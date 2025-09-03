/**
 * @file Complex error handling example for ScopeDSL resolvers
 * @description Shows advanced error handling patterns including recovery, context sanitization, and buffering
 */

import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Example of a complex resolver with advanced error handling patterns
 *
 * @param {object} dependencies - Dependency injection object
 * @param {import('../../../src/interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
 * @param {import('../../../src/scopeDsl/core/scopeDslErrorHandler.js').default} dependencies.errorHandler - Error handler
 * @param {object} dependencies.entityRegistry - Entity registry for lookups
 * @param {object} dependencies.dispatcher - Event dispatcher for nested resolution
 * @returns {object} Resolver object with advanced error handling
 */
export default function createComplexResolver({
  logger,
  errorHandler,
  entityRegistry,
  dispatcher,
}) {
  // Validate all dependencies
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
    requiredMethods: ['handleError', 'getErrorBuffer', 'clearErrorBuffer'],
  });

  validateDependency(entityRegistry, 'IEntityRegistry', logger, {
    requiredMethods: ['getEntity', 'hasEntity'],
  });

  validateDependency(dispatcher, 'IDispatcher', logger, {
    requiredMethods: ['dispatch'],
  });

  // Track failures for circuit breaking pattern
  let consecutiveFailures = 0;
  const FAILURE_THRESHOLD = 3;
  let circuitBreakerOpen = false;
  let lastFailureTime = null;
  const CIRCUIT_RESET_TIME = 60000; // 1 minute

  return {
    canResolve(node) {
      return node.type === 'complex' || node.type === 'advanced';
    },

    resolve(node, ctx) {
      // Pattern 1: Circuit breaker check
      if (circuitBreakerOpen) {
        const timeSinceFailure = Date.now() - lastFailureTime;
        if (timeSinceFailure < CIRCUIT_RESET_TIME) {
          errorHandler.handleError(
            'Circuit breaker is open due to repeated failures',
            { consecutiveFailures, timeSinceFailure },
            'ComplexResolver',
            ErrorCodes.RESOURCE_EXHAUSTION
          );
        } else {
          // Reset circuit breaker
          circuitBreakerOpen = false;
          consecutiveFailures = 0;
          logger.info('ComplexResolver: Circuit breaker reset');
        }
      }

      // Pattern 2: Context sanitization for sensitive data
      const sanitizedContext = sanitizeContext(ctx);

      // Pattern 3: Cycle detection with visited tracking
      const visited = ctx.visited || new Set();
      const nodeKey = `${node.type}:${node.id || JSON.stringify(node.value)}`;

      if (visited.has(nodeKey)) {
        errorHandler.handleError(
          `Circular reference detected for node: ${nodeKey}`,
          { ...sanitizedContext, cycleChain: Array.from(visited) },
          'ComplexResolver',
          ErrorCodes.CYCLE_DETECTED
        );
      }

      // Add current node to visited set
      const newVisited = new Set(visited);
      newVisited.add(nodeKey);

      // Pattern 4: Validation chain with specific error codes
      validateComplexNode(node, sanitizedContext, errorHandler);
      validateComplexContext(sanitizedContext, errorHandler);

      // Pattern 5: Try primary resolution with fallback
      let result = null;
      let usedFallback = false;
      let primaryError = null;

      try {
        // Primary resolution path
        result = performPrimaryResolution(node, {
          ...ctx,
          visited: newVisited,
          depth: (ctx.depth || 0) + 1,
        });

        // Success - reset failure counter
        consecutiveFailures = 0;
        circuitBreakerOpen = false;
      } catch (error) {
        primaryError = error;
        // Log primary failure
        logger.warn('Primary resolution failed, attempting fallback', {
          error: primaryError.message,
          node: node.type,
        });

        // Pattern 6: Error categorization for smart recovery
        const errorCategory = categorizeError(primaryError);

        if (errorCategory === 'recoverable') {
          try {
            // Attempt fallback resolution
            result = performFallbackResolution(node, ctx);
            usedFallback = true;

            // Partial success - don't increment failure counter
            logger.info('Fallback resolution succeeded');
          } catch (fallbackError) {
            // Both primary and fallback failed
            handleDoubleFailure(
              primaryError,
              fallbackError,
              sanitizedContext,
              errorHandler
            );
          }
        } else {
          // Non-recoverable error - update circuit breaker
          consecutiveFailures++;
          lastFailureTime = Date.now();

          if (consecutiveFailures >= FAILURE_THRESHOLD) {
            circuitBreakerOpen = true;
            logger.error(
              `Circuit breaker opened after ${consecutiveFailures} consecutive failures`
            );
          }

          // Re-throw with proper error code
          errorHandler.handleError(
            primaryError,
            sanitizedContext,
            'ComplexResolver',
            determineSpecificErrorCode(primaryError)
          );
        }
      }

      // Pattern 7: Error buffer analysis for patterns
      if (errorHandler.getErrorBuffer) {
        const recentErrors = errorHandler.getErrorBuffer();
        analyzeErrorPatterns(recentErrors, logger);
      }

      // Pattern 8: Result validation
      if (result === null || result === undefined) {
        errorHandler.handleError(
          'Resolution produced null/undefined result',
          { ...sanitizedContext, usedFallback },
          'ComplexResolver',
          ErrorCodes.RESOLUTION_FAILED_GENERIC
        );
      }

      return result;
    },
  };

  /**
   * Sanitize context to remove sensitive data
   *
   * @param ctx
   */
  function sanitizeContext(ctx) {
    const sanitized = { ...ctx };

    // Remove sensitive fields
    delete sanitized.credentials;
    delete sanitized.apiKey;
    delete sanitized.password;
    delete sanitized.token;

    // Handle circular references
    try {
      JSON.stringify(sanitized);
    } catch (e) {
      // If circular reference detected, create safe version
      return {
        actorEntity: ctx.actorEntity?.id || 'unknown',
        depth: ctx.depth || 0,
        hasDispatcher: !!ctx.dispatcher,
        // Add other safe fields as needed
      };
    }

    return sanitized;
  }

  /**
   * Validate complex node structure
   *
   * @param node
   * @param ctx
   * @param errorHandler
   */
  function validateComplexNode(node, ctx, errorHandler) {
    if (!node) {
      errorHandler.handleError(
        'Node is null or undefined',
        ctx,
        'ComplexResolver',
        ErrorCodes.INVALID_NODE_STRUCTURE
      );
    }

    if (!node.type) {
      errorHandler.handleError(
        'Node missing required type property',
        { node, ...ctx },
        'ComplexResolver',
        ErrorCodes.INVALID_NODE_TYPE
      );
    }

    if (node.type === 'complex' && !node.children) {
      errorHandler.handleError(
        'Complex node missing children array',
        { node, ...ctx },
        'ComplexResolver',
        ErrorCodes.INVALID_NODE_STRUCTURE
      );
    }
  }

  /**
   * Validate complex context requirements
   *
   * @param ctx
   * @param errorHandler
   */
  function validateComplexContext(ctx, errorHandler) {
    const required = ['actorEntity', 'dispatcher'];
    const missing = [];

    for (const field of required) {
      if (!ctx[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      errorHandler.handleError(
        `Missing required context fields: ${missing.join(', ')}`,
        ctx,
        'ComplexResolver',
        ErrorCodes.MISSING_CONTEXT_GENERIC
      );
    }
  }

  /**
   * Primary resolution logic
   *
   * @param node
   * @param ctx
   */
  function performPrimaryResolution(node, ctx) {
    // Simulate complex resolution that might fail
    if (Math.random() < 0.1) {
      // 10% chance of failure for demo
      throw new Error('Primary resolution encountered an error');
    }

    // Process children recursively
    if (node.children) {
      const results = [];
      for (const child of node.children) {
        const childResult = dispatcher.dispatch(child, ctx);
        results.push(childResult);
      }
      return results;
    }

    return { resolved: true, nodeType: node.type };
  }

  /**
   * Fallback resolution logic
   *
   * @param node
   * @param ctx
   */
  function performFallbackResolution(node, ctx) {
    logger.debug('Using simplified fallback resolution');

    // Return simplified result
    return {
      resolved: true,
      fallback: true,
      nodeType: node.type,
      simplified: true,
    };
  }

  /**
   * Categorize error for recovery decision
   *
   * @param error
   */
  function categorizeError(error) {
    const message = error.message.toLowerCase();

    // Recoverable errors
    if (
      message.includes('timeout') ||
      message.includes('temporary') ||
      message.includes('retry')
    ) {
      return 'recoverable';
    }

    // Non-recoverable errors
    if (
      message.includes('invalid') ||
      message.includes('missing') ||
      message.includes('cycle')
    ) {
      return 'non-recoverable';
    }

    return 'unknown';
  }

  /**
   * Handle double failure scenario
   *
   * @param primaryError
   * @param fallbackError
   * @param ctx
   * @param errorHandler
   */
  function handleDoubleFailure(
    primaryError,
    fallbackError,
    ctx,
    errorHandler
  ) {
    const combinedMessage = `Primary resolution failed: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`;

    errorHandler.handleError(
      combinedMessage,
      {
        ...ctx,
        primaryError: primaryError.message,
        fallbackError: fallbackError.message,
      },
      'ComplexResolver',
      ErrorCodes.RESOLUTION_FAILED_GENERIC
    );
  }

  /**
   * Determine specific error code from error
   *
   * @param error
   */
  function determineSpecificErrorCode(error) {
    const message = error.message.toLowerCase();

    if (message.includes('entity') && message.includes('not found')) {
      return ErrorCodes.ENTITY_RESOLUTION_FAILED;
    }
    if (message.includes('component')) {
      return ErrorCodes.COMPONENT_RESOLUTION_FAILED;
    }
    if (message.includes('timeout')) {
      return ErrorCodes.EXECUTION_TIMEOUT;
    }
    if (message.includes('memory') || message.includes('resource')) {
      return ErrorCodes.RESOURCE_EXHAUSTION;
    }

    return ErrorCodes.RESOLUTION_FAILED_GENERIC;
  }

  /**
   * Analyze error patterns in buffer
   *
   * @param errors
   * @param logger
   */
  function analyzeErrorPatterns(errors, logger) {
    if (errors.length === 0) return;

    // Count errors by category
    const categoryCounts = {};
    errors.forEach((error) => {
      categoryCounts[error.category] = (categoryCounts[error.category] || 0) + 1;
    });

    // Check for concerning patterns
    const totalErrors = errors.length;
    const recentErrors = errors.slice(-10); // Last 10 errors

    // All recent errors are the same type
    const uniqueRecentCodes = new Set(recentErrors.map((e) => e.code));
    if (uniqueRecentCodes.size === 1 && recentErrors.length >= 5) {
      logger.warn(
        `Repeated error pattern detected: ${recentErrors[0].code} occurred ${recentErrors.length} times recently`
      );
    }

    // High error rate
    if (totalErrors >= 50) {
      logger.warn(`High error count in buffer: ${totalErrors} errors`);

      // Consider clearing buffer to prevent memory issues
      if (totalErrors >= 100) {
        errorHandler.clearErrorBuffer();
        logger.info('Error buffer cleared due to size');
      }
    }
  }
}