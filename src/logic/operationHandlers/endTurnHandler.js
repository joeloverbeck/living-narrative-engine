/**
 * @file Handler for END_TURN operation
 *
 * Dispatches the core:turn_ended event with a standardized payload describing the
 * outcome of an entity's turn (success/failure with optional error details).
 *
 * Operation flow:
 * 1. Validate parameters (entityId, success boolean, optional error object)
 * 2. Build standardized payload with entity ID and success status
 * 3. Include optional error information if provided
 * 4. Dispatch core:turn_ended event through safe event dispatcher
 * 5. Handle async dispatch results and report failures
 *
 * FAIL-FAST: This handler throws EndTurnOperationError on invalid parameters
 * rather than silently returning. This makes debugging turn-end failures
 * immediately visible instead of causing cryptic 3000ms timeouts.
 *
 * Related files:
 * @see data/schemas/operations/endTurn.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - EndTurnHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { TURN_ENDED_ID } from '../../constants/eventIds.js';

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Error thrown when END_TURN operation fails due to invalid parameters.
 * Includes diagnostic details to help identify the root cause.
 */
export class EndTurnOperationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {object} details - Diagnostic details about the failure
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'EndTurnOperationError';
    this.details = details;
  }
}

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
   * Uses queueMicrotask to defer dispatch until current operation handlers complete,
   * then awaits the dispatch to ensure event delivery before returning.
   *
   * FAIL-FAST: Throws EndTurnOperationError on invalid params instead of
   * silently returning. This ensures turn-end failures are immediately visible.
   *
   * @param {EndTurnParameters} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   * @throws {EndTurnOperationError} If params or entityId are invalid.
   */
  async execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;

    // FAIL-FAST: Throw on invalid params instead of silent return
    if (!params || typeof params !== 'object') {
      const error = new EndTurnOperationError(
        'END_TURN: params must be a non-null object.',
        { receivedParams: params, paramsType: typeof params }
      );
      logger.error(error.message, error.details);
      throw error;
    }

    // FAIL-FAST: Throw on invalid entityId instead of silent return
    if (typeof params.entityId !== 'string' || !params.entityId.trim()) {
      const error = new EndTurnOperationError(
        'END_TURN: Invalid or missing "entityId" parameter. ' +
          'This usually means placeholder resolution failed for {event.payload.actorId}.',
        {
          receivedEntityId: params.entityId,
          entityIdType: typeof params.entityId,
          allParams: params,
          hasExecutionContext: !!executionContext,
          hasEvent: !!executionContext?.evaluationContext?.event,
          eventPayload: executionContext?.evaluationContext?.event?.payload,
        }
      );
      logger.error(error.message, error.details);
      throw error;
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

    // Note: Previously had queueMicrotask deferral here to allow IF handlers to complete,
    // but this was causing race conditions with the timeout in AwaitingExternalTurnEndState.
    // The early listener pattern (Phase 7) now captures events regardless of timing,
    // so immediate dispatch is safe and preferred.

    // Await the dispatch to ensure event is delivered before returning.
    // This is critical for the Promise.race pattern in AwaitingExternalTurnEndState
    // to work correctly - the event must be delivered before any timeout can fire.
    const dispatchResult = this.#safeEventDispatcher.dispatch(
      TURN_ENDED_ID,
      payload
    );

    // Handle both Promise-based and synchronous dispatch results
    if (dispatchResult && typeof dispatchResult.then === 'function') {
      const success = await dispatchResult;
      if (!success) {
        safeDispatchError(
          this.#safeEventDispatcher,
          'END_TURN: Failed to dispatch turn ended event.',
          { payload },
          logger
        );
      }
    } else if (dispatchResult === false) {
      safeDispatchError(
        this.#safeEventDispatcher,
        'END_TURN: Failed to dispatch turn ended event.',
        { payload },
        logger
      );
    }
  }
}

export default EndTurnHandler;
