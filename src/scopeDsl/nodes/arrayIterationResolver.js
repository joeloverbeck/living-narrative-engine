import flattenIntoSet from '../core/flattenIntoSet.js';

/**
 * Creates an ArrayIterationStep node resolver for flattening array values.
 * Resolves ArrayIterationStep nodes by flattening arrays from parent results.
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createArrayIterationResolver({ entitiesGateway }) {
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
          `Resolving ArrayIterationStep node with field '${node.field}'. Parent result size: ${parentResult.size}`,
          'ArrayIterationResolver',
          {
            field: node.field,
            parentSize: parentResult.size,
          }
        );
      }

      // Return empty set if parent is empty
      if (parentResult.size === 0) {
        return new Set();
      }

      const arrayValues = [];

      // Process each parent value to extract field values
      for (const parentValue of parentResult) {
        if (typeof parentValue === 'string') {
          // Parent is entity ID - use entitiesGateway
          const componentData = entitiesGateway.getComponentData(
            parentValue,
            node.field
          );
          if (componentData !== undefined) {
            arrayValues.push(componentData);
          }
        } else if (parentValue && typeof parentValue === 'object') {
          // Parent is object - direct property access
          const fieldValue = parentValue[node.field];
          if (fieldValue !== undefined) {
            arrayValues.push(fieldValue);
          }
        }
      }

      // Use flattenIntoSet to flatten all arrays
      const result = flattenIntoSet(arrayValues);

      if (trace) {
        trace.addLog(
          'info',
          `ArrayIterationStep node resolved. Field: '${node.field}', Result size: ${result.size}`,
          'ArrayIterationResolver',
          {
            field: node.field,
            resultSize: result.size,
          }
        );
      }

      return result;
    },
  };
}
