/**
 * @file Helper for processing command exceptions and cleanup logic.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { SYSTEM_ERROR_OCCURRED_ID } from '../../../constants/eventIds.js';
import { TurnIdleState } from '../turnIdleState.js';

/**
 * Handles exceptions that occur during command processing.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {Error} error - Error being handled.
 * @param {string} [actorIdContext] - Actor ID for logging context.
 * @param {boolean} [shouldEndTurn] - Whether the turn should be ended.
 * @returns {Promise<void>} Resolves when handling completes.
 */
export async function handleProcessingException(
  state,
  turnCtx,
  error,
  actorIdContext = 'UnknownActor',
  shouldEndTurn = true
) {
  const wasProcessing = state._isProcessing;
  state._isProcessing = false;

  let logger = console;
  let currentActorIdForLog = actorIdContext;

  if (turnCtx && typeof turnCtx.getLogger === 'function') {
    logger = turnCtx.getLogger();
    currentActorIdForLog = turnCtx.getActor?.()?.id ?? actorIdContext;
  } else {
    console.error(
      `${state.getStateName()}: Critical error - turnCtx is invalid in #handleProcessingException. Using console for logging. Actor context for this error: ${currentActorIdForLog}`
    );
  }

  logger.error(
    `${state.getStateName()}: Error during command processing for actor ${currentActorIdForLog} (wasProcessing: ${wasProcessing}): ${error.message}`,
    error
  );

  /** @type {ISafeEventDispatcher | undefined} */
  let systemErrorDispatcher;
  if (turnCtx && typeof turnCtx.getSafeEventDispatcher === 'function') {
    systemErrorDispatcher = turnCtx.getSafeEventDispatcher();
  } else if (
    state._handler &&
    typeof state._handler.safeEventDispatcher === 'object' &&
    state._handler.safeEventDispatcher !== null &&
    typeof state._handler.safeEventDispatcher.dispatch === 'function'
  ) {
    logger.warn(
      `${state.getStateName()}: SafeEventDispatcher not found on TurnContext for actor ${currentActorIdForLog}. Attempting to use this._handler.safeEventDispatcher.`
    );
    systemErrorDispatcher = state._handler.safeEventDispatcher;
  }

  if (systemErrorDispatcher) {
    try {
      await systemErrorDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `System error in ${state.getStateName()} for actor ${currentActorIdForLog}: ${error.message}`,
        details: {
          raw: `OriginalError: ${error.name} - ${error.message}`,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (dispatchError) {
      logger.error(
        `${state.getStateName()}: Unexpected error dispatching SYSTEM_ERROR_OCCURRED_ID via SafeEventDispatcher for ${currentActorIdForLog}: ${dispatchError.message}`,
        dispatchError
      );
    }
  } else {
    logger.warn(
      `${state.getStateName()}: SafeEventDispatcher not available for actor ${currentActorIdForLog}. Cannot dispatch system error event.`
    );
  }

  if (shouldEndTurn) {
    if (turnCtx && typeof turnCtx.endTurn === 'function') {
      logger.debug(
        `${state.getStateName()}: Ending turn (no valid actor or error state) due to processing exception.`
      );
      try {
        await turnCtx.endTurn(error);
      } catch (endTurnError) {
        logger.error(
          `${state.getStateName()}: Error calling turnCtx.endTurn(): ${endTurnError.message}`,
          endTurnError
        );
        if (
          state._handler?._resetTurnStateAndResources &&
          state._handler?._transitionToState
        ) {
          logger.warn(
            `${state.getStateName()}: Resetting handler due to failure in turnCtx.endTurn().`
          );
          await state._handler._resetTurnStateAndResources(
            `exception-endTurn-failed-${state.getStateName()}`
          );
          await state._handler._transitionToState(
            new TurnIdleState(state._handler)
          );
        }
      }
    } else {
      logger.warn(
        `${state.getStateName()}: Cannot call turnCtx.endTurn(); ITurnContext or its endTurn method is unavailable.`
      );
      if (
        state._handler?._resetTurnStateAndResources &&
        state._handler?._transitionToState
      ) {
        await state._handler._resetTurnStateAndResources(
          `exception-no-context-end-${state.getStateName()}`
        );
        await state._handler._transitionToState(
          new TurnIdleState(state._handler)
        );
      } else {
        logger.error(
          `${state.getStateName()}: CRITICAL - Cannot end turn OR reset handler. System may be unstable.`
        );
      }
    }
  } else {
    logger.debug(
      `${state.getStateName()}: #handleProcessingException called with shouldEndTurn=false for actor ${currentActorIdForLog}.`
    );
  }
}

export default handleProcessingException;
