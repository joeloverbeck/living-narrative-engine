/**
 * @file Handler that dispatches the core:turn_ended event with a payload
 * describing the outcome of an entity's turn.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { TURN_ENDED_ID } from '../../constants/eventIds.js';

import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Parameters for {@link EndTurnHandler#execute}.
 *
 * @typedef {object} EndTurnParameters
 * @property {string} entityId - ID of the entity whose turn ended.
 * @property {boolean} success - Whether the turn completed successfully.
 * @property {object=} error - Optional error information.
 */

/**
 * @implements {OperationHandler}
 */
class EndTurnHandler {
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Safe event dispatcher.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ safeEventDispatcher, logger }) {
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'EndTurnHandler requires a valid ISafeEventDispatcher instance.'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('EndTurnHandler requires a valid ILogger instance.');
    }
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
  }

  /**
   * Dispatch the core:turn_ended event.
   *
   * @param {EndTurnParameters} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context (unused).
   */
  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;
    if (!assertParamsObject(params, logger, 'END_TURN')) return;

    if (typeof params.entityId !== 'string' || !params.entityId.trim()) {
      safeDispatchError(
        this.#safeEventDispatcher,
        'END_TURN: Invalid or missing "entityId" parameter.',
        { params },
        logger
      );
      return;
    }

    const payload = {
      entityId: params.entityId.trim(),
      success: Boolean(params.success),
    };

    if (params.error !== undefined) {
      payload.error = params.error;
    }

    this.#logger.debug(
      `END_TURN: dispatching ${TURN_ENDED_ID} for ${payload.entityId} with success=${payload.success}`,
      { payload }
    );

    const dispatchResult = this.#safeEventDispatcher.dispatch(
      TURN_ENDED_ID,
      payload
    );
    if (dispatchResult && typeof dispatchResult.then === 'function') {
      dispatchResult.then((success) => {
        if (!success) {
          safeDispatchError(
            this.#safeEventDispatcher,
            'END_TURN: Failed to dispatch turn ended event.',
            { payload }
          );
        }
      });
    } else if (dispatchResult === false) {
      safeDispatchError(
        this.#safeEventDispatcher,
        'END_TURN: Failed to dispatch turn ended event.',
        { payload }
      );
    }
  }
}

export default EndTurnHandler;
