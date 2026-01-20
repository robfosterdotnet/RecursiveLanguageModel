/**
 * Concurrency utilities for parallel processing with controlled throughput.
 *
 * The pool pattern keeps a constant number of tasks in flight at all times,
 * immediately starting a new task as soon as one completes. This is more
 * efficient than batch processing which waits for all tasks in a batch
 * to complete before starting the next batch.
 */

export type PoolResult<T, R> = {
  item: T;
  result: R;
  index: number;
};

export type PoolOptions = {
  concurrency: number;
  onProgress?: (completed: number, total: number) => void;
};

/**
 * Process items with a concurrent worker pool using Promise.race pattern.
 *
 * This implementation uses a proven pattern that guarantees true parallelism:
 * 1. Start `concurrency` promises immediately
 * 2. Use Promise.race to detect when ANY promise completes
 * 3. Immediately start the next item when one completes
 * 4. Always maintain exactly `concurrency` promises in flight
 *
 * @example
 * ```typescript
 * const results = await processWithPool(
 *   chunks,
 *   async (chunk) => await analyzeChunk(chunk),
 *   {
 *     concurrency: 6,
 *     onProgress: (done, total) => console.log(`${done}/${total}`)
 *   }
 * );
 * ```
 */
export async function processWithPool<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: PoolOptions
): Promise<PoolResult<T, R>[]> {
  const { concurrency, onProgress } = options;
  const results: PoolResult<T, R>[] = [];

  if (items.length === 0) {
    return results;
  }

  // Track in-flight promises with their indices
  const inFlight = new Map<
    Promise<{ index: number; result: R }>,
    number
  >();

  let nextIndex = 0;
  let completed = 0;

  // Helper to start processing an item
  const startNext = (): void => {
    if (nextIndex >= items.length) return;

    const currentIndex = nextIndex;
    nextIndex += 1;

    const promise = processor(items[currentIndex], currentIndex).then(
      (result) => ({ index: currentIndex, result })
    );

    inFlight.set(promise, currentIndex);
  };

  // Start initial batch of concurrent requests
  const initialBatch = Math.min(concurrency, items.length);
  for (let i = 0; i < initialBatch; i++) {
    startNext();
  }

  // Process until all items are done
  while (inFlight.size > 0) {
    // Wait for ANY promise to complete
    const completedPromise = await Promise.race(inFlight.keys());
    const { index, result } = await completedPromise;

    // Remove from in-flight tracking
    inFlight.delete(completedPromise);

    // Store result
    results.push({ item: items[index], result, index });
    completed += 1;

    // Report progress
    if (onProgress) {
      onProgress(completed, items.length);
    }

    // Start next item if any remain
    startNext();
  }

  // Sort results by original index to maintain order
  results.sort((a, b) => a.index - b.index);

  return results;
}

/**
 * Process items with a concurrent pool, yielding results as they complete.
 *
 * This is useful for streaming scenarios where you want to process
 * results as soon as they're available rather than waiting for all to complete.
 *
 * @example
 * ```typescript
 * for await (const { item, result } of streamWithPool(chunks, processChunk, { concurrency: 6 })) {
 *   console.log(`Processed: ${item.id}`);
 * }
 * ```
 */
export async function* streamWithPool<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: Omit<PoolOptions, "onProgress">
): AsyncGenerator<PoolResult<T, R>> {
  const { concurrency } = options;

  if (items.length === 0) {
    return;
  }

  // Track in-flight promises with their indices
  const inFlight = new Map<
    Promise<{ index: number; result: R }>,
    number
  >();

  let nextIndex = 0;

  // Helper to start processing an item
  const startNext = (): void => {
    if (nextIndex >= items.length) return;

    const currentIndex = nextIndex;
    nextIndex += 1;

    const promise = processor(items[currentIndex], currentIndex).then(
      (result) => ({ index: currentIndex, result })
    );

    inFlight.set(promise, currentIndex);
  };

  // Start initial batch of concurrent requests
  const initialBatch = Math.min(concurrency, items.length);
  for (let i = 0; i < initialBatch; i++) {
    startNext();
  }

  // Process until all items are done
  while (inFlight.size > 0) {
    // Wait for ANY promise to complete
    const completedPromise = await Promise.race(inFlight.keys());
    const { index, result } = await completedPromise;

    // Remove from in-flight tracking
    inFlight.delete(completedPromise);

    // Yield result immediately
    yield { item: items[index], result, index };

    // Start next item if any remain
    startNext();
  }
}

/**
 * Measure the performance improvement of pool vs batch processing.
 * Useful for benchmarking and logging.
 */
export function estimatePoolSpeedup(
  itemCount: number,
  concurrency: number,
  avgTimeMs: number,
  timeVarianceMs: number
): { batchTimeMs: number; poolTimeMs: number; speedup: string } {
  // Batch: ceil(items/concurrency) batches, each takes max time in batch
  const batchCount = Math.ceil(itemCount / concurrency);
  const batchTimeMs = batchCount * (avgTimeMs + timeVarianceMs);

  // Pool: total work / concurrency (no waiting for slow items)
  const poolTimeMs = (itemCount * avgTimeMs) / concurrency;

  const speedup = ((batchTimeMs - poolTimeMs) / batchTimeMs) * 100;

  return {
    batchTimeMs,
    poolTimeMs,
    speedup: `${speedup.toFixed(0)}% faster`,
  };
}
