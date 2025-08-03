/**
 * @file batchOperationUtils - Utility functions for batch operations
 * @module batchOperationUtils
 */

import { validateBatchSize } from './configUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * @typedef {object} BatchProcessingOptions
 * @property {number} [batchSize=50] - Size of each batch
 * @property {boolean} [stopOnError=false] - Stop processing on first error
 * @property {boolean} [enableParallel=false] - Enable parallel processing
 * @property {number} [maxConcurrency=5] - Maximum concurrent operations
 * @property {Function} [onProgress] - Progress callback
 */

/**
 * @typedef {object} BatchResult
 * @property {Array} successes - Successfully processed items
 * @property {Array} failures - Failed items with errors
 * @property {number} totalProcessed - Total items processed
 * @property {number} successCount - Number of successful operations
 * @property {number} failureCount - Number of failed operations
 * @property {number} processingTime - Processing time in milliseconds
 */

/**
 * Processes an array of items in batches.
 *
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {BatchProcessingOptions} [options] - Processing options
 * @returns {Promise<BatchResult>} Processing results
 */
export async function processBatch(items, processor, options = {}) {
  const {
    batchSize = 50,
    stopOnError = false,
    enableParallel = false,
    maxConcurrency = 5,
    onProgress = null,
  } = options;

  validateBatchProcessingOptions(options);

  if (!Array.isArray(items)) {
    throw new InvalidArgumentError('Items must be an array');
  }

  if (typeof processor !== 'function') {
    throw new InvalidArgumentError('Processor must be a function');
  }

  const startTime = performance.now();
  const result = {
    successes: [],
    failures: [],
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    processingTime: 0,
  };

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    try {
      const batchResult = enableParallel
        ? await processParallelBatch(batch, processor, maxConcurrency)
        : await processSequentialBatch(batch, processor);

      result.successes.push(...batchResult.successes);
      result.failures.push(...batchResult.failures);
      result.totalProcessed += batchResult.totalProcessed;
      result.successCount += batchResult.successCount;
      result.failureCount += batchResult.failureCount;

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          batchIndex: Math.floor(i / batchSize),
          totalBatches: Math.ceil(items.length / batchSize),
          processedItems: result.totalProcessed,
          totalItems: items.length,
          successes: result.successCount,
          failures: result.failureCount,
        });
      }

      if (stopOnError && batchResult.failureCount > 0) {
        break;
      }
    } catch (error) {
      if (stopOnError) {
        throw error;
      }

      // Mark entire batch as failed
      for (const item of batch) {
        result.failures.push({ item, error });
        result.failureCount++;
        result.totalProcessed++;
      }
    }
  }

  result.processingTime = performance.now() - startTime;
  return result;
}

/**
 * Processes a batch of items sequentially.
 *
 * @param {Array} batch - Items to process
 * @param {Function} processor - Processing function
 * @returns {Promise<BatchResult>} Processing results
 */
export async function processSequentialBatch(batch, processor) {
  const result = {
    successes: [],
    failures: [],
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    processingTime: 0,
  };

  for (const item of batch) {
    result.totalProcessed++;

    try {
      const processResult = await processor(item);
      result.successes.push(processResult);
      result.successCount++;
    } catch (error) {
      result.failures.push({ item, error });
      result.failureCount++;
    }
  }

  return result;
}

/**
 * Processes a batch of items in parallel with concurrency control.
 *
 * @param {Array} batch - Items to process
 * @param {Function} processor - Processing function
 * @param {number} maxConcurrency - Maximum concurrent operations
 * @returns {Promise<BatchResult>} Processing results
 */
export async function processParallelBatch(
  batch,
  processor,
  maxConcurrency = 5
) {
  const result = {
    successes: [],
    failures: [],
    totalProcessed: batch.length,
    successCount: 0,
    failureCount: 0,
    processingTime: 0,
  };

  // Process with concurrency control
  const results = await processWithConcurrency(
    batch,
    processor,
    maxConcurrency
  );

  for (const itemResult of results) {
    if (itemResult.success) {
      result.successes.push(itemResult.result);
      result.successCount++;
    } else {
      result.failures.push({ item: itemResult.item, error: itemResult.error });
      result.failureCount++;
    }
  }

  return result;
}

/**
 * Processes items with concurrency control.
 *
 * @param {Array} items - Items to process
 * @param {Function} processor - Processing function
 * @param {number} maxConcurrency - Maximum concurrent operations
 * @returns {Promise<Array>} Processing results
 */
export async function processWithConcurrency(items, processor, maxConcurrency) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const promise = processor(item)
      .then((result) => ({ success: true, result, item }))
      .catch((error) => ({ success: false, error, item }));

    results.push(promise);

    if (results.length >= maxConcurrency) {
      executing.push(promise);
    }

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  return Promise.all(results);
}


/**
 * Validates batch processing options.
 *
 * @param {BatchProcessingOptions} options - Options to validate
 * @throws {InvalidArgumentError} If options are invalid
 */
export function validateBatchProcessingOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new InvalidArgumentError('Options must be an object');
  }

  if (options.batchSize !== undefined) {
    validateBatchSize(options.batchSize);
  }

  if (options.maxConcurrency !== undefined) {
    if (
      typeof options.maxConcurrency !== 'number' ||
      options.maxConcurrency <= 0
    ) {
      throw new InvalidArgumentError(
        'maxConcurrency must be a positive number'
      );
    }
  }

  if (
    options.onProgress !== undefined &&
    typeof options.onProgress !== 'function'
  ) {
    throw new InvalidArgumentError('onProgress must be a function');
  }
}
