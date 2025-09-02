import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 */

/**
 * Factory function that creates a union resolver
 *
 * @param {object} [dependencies] - Optional dependencies
 * @param {object} [dependencies.errorHandler] - Optional error handler for centralized error management
 * @returns {NodeResolver} Union node resolver
 */
export default function createUnionResolver({ errorHandler = null } = {}) {
  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }
  return {
    /**
     * Determines if this resolver can handle the given node
     *
     * @param {object} node - AST node
     * @returns {boolean} True if this is a Union node
     */
    canResolve(node) {
      return node.type === 'Union';
    },

    /**
     * Resolves a Union node by combining results from left and right expressions
     *
     * @param {object} node - Union node with left and right expressions
     * @param {object} ctx - Resolution context
     * @param {Function} ctx.dispatcher - Dispatcher for recursive resolution
     * @param {object} [ctx.trace] - Optional trace context
     * @returns {Set<any>} Union of left and right results
     */
    resolve(node, ctx) {
      const { dispatcher, trace } = ctx;

      // Validate context has required properties
      if (!ctx.actorEntity) {
        const error = new Error(
          'UnionResolver: actorEntity is missing from context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'UnionResolver',
            ErrorCodes.MISSING_ACTOR
          );
          return new Set(); // Return empty set when using error handler
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      const source = 'UnionResolver';

      if (trace) {
        trace.addLog('info', 'Starting union resolution.', source);
      }

      // Recursively resolve left and right nodes - pass full context
      const leftResult = dispatcher.resolve(node.left, ctx);
      const rightResult = dispatcher.resolve(node.right, ctx);

      // Validate both operands are valid for union operations
      // Valid types: Set, Array, or other iterables that aren't primitive strings/numbers
      const isValidUnionOperand = (operand) => {
        return operand && 
               typeof operand === 'object' &&
               typeof operand[Symbol.iterator] === 'function' &&
               (operand instanceof Set || Array.isArray(operand) || operand.constructor !== String);
      };

      if (!isValidUnionOperand(leftResult) || !isValidUnionOperand(rightResult)) {
        const error = new Error(
          `Cannot union ${typeof leftResult} with ${typeof rightResult} - both operands must be iterable collections (Set, Array, etc.)`
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'UnionResolver',
            ErrorCodes.DATA_TYPE_MISMATCH
          );
          return new Set(); // Return empty set when using error handler
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      // Check if union operation would result in excessive memory usage
      const leftSize = leftResult.size || leftResult.length || 0;
      const rightSize = rightResult.size || rightResult.length || 0;
      const estimatedSize = leftSize + rightSize;
      const MEMORY_THRESHOLD = 10000; // Reasonable limit for union operations

      if (estimatedSize > MEMORY_THRESHOLD) {
        const error = new Error(
          `Union size ${estimatedSize} exceeds memory threshold ${MEMORY_THRESHOLD}`
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            { ...ctx, estimatedSize, leftSize, rightSize },
            'UnionResolver',
            ErrorCodes.MEMORY_LIMIT
          );
          // Continue with operation after warning - memory limit is not a blocking error
        }
      }

      // Create union of both sets, flattening arrays if present
      const result = new Set();

      // Helper to add items to result, handling arrays
      const addToResult = (item) => {
        if (Array.isArray(item)) {
          // If the item is an array, add each element individually
          for (const element of item) {
            if (element !== null && element !== undefined) {
              result.add(element);
            }
          }
        } else if (item !== null && item !== undefined) {
          result.add(item);
        }
      };

      // Process left result
      for (const item of leftResult) {
        addToResult(item);
      }

      // Process right result
      for (const item of rightResult) {
        addToResult(item);
      }

      if (trace) {
        trace.addLog(
          'info',
          `Union complete. Left: ${leftResult.size} items, Right: ${rightResult.size} items, Total: ${result.size} items.`,
          source,
          {
            leftSize: leftResult.size,
            rightSize: rightResult.size,
            unionSize: result.size,
          }
        );
      }

      return result;
    },
  };
}
