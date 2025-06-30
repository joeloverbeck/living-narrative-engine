/**
 * Creates a Step node resolver for field access operations.
 * Resolves Step nodes by extracting field values from parent results.
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
import { buildComponents } from '../core/entityComponentUtils.js';

/**
 *
 * @param root0
 * @param root0.entitiesGateway
 */
export default function createStepResolver({ entitiesGateway }) {
  /**
   * Builds a components object for the given entity ID.
   *
   * @description Retrieves all component data for the specified entity.
   * @param {string} entityId - ID of the entity to inspect.
   * @param {object} [trace] - Optional trace logger.
   * @returns {object|null} Components keyed by type or null if entity missing.
   */
  function getComponentsForEntity(entityId, trace) {
    const entity = entitiesGateway.getEntityInstance(entityId);
    if (!entity) return null;

    if (!entity.componentTypeIds || !Array.isArray(entity.componentTypeIds)) {
      if (trace) {
        trace.addLog(
          'warn',
          `Entity '${entityId}' does not expose componentTypeIds. Unable to retrieve components.`,
          'StepResolver',
          { entityId }
        );
      }
      return {};
    }

    return buildComponents(entityId, entity, entitiesGateway);
  }

  /**
   * Retrieves a single component value from an entity.
   *
   * @description Returns the data for the specified component type.
   * @param {string} entityId - Target entity ID.
   * @param {string} field - Component type ID to fetch.
   * @returns {any} The component data or undefined.
   */
  function extractFieldFromEntity(entityId, field) {
    return entitiesGateway.getComponentData(entityId, field);
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
   * Processes a parent value that is an entity ID.
   *
   * @param {string} entityId - ID of the entity to inspect.
   * @param {string} field - Field name requested.
   * @param {object} [trace] - Optional trace logger.
   * @returns {any} Extracted value or undefined/null.
   */
  function processEntityParentValue(entityId, field, trace) {
    if (field === 'components') {
      return getComponentsForEntity(entityId, trace);
    }

    return extractFieldFromEntity(entityId, field);
  }

  /**
   * Processes a parent value that is a plain object.
   *
   * @param {object} obj - Object containing the field.
   * @param {string} field - Field name to extract.
   * @returns {any} Extracted value or undefined.
   */
  function processObjectParentValue(obj, field) {
    return extractFieldFromObject(obj, field);
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

      for (const parentValue of parentResult) {
        if (typeof parentValue === 'string') {
          const val = processEntityParentValue(parentValue, node.field, trace);
          if (node.field === 'components') {
            if (val) result.add(val);
          } else if (val !== undefined) {
            result.add(val);
          }
        } else if (parentValue && typeof parentValue === 'object') {
          const val = processObjectParentValue(parentValue, node.field);
          if (val !== undefined) result.add(val);
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
