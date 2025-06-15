/**
 * @file A handler that resolves a direction into a target location's instance id.
 * @see src/logic/operationHandlers/checkFollowCycleHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

import { wouldCreateCycle } from '../../utils/followUtils.js';
import { setContextValue } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils.js';

/**
 * @typedef {object} CheckFollowCycleParams
 * @property {string} follower_id       - ID of the entity attempting to follow.
 * @property {string} leader_id         - ID of the target to be followed.
 * @property {string} result_variable   - Name of the context variable to write the result into.
 */

class CheckFollowCycleHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {{ logger: ILogger; entityManager: EntityManager }} deps
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    if (!logger?.debug)
      throw new Error('CheckFollowCycleHandler requires a valid ILogger');
    if (!entityManager?.getEntityInstance)
      throw new Error('CheckFollowCycleHandler requires a valid EntityManager');
    if (!safeEventDispatcher?.dispatch)
      throw new Error(
        'CheckFollowCycleHandler requires a valid ISafeEventDispatcher'
      );
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#logger.debug('[CheckFollowCycleHandler] Initialized');
  }

  /**
   * @param {CheckFollowCycleParams} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = this.#logger;
    if (!assertParamsObject(params, log, 'CHECK_FOLLOW_CYCLE')) return;

    const { follower_id, leader_id, result_variable } = params;

    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'CHECK_FOLLOW_CYCLE: Invalid "follower_id" parameter',
        details: { params },
      });
      return;
    }
    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'CHECK_FOLLOW_CYCLE: Invalid "leader_id" parameter',
        details: { params },
      });
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'CHECK_FOLLOW_CYCLE: Invalid "result_variable" parameter',
        details: { params },
      });
      return;
    }

    const fid = follower_id.trim();
    const lid = leader_id.trim();
    log.debug(
      `CHECK_FOLLOW_CYCLE: Checking cycle for follower=${fid}, leader=${lid}`
    );

    const cycleDetected = wouldCreateCycle(fid, lid, this.#entityManager);
    const result = { success: true, cycleDetected };

    const stored = setContextValue(
      result_variable,
      result,
      execCtx,
      this.#dispatcher,
      log
    );
    if (stored) {
      log.debug(
        `CHECK_FOLLOW_CYCLE: Stored result in "${result_variable}": ${JSON.stringify(result)}`
      );
    }
  }
}

export default CheckFollowCycleHandler;
