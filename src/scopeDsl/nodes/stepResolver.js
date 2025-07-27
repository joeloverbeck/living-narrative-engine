/**
 * Creates a Step node resolver for field access operations.
 * Resolves Step nodes by extracting field values from parent results.
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
import { getOrBuildComponents } from '../core/entityHelpers.js';

/**
 *
 * @param root0
 * @param root0.entitiesGateway
 */
export default function createStepResolver({ entitiesGateway }) {
  /**
   * Retrieves a single component value from an entity.
   *
   * @description Returns the data for the specified component type.
   * @param {string} entityId - Target entity ID.
   * @param {string} field - Component type ID to fetch.
   * @returns {any} The component data or undefined.
   */
  function extractFieldFromEntity(entityId, field) {
    // First try to get it as a component
    const componentData = entitiesGateway.getComponentData(entityId, field);
    if (componentData !== undefined) {
      return componentData; // Return null or any other value, but not undefined
    }

    // If not found as a component, search within all component data for the field
    const entity = entitiesGateway.getEntityInstance(entityId);
    if (entity && entity.componentTypeIds) {
      for (const componentId of entity.componentTypeIds) {
        const compData = entitiesGateway.getComponentData(
          entityId,
          componentId
        );
        if (compData && typeof compData === 'object' && field in compData) {
          return compData[field];
        }
      }
    }

    return undefined;
  }

  /**
   * Extracts a property value from an object.
   *
   * @description Reads the given field directly from the object.
   * @param {object} obj - Source object.
   * @param {string} field - Property to read.
   * @returns {any} Property value or undefined.
   */
  function extractFieldFromObject(obj, field) {
    return obj[field];
  }

  /**
   * Resolves a value from a parent entity.
   *
   * @description Retrieves the requested component or components object.
   * @param {string} entityId - ID of the entity to inspect.
   * @param {string} field - Field name requested.
   * @param {object} [trace] - Optional trace logger.
   * @returns {any} Extracted value or undefined.
   */
  function resolveEntityParentValue(entityId, field, trace) {
    if (field === 'components') {
      return getOrBuildComponents(entityId, null, entitiesGateway, trace);
    }

    return extractFieldFromEntity(entityId, field);
  }

  /**
   * Resolves a value from a parent object.
   *
   * @description Reads the given property directly from the object.
   * @param {object} obj - Object containing the field.
   * @param {string} field - Field name to extract.
   * @returns {any} Extracted value or undefined.
   */
  function resolveObjectParentValue(obj, field) {
    return extractFieldFromObject(obj, field);
  }

  /**
   * Adds a trace log entry for step resolution.
   *
   * @description Writes an informational trace if tracing is enabled.
   * @param {object} trace - Trace logger.
   * @param {string} message - Message to log.
   * @param {object} data - Additional log data.
   */
  function logStepResolution(trace, message, data) {
    if (trace) {
      trace.addLog('info', message, 'StepResolver', data);
    }
  }

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

      // Validate context has required properties
      if (!ctx.actorEntity) {
        const error = new Error(
          'StepResolver: actorEntity is missing from context'
        );
        console.error('[CRITICAL] StepResolver missing actorEntity:', {
          hasCtx: !!ctx,
          ctxKeys: ctx ? Object.keys(ctx) : [],
          nodeType: node?.type,
          field: node?.field,
          parentNodeType: node?.parent?.type,
          depth: ctx?.depth,
          callStack: new Error().stack,
        });
        throw error;
      }

      // Use dispatcher to resolve parent node - pass full context
      const parentResult = ctx.dispatcher.resolve(node.parent, ctx);

      logStepResolution(
        trace,
        `Resolving Step node with field '${node.field}'. Parent result size: ${parentResult.size}`,
        {
          field: node.field,
          parentSize: parentResult.size,
        }
      );

      // Return empty set if parent is empty
      if (parentResult.size === 0) {
        return new Set();
      }

      const result = new Set();

      for (const parentValue of parentResult) {
        if (typeof parentValue === 'string') {
          // Special case: location.entities(componentId)
          if (
            node.field === 'entities' &&
            node.param &&
            node.parent?.type === 'Source' &&
            node.parent?.kind === 'location'
          ) {
            // Get all entities with the specified component at this location
            const componentId = node.param;
            const locationId = parentValue;
            const entitiesWithComponent =
              entitiesGateway.getEntitiesWithComponent(componentId);

            if (entitiesWithComponent) {
              for (const entity of entitiesWithComponent) {
                // Check if entity is at this location
                const posData = entitiesGateway.getComponentData(
                  entity.id,
                  'core:position'
                );
                if (posData && posData.locationId === locationId) {
                  result.add(entity.id);
                }
              }
            }
          } else {
            const val = resolveEntityParentValue(
              parentValue,
              node.field,
              trace
            );
            if (node.field === 'components') {
              if (val) result.add(val);
            } else if (val !== undefined) {
              result.add(val);
            }
          }
        } else if (parentValue && typeof parentValue === 'object') {
          const val = resolveObjectParentValue(parentValue, node.field);
          if (val !== undefined) {
            result.add(val);
          }
        }
      }

      logStepResolution(
        trace,
        `Step node resolved. Field: '${node.field}', Result size: ${result.size}`,
        {
          field: node.field,
          resultSize: result.size,
        }
      );

      return result;
    },
  };
}
