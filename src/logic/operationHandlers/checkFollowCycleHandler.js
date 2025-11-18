/**
 * @file Handler for CHECK_FOLLOW_CYCLE operation
 *
 * Validates whether establishing a follow relationship would create a circular dependency
 * in the follow chain, storing the result in a context variable for conditional logic.
 *
 * Operation flow:
 * 1. Validate parameters (follower_id, leader_id, result_variable)
 * 2. Use wouldCreateCycle utility to check for circular dependency
 * 3. Build result object with success status and cycleDetected boolean
 * 4. Store result in specified context variable
 * 5. Log cycle detection result for debugging
 *
 * Related files:
 * @see data/schemas/operations/checkFollowCycle.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - CheckFollowCycleHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
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
import {
  assertParamsObject,
  validateStringParam,
} from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

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

    const followerId = validateStringParam(
      follower_id,
      'follower_id',
      log,
      this.#dispatcher
    );
    if (!followerId) return;

    const leaderId = validateStringParam(
      leader_id,
      'leader_id',
      log,
      this.#dispatcher
    );
    if (!leaderId) return;

    const resultVar = validateStringParam(
      result_variable,
      'result_variable',
      log,
      this.#dispatcher
    );
    if (!resultVar) return;

    log.debug(
      `CHECK_FOLLOW_CYCLE: Checking cycle for follower=${followerId}, leader=${leaderId}`
    );

    const cycleDetected = wouldCreateCycle(
      followerId,
      leaderId,
      this.#entityManager
    );
    const result = { success: true, cycleDetected };

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, log)) {
      return;
    }

    const res = tryWriteContextVariable(
      resultVar,
      result,
      executionContext,
      this.#dispatcher,
      log
    );
    if (res.success) {
      log.debug(
        `CHECK_FOLLOW_CYCLE: Stored result in "${resultVar}": ${JSON.stringify(result)}`
      );
    }
  }
}

export default CheckFollowCycleHandler;
