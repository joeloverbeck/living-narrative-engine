/**
 * @file Performance-optimized error handling for ScopeDSL resolvers
 * @description Demonstrates performance optimization techniques for error handling
 */

import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Performance-optimized resolver with efficient error handling
 *
 * This resolver demonstrates techniques to minimize error handling overhead
 * while maintaining comprehensive error reporting.
 *
 * @param root0
 * @param root0.logger
 * @param root0.errorHandler
 * @param root0.metricsCollector
 */
export default function createPerformanceResolver({
  logger,
  errorHandler,
  metricsCollector,
}) {
  // Validate dependencies
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer', 'clearErrorBuffer'],
    });
  }

  if (metricsCollector) {
    validateDependency(metricsCollector, 'IMetricsCollector', logger, {
      requiredMethods: ['recordMetric', 'getMetrics'],
    });
  }

  // Pre-compile error code lookup map for O(1) access
  const ERROR_CODE_MAP = new Map([
    ['missing', ErrorCodes.MISSING_CONTEXT_GENERIC],
    ['invalid', ErrorCodes.INVALID_DATA_GENERIC],
    ['failed', ErrorCodes.RESOLUTION_FAILED_GENERIC],
    ['timeout', ErrorCodes.TIMEOUT],
    ['depth', ErrorCodes.MAX_DEPTH_EXCEEDED],
    ['cycle', ErrorCodes.CYCLE_DETECTED],
    ['parse', ErrorCodes.PARSE_ERROR],
  ]);

  // Cache for frequently accessed error messages
  const ERROR_MESSAGE_CACHE = new Map();
  const MAX_CACHE_SIZE = 100;

  /**
   * Get error code with optimized lookup
   *
   * @param message
   */
  function getErrorCode(message) {
    const lowerMessage = message.toLowerCase();

    // Fast path: exact match in cache
    for (const [keyword, code] of ERROR_CODE_MAP) {
      if (lowerMessage.includes(keyword)) {
        return code;
      }
    }

    return ErrorCodes.UNKNOWN_ERROR;
  }

  /**
   * Create minimal context for production
   *
   * @param ctx
   * @param includeFields
   */
  function createMinimalContext(ctx, includeFields = []) {
    const minimal = {};

    // Only include specified fields
    for (const field of includeFields) {
      if (ctx[field] !== undefined) {
        // Use primitive values when possible
        if (typeof ctx[field] === 'object' && ctx[field]?.id) {
          minimal[field + 'Id'] = ctx[field].id;
        } else if (typeof ctx[field] !== 'object') {
          minimal[field] = ctx[field];
        }
      }
    }

    return minimal;
  }

  /**
   * Lightweight error handling for hot paths
   *
   * @param message
   * @param ctx
   * @param resolverName
   * @param errorCode
   */
  function handleErrorFast(message, ctx, resolverName, errorCode) {
    // Skip expensive operations in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment) {
      // Minimal context in production
      const minimalCtx = createMinimalContext(ctx, ['depth', 'actorEntity']);

      if (errorHandler) {
        errorHandler.handleError(message, minimalCtx, resolverName, errorCode);
      } else {
        throw new Error(message);
      }
    } else {
      // Full context in development
      if (errorHandler) {
        errorHandler.handleError(message, ctx, resolverName, errorCode);
      } else {
        throw new Error(message);
      }
    }
  }

  /**
   * Batch error processing for high-volume scenarios
   */
  class BatchErrorProcessor {
    constructor(errorHandler, flushInterval = 1000) {
      this.errorHandler = errorHandler;
      this.errors = [];
      this.flushInterval = flushInterval;
      this.timer = null;
    }

    add(error) {
      this.errors.push(error);

      // Auto-flush on size threshold
      if (this.errors.length >= 10) {
        this.flush();
      } else if (!this.timer) {
        // Schedule flush
        this.timer = setTimeout(() => this.flush(), this.flushInterval);
      }
    }

    flush() {
      if (this.errors.length === 0) return;

      // Process errors in batch
      const errorSummary = this.summarizeErrors(this.errors);

      if (this.errorHandler) {
        // Report summary instead of individual errors
        this.errorHandler.handleError(
          `Batch error summary: ${errorSummary.message}`,
          { count: this.errors.length, codes: errorSummary.codes },
          'BatchProcessor',
          ErrorCodes.BATCH_ERROR_SUMMARY
        );
      }

      this.errors = [];
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    summarizeErrors(errors) {
      const codes = new Map();

      for (const error of errors) {
        const code = error.code || 'UNKNOWN';
        codes.set(code, (codes.get(code) || 0) + 1);
      }

      return {
        message: `${errors.length} errors occurred`,
        codes: Object.fromEntries(codes),
      };
    }
  }

  const batchProcessor = new BatchErrorProcessor(errorHandler);

  /**
   * Circuit breaker for failing operations
   */
  class CircuitBreaker {
    constructor(threshold = 5, resetTime = 60000) {
      this.threshold = threshold;
      this.resetTime = resetTime;
      this.failures = 0;
      this.lastFailureTime = null;
      this.state = 'closed'; // closed, open, half-open
    }

    canExecute() {
      if (this.state === 'closed') {
        return true;
      }

      if (this.state === 'open') {
        const timeSinceFailure = Date.now() - this.lastFailureTime;
        if (timeSinceFailure > this.resetTime) {
          this.state = 'half-open';
          return true;
        }
        return false;
      }

      return true; // half-open - allow one attempt
    }

    recordSuccess() {
      this.failures = 0;
      this.state = 'closed';
    }

    recordFailure() {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
    }
  }

  const circuitBreakers = new Map();

  /**
   * Get or create circuit breaker for operation
   *
   * @param operation
   */
  function getCircuitBreaker(operation) {
    if (!circuitBreakers.has(operation)) {
      circuitBreakers.set(operation, new CircuitBreaker());
    }
    return circuitBreakers.get(operation);
  }

  /**
   * Memoized validation with LRU cache
   */
  class LRUCache {
    constructor(maxSize = 100) {
      this.maxSize = maxSize;
      this.cache = new Map();
    }

    get(key) {
      if (!this.cache.has(key)) {
        return undefined;
      }

      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    set(key, value) {
      // Remove oldest if at capacity
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      // Remove and re-add to move to end
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    clear() {
      this.cache.clear();
    }
  }

  const validationCache = new LRUCache(50);

  /**
   * Cached validation
   *
   * @param value
   * @param validatorKey
   * @param validator
   */
  function validateWithCache(value, validatorKey, validator) {
    const cacheKey = `${validatorKey}:${JSON.stringify(value)}`;

    // Check cache first
    const cached = validationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Perform validation
    try {
      const result = validator(value);
      validationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      validationCache.set(cacheKey, { error: error.message });
      throw error;
    }
  }

  /**
   * Optimized depth check with early exit
   */
  const MAX_DEPTH = 10;
  /**
   *
   * @param ctx
   */
  function checkDepth(ctx) {
    const depth = ctx.depth || 0;

    // Fast path: most common case
    if (depth <= MAX_DEPTH) {
      return true;
    }

    // Only throw error when actually exceeded
    handleErrorFast(
      `Depth ${depth} exceeds maximum ${MAX_DEPTH}`,
      ctx,
      'PerformanceResolver',
      ErrorCodes.MAX_DEPTH_EXCEEDED
    );
  }

  /**
   * Error sampling for high-volume scenarios
   */
  class ErrorSampler {
    constructor(sampleRate = 0.1) {
      this.sampleRate = sampleRate;
      this.skippedCount = 0;
    }

    shouldSample() {
      return Math.random() < this.sampleRate;
    }

    handleError(error, ctx, resolver) {
      // If error is already a ScopeDslError, just re-throw it to avoid double processing
      if (error.name === 'ScopeDslError') {
        throw error;
      }

      if (this.shouldSample()) {
        if (errorHandler) {
          // Include skipped count in context
          const sampledCtx = {
            ...ctx,
            skippedErrors: this.skippedCount,
          };

          errorHandler.handleError(
            error,
            sampledCtx,
            resolver,
            getErrorCode(error.message || error)
          );

          this.skippedCount = 0;
        } else {
          throw error;
        }
      } else {
        this.skippedCount++;
        // Log minimal info for skipped errors
        logger.debug(`Skipped error: ${error.message || error}`);
      }
    }
  }

  const errorSampler = new ErrorSampler(0.1); // Sample 10% of errors

  /**
   * Performance metrics tracking
   *
   * @param operation
   * @param fn
   */
  function trackPerformance(operation, fn) {
    return function tracked(...args) {
      const start = performance.now();
      let success = false;

      try {
        const result = fn(...args);
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const duration = performance.now() - start;

        if (metricsCollector) {
          metricsCollector.recordMetric({
            operation,
            duration,
            success,
            timestamp: Date.now(),
          });
        }

        // Warn on slow operations
        if (duration > 100) {
          logger.warn(`Slow operation: ${operation} took ${duration}ms`);
        }
      }
    };
  }

  return {
    canResolve(node) {
      return node.type === 'performance';
    },

    resolve: trackPerformance('resolve', function (node, ctx) {
      // Check circuit breaker first
      const breaker = getCircuitBreaker('resolve');
      if (!breaker.canExecute()) {
        handleErrorFast(
          'Circuit breaker open - operation failing',
          ctx,
          'PerformanceResolver',
          ErrorCodes.CIRCUIT_BREAKER_OPEN
        );
      }

      try {
        // Fast depth check
        checkDepth(ctx);

        // Cached validation
        const isValid = validateWithCache(
          node,
          'node-structure',
          (n) => n && n.type && n.id
        );

        if (!isValid) {
          handleErrorFast(
            'Invalid node structure',
            ctx,
            'PerformanceResolver',
            ErrorCodes.INVALID_NODE_STRUCTURE
          );
        }

        // Simulate processing
        const result = {
          id: node.id,
          type: node.type,
          processed: true,
        };

        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();

        // If error is already a ScopeDslError, just re-throw it to avoid double processing
        if (error.name === 'ScopeDslError') {
          throw error;
        }

        // Use error sampling in high-volume mode
        if (node.highVolume) {
          errorSampler.handleError(error, ctx, 'PerformanceResolver');
        } else {
          // Normal error handling for non-ScopeDslErrors
          if (errorHandler) {
            errorHandler.handleError(
              error,
              ctx,
              'PerformanceResolver',
              getErrorCode(error.message)
            );
          } else {
            throw error;
          }
        }
      }
    }),

    // Buffer management methods
    manageErrorBuffer() {
      const buffer = errorHandler.getErrorBuffer();

      // Clear buffer if at or above threshold
      if (buffer.length >= 50) {
        // Optionally process before clearing
        const summary = this.summarizeBuffer(buffer);
        logger.info('Error buffer summary before clear', summary);

        errorHandler.clearErrorBuffer();
      }
    },

    summarizeBuffer(buffer) {
      const summary = {
        total: buffer.length,
        byCode: {},
        byResolver: {},
      };

      for (const error of buffer) {
        summary.byCode[error.code] = (summary.byCode[error.code] || 0) + 1;
        summary.byResolver[error.resolver] =
          (summary.byResolver[error.resolver] || 0) + 1;
      }

      return summary;
    },

    // Cleanup method
    cleanup() {
      batchProcessor.flush();
      validationCache.clear();
      circuitBreakers.clear();
    },
  };
}

/**
 * Create optimized error handler for production
 *
 * @param logger
 */
export function createProductionErrorHandler(logger) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'handleError') {
          return (message, context, resolver, code) => {
            // Minimal logging in production
            logger.error(`[${resolver}] ${code || 'ERROR'}: ${message}`);

            // Throw minimal error
            const error = new Error(message);
            error.code = code;
            throw error;
          };
        }

        if (prop === 'getErrorBuffer') {
          return () => []; // No buffering in production
        }

        if (prop === 'clearErrorBuffer') {
          return () => {}; // No-op
        }

        return undefined;
      },
    }
  );
}
