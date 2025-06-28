import flattenIntoSet from '../core/flattenIntoSet.js';

/**
 * Creates an ArrayIterationStep node resolver for flattening array values.
 * Resolves ArrayIterationStep nodes by flattening arrays from parent results.
 *
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createArrayIterationResolver() {
  return {
    /**
     * Checks if this resolver can handle the given node.
     *
     * @param {object} node - The node to check
     * @returns {boolean} True if node type is 'ArrayIterationStep'
     */
    canResolve(node) {
      return node.type === 'ArrayIterationStep';
    },

    /**
     * Resolves an ArrayIterationStep node by flattening arrays from parent results.
     *
     * @param {object} node - The ArrayIterationStep node to resolve
     * @param {object} ctx - Resolution context with actorEntity, trace, etc.
     * @returns {Set} Set of flattened values from arrays
     */
    resolve(node, ctx) {
      const trace = ctx.trace;

      // Use dispatcher to resolve parent node
      const parentResult = ctx.dispatcher.resolve(node.parent, ctx);

      if (trace) {
        trace.addLog(
          'info',
          `Resolving ArrayIterationStep node. Parent result size: ${parentResult.size}`,
          'ArrayIterationResolver',
          {
            parentSize: parentResult.size,
          }
        );
      }

      const result = new Set();

      // Flatten arrays from parent result
      for (const parentValue of parentResult) {
        if (Array.isArray(parentValue)) {
          for (const item of parentValue) {
            if (item !== null && item !== undefined) {
              result.add(item);
            }
          }
        } else if (node.parent.type === 'Source') {
          // Pass through for entities()[] case where Source returns entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            result.add(parentValue);
          }
        }
        // For other cases (like Step nodes), non-arrays result in empty set
      }

      if (trace) {
        trace.addLog(
          'info',
          `ArrayIterationStep node resolved. Result size: ${result.size}`,
          'ArrayIterationResolver',
          {
            resultSize: result.size,
          }
        );
      }

      return result;
    },
  };
}
