/**
 * @file Handler for REMOVE_FROM_CLOSENESS_CIRCLE operation
 *
 * Removes an actor from their closeness circle by updating all partners' lists and conditionally
 * removing empty closeness components, with automatic movement lock updates.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, optional result_variable)
 * 2. Retrieve actor's closeness component and partner list
 * 3. For each partner, remove actor from their partners list
 * 4. Remove closeness components that become empty, update others
 * 5. Unlock movement for all actors who no longer have closeness relationships
 *
 * Related files:
 * @see data/schemas/operations/removeFromClosenessCircle.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - RemoveFromClosenessCircleHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import { updateMovementLock } from '../../utils/movementUtils.js';

class RemoveFromClosenessCircleHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {object} */
  #closenessCircleService;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {object} deps.closenessCircleService
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    closenessCircleService,
  }) {
    super('RemoveFromClosenessCircleHandler', {
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
      closenessCircleService: {
        value: closenessCircleService,
        requiredMethods: ['repair'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#closenessCircleService = closenessCircleService;
  }

  /**
   * @param {{ actor_id: string, result_variable?: string } | null | undefined} params
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;
    const { actorId, resultVar, logger } = validated;

    const { partners, toUnlock } = await this.#removePartners(actorId);
    await this.#unlockMovement(toUnlock);

    if (resultVar) {
      if (
        !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
      ) {
        return;
      }
      tryWriteContextVariable(
        resultVar,
        partners,
        executionContext,
        this.#dispatcher,
        logger
      );
    }
  }

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   * @returns {{ actorId:string, resultVar:string|null, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, log, 'REMOVE_FROM_CLOSENESS_CIRCLE')) {
      return null;
    }
    const { actor_id, result_variable } = params;

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'REMOVE_FROM_CLOSENESS_CIRCLE: Invalid "actor_id" parameter',
        { params },
        this.logger
      );
      return null;
    }

    return {
      actorId: actor_id.trim(),
      resultVar:
        typeof result_variable === 'string' ? result_variable.trim() : null,
      logger: log,
    };
  }

  /**
   * Remove the actor from partner lists and gather unlock targets.
   *
   * @param {string} actorId
   * @returns {Promise<{ partners:string[], toUnlock:string[] }>}
   * @private
   */
  async #removePartners(actorId) {
    const closeness = this.#entityManager.getComponentData(
      actorId,
      'personal-space-states:closeness'
    );
    const partners = Array.isArray(closeness?.partners)
      ? [...closeness.partners]
      : [];
    const toUnlock = [];

    for (const pid of partners) {
      const partnerData = this.#entityManager.getComponentData(
        pid,
        'personal-space-states:closeness'
      );
      if (!partnerData) continue;
      const updated = partnerData.partners.filter((p) => p !== actorId);
      const repaired = this.#closenessCircleService.repair(updated);
      if (repaired.length === 0) {
        await this.#entityManager.removeComponent(pid, 'personal-space-states:closeness');
        toUnlock.push(pid);
      } else {
        await this.#entityManager.addComponent(pid, 'personal-space-states:closeness', {
          partners: repaired,
        });
      }
    }

    if (closeness) {
      await this.#entityManager.removeComponent(
        actorId,
        'personal-space-states:closeness'
      );
      toUnlock.push(actorId);
    }

    return { partners, toUnlock };
  }

  /**
   * Unlock movement for the specified entities.
   *
   * @param {string[]} ids
   * @returns {void}
   * @private
   */
  async #unlockMovement(ids) {
    for (const id of ids) {
      await updateMovementLock(this.#entityManager, id, false);
    }
  }
}

export default RemoveFromClosenessCircleHandler;
