/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 */

/**
 * Factory function that creates a union resolver
 *
 * @returns {NodeResolver} Union node resolver
 */
export default function createUnionResolver() {
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
        console.error('[CRITICAL] UnionResolver missing actorEntity:', {
          hasCtx: !!ctx,
          ctxKeys: ctx ? Object.keys(ctx) : [],
          nodeType: node?.type,
          hasLeft: !!node?.left,
          hasRight: !!node?.right,
          depth: ctx?.depth,
          callStack: new Error().stack,
        });
        throw error;
      }

      const source = 'UnionResolver';

      if (trace) {
        trace.addLog('info', 'Starting union resolution.', source);
      }

      // Recursively resolve left and right nodes - pass full context
      const leftResult = dispatcher.resolve(node.left, ctx);
      const rightResult = dispatcher.resolve(node.right, ctx);

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
