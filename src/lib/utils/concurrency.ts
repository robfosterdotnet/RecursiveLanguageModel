/**
 * Concurrency utilities for parallel processing with controlled throughput.
 *
 * The pool pattern keeps a constant number of tasks in flight at all times,
 * immediately starting a new task as soon as one completes. This is more
 * efficient than batch processing which waits for all tasks in a batch
 * to complete before starting the next batch.
 */

export type PoolTask<T, R> = {
  item: T;
  process: (item: T) => Promise<R>;
};

export type PoolResult<T, R> = {
  item: T;
  result: R;
  index: number;
};

export type PoolOptions = {
  concurrency: number;
  onProgress?: (completed: number, total: number, result: unknown) => void;
};

/**
 * Process items with a concurrent worker pool.
 *
 * Unlike batch processing which waits for all items in a batch to complete,
 * this keeps exactly `concurrency` requests in flight at all times.
 *
 * Performance comparison for 24 items with concurrency 6:
 * - Batch: Processes 6, waits for ALL 6, then next 6... (4 sync points)
 * - Pool: Always keeps 6 in flight, starts new one immediately when any completes
 *
 * If requests take variable time (2-10 seconds), pool can be 30-50% faster.
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
  let completed = 0;
  let nextIndex = 0;

  // Create a pool of workers
  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const item = items[currentIndex];
      const result = await processor(item, currentIndex);

      results.push({ item, result, index: currentIndex });
      completed += 1;

      if (onProgress) {
        onProgress(completed, items.length, result);
      }
    }
  };

  // Start `concurrency` workers in parallel
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    runWorker()
  );

  await Promise.all(workers);

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

  // Use a queue to yield results in completion order
  const resultQueue: PoolResult<T, R>[] = [];
  let resolveNext: ((value: PoolResult<T, R> | null) => void) | null = null;
  let completed = 0;
  let nextIndex = 0;

  const pushResult = (result: PoolResult<T, R>) => {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve(result);
    } else {
      resultQueue.push(result);
    }
  };

  const getNext = (): Promise<PoolResult<T, R> | null> => {
    if (resultQueue.length > 0) {
      return Promise.resolve(resultQueue.shift()!);
    }
    if (completed >= items.length) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  };

  // Start workers
  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const item = items[currentIndex];
      const result = await processor(item, currentIndex);

      completed += 1;
      pushResult({ item, result, index: currentIndex });
    }
  };

  // Start workers in background
  const workersPromise = Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );

  // Yield results as they complete
  while (completed < items.length || resultQueue.length > 0) {
    const result = await getNext();
    if (result === null) break;
    yield result;
  }

  await workersPromise;
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
