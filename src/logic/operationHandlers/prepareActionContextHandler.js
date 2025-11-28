/**
 * @file PrepareActionContextHandler - Consolidates common action context setup
 * @see establishSittingClosenessHandler.js for closeness pattern reference
 */

import BaseOperationHandler from './baseOperationHandler.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../types/executionTypes.js').ExecutionContext} ExecutionContext */

/**
 * Prepares common context variables for action rules:
 * - actorName, targetName, locationId, targetId, perceptionType
 * - Optionally: secondaryName if include_secondary is true
 */
class PrepareActionContextHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;

  /**
   * Constructor for PrepareActionContextHandler.
   *
   * @param {object} deps - Dependencies object.
   * @param {EntityManager} deps.entityManager - The entity manager instance.
   * @param {ILogger} deps.logger - The logger instance.
   */
  constructor({ entityManager, logger }) {
    super('PrepareActionContextHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance', 'getComponentData'],
      },
    });
    this.#entityManager = entityManager;
  }

  /**
   * Executes the context preparation operation.
   *
   * @param {object} parameters - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context containing event and parameters.
   * @returns {Promise<ExecutionContext>} Updated context with prepared variables.
   */
  async execute(parameters, executionContext) {
    // @ts-ignore - ExecutionContext type resolution issue
    const { evaluationContext } = executionContext;
    const { event } = evaluationContext;
    
    /** @type {{ perception_type?: string, include_secondary?: boolean, secondary_name_variable?: string }} */
    const params = parameters || {};
    
    const {
      perception_type = 'action_target_general',
      include_secondary = false,
      secondary_name_variable = 'secondaryName',
    } = params;

    if (!event || !event.payload) {
      this.logger.warn('PrepareActionContextHandler: No event payload found.');
      return executionContext;
    }

    // Ensure context object exists
    if (!evaluationContext.context) {
      evaluationContext.context = {};
    }
    const contextVars = evaluationContext.context;

    // 1. Resolve actor name
    // @ts-ignore - Payload structure is dynamic
    const actorId = event.payload.actorId;
    const actorName = this.#resolveEntityName(actorId);

    // 2. Resolve target name
    // @ts-ignore - Payload structure is dynamic
    const targetId = event.payload.targetId;
    const targetName = this.#resolveEntityName(targetId);

    // 3. Query actor position for locationId
    /** @type {{ locationId?: string } | undefined} */
    // @ts-ignore - getComponentData return type might not match exactly what we expect without generics
    const actorPosition = this.#entityManager.getComponentData(
      actorId,
      'core:position'
    );
    const locationId = actorPosition?.locationId ?? null;

    // 4. Set context variables
    contextVars.actorName = actorName;
    contextVars.targetName = targetName;
    contextVars.locationId = locationId;
    contextVars.targetId = targetId;
    contextVars.perceptionType = perception_type;

    // 5. Optionally resolve secondary name
    // @ts-ignore - Payload structure is dynamic
    if (include_secondary && event.payload.secondaryId) {
      // @ts-ignore - Payload structure is dynamic
      const secondaryName = this.#resolveEntityName(
        event.payload.secondaryId
      );
      contextVars[secondary_name_variable] = secondaryName;
    }

    this.logger.debug(
      `PrepareActionContextHandler: Prepared context for action`,
      {
        actorId,
        targetId,
        locationId,
        perceptionType: perception_type,
        includeSecondary: include_secondary,
      }
    );

    return executionContext;
  }

  /**
   * Resolves entity name using core:name component (primary), then
   * falls back to core:actor.name or core:item.name.
   * Matches GetNameHandler behavior for consistency.
   *
   * @param {string} entityId - The ID of the entity to resolve.
   * @returns {string} Entity name or fallback.
   */
  #resolveEntityName(entityId) {
    if (!entityId) return 'Unknown';

    // Try core:name first (primary name component, used by GetNameHandler)
    /** @type {{ text?: string } | undefined} */
    // @ts-ignore
    const nameComponent = this.#entityManager.getComponentData(
      entityId,
      'core:name'
    );
    if (nameComponent?.text) {
      return nameComponent.text.trim();
    }

    // Try core:actor.name as fallback
    /** @type {{ name?: string } | undefined} */
    // @ts-ignore
    const actorComponent = this.#entityManager.getComponentData(
      entityId,
      'core:actor'
    );
    if (actorComponent?.name) {
      return actorComponent.name;
    }

    // Try core:item.name as fallback
    /** @type {{ name?: string } | undefined} */
    // @ts-ignore
    const itemComponent = this.#entityManager.getComponentData(
      entityId,
      'core:item'
    );
    if (itemComponent?.name) {
      return itemComponent.name;
    }

    // Fallback to entity ID
    return entityId;
  }
}

export default PrepareActionContextHandler;
