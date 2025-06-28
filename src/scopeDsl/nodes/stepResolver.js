/**
 * Creates a Step node resolver for field access operations.
 * Resolves Step nodes by extracting field values from parent results.
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createStepResolver({ entitiesGateway }) {
  return {
    /**
     * Checks if this resolver can handle the given node.
     *
     * @param {object} node - The node to check
     * @returns {boolean} True if node type is 'Step'
     */
    canResolve(node) {
      return node.type === 'Step';
    },

    /**
     * Resolves a Step node by extracting field values from parent results.
     *
     * @param {object} node - The Step node to resolve
     * @param {object} ctx - Resolution context with actorEntity, trace, etc.
     * @returns {Set} Set of field values (no flattening)
     */
    resolve(node, ctx) {
      const trace = ctx.trace;

      // Use dispatcher to resolve parent node
      const parentResult = ctx.dispatcher.resolve(node.parent, ctx);

      if (trace) {
        trace.addLog(
          'info',
          `Resolving Step node with field '${node.field}'. Parent result size: ${parentResult.size}`,
          'StepResolver',
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

      const result = new Set();

      // Process each parent value
      for (const parentValue of parentResult) {
        if (typeof parentValue === 'string') {
          // Parent is entity ID - use entitiesGateway
          const componentData = entitiesGateway.getComponentData(
            parentValue,
            node.field
          );
          if (componentData !== undefined) {
            result.add(componentData);
          }
        } else if (parentValue && typeof parentValue === 'object') {
          // Parent is object - direct property access
          const fieldValue = parentValue[node.field];
          if (fieldValue !== undefined) {
            result.add(fieldValue);
          }
        }
      }

      if (trace) {
        trace.addLog(
          'info',
          `Step node resolved. Field: '${node.field}', Result size: ${result.size}`,
          'StepResolver',
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
