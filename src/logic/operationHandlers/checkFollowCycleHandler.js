/**
 * @file A handler that resolves a direction into a target location's instance id.
 * @see src/logic/operationHandlers/checkFollowCycleHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import { wouldCreateCycle } from '../../utils/followUtils.js';

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

  /**
   * @param {{ logger: ILogger; entityManager: EntityManager }} deps
   */
  constructor({ logger, entityManager }) {
    if (!logger?.debug)
      throw new Error('CheckFollowCycleHandler requires a valid ILogger');
    if (!entityManager?.getEntityInstance)
      throw new Error('CheckFollowCycleHandler requires a valid EntityManager');
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#logger.debug('[CheckFollowCycleHandler] Initialized');
  }

  /**
   * @param {CheckFollowCycleParams} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = this.#logger;
    const { follower_id, leader_id, result_variable } = params || {};

    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      log.error('CHECK_FOLLOW_CYCLE: Invalid "follower_id" parameter', {
        params,
      });
      return;
    }
    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      log.error('CHECK_FOLLOW_CYCLE: Invalid "leader_id" parameter', {
        params,
      });
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      log.error('CHECK_FOLLOW_CYCLE: Invalid "result_variable" parameter', {
        params,
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

    try {
      execCtx.evaluationContext.context[result_variable.trim()] = result;
      log.debug(
        `CHECK_FOLLOW_CYCLE: Stored result in "${result_variable}": ${JSON.stringify(result)}`
      );
    } catch (e) {
      log.error(
        `CHECK_FOLLOW_CYCLE: Failed to write to context variable "${result_variable}"`,
        { error: e }
      );
    }
  }
}

export default CheckFollowCycleHandler;
