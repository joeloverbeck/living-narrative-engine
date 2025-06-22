/**
 * @file A handler that resolves a direction into a target location's instance id.
 * @see src/logic/operationHandlers/checkFollowCycleHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { wouldCreateCycle } from '../../utils/followUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

/**
 * @typedef {object} CheckFollowCycleParams
 * @property {string} follower_id       - ID of the entity attempting to follow.
 * @property {string} leader_id         - ID of the target to be followed.
 * @property {string} result_variable   - Name of the context variable to write the result into.
 */

class CheckFollowCycleHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {{ logger: ILogger; entityManager: EntityManager; safeEventDispatcher: ISafeEventDispatcher }} deps
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('CheckFollowCycleHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
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
   * @param {CheckFollowCycleParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);
    if (!assertParamsObject(params, log, 'CHECK_FOLLOW_CYCLE')) return;

    const { follower_id, leader_id, result_variable } = params;

    if (typeof follower_id !== 'string' || !follower_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'CHECK_FOLLOW_CYCLE: Invalid "follower_id" parameter',
        { params },
        log
      );
      return;
    }
    if (typeof leader_id !== 'string' || !leader_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'CHECK_FOLLOW_CYCLE: Invalid "leader_id" parameter',
        { params },
        log
      );
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'CHECK_FOLLOW_CYCLE: Invalid "result_variable" parameter',
        { params },
        log
      );
      return;
    }

    const followerId = follower_id.trim();
    const leaderId = leader_id.trim();
    log.debug(
      `CHECK_FOLLOW_CYCLE: Checking cycle for follower=${followerId}, leader=${leaderId}`
    );

    const cycleDetected = wouldCreateCycle(followerId, leaderId, this.#entityManager);
    const result = { success: true, cycleDetected };

    const res = tryWriteContextVariable(
      result_variable,
      result,
      executionContext,
      this.#dispatcher,
      log
    );
    if (res.success) {
      log.debug(
        `CHECK_FOLLOW_CYCLE: Stored result in "${result_variable}": ${JSON.stringify(result)}`
      );
    }
  }
}

export default CheckFollowCycleHandler;
