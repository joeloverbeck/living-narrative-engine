/**
 * @file Scope Reference Resolver
 * @description Resolves references to other scopes by looking them up and recursively resolving them
 */

/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 */

/**
 * Factory function that creates a scope reference resolver
 *
 * @param {object} deps - Dependencies
 * @param {object} deps.scopeRegistry - Registry to look up scope definitions
 * @param {object} deps.cycleDetector - Detector to prevent circular references
 * @returns {NodeResolver} Scope reference node resolver
 */
export default function createScopeReferenceResolver({
  scopeRegistry,
  cycleDetector,
}) {
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
      const { dispatcher, actorEntity, runtimeCtx, trace } = ctx;

      // Validate context has required properties
      if (!actorEntity) {
        throw new Error(
          'ScopeReferenceResolver: actorEntity is missing from context'
        );
      }

      if (!scopeRegistry) {
        throw new Error(
          'ScopeReferenceResolver: scopeRegistry is not available'
        );
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
          throw new Error(`Referenced scope not found: ${scopeId}`);
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
