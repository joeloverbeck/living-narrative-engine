/**
 * @file Error recovery patterns example for ScopeDSL resolvers
 * @description Shows various error recovery strategies and graceful degradation patterns
 */

import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Example resolver demonstrating error recovery patterns
 *
 * @param {object} dependencies - Dependency injection object
 * @param {import('../../../src/interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
 * @param {import('../../../src/scopeDsl/core/scopeDslErrorHandler.js').default} dependencies.errorHandler - Error handler
 * @param {object} dependencies.cache - Cache service for storing results
 * @param {object} dependencies.configService - Configuration service
 * @returns {object} Resolver with recovery strategies
 */
export default function createRecoveryResolver({
  logger,
  errorHandler,
  cache,
  configService,
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

  // Recovery configuration
  const config = {
    maxRetries: configService?.get('maxRetries') || 3,
    retryDelay: configService?.get('retryDelay') || 100,
    useCacheFallback: configService?.get('useCacheFallback') !== false,
    useDefaultFallback: configService?.get('useDefaultFallback') !== false,
    gracefulDegradation: configService?.get('gracefulDegradation') !== false,
  };

  return {
    canResolve(node) {
      return node.type === 'recoverable' || node.type === 'resilient';
    },

    resolve(node, ctx) {
      // Recovery Pattern 1: Retry with exponential backoff
      const resultWithRetry = withRetry(
        () => performResolution(node, ctx),
        {
          maxAttempts: config.maxRetries,
          delay: config.retryDelay,
          backoff: 'exponential',
          shouldRetry: (error) => isRetriableError(error),
        }
      );

      if (resultWithRetry.success) {
        return resultWithRetry.value;
      }

      // Recovery Pattern 2: Cache fallback
      if (config.useCacheFallback && cache) {
        const cachedResult = tryGetFromCache(node, ctx);
        if (cachedResult !== null) {
          logger.info('Using cached result after failure', {
            nodeType: node.type,
            cacheAge: cachedResult.age,
          });
          return cachedResult.value;
        }
      }

      // Recovery Pattern 3: Default value fallback
      if (config.useDefaultFallback) {
        const defaultValue = getDefaultValue(node);
        if (defaultValue !== undefined) {
          logger.warn('Using default value after failure', {
            nodeType: node.type,
            defaultValue,
          });

          // Log error but don't throw
          if (errorHandler) {
            try {
              // Store error for analysis but continue
              const error = new Error(
                `Failed to resolve, using default: ${resultWithRetry.error.message}`
              );
              // Note: We're not calling handleError here because we're recovering
              logger.error('Recoverable error occurred', error);
            } catch (e) {
              // Even error logging failed, but we can still return default
            }
          }

          return defaultValue;
        }
      }

      // Recovery Pattern 4: Graceful degradation
      if (config.gracefulDegradation) {
        const degradedResult = tryGracefulDegradation(node, ctx);
        if (degradedResult !== null) {
          logger.info('Applied graceful degradation', {
            nodeType: node.type,
            degradationType: degradedResult.type,
          });
          return degradedResult.value;
        }
      }

      // Recovery Pattern 5: Partial result with error flag
      if (node.allowPartial) {
        const partialResult = buildPartialResult(node, ctx, resultWithRetry.error);
        logger.warn('Returning partial result', {
          nodeType: node.type,
          completeness: partialResult.completeness,
        });
        return partialResult;
      }

      // All recovery strategies failed - now we must error
      if (errorHandler) {
        errorHandler.handleError(
          `All recovery strategies exhausted: ${resultWithRetry.error.message}`,
          {
            ...ctx,
            attemptedRecoveries: [
              'retry',
              'cache',
              'default',
              'degradation',
              'partial',
            ],
            originalError: resultWithRetry.error.message,
          },
          'RecoveryResolver',
          ErrorCodes.RESOLUTION_FAILED_GENERIC
        );
      } else {
        throw resultWithRetry.error;
      }
    },
  };

  /**
   * Retry helper with exponential backoff
   *
   * @param fn
   * @param options
   */
  function withRetry(fn, options) {
    const { maxAttempts, delay, backoff, shouldRetry } = options;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = fn();
        // Success!
        if (attempt > 1) {
          logger.info(`Operation succeeded on attempt ${attempt}`);
        }
        return { success: true, value: result };
      } catch (error) {
        lastError = error;

        // Check if error is retriable
        if (!shouldRetry(error)) {
          logger.debug('Error is not retriable', { errorType: error.constructor.name });
          break;
        }

        if (attempt < maxAttempts) {
          const waitTime = backoff === 'exponential' 
            ? delay * Math.pow(2, attempt - 1)
            : delay;

          logger.debug(`Retry attempt ${attempt} failed, waiting ${waitTime}ms`);

          // Simple synchronous wait (in real code, use async/await)
          const start = Date.now();
          while (Date.now() - start < waitTime) {
            // Wait
          }
        }
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Check if error is retriable
   *
   * @param error
   */
  function isRetriableError(error) {
    const message = error.message.toLowerCase();

    // Retriable error patterns
    const retriablePatterns = [
      'timeout',
      'temporary',
      'unavailable',
      'busy',
      'throttl',
      'rate limit',
      'concurrent',
    ];

    // Non-retriable error patterns
    const nonRetriablePatterns = [
      'invalid',
      'missing',
      'not found',
      'unauthorized',
      'forbidden',
      'cycle',
      'circular',
    ];

    // Check non-retriable first (more specific)
    for (const pattern of nonRetriablePatterns) {
      if (message.includes(pattern)) {
        return false;
      }
    }

    // Check retriable patterns
    for (const pattern of retriablePatterns) {
      if (message.includes(pattern)) {
        return true;
      }
    }

    // Default to not retriable for unknown errors
    return false;
  }

  /**
   * Try to get result from cache
   *
   * @param node
   * @param ctx
   */
  function tryGetFromCache(node, ctx) {
    if (!cache || !cache.get) return null;

    const cacheKey = buildCacheKey(node, ctx);
    
    try {
      const cached = cache.get(cacheKey);
      if (cached) {
        const age = Date.now() - (cached.timestamp || 0);
        const maxAge = 5 * 60 * 1000; // 5 minutes

        if (age < maxAge) {
          return { value: cached.value, age };
        }
      }
    } catch (error) {
      logger.debug('Cache lookup failed', error);
    }

    return null;
  }

  /**
   * Build cache key from node and context
   *
   * @param node
   * @param ctx
   */
  function buildCacheKey(node, ctx) {
    // Create a stable cache key
    const keyParts = [
      'scope',
      node.type,
      node.id || '',
      ctx.actorEntity?.id || '',
    ];

    if (node.value) {
      keyParts.push(JSON.stringify(node.value));
    }

    return keyParts.join(':');
  }

  /**
   * Get default value for node type
   *
   * @param node
   */
  function getDefaultValue(node) {
    const defaults = {
      'recoverable': [],
      'resilient': { items: [] },
      'list': [],
      'count': 0,
      'boolean': false,
      'string': '',
      'object': {},
    };

    return defaults[node.type] ?? defaults[node.returnType];
  }

  /**
   * Try graceful degradation strategies
   *
   * @param node
   * @param ctx
   */
  function tryGracefulDegradation(node, ctx) {
    // Strategy 1: Use simpler resolution
    if (node.type === 'complex' && node.simpleAlternative) {
      try {
        const simpleResult = resolveSimple(node.simpleAlternative, ctx);
        return { value: simpleResult, type: 'simplified' };
      } catch (e) {
        logger.debug('Simplified resolution also failed');
      }
    }

    // Strategy 2: Use subset of data
    if (node.type === 'list' && ctx.actorEntity) {
      try {
        // Return just actor-related items
        const actorOnly = [ctx.actorEntity];
        return { value: actorOnly, type: 'actor-subset' };
      } catch (e) {
        logger.debug('Actor subset failed');
      }
    }

    // Strategy 3: Use static/mock data in development
    if (globalThis.process?.env?.NODE_ENV === 'development' && node.mockData) {
      return { value: node.mockData, type: 'mock' };
    }

    return null;
  }

  /**
   * Build partial result with error information
   *
   * @param node
   * @param ctx
   * @param error
   */
  function buildPartialResult(node, ctx, error) {
    const partial = {
      _partial: true,
      _error: error.message,
      _errorCode: error.code || 'UNKNOWN',
      _timestamp: Date.now(),
      completeness: 0,
      data: null,
    };

    // Try to populate with whatever we can
    if (node.type === 'list') {
      partial.data = [];
      partial.completeness = 0;
    } else if (node.type === 'object') {
      partial.data = {};
      
      // Try to fill in any fields we can
      if (node.fields) {
        let completed = 0;
        for (const field of node.fields) {
          try {
            partial.data[field.name] = getDefaultValue(field);
            completed++;
          } catch (e) {
            partial.data[field.name] = null;
          }
        }
        partial.completeness = (completed / node.fields.length) * 100;
      }
    }

    return partial;
  }

  /**
   * Perform the actual resolution (may fail)
   *
   * @param node
   * @param ctx
   */
  function performResolution(node, ctx) {
    // Validate inputs
    if (!node) {
      throw new Error('Node is required');
    }

    if (!ctx.actorEntity) {
      throw new Error('Actor entity is required');
    }

    // Simulate resolution that might fail
    if (Math.random() < 0.3) {
      // 30% failure rate for demo
      const errorTypes = [
        'Temporary network error',
        'Resource temporarily unavailable',
        'Database connection timeout',
        'Service is busy',
        'Rate limit exceeded',
      ];
      const errorMessage = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      throw new Error(errorMessage);
    }

    // Simulate successful resolution
    const result = {
      resolved: true,
      nodeType: node.type,
      actorId: ctx.actorEntity.id,
      timestamp: Date.now(),
    };

    // Cache successful result
    if (cache && cache.set) {
      const cacheKey = buildCacheKey(node, ctx);
      try {
        cache.set(cacheKey, { value: result, timestamp: Date.now() });
      } catch (e) {
        logger.debug('Failed to cache result', e);
      }
    }

    return result;
  }

  /**
   * Simple resolution fallback
   *
   * @param alternative
   * @param ctx
   */
  function resolveSimple(alternative, ctx) {
    return {
      simple: true,
      alternative: alternative,
      actorId: ctx.actorEntity?.id,
    };
  }
}