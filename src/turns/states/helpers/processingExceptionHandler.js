/**
 * @file processingExceptionHandler.js
 * @description Class to handle exceptions during command processing.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 */

import {
  resetProcessingFlags,
  resolveLogger,
  dispatchSystemError,
} from './processingErrorUtils.js';
import { getSafeEventDispatcher } from './contextUtils.js';

/**
 * @class ProcessingExceptionHandler
 * @description Handles cleanup and logging when command processing fails.
 */
export class ProcessingExceptionHandler {
  /**
   * @param {ProcessingCommandStateLike} state - Owning state instance.
   */
  constructor(state) {
    this._state = state;
  }

  /**
   * Handles a processing exception and optionally ends the turn.
   *
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Error} error - Error being handled.
   * @param {string} [actorIdContext] - Actor ID for logging.
   * @param {boolean} [shouldEndTurn] - Whether the turn should be ended.
   * @returns {Promise<void>} Resolves when handling completes.
   */
  async handle(
    turnCtx,
    error,
    actorIdContext = 'UnknownActor',
    shouldEndTurn = true
  ) {
    const wasProcessing = resetProcessingFlags(this._state);
    const { logger, actorId } = resolveLogger(
      this._state,
      turnCtx,
      actorIdContext
    );

    await this.logAndDispatch(turnCtx, error, logger, actorId, wasProcessing);

    if (shouldEndTurn) {
      const handled = await this.tryEndTurn(turnCtx, error, logger);
      if (!handled) {
        logger.warn(
          `${this._state.getStateName()}: Failed to end turn and handler reset was not performed for actor ${actorId}.`
        );
      }
    } else {
      logger.debug(
        `${this._state.getStateName()}: ProcessingExceptionHandler.handle called with shouldEndTurn=false for actor ${actorId}.`
      );
    }
  }

  /**
   * Logs the error and dispatches a SYSTEM_ERROR_OCCURRED event.
   *
   * @param {ITurnContext} turnCtx - Context used for dispatcher resolution.
   * @param {Error} error - Error to log and dispatch.
   * @param {ILogger} logger - Logger instance.
   * @param {string} actorId - Actor ID for logging.
   * @param {boolean} wasProcessing - Previous processing flag.
   * @returns {Promise<void>} Resolves when complete.
   */
  async logAndDispatch(turnCtx, error, logger, actorId, wasProcessing) {
    logger.error(
      `${this._state.getStateName()}: Error during command processing for actor ${actorId} (wasProcessing: ${wasProcessing}): ${error.message}`,
      error
    );

    const dispatcher = getSafeEventDispatcher(turnCtx, this._state._handler);
    dispatchSystemError(
      dispatcher,
      logger,
      this._state.getStateName(),
      actorId,
      error
    );
  }

  /**
   * Attempts to end the current turn, resetting the handler if necessary.
   *
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Error} error - Original error.
   * @param {ILogger} logger - Logger instance.
   * @returns {Promise<boolean>} `true` if the turn was ended or a handler reset occurred.
   */
  async tryEndTurn(turnCtx, error, logger) {
    let handled = false;

    if (turnCtx && typeof turnCtx.endTurn === 'function') {
      logger.debug(
        `${this._state.getStateName()}: Ending turn (no valid actor or error state) due to processing exception.`
      );
      try {
        await turnCtx.endTurn(error);
        handled = true;
      } catch (endTurnError) {
        logger.error(
          `${this._state.getStateName()}: Error calling turnCtx.endTurn(): ${endTurnError.message}`,
          endTurnError
        );
        handled = await this.resetHandlerIfNeeded(
          logger,
          `exception-endTurn-failed-${this._state.getStateName()}`
        );
      }
    } else {
      logger.warn(
        `${this._state.getStateName()}: Cannot call turnCtx.endTurn(); ITurnContext or its endTurn method is unavailable.`
      );
      handled = await this.resetHandlerIfNeeded(
        logger,
        `exception-no-context-end-${this._state.getStateName()}`
      );
      if (!handled) {
        logger.error(
          `${this._state.getStateName()}: CRITICAL - Cannot end turn OR reset handler. System may be unstable.`
        );
      }
    }

    return handled;
  }

  /**
   * Resets the handler when reset and transition methods exist.
   *
   * @param {ILogger} logger - Logger for diagnostic output.
   * @param {string} reason - Reason for the reset.
   * @returns {Promise<boolean>} True if a reset occurred.
   */
  async resetHandlerIfNeeded(logger, reason) {
    if (
      this._state._handler?.resetStateAndResources &&
      this._state._handler?.requestIdleStateTransition
    ) {
      logger.warn(
        `${this._state.getStateName()}: Resetting handler due to failure in processing flow.`
      );
      await this._state._handler.resetStateAndResources(reason);
      await this._state._handler.requestIdleStateTransition();
      return true;
    }
    return false;
  }
}

export default ProcessingExceptionHandler;
