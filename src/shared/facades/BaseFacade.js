/**
 * @file Base facade abstract class providing common functionality for all facade implementations
 * @description Provides resilience patterns, caching, event dispatching, and logging utilities
 * @see src/clothing/facades/IClothingSystemFacade.js
 * @see src/anatomy/facades/IAnatomySystemFacade.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('../../cache/UnifiedCache.js').UnifiedCache} IUnifiedCache */

/**
 * Abstract base class for all facade implementations
 * Provides common functionality including resilience patterns, caching, and event handling
 */
class BaseFacade {
  #logger;
  #eventBus;
  #cache;
  #circuitBreaker;

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger service
   * @param {IEventBus} deps.eventBus - Event bus service
   * @param {IUnifiedCache} deps.unifiedCache - Unified cache service
   * @param {object} [deps.circuitBreaker] - Circuit breaker service (optional)
   */
  constructor({ logger, eventBus, unifiedCache, circuitBreaker }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(unifiedCache, 'IUnifiedCache', logger, {
      requiredMethods: ['get', 'set', 'invalidate'],
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#cache = unifiedCache;
    this.#circuitBreaker = circuitBreaker;
  }

  /**
   * Execute an operation with resilience patterns (circuit breaker, fallback)
   *
   * @protected
   * @param {string} operationName - Name of the operation for logging and metrics
   * @param {Function} operation - The operation to execute
   * @param {Function} [fallback] - Optional fallback function if operation fails
   * @param {object} [options] - Options for resilience behavior
   * @param {number} [options.timeout] - Timeout in milliseconds
   * @param {number} [options.retries] - Number of retries
   * @returns {Promise<*>} Operation result or fallback result
   */
  async executeWithResilience(
    operationName,
    operation,
    fallback,
    options = {}
  ) {
    try {
      assertNonBlankString(
        operationName,
        'Operation name',
        'executeWithResilience',
        this.#logger
      );

      if (typeof operation !== 'function') {
        throw new InvalidArgumentError('Operation must be a function');
      }

      const { timeout = 5000, retries = 0 } = options;

      // Log operation start
      this.logOperation(
        'debug',
        `Starting resilient operation: ${operationName}`,
        {
          timeout,
          retries,
          hasCircuitBreaker: !!this.#circuitBreaker,
        }
      );

      // Use circuit breaker if available
      if (this.#circuitBreaker) {
        return await this.#circuitBreaker.execute(operationName, async () => {
          return await this.#executeWithTimeout(operation, timeout, retries);
        });
      }

      // Execute directly with timeout and retries
      return await this.#executeWithTimeout(operation, timeout, retries);
    } catch (error) {
      this.logOperation(
        'error',
        `Resilient operation failed: ${operationName}`,
        {
          error: error.message,
          stack: error.stack,
        }
      );

      // Dispatch error event
      this.dispatchEvent('FACADE_OPERATION_ERROR', {
        operationName,
        error: error.message,
        timestamp: Date.now(),
      });

      // Use fallback if provided
      if (typeof fallback === 'function') {
        this.logOperation(
          'warn',
          `Using fallback for operation: ${operationName}`
        );
        try {
          return await fallback(error);
        } catch (fallbackError) {
          this.logOperation(
            'error',
            `Fallback failed for operation: ${operationName}`,
            {
              error: fallbackError.message,
            }
          );
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Execute a cacheable operation with automatic cache management
   *
   * @protected
   * @param {string} cacheKey - Cache key for storing/retrieving results
   * @param {Function} operation - The operation to execute if not cached
   * @param {object} [options] - Caching options
   * @param {number} [options.ttl] - Time to live for cache entry
   * @param {boolean} [options.forceRefresh] - Skip cache lookup and refresh
   * @returns {Promise<*>} Cached result or fresh operation result
   */
  async cacheableOperation(cacheKey, operation, options = {}) {
    try {
      assertNonBlankString(
        cacheKey,
        'Cache key',
        'cacheableOperation',
        this.#logger
      );

      if (typeof operation !== 'function') {
        throw new InvalidArgumentError('Operation must be a function');
      }

      const { ttl, forceRefresh = false } = options;

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedResult = await this.#cache.get(cacheKey);
        if (cachedResult !== undefined) {
          this.logOperation('debug', `Cache hit for key: ${cacheKey}`);
          return cachedResult;
        }
      }

      this.logOperation(
        'debug',
        `Cache miss for key: ${cacheKey}, executing operation`
      );

      // Execute operation
      const result = await operation();

      // Cache the result
      await this.#cache.set(cacheKey, result, { ttl });

      this.logOperation('debug', `Cached result for key: ${cacheKey}`);

      return result;
    } catch (error) {
      this.logOperation(
        'error',
        `Cacheable operation failed for key: ${cacheKey}`,
        {
          error: error.message,
        }
      );
      throw error;
    }
  }

  /**
   * Dispatch an event through the event bus
   *
   * @protected
   * @param {string} eventType - Type of event to dispatch
   * @param {object} payload - Event payload data
   */
  dispatchEvent(eventType, payload) {
    try {
      assertNonBlankString(
        eventType,
        'Event type',
        'dispatchEvent',
        this.#logger
      );

      this.#eventBus.dispatch({
        type: eventType,
        payload: payload || {},
        timestamp: Date.now(),
        source: this.constructor.name,
      });

      this.logOperation('debug', `Dispatched event: ${eventType}`, {
        payloadKeys: Object.keys(payload || {}),
      });
    } catch (error) {
      this.logOperation('error', `Failed to dispatch event: ${eventType}`, {
        error: error.message,
      });
    }
  }

  /**
   * Log an operation with consistent formatting
   *
   * @protected
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {object} [metadata] - Additional metadata to include
   */
  logOperation(level, message, metadata = {}) {
    try {
      if (!this.#logger || typeof this.#logger[level] !== 'function') {
        return;
      }

      const logData = {
        facade: this.constructor.name,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      this.#logger[level](message, logData);
    } catch (error) {
      // Fallback to console if logger fails
      console.error(`Logger failed in ${this.constructor.name}:`, error);
    }
  }

  /**
   * Invalidate cache entries by pattern or specific key
   *
   * @protected
   * @param {string} keyOrPattern - Cache key or pattern to invalidate
   * @param {boolean} [isPattern] - Whether the key is a pattern
   */
  async invalidateCache(keyOrPattern, isPattern = false) {
    try {
      assertNonBlankString(
        keyOrPattern,
        'Cache key or pattern',
        'invalidateCache',
        this.#logger
      );

      if (isPattern) {
        // Invalidate by pattern (if cache supports it)
        if (typeof this.#cache.invalidateByPattern === 'function') {
          await this.#cache.invalidateByPattern(keyOrPattern);
        } else {
          this.logOperation(
            'warn',
            `Cache does not support pattern invalidation: ${keyOrPattern}`
          );
        }
      } else {
        // Invalidate specific key
        await this.#cache.invalidate(keyOrPattern);
      }

      this.logOperation('debug', `Invalidated cache: ${keyOrPattern}`, {
        isPattern,
      });
    } catch (error) {
      this.logOperation('error', `Cache invalidation failed: ${keyOrPattern}`, {
        error: error.message,
      });
    }
  }

  /**
   * Execute operation with timeout and retry logic
   *
   * @private
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} retries - Number of retries
   * @returns {Promise<*>} Operation result
   */
  async #executeWithTimeout(operation, timeout, retries) {
    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeout}ms`)),
            timeout
          );
        });

        // Race between operation and timeout
        return await Promise.race([operation(), timeoutPromise]);
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt <= retries) {
          this.logOperation(
            'warn',
            `Operation attempt ${attempt} failed, retrying...`,
            {
              error: error.message,
              attemptsRemaining: retries - attempt + 1,
            }
          );

          // Exponential backoff delay
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export default BaseFacade;
