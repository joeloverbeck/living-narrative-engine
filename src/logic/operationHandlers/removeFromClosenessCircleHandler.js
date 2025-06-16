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
} from '../../utils/handlerUtils';
import { assertParamsObject } from '../../utils/handlerUtils';
import { setContextValue } from '../../utils/contextVariableUtils.js';

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
   * @returns {void}
   */
  execute(params, execCtx) {
    const log = getExecLogger(this.#logger, execCtx);

    if (!assertParamsObject(params, log, 'REMOVE_FROM_CLOSENESS_CIRCLE')) {
      return;
    }
    const { actor_id, result_variable } = params;

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'REMOVE_FROM_CLOSENESS_CIRCLE: Invalid "actor_id" parameter',
        details: { params },
      });
      return;
    }

    const actorId = actor_id.trim();

    const closeness = this.#entityManager.getComponentData(
      actorId,
      'intimacy:closeness'
    );
    const partners = Array.isArray(closeness?.partners)
      ? [...closeness.partners]
      : [];

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
        const move =
          this.#entityManager.getComponentData(pid, 'core:movement') || {};
        this.#entityManager.addComponent(pid, 'core:movement', {
          ...move,
          locked: false,
        });
      } else {
        this.#entityManager.addComponent(pid, 'intimacy:closeness', {
          partners: repaired,
        });
      }
    }

    if (closeness) {
      this.#entityManager.removeComponent(actorId, 'intimacy:closeness');
    }

    const actorMove =
      this.#entityManager.getComponentData(actorId, 'core:movement') || {};
    this.#entityManager.addComponent(actorId, 'core:movement', {
      ...actorMove,
      locked: false,
    });

    if (result_variable) {
      setContextValue(
        result_variable,
        partners,
        execCtx,
        this.#dispatcher,
        log
      );
    }
  }
}

export default RemoveFromClosenessCircleHandler;
