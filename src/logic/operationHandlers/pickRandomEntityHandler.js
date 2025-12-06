/**
 * @file Handler for PICK_RANDOM_ENTITY operation
 * @see data/schemas/operations/pickRandomEntity.schema.json
 */

import BaseOperationHandler from './baseOperationHandler.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */

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
 * Picks a random entity from a location with optional exclusions and component filters.
 * Stores the selected entity ID (or null if no candidates) in the specified context variable.
 *
 * @augments BaseOperationHandler
 */
class PickRandomEntityHandler extends BaseOperationHandler {
  /**
   * Constructor for PickRandomEntityHandler.
   *
   * @param {object} deps - Dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager service
   * @param {ILogger} deps.logger - Logger service
   */
  constructor({ entityManager, logger }) {
    super('PickRandomEntityHandler', {
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getEntitiesWithComponent',
          'getComponentData',
          'hasComponent',
        ],
      },
      logger: {
        value: logger,
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      },
    });
  }

  /**
   * Execute the PICK_RANDOM_ENTITY operation.
   *
   * @param {{location_id: string, exclude_entities?: string[], require_components?: string[], exclude_components?: string[], result_variable: string}} params - Operation parameters
   * @param {LocalExecutionContext} context - Execution context
   * @returns {Promise<void>}
   */
  async execute(params, context) {
    const {
      location_id,
      exclude_entities = [],
      require_components = [],
      exclude_components = [],
      result_variable,
    } = params;

    /** @type {IEntityManager} */
    const entityManager = this.deps.entityManager;
    // @ts-ignore - BaseOperationHandler.getLogger expects ExecutionContext but works with our Local structure
    const logger = this.getLogger(context);

    // Resolve location_id if it's a context reference
    const locationId = /** @type {string} */ (
      this._resolveValue(location_id, context)
    );

    if (!locationId || typeof locationId !== 'string') {
      logger.warn(
        'PickRandomEntityHandler: No location_id provided or invalid, storing null'
      );
      if (context.evaluationContext && context.evaluationContext.context) {
        context.evaluationContext.context[result_variable] = null;
      }
      return;
    }

    // Resolve excluded entity IDs
    const excludedIds = new Set(
      exclude_entities.map((id) => this._resolveValue(id, context))
    );

    // Get all entities at location
    // Note: IEntityManager.getEntitiesInLocation is not implemented in the facade,
    // so we manually filter entities with core:position component.
    const entitiesAtLocation = entityManager
      .getEntitiesWithComponent('core:position')
      .filter((entity) => {
        const pos = entityManager.getComponentData(entity.id, 'core:position');
        // @ts-ignore - Position component data is generic object
        return pos?.locationId === locationId;
      })
      .map((entity) => entity.id);

    // Filter candidates
    const candidates = entitiesAtLocation.filter((entityId) => {
      // Skip excluded entities
      if (excludedIds.has(entityId)) {
        return false;
      }

      // Check required components (must have ALL)
      for (const componentType of require_components) {
        if (!entityManager.hasComponent(entityId, componentType)) {
          return false;
        }
      }

      // Check excluded components (must NOT have ANY)
      for (const componentType of exclude_components) {
        if (entityManager.hasComponent(entityId, componentType)) {
          return false;
        }
      }

      return true;
    });

    // Pick random candidate or null
    let result = null;
    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      result = candidates[randomIndex];
      logger.debug(
        `PickRandomEntityHandler: Selected entity ${result} from ${candidates.length} candidates`
      );
    } else {
      logger.debug(
        'PickRandomEntityHandler: No candidates found, storing null'
      );
    }

    // Store result in context
    if (context.evaluationContext && context.evaluationContext.context) {
      context.evaluationContext.context[result_variable] = result;
    }
  }

  /**
   * Resolve a value that may be a string, context reference, or JSON Logic expression.
   *
   * @param {string|object} value - Value to resolve
   * @param {LocalExecutionContext} context - Execution context
   * @returns {unknown} Resolved value
   * @private
   */
  _resolveValue(value, context) {
    if (typeof value === 'string') {
      // Check for context reference pattern {context.varName}
      const match = value.match(/^\{context\.(\w+)\}$/);
      if (match && context.evaluationContext?.context) {
        return context.evaluationContext.context[match[1]];
      }
      // Check for event reference pattern {event.payload.something}
      const eventMatch = value.match(/^\{event\.payload\.(\w+)\}$/);
      if (
        eventMatch &&
        context.evaluationContext?.event &&
        context.evaluationContext.event.payload
      ) {
        // @ts-ignore - payload is generic object
        return context.evaluationContext.event.payload[eventMatch[1]];
      }
      return value;
    }
    // For objects, assume JSON Logic and evaluate
    if (typeof value === 'object' && value !== null) {
      // Use JSON Logic evaluation if available in context
      if (
        context.jsonLogic &&
        typeof context.jsonLogic.evaluate === 'function'
      ) {
        return context.jsonLogic.evaluate(value, context.evaluationContext);
      }
    }
    return value;
  }
}

export default PickRandomEntityHandler;
