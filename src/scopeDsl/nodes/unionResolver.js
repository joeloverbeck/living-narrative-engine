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

      const source = 'UnionResolver';

      if (trace) {
        trace.addLog('info', 'Starting union resolution.', source);
      }

      // Recursively resolve left and right nodes
      const leftResult = dispatcher.resolve(node.left, ctx);
      const rightResult = dispatcher.resolve(node.right, ctx);

      // Create union of both sets
      const result = new Set([...leftResult, ...rightResult]);

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
