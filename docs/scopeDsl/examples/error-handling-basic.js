/**
 * @file Basic error handling example for ScopeDSL resolvers
 * @description Shows fundamental error handling patterns for resolver implementation
 */

import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

/**
 * Example of a basic resolver with proper error handling
 *
 * @param {object} dependencies - Dependency injection object
 * @param {import('../../../src/interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
 * @param {import('../../../src/scopeDsl/core/scopeDslErrorHandler.js').default} dependencies.errorHandler - Error handler
 * @returns {object} Resolver object with canResolve and resolve methods
 */
export default function createBasicResolver({ logger, errorHandler }) {
  // Validate dependencies
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  // Error handler is optional for backward compatibility
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  return {
    /**
     * Check if this resolver can handle the given node
     *
     * @param {object} node - AST node to check
     * @returns {boolean} True if this resolver can handle the node
     */
    canResolve(node) {
      return node.type === 'basic';
    },

    /**
     * Resolve the node with proper error handling
     *
     * @param {object} node - AST node to resolve
     * @param {object} ctx - Resolution context
     * @returns {*} Resolution result
     * @throws {Error} If resolution fails and no error handler provided
     */
    resolve(node, ctx) {
      // Example 1: Validate required context
      if (!ctx.actorEntity) {
        const errorMessage = 'actorEntity is required in context';

        if (errorHandler) {
          // Use error handler with specific error code
          errorHandler.handleError(
            errorMessage,
            ctx,
            'BasicResolver',
            ErrorCodes.MISSING_ACTOR
          );
        } else {
          // Fallback to standard error for backward compatibility
          throw new Error(errorMessage);
        }
      }

      // Example 2: Validate node structure
      if (!node.value) {
        const errorMessage = 'Node must have a value property';

        if (errorHandler) {
          errorHandler.handleError(
            errorMessage,
            { node, ...ctx },
            'BasicResolver',
            ErrorCodes.INVALID_NODE_STRUCTURE
          );
        } else {
          throw new Error(errorMessage);
        }
      }

      // Example 3: Depth check to prevent infinite recursion
      const currentDepth = (ctx.depth || 0) + 1;
      const MAX_DEPTH = 10;

      if (currentDepth > MAX_DEPTH) {
        const errorMessage = `Maximum depth ${MAX_DEPTH} exceeded at depth ${currentDepth}`;

        if (errorHandler) {
          errorHandler.handleError(
            errorMessage,
            { ...ctx, depth: currentDepth },
            'BasicResolver',
            ErrorCodes.MAX_DEPTH_EXCEEDED
          );
        } else {
          throw new Error(errorMessage);
        }
      }

      try {
        // Main resolution logic
        logger.debug(`BasicResolver: Processing node with value ${node.value}`);

        // Simulate some processing
        const result = processNodeValue(node.value, ctx.actorEntity);

        // Return result
        return result;
      } catch (error) {
        // Example 4: Handle unexpected errors during processing
        if (errorHandler) {
          // Determine appropriate error code based on error type
          const errorCode = determineErrorCode(error);

          errorHandler.handleError(error, ctx, 'BasicResolver', errorCode);
        } else {
          // Re-throw if no error handler
          throw error;
        }
      }
    },
  };
}

/**
 * Helper function to process node value
 *
 * @param value
 * @param actorEntity
 * @private
 */
function processNodeValue(value, actorEntity) {
  // Simulate some processing that might fail
  if (typeof value !== 'string') {
    throw new Error(`Expected string value, got ${typeof value}`);
  }

  return {
    processedValue: value.toUpperCase(),
    actorId: actorEntity.id,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to determine error code from error
 *
 * @param error
 * @private
 */
function determineErrorCode(error) {
  const message = error.message.toLowerCase();

  if (message.includes('not found')) {
    return ErrorCodes.RESOLUTION_FAILED_GENERIC;
  }
  if (message.includes('invalid') || message.includes('expected')) {
    return ErrorCodes.INVALID_DATA_GENERIC;
  }
  if (message.includes('cycle') || message.includes('circular')) {
    return ErrorCodes.CYCLE_DETECTED;
  }
  if (message.includes('timeout')) {
    return ErrorCodes.EXECUTION_TIMEOUT;
  }

  return ErrorCodes.UNKNOWN_ERROR;
}
