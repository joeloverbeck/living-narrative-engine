/**
 * @file Helper for processing command exceptions and cleanup logic.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { TurnIdleState } from '../turnIdleState.js';
import {
  resetProcessingFlags,
  resolveLogger,
  dispatchSystemError,
} from './processingErrorUtils.js';

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
  const wasProcessing = resetProcessingFlags(state);

  const { logger, actorId: currentActorIdForLog } = resolveLogger(
    state,
    turnCtx,
    actorIdContext
  );

  logger.error(
    `${state.getStateName()}: Error during command processing for actor ${currentActorIdForLog} (wasProcessing: ${wasProcessing}): ${error.message}`,
    error
  );

  /** @type {ISafeEventDispatcher | null} */
  const systemErrorDispatcher = state._getSafeEventDispatcher(
    turnCtx,
    state._handler
  );

  dispatchSystemError(
    systemErrorDispatcher,
    logger,
    state.getStateName(),
    currentActorIdForLog,
    error
  );

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
          state._handler?.resetStateAndResources &&
          state._handler?.requestIdleStateTransition
        ) {
          logger.warn(
            `${state.getStateName()}: Resetting handler due to failure in turnCtx.endTurn().`
          );
          await state._handler.resetStateAndResources(
            `exception-endTurn-failed-${state.getStateName()}`
          );
          await state._handler.requestIdleStateTransition();
        }
      }
    } else {
      logger.warn(
        `${state.getStateName()}: Cannot call turnCtx.endTurn(); ITurnContext or its endTurn method is unavailable.`
      );
      if (
        state._handler?.resetStateAndResources &&
        state._handler?.requestIdleStateTransition
      ) {
        await state._handler.resetStateAndResources(
          `exception-no-context-end-${state.getStateName()}`
        );
        await state._handler.requestIdleStateTransition();
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
