/**
 * @file Utilities for parallel execution
 * Provides controlled parallel processing with concurrency limits
 */

/**
 * Execute tasks in parallel with concurrency limit
 *
 * @param {Array<Function>} tasks - Array of async functions
 * @param {number} concurrency - Max concurrent tasks
 * @returns {Promise<Array>} Results with {status, value/reason}
 */
async function parallelLimit(tasks, concurrency) {
  const results = [];
  const executing = new Set();

  for (const [index, task] of tasks.entries()) {
    const promise = (async () => {
      try {
        const value = await task();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    })().finally(() => executing.delete(promise));

    executing.add(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Execute tasks in batches
 *
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} batchSize - Items per batch
 * @returns {Promise<Array>} All results
 */
async function batchProcess(items, processor, batchSize) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processor(item))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Execute with timeout
 *
 * @param {Promise} promise - Promise to execute
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} [message] - Timeout error message
 * @returns {Promise} Result or timeout error
 */
async function withTimeout(promise, timeout, message = 'Operation timed out') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeout);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry operation with exponential backoff
 *
 * @param {Function} operation - Async operation to retry
 * @param {object} options - Retry options
 * @param {number} [options.maxRetries] - Maximum retry attempts
 * @param {number} [options.initialDelay] - Initial delay in ms
 * @param {number} [options.maxDelay] - Maximum delay in ms
 * @param {number} [options.factor] - Backoff factor
 * @returns {Promise} Operation result
 */
async function retryWithBackoff(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Create a semaphore for resource limiting
 *
 * @param {number} max - Maximum concurrent operations
 * @returns {object} Semaphore with acquire/release methods
 */
function createSemaphore(max) {
  let current = 0;
  const waiting = [];

  return {
    async acquire() {
      if (current < max) {
        current++;
        return;
      }

      await new Promise((resolve) => waiting.push(resolve));
    },

    release() {
      current--;
      const next = waiting.shift();
      if (next) {
        current++;
        next();
      }
    },
  };
}

module.exports = {
  parallelLimit,
  batchProcess,
  withTimeout,
  retryWithBackoff,
  createSemaphore,
};
