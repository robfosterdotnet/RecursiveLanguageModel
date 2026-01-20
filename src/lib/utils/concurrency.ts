/**
 * Concurrency utilities for parallel processing with controlled throughput.
 */

export type PoolResult<T, R> = {
  item: T;
  result: R;
  index: number;
};

export type PoolOptions = {
  concurrency: number;
  onProgress?: (completed: number, total: number) => void;
  onStart?: (index: number, total: number) => void;
};

/**
 * Process items with a concurrent worker pool using a semaphore pattern.
 *
 * This implementation uses a simple and robust approach:
 * 1. Create N worker "slots" that run independently
 * 2. Each worker pulls the next item from a shared queue
 * 3. Workers run until the queue is empty
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
  const { concurrency, onProgress, onStart } = options;
  const results: PoolResult<T, R>[] = [];

  if (items.length === 0) {
    return results;
  }

  // Shared state for workers
  let nextIndex = 0;
  let completed = 0;
  const totalItems = items.length;

  // Worker function - each worker independently pulls from the queue
  const worker = async (): Promise<void> => {
    while (true) {
      // Atomically get the next index
      const currentIndex = nextIndex;
      if (currentIndex >= totalItems) {
        break; // No more work
      }
      nextIndex += 1;

      // Notify start
      if (onStart) {
        onStart(currentIndex, totalItems);
      }

      // Process the item
      const item = items[currentIndex];
      const result = await processor(item, currentIndex);

      // Store result
      results.push({ item, result, index: currentIndex });

      // Update progress
      completed += 1;
      if (onProgress) {
        onProgress(completed, totalItems);
      }
    }
  };

  // Start N workers in parallel
  const numWorkers = Math.min(concurrency, items.length);
  const workers: Promise<void>[] = [];

  for (let i = 0; i < numWorkers; i++) {
    workers.push(worker());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  // Sort results by original index to maintain order
  results.sort((a, b) => a.index - b.index);

  return results;
}

/**
 * Process items with a concurrent pool, yielding results as they complete.
 */
export async function* streamWithPool<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: Omit<PoolOptions, "onProgress" | "onStart">
): AsyncGenerator<PoolResult<T, R>> {
  const { concurrency } = options;

  if (items.length === 0) {
    return;
  }

  // Use a queue to collect results
  const resultQueue: PoolResult<T, R>[] = [];
  let resolveWaiting: (() => void) | null = null;
  let allDone = false;

  // Shared state for workers
  let nextIndex = 0;
  let completed = 0;
  const totalItems = items.length;

  const pushResult = (result: PoolResult<T, R>) => {
    resultQueue.push(result);
    if (resolveWaiting) {
      const resolve = resolveWaiting;
      resolveWaiting = null;
      resolve();
    }
  };

  // Worker function
  const worker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= totalItems) {
        break;
      }
      nextIndex += 1;

      const item = items[currentIndex];
      const result = await processor(item, currentIndex);

      completed += 1;
      pushResult({ item, result, index: currentIndex });
    }
  };

  // Start workers
  const numWorkers = Math.min(concurrency, items.length);
  const workersPromise = Promise.all(
    Array.from({ length: numWorkers }, () => worker())
  ).then(() => {
    allDone = true;
    if (resolveWaiting) {
      resolveWaiting();
    }
  });

  // Yield results as they come in
  while (!allDone || resultQueue.length > 0) {
    if (resultQueue.length > 0) {
      yield resultQueue.shift()!;
    } else if (!allDone) {
      await new Promise<void>((resolve) => {
        resolveWaiting = resolve;
      });
    }
  }

  await workersPromise;
}
