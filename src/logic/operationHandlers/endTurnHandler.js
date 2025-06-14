/**
 * @file Handler that dispatches the core:turn_ended event with a payload
 * describing the outcome of an entity's turn.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../events/eventBus.js').default} EventBus */

import { TURN_ENDED_ID } from '../../constants/eventIds.js';

/**
 * Parameters for {@link EndTurnHandler#execute}.
 *
 * @typedef {object} EndTurnParameters
 * @property {string} entityId - ID of the entity whose turn ended.
 * @property {boolean} success - Whether the turn completed successfully.
 * @property {object=} error - Optional error information.
 */

class EndTurnHandler {
  /** @type {ValidatedEventDispatcher|EventBus} */
  #dispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ValidatedEventDispatcher|EventBus} deps.dispatcher - Event dispatcher.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ dispatcher, logger }) {
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'EndTurnHandler requires a dispatcher with a dispatch method.'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('EndTurnHandler requires a valid ILogger instance.');
    }
    this.#dispatcher = dispatcher;
    this.#logger = logger;
  }

  /**
   * Dispatch the core:turn_ended event.
   *
   * @param {EndTurnParameters} params - Resolved parameters.
   * @param {ExecutionContext} _executionContext - Execution context (unused).
   */
  execute(params, _executionContext) {
    if (
      !params ||
      typeof params.entityId !== 'string' ||
      !params.entityId.trim()
    ) {
      this.#logger.error('END_TURN: Invalid or missing "entityId" parameter.');
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

    try {
      this.#dispatcher.dispatch(TURN_ENDED_ID, payload);
    } catch (err) {
      this.#logger.error('END_TURN: Error dispatching turn ended event.', err);
    }
  }
}

export default EndTurnHandler;
