/**
 * @file Scope Reference Resolver
 * @description Resolves references to other scopes by looking them up and recursively resolving them
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 */

/**
 * Factory function that creates a scope reference resolver
 *
 * @param {object} deps - Dependencies
 * @param {object} deps.scopeRegistry - Registry to look up scope definitions
 * @param {object} deps.cycleDetector - Detector to prevent circular references
 * @param {object} [deps.errorHandler] - Error handler for centralized error management
 * @returns {NodeResolver} Scope reference node resolver
 */
export default function createScopeReferenceResolver({
  scopeRegistry,
  cycleDetector,
  errorHandler = null,
}) {
  // Validate dependencies
  validateDependency(scopeRegistry, 'IScopeRegistry', console, {
    requiredMethods: ['getScopeAst'],
  });

  // Only validate errorHandler if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError'],
    });
  }
  return {
    /**
     * Determines if this resolver can handle the given node
     *
     * @param {object} node - AST node
     * @returns {boolean} True if this is a ScopeReference node
     */
    canResolve(node) {
      return node.type === 'ScopeReference';
    },

    /**
     * Resolves a ScopeReference node by looking up and resolving the referenced scope
     *
     * @param {object} node - ScopeReference node with scopeId
     * @param {object} ctx - Resolution context
     * @param {Function} ctx.dispatcher - Dispatcher for recursive resolution
     * @param {object} ctx.actorEntity - The acting entity
     * @param {object} ctx.runtimeCtx - Runtime context with services
     * @param {object} [ctx.trace] - Optional trace context
     * @returns {Set<string>} Set of entity IDs from the referenced scope
     */
    resolve(node, ctx) {
      const { dispatcher, actorEntity, runtimeCtx: _runtimeCtx, trace } = ctx;

      // Validate context has required properties
      if (!actorEntity) {
        const error = new Error(
          'ScopeReferenceResolver: actorEntity is missing from context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error.message,
            { ...ctx, requestedScope: node.scopeId },
            'ScopeReferenceResolver',
            ErrorCodes.MISSING_ACTOR
          );
          return new Set(); // Return empty set when using error handler
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      if (!scopeRegistry) {
        const error = new Error(
          'ScopeReferenceResolver: scopeRegistry is not available'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error.message,
            { ...ctx, requestedScope: node.scopeId },
            'ScopeReferenceResolver',
            ErrorCodes.MISSING_REGISTRY
          );
          return new Set(); // Return empty set when using error handler
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      const scopeId = node.scopeId;

      // Check for circular references
      if (cycleDetector) {
        cycleDetector.enter(scopeId);
      }

      try {
        // Get the referenced scope's AST from the registry
        const scopeAst = scopeRegistry.getScopeAst(scopeId);

        if (!scopeAst) {
          const error = new Error(`Referenced scope not found: ${scopeId}`);
          if (errorHandler) {
            errorHandler.handleError(
              error.message,
              { ...ctx, requestedScope: scopeId },
              'ScopeReferenceResolver',
              ErrorCodes.SCOPE_NOT_FOUND
            );
            return new Set(); // Return empty set when scope not found
          } else {
            // Fallback for backward compatibility
            throw error;
          }
        }

        if (trace) {
          trace.addLog(
            'info',
            `Resolving scope reference: ${scopeId}`,
            'ScopeReferenceResolver'
          );
        }

        // Recursively resolve the referenced scope's AST
        // Pass the full context to maintain all necessary state
        const result = dispatcher.resolve(scopeAst, ctx);

        if (trace) {
          trace.addLog(
            'info',
            `Scope reference ${scopeId} resolved to ${result.size} entities`,
            'ScopeReferenceResolver'
          );
        }

        return result;
      } finally {
        // Exit the scope reference to allow proper cycle detection
        if (cycleDetector) {
          cycleDetector.leave();
        }
      }
    },
  };
}
