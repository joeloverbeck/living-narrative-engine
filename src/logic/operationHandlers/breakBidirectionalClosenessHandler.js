/**
 * @file BreakBidirectionalClosenessHandler - Consolidates bidirectional relationship removal
 * @see establishBidirectionalClosenessHandler.js for establishment counterpart
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject, validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Breaks bidirectional closeness relationships between actor and target
 * by removing the relationship components from both entities.
 *
 * Used by: release_hug, release_hand, and similar break relationship actions.
 */
class BreakBidirectionalClosenessHandler extends BaseOperationHandler {
  #entityManager;
  #regenerateDescriptionHandler;
  #dispatcher;

  constructor({ entityManager, regenerateDescriptionHandler, safeEventDispatcher, logger }) {
    const depSpec = {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'removeComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    };

    if (regenerateDescriptionHandler) {
      depSpec.regenerateDescriptionHandler = {
        value: regenerateDescriptionHandler,
        requiredMethods: ['execute'],
      };
    }

    super('BreakBidirectionalClosenessHandler', depSpec);
    this.#entityManager = entityManager;
    this.#regenerateDescriptionHandler = regenerateDescriptionHandler;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Updated context
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'BREAK_BIDIRECTIONAL_CLOSENESS')) {
      return executionContext;
    }

    const validation = this.#validateParams(params, log);
    if (!validation) {
      return executionContext;
    }

    const { actorId, targetId } = this.#getPayloadIds(executionContext);

    if (!actorId || !targetId) {
       await safeDispatchError(
        this.#dispatcher,
        'BREAK_BIDIRECTIONAL_CLOSENESS: actorId or targetId missing from event payload',
        { actorId, targetId, payload: executionContext?.evaluationContext?.event?.payload },
        log
      );
      return executionContext;
    }

    // Build complete list of components to remove
    const componentsToRemove = [
      validation.actorComponentType,
      validation.targetComponentType,
      ...validation.additionalComponentTypes,
    ];

    // Remove components from both entities
    for (const componentType of componentsToRemove) {
      await this.#safeRemoveComponent(actorId, componentType, log);
      await this.#safeRemoveComponent(targetId, componentType, log);
    }

    // Regenerate descriptions if enabled
    if (validation.regenerateDescriptions) {
      await this.#regenerateIfPossible(actorId, executionContext, log);
      await this.#regenerateIfPossible(targetId, executionContext, log);
    }

    log.debug(
      `BreakBidirectionalClosenessHandler: Removed ${validation.actorComponentType} <-> ${validation.targetComponentType}`,
      {
        actorId,
        targetId,
        removedComponents: componentsToRemove,
      }
    );

    return executionContext;
  }

  #validateParams(params, logger) {
    const actorComponentType = validateStringParam(
      params.actor_component_type,
      'actor_component_type',
      logger,
      this.#dispatcher
    );
    const targetComponentType = validateStringParam(
      params.target_component_type,
      'target_component_type',
      logger,
      this.#dispatcher
    );

    if (!actorComponentType || !targetComponentType) {
      return null;
    }

    return {
      actorComponentType,
      targetComponentType,
      additionalComponentTypes: Array.isArray(params.additional_component_types_to_remove)
        ? params.additional_component_types_to_remove
        : [],
      regenerateDescriptions: params.regenerate_descriptions !== false,
    };
  }

  #getPayloadIds(executionContext) {
    return {
      actorId: executionContext?.evaluationContext?.event?.payload?.actorId,
      targetId: executionContext?.evaluationContext?.event?.payload?.targetId
    };
  }

  /**
   * Safely removes a component, ignoring errors if component doesn't exist.
   */
  async #safeRemoveComponent(entityId, componentType, logger) {
    try {
      if (this.#entityManager.getComponentData(entityId, componentType)) {
        await this.#entityManager.removeComponent(entityId, componentType);
      }
    } catch (err) {
      logger.debug(
        `Component ${componentType} not found on ${entityId}, skipping removal`
      );
    }
  }

  async #regenerateIfPossible(entityId, executionContext, logger) {
    if (!this.#regenerateDescriptionHandler) {
      logger?.debug?.(
        `BREAK_BIDIRECTIONAL_CLOSENESS: regenerate_descriptions requested but handler not available`,
        { entityId }
      );
      return;
    }

    try {
      await this.#regenerateDescriptionHandler.execute(
        { entity_ref: entityId },
        executionContext
      );
    } catch (error) {
      logger?.warn?.(
        `BREAK_BIDIRECTIONAL_CLOSENESS: description regeneration failed for ${entityId}`,
        { error: error?.message }
      );
    }
  }
}

export default BreakBidirectionalClosenessHandler;
