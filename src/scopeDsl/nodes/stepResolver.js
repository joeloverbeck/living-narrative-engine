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
          // Parent is entity ID

          // Special handling for 'components' field
          if (node.field === 'components') {
            const entity = entitiesGateway.getEntityInstance(parentValue);
            if (!entity) continue;

            // All entities must expose componentTypeIds to be queryable
            // This ensures the scopeDSL remains component-agnostic

            // For production Entity objects, build the components object
            let components = {};

            // If entity has componentTypeIds, use that
            if (
              entity.componentTypeIds &&
              Array.isArray(entity.componentTypeIds)
            ) {
              for (const componentTypeId of entity.componentTypeIds) {
                const componentData =
                  entity.getComponentData?.(componentTypeId) ||
                  entitiesGateway.getComponentData(
                    parentValue,
                    componentTypeId
                  );
                if (componentData) {
                  components[componentTypeId] = componentData;
                }
              }
            } else {
              // If entity doesn't have componentTypeIds, we cannot determine which components it has
              // This is an error condition - all entities should properly expose their components
              if (trace) {
                trace.addLog(
                  'warn',
                  `Entity '${parentValue}' does not expose componentTypeIds. Unable to retrieve components.`,
                  'StepResolver',
                  { entityId: parentValue }
                );
              }
              // Return empty components object rather than guessing
              components = {};
            }

            result.add(components);
          } else {
            // Normal component data access
            const componentData = entitiesGateway.getComponentData(
              parentValue,
              node.field
            );

            if (componentData !== undefined) {
              result.add(componentData);
            }
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
