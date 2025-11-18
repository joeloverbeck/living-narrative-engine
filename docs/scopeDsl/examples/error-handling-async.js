/**
 * @file Async operation error handling for ScopeDSL resolvers
 * @description Demonstrates error handling patterns for asynchronous operations
 */

import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Example async resolver with comprehensive error handling
 *
 * This resolver demonstrates how to properly handle errors in async operations,
 * including promises, async/await, and parallel async operations.
 *
 * @param root0
 * @param root0.logger
 * @param root0.errorHandler
 * @param root0.dataFetcher
 * @param root0.cache
 */
export default function createAsyncResolver({
  logger,
  errorHandler,
  dataFetcher,
  cache,
}) {
  // Validate dependencies
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  validateDependency(dataFetcher, 'IDataFetcher', logger, {
    requiredMethods: ['fetch', 'fetchBatch'],
  });

  if (cache) {
    validateDependency(cache, 'ICache', logger, {
      requiredMethods: ['get', 'set', 'has'],
    });
  }

  /**
   * Fetch data with proper error handling
   *
   * @param id
   * @param ctx
   */
  async function fetchWithErrorHandling(id, ctx) {
    const startTime = Date.now();

    try {
      // Check cache first
      if (cache && cache.has(id)) {
        return cache.get(id);
      }

      // Fetch with timeout
      const timeoutMs = 5000;
      const fetchPromise = dataFetcher.fetch(id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);

      // Cache successful result
      if (cache) {
        cache.set(id, result);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Determine specific error code based on error type
      let errorCode = ErrorCodes.RESOLUTION_FAILED_GENERIC;

      if (error.message === 'Fetch timeout') {
        errorCode = ErrorCodes.TIMEOUT;
      } else if (error.code === 'ECONNREFUSED') {
        errorCode = ErrorCodes.CONNECTION_FAILED;
      } else if (error.code === 'ENOTFOUND') {
        errorCode = ErrorCodes.SERVICE_NOT_FOUND;
      }

      if (errorHandler) {
        errorHandler.handleError(
          `Failed to fetch data for ${id}: ${error.message}`,
          { id, duration, ...ctx },
          'AsyncResolver',
          errorCode
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Parallel fetch with error handling for multiple items
   *
   * @param ids
   * @param ctx
   */
  async function fetchMultiple(ids, ctx) {
    const results = [];
    const errors = [];

    // Create promises for all fetches
    const promises = ids.map(async (id) => {
      try {
        const result = await fetchWithErrorHandling(id, ctx);
        return { id, result, success: true };
      } catch (error) {
        // Collect errors but don't fail entire batch
        errors.push({ id, error });
        return { id, error, success: false };
      }
    });

    // Wait for all to complete (success or failure)
    const outcomes = await Promise.allSettled(promises);

    // Process outcomes
    outcomes.forEach((outcome) => {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.success) {
          results.push(outcome.value);
        }
      } else {
        errors.push({
          id: 'unknown',
          error: outcome.reason,
        });
      }
    });

    // Handle partial failure scenario
    if (errors.length > 0) {
      const errorMessage = `Partial fetch failure: ${errors.length} of ${ids.length} failed`;

      if (errorHandler) {
        // Log warning but don't throw if we have some results
        if (results.length > 0) {
          logger.warn(errorMessage, { errors, results: results.length });
        } else {
          // Complete failure - throw error
          errorHandler.handleError(
            errorMessage,
            { errors, ids, ...ctx },
            'AsyncResolver',
            ErrorCodes.BATCH_OPERATION_FAILED
          );
        }
      } else if (results.length === 0) {
        throw new Error(errorMessage);
      }
    }

    return results;
  }

  /**
   * Retry logic with exponential backoff
   *
   * @param id
   * @param ctx
   * @param maxRetries
   */
  async function fetchWithRetry(id, ctx, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchWithErrorHandling(id, ctx);
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (
          error.code === ErrorCodes.INVALID_DATA_GENERIC ||
          error.code === ErrorCodes.MISSING_CONTEXT_GENERIC
        ) {
          throw error; // Re-throw immediately for non-retriable errors
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms...
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000);
          logger.debug(`Retry attempt ${attempt} after ${delay}ms for ${id}`);

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    if (errorHandler) {
      errorHandler.handleError(
        `Failed after ${maxRetries} retries: ${lastError.message}`,
        { id, attempts: maxRetries, ...ctx },
        'AsyncResolver',
        ErrorCodes.MAX_RETRIES_EXCEEDED
      );
    } else {
      throw lastError;
    }
  }

  /**
   * Stream processing with error handling
   *
   * @param items
   * @param ctx
   */
  async function* processStream(items, ctx) {
    for (const item of items) {
      try {
        const processed = await processItem(item, ctx);
        yield { success: true, item: processed };
      } catch (error) {
        // Yield error but continue processing
        yield {
          success: false,
          item,
          error: error.message,
        };

        // Log error but don't stop stream
        logger.warn(`Stream processing error for item ${item.id}`, error);
      }
    }
  }

  /**
   * Process single item
   *
   * @param item
   * @param ctx
   */
  async function processItem(item, ctx) {
    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (!item || !item.id) {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid item structure',
          { item, ...ctx },
          'AsyncResolver',
          ErrorCodes.INVALID_DATA_GENERIC
        );
      } else {
        throw new Error('Invalid item structure');
      }
    }

    return {
      ...item,
      processed: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Queue-based async processing with error handling
   */
  class AsyncQueue {
    constructor(concurrency = 3) {
      this.concurrency = concurrency;
      this.running = 0;
      this.queue = [];
    }

    async add(task, ctx) {
      return new Promise((resolve, reject) => {
        this.queue.push({ task, ctx, resolve, reject });
        this.process();
      });
    }

    async process() {
      if (this.running >= this.concurrency || this.queue.length === 0) {
        return;
      }

      this.running++;
      const { task, ctx, resolve, reject } = this.queue.shift();

      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        if (errorHandler) {
          try {
            errorHandler.handleError(
              error,
              ctx,
              'AsyncQueue',
              ErrorCodes.QUEUE_PROCESSING_FAILED
            );
          } catch (handledError) {
            reject(handledError);
          }
        } else {
          reject(error);
        }
      } finally {
        this.running--;
        this.process(); // Process next item in queue
      }
    }
  }

  // Create shared queue instance
  const queue = new AsyncQueue(3);

  return {
    canResolve(node) {
      return node.type === 'async';
    },

    async resolve(node, ctx) {
      // Track async context
      const asyncCtx = {
        ...ctx,
        async: true,
        startTime: Date.now(),
      };

      try {
        // Different async patterns based on node subtype
        switch (node.subtype) {
          case 'single':
            return await fetchWithRetry(node.id, asyncCtx);

          case 'batch':
            return await fetchMultiple(node.ids, asyncCtx);

          case 'stream':
            const results = [];
            for await (const result of processStream(node.items, asyncCtx)) {
              results.push(result);
            }
            return results;

          case 'queued':
            return await queue.add(
              () => fetchWithErrorHandling(node.id, asyncCtx),
              asyncCtx
            );

          default:
            if (errorHandler) {
              errorHandler.handleError(
                `Unknown async subtype: ${node.subtype}`,
                asyncCtx,
                'AsyncResolver',
                ErrorCodes.INVALID_NODE_TYPE
              );
            } else {
              throw new Error(`Unknown async subtype: ${node.subtype}`);
            }
        }
      } catch (error) {
        const duration = Date.now() - asyncCtx.startTime;

        // Add timing information to error context
        if (errorHandler) {
          errorHandler.handleError(
            error,
            { ...asyncCtx, duration },
            'AsyncResolver',
            error.code || ErrorCodes.ASYNC_OPERATION_FAILED
          );
        } else {
          throw error;
        }
      }
    },
  };
}

/**
 * Helper: Create cancellable async operation
 *
 * @param asyncFn
 * @param errorHandler
 */
export function createCancellableOperation(asyncFn, errorHandler) {
  let cancelled = false;

  const promise = new Promise(async (resolve, reject) => {
    try {
      const result = await asyncFn(() => cancelled);
      if (!cancelled) {
        resolve(result);
      } else {
        reject(new Error('Operation cancelled'));
      }
    } catch (error) {
      if (!cancelled) {
        if (errorHandler) {
          errorHandler.handleError(
            error,
            { cancelled },
            'CancellableOperation',
            ErrorCodes.ASYNC_OPERATION_FAILED
          );
        } else {
          reject(error);
        }
      }
    }
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

/**
 * Helper: Async operation with progress reporting
 *
 * @param asyncFn
 * @param onProgress
 * @param errorHandler
 * @param ctx
 */
export async function withProgress(asyncFn, onProgress, errorHandler, ctx) {
  try {
    let progressCount = 0;

    const progressReporter = (current, total) => {
      progressCount++;
      onProgress({ current, total, count: progressCount });
    };

    return await asyncFn(progressReporter);
  } catch (error) {
    if (errorHandler) {
      errorHandler.handleError(
        error,
        { ...ctx, operation: 'withProgress' },
        'ProgressOperation',
        ErrorCodes.ASYNC_OPERATION_FAILED
      );
    } else {
      throw error;
    }
  }
}
