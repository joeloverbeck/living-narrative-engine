/**
 * @file Handler for PICK_RANDOM_ARRAY_ELEMENT operation
 * @see data/schemas/operations/pickRandomArrayElement.schema.json
 */

import BaseOperationHandler from './baseOperationHandler.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} LocalExecutionContext
 * @property {object} evaluationContext - Evaluation context containing state
 * @property {Record<string, unknown>} evaluationContext.context - Context variables
 * @property {object} evaluationContext.event - Triggering event
 * @property {Record<string, unknown>} [evaluationContext.event.payload] - Event payload
 * @property {object} [jsonLogic] - JSON Logic engine
 * @property {function(unknown, object): unknown} [jsonLogic.evaluate] - Evaluation function
 */

/**
 * Picks a random element from an array field in a component.
 * Stores the selected element (or null if array is empty/missing) in the specified context variable.
 *
 * @augments BaseOperationHandler
 */
class PickRandomArrayElementHandler extends BaseOperationHandler {
  /**
   * Constructor for PickRandomArrayElementHandler.
   *
   * @param {object} deps - Dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager service
   * @param {ILogger} deps.logger - Logger service
   */
  constructor({ entityManager, logger }) {
    super('PickRandomArrayElementHandler', {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      logger: {
        value: logger,
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      },
    });
  }

  /**
   * Execute the PICK_RANDOM_ARRAY_ELEMENT operation.
   *
   * @param {{entity_ref: string|object, component_type: string, array_field?: string, result_variable: string}} params - Operation parameters
   * @param {LocalExecutionContext} context - Execution context
   * @returns {Promise<void>}
   */
  async execute(params, context) {
    const { entity_ref, component_type, array_field, result_variable } = params;

    /** @type {IEntityManager} */
    const entityManager = this.deps.entityManager;
    // @ts-ignore - BaseOperationHandler.getLogger expects ExecutionContext but works with our Local structure
    const logger = this.getLogger(context);

    // Resolve entity_ref to get the entity ID
    const entityId = this._resolveEntityId(entity_ref, context);

    if (!entityId) {
      logger.warn(
        'PickRandomArrayElementHandler: Could not resolve entity_ref, storing null'
      );
      this._storeResult(context, result_variable, null);
      return;
    }

    // Get the component data
    const componentData = entityManager.getComponentData(entityId, component_type);

    if (!componentData) {
      logger.debug(
        `PickRandomArrayElementHandler: Entity ${entityId} has no ${component_type} component, storing null`
      );
      this._storeResult(context, result_variable, null);
      return;
    }

    // Extract the array from the component
    const array = this._extractArray(componentData, array_field, component_type);

    if (!Array.isArray(array) || array.length === 0) {
      logger.debug(
        `PickRandomArrayElementHandler: Array is empty or not found in ${component_type}${array_field ? '.' + array_field : ''}, storing null`
      );
      this._storeResult(context, result_variable, null);
      return;
    }

    // Pick a random element
    const randomIndex = Math.floor(Math.random() * array.length);
    const result = array[randomIndex];

    logger.debug(
      `PickRandomArrayElementHandler: Selected element at index ${randomIndex} from ${array.length} elements`
    );

    this._storeResult(context, result_variable, result);
  }

  /**
   * Resolve entity_ref to an entity ID.
   *
   * @param {string|object} entityRef - Entity reference (can be 'actor', 'target', {entityId: ...}, or context reference)
   * @param {LocalExecutionContext} context - Execution context
   * @returns {string|null} Resolved entity ID or null
   * @private
   */
  _resolveEntityId(entityRef, context) {
    // Handle string references
    if (typeof entityRef === 'string') {
      // Check for special keywords
      if (entityRef === 'actor') {
        return context.evaluationContext?.event?.payload?.actorId ??
          context.evaluationContext?.context?.actorId ?? null;
      }
      if (entityRef === 'target') {
        return context.evaluationContext?.event?.payload?.targetId ??
          context.evaluationContext?.context?.targetId ?? null;
      }

      // Check for context reference pattern {context.varName}
      const contextMatch = entityRef.match(/^\{context\.(\w+)\}$/);
      if (contextMatch && context.evaluationContext?.context) {
        const value = context.evaluationContext.context[contextMatch[1]];
        return typeof value === 'string' ? value : null;
      }

      // Check for event reference pattern {event.payload.something}
      const eventMatch = entityRef.match(/^\{event\.payload\.(\w+)\}$/);
      if (eventMatch && context.evaluationContext?.event?.payload) {
        const value = context.evaluationContext.event.payload[eventMatch[1]];
        return typeof value === 'string' ? value : null;
      }

      // Assume it's a direct entity ID
      return entityRef;
    }

    // Handle object references like {entityId: "..."} or {entityId: {context reference}}
    if (typeof entityRef === 'object' && entityRef !== null) {
      if ('entityId' in entityRef) {
        const innerRef = entityRef.entityId;
        if (typeof innerRef === 'string') {
          // Recursively resolve in case it's a context reference
          return this._resolveEntityId(innerRef, context);
        }
      }

      // Handle JSON Logic evaluation if available
      if (context.jsonLogic && typeof context.jsonLogic.evaluate === 'function') {
        const result = context.jsonLogic.evaluate(entityRef, context.evaluationContext);
        if (typeof result === 'string') {
          return result;
        }
        if (typeof result === 'object' && result !== null && 'id' in result) {
          return result.id;
        }
      }
    }

    return null;
  }

  /**
   * Extract array from component data.
   *
   * @param {object} componentData - Component data
   * @param {string|undefined} arrayField - Optional path to array field
   * @param {string} componentType - Component type for smart defaults
   * @returns {Array|null} The array or null if not found
   * @private
   */
  _extractArray(componentData, arrayField, componentType) {
    // If array_field is specified, use it as the path
    if (arrayField) {
      // Support nested paths like "items.weapons"
      const parts = arrayField.split('.');
      let current = componentData;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return null;
        }
      }
      return Array.isArray(current) ? current : null;
    }

    // Smart defaults based on component type
    // For movement:exits, the array is typically in .exits
    if (componentType === 'movement:exits') {
      if (Array.isArray(componentData.exits)) {
        return componentData.exits;
      }
      // Fallback: component data might be the array itself
      if (Array.isArray(componentData)) {
        return componentData;
      }
    }

    // Generic fallback: check if componentData is an array
    if (Array.isArray(componentData)) {
      return componentData;
    }

    // Check common array field names
    if (Array.isArray(componentData.items)) {
      return componentData.items;
    }
    if (Array.isArray(componentData.elements)) {
      return componentData.elements;
    }
    if (Array.isArray(componentData.values)) {
      return componentData.values;
    }

    return null;
  }

  /**
   * Store result in context.
   *
   * @param {LocalExecutionContext} context - Execution context
   * @param {string} resultVariable - Variable name to store result
   * @param {unknown} value - Value to store
   * @private
   */
  _storeResult(context, resultVariable, value) {
    if (context.evaluationContext && context.evaluationContext.context) {
      context.evaluationContext.context[resultVariable] = value;
    }
  }
}

export default PickRandomArrayElementHandler;
