/**
 * @file Handler for REMOVE_FROM_CLOSENESS_CIRCLE.
 * Removes an actor from all partner lists and cleans up closeness components.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import ClosenessCircleService from '../services/closenessCircleService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';
import {
  initHandlerLogger,
  validateDeps,
  getExecLogger,
} from '../../utils/handlerUtils/serviceUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

class RemoveFromClosenessCircleHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    this.#logger = initHandlerLogger(
      'RemoveFromClosenessCircleHandler',
      logger
    );
    validateDeps('RemoveFromClosenessCircleHandler', this.#logger, {
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
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @param {{ actor_id: string, result_variable?: string } | null | undefined} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const validated = this.#validateParams(params, execCtx);
    if (!validated) return;
    const { actorId, resultVar, logger } = validated;

    const { partners, toUnlock } = this.#removePartners(actorId);
    this.#unlockMovement(toUnlock);

    if (resultVar) {
      tryWriteContextVariable(
        resultVar,
        partners,
        execCtx,
        this.#dispatcher,
        logger
      );
    }
  }

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} execCtx
   * @returns {{ actorId:string, resultVar:string|null, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, execCtx) {
    const log = getExecLogger(this.#logger, execCtx);

    if (!assertParamsObject(params, log, 'REMOVE_FROM_CLOSENESS_CIRCLE')) {
      return null;
    }
    const { actor_id, result_variable } = params;

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'REMOVE_FROM_CLOSENESS_CIRCLE: Invalid "actor_id" parameter',
        details: { params },
      });
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
   * @returns {{ partners:string[], toUnlock:string[] }}
   * @private
   */
  #removePartners(actorId) {
    const closeness = this.#entityManager.getComponentData(
      actorId,
      'intimacy:closeness'
    );
    const partners = Array.isArray(closeness?.partners)
      ? [...closeness.partners]
      : [];
    const toUnlock = [];

    for (const pid of partners) {
      const partnerData = this.#entityManager.getComponentData(
        pid,
        'intimacy:closeness'
      );
      if (!partnerData) continue;
      const updated = partnerData.partners.filter((p) => p !== actorId);
      const repaired = ClosenessCircleService.repair(updated);
      if (repaired.length === 0) {
        this.#entityManager.removeComponent(pid, 'intimacy:closeness');
        toUnlock.push(pid);
      } else {
        this.#entityManager.addComponent(pid, 'intimacy:closeness', {
          partners: repaired,
        });
      }
    }

    if (closeness) {
      this.#entityManager.removeComponent(actorId, 'intimacy:closeness');
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
  #unlockMovement(ids) {
    for (const id of ids) {
      const move =
        this.#entityManager.getComponentData(id, 'core:movement') || {};
      this.#entityManager.addComponent(id, 'core:movement', {
        ...move,
        locked: false,
      });
    }
  }
}

export default RemoveFromClosenessCircleHandler;
