/**
 * @file Handler for ESTABLISH_BIDIRECTIONAL_CLOSENESS operation
 *
 * Establishes mutual closeness components between actor and target while cleaning
 * any pre-existing relationships on either side.
 */

/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

import BaseOperationHandler from './baseOperationHandler.js';
import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { isPlainObject, resolvePath } from '../../utils/objectUtils.js';

const OPERATION_NAME = 'ESTABLISH_BIDIRECTIONAL_CLOSENESS';
const REFERENCE_FIELDS = [
  'embraced_entity_id',
  'hugging_entity_id',
  'holding_hand_of',
  'hand_held_by',
  'partner_id',
  'target_id',
  'actor_id',
];

class EstablishBidirectionalClosenessHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;
  #regenerateDescriptionHandler;

  constructor({
    entityManager,
    safeEventDispatcher,
    regenerateDescriptionHandler,
    logger,
  }) {
    const depSpec = {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'removeComponent',
        ],
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

    super('EstablishBidirectionalClosenessHandler', depSpec);
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#regenerateDescriptionHandler = regenerateDescriptionHandler ?? null;
  }

  /**
   * Establishes bidirectional closeness between actor and target.
   *
   * @param {OperationParams} params - Operation parameters defined by the ESTABLISH_BIDIRECTIONAL_CLOSENESS schema.
   * @param {ExecutionContext} executionContext - Current execution context carrying actor/target payload and logger.
   * @returns {Promise<null>} Always resolves to null after the operation completes or aborts.
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, OPERATION_NAME)) {
      return null;
    }

    const validation = this.#validateParams(params, log);
    if (!validation) {
      return null;
    }

    const actorId =
      executionContext?.evaluationContext?.event?.payload?.actorId;
    const targetId =
      executionContext?.evaluationContext?.event?.payload?.targetId;

    if (!actorId || !targetId) {
      await safeDispatchError(
        this.#dispatcher,
        `${OPERATION_NAME}: actorId or targetId missing from event payload`,
        {
          actorId,
          targetId,
          payload: executionContext?.evaluationContext?.event?.payload,
        },
        log
      );
      return null;
    }

    const resolvedActorData = this.#resolveTemplates(
      params.actor_data,
      executionContext?.evaluationContext,
      log
    );
    const resolvedTargetData = this.#resolveTemplates(
      params.target_data,
      executionContext?.evaluationContext,
      log
    );

    const typesToClean = this.#normalizeTypes(
      params.existing_component_types_to_clean,
      validation.actorComponentType,
      validation.targetComponentType
    );

    try {
      if (validation.cleanExisting) {
        await this.#cleanExistingRelationships(actorId, typesToClean, log);
        await this.#cleanExistingRelationships(targetId, typesToClean, log);
      }

      await this.#removeComponents(actorId, typesToClean, log);
      await this.#removeComponents(targetId, typesToClean, log);

      await this.#entityManager.addComponent(
        actorId,
        validation.actorComponentType,
        resolvedActorData
      );
      await this.#entityManager.addComponent(
        targetId,
        validation.targetComponentType,
        resolvedTargetData
      );

      if (validation.regenerateDescriptions) {
        await this.#regenerateIfPossible(actorId, executionContext, log);
        await this.#regenerateIfPossible(targetId, executionContext, log);
      }

      log.debug(
        `${OPERATION_NAME}: Established ${validation.actorComponentType} <-> ${validation.targetComponentType}`,
        { actorId, targetId, cleanedTypes: typesToClean }
      );
    } catch (error) {
      await safeDispatchError(
        this.#dispatcher,
        `${OPERATION_NAME}: handler failed`,
        {
          error: error?.message || error,
          actorId,
          targetId,
        },
        log
      );
    }

    return null;
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

    if (!isPlainObject(params.actor_data)) {
      safeDispatchError(
        this.#dispatcher,
        `${OPERATION_NAME}: "actor_data" must be an object`,
        { actor_data: params.actor_data },
        logger
      );
      return null;
    }

    if (!isPlainObject(params.target_data)) {
      safeDispatchError(
        this.#dispatcher,
        `${OPERATION_NAME}: "target_data" must be an object`,
        { target_data: params.target_data },
        logger
      );
      return null;
    }

    return {
      actorComponentType,
      targetComponentType,
      cleanExisting: params.clean_existing !== false,
      regenerateDescriptions: params.regenerate_descriptions !== false,
    };
  }

  #normalizeTypes(existingTypes, actorType, targetType) {
    const baseTypes = Array.isArray(existingTypes)
      ? existingTypes
      : [actorType, targetType];

    const trimmed = baseTypes
      .filter((type) => typeof type === 'string')
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    return Array.from(new Set(trimmed));
  }

  #resolveTemplates(data, evaluationContext, logger) {
    if (!isPlainObject(data)) {
      return data;
    }

    const resolverRoot = evaluationContext || {};

    const recurse = (value) => {
      if (typeof value === 'string') {
        return value.replace(/\{([^}]+)\}/g, (match, path) => {
          const resolved = resolvePath(resolverRoot, path.trim());
          return resolved !== undefined ? String(resolved) : match;
        });
      }

      if (Array.isArray(value)) {
        return value.map((entry) => recurse(entry));
      }

      if (isPlainObject(value)) {
        const next = {};
        for (const [key, val] of Object.entries(value)) {
          next[key] = recurse(val);
        }
        return next;
      }

      return value;
    };

    try {
      return recurse(data);
    } catch (error) {
      logger?.warn?.(
        `${OPERATION_NAME}: Failed to resolve template variables`,
        {
          error: error?.message,
        }
      );
      return data;
    }
  }

  async #cleanExistingRelationships(entityId, componentTypes, logger) {
    for (const componentType of componentTypes) {
      let componentData;
      try {
        componentData = this.#entityManager.getComponentData(
          entityId,
          componentType
        );
      } catch (error) {
        logger?.debug?.(
          `${OPERATION_NAME}: Unable to read component ${componentType} for ${entityId}`,
          { error: error?.message }
        );
        continue;
      }

      if (!componentData) continue;

      const partnerId = this.#extractPartnerId(componentData);
      if (!partnerId || partnerId === entityId) continue;

      for (const typeToRemove of componentTypes) {
        await this.#safeRemoveComponent(partnerId, typeToRemove, logger);
      }

      logger?.debug?.(`${OPERATION_NAME}: cleaned partner component`, {
        entityId,
        partnerId,
        componentType,
      });
    }
  }

  async #removeComponents(entityId, componentTypes, logger) {
    for (const componentType of componentTypes) {
      await this.#safeRemoveComponent(entityId, componentType, logger);
    }
  }

  async #safeRemoveComponent(entityId, componentType, logger) {
    try {
      const existing = this.#entityManager.getComponentData(
        entityId,
        componentType
      );
      if (existing) {
        await this.#entityManager.removeComponent(entityId, componentType);
      }
    } catch (error) {
      logger?.debug?.(
        `${OPERATION_NAME}: skipping removal for ${componentType} on ${entityId}`,
        { error: error?.message }
      );
    }
  }

  #extractPartnerId(componentData) {
    for (const field of REFERENCE_FIELDS) {
      if (componentData[field]) {
        return componentData[field];
      }
    }
    return null;
  }

  async #regenerateIfPossible(entityId, executionContext, logger) {
    if (!this.#regenerateDescriptionHandler) {
      logger?.debug?.(
        `${OPERATION_NAME}: regenerate_descriptions requested but handler not available`,
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
        `${OPERATION_NAME}: description regeneration failed for ${entityId}`,
        { error: error?.message }
      );
    }
  }
}

export default EstablishBidirectionalClosenessHandler;
