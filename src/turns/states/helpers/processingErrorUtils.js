/**
 * @file Utilities for processing error handling.
 */

/**
 * @typedef {import('../../../types/stateTypes.js').ProcessingCommandStateLike} ProcessingCommandStateLike
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { safeDispatchError } from '../../../utils/safeDispatchErrorUtils.js';

/**
 * Resets processing flags on the provided state.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @returns {boolean} The previous _isProcessing value.
 */
export function resetProcessingFlags(state) {
  const wasProcessing = state._isProcessing;
  if (state._processingGuard) {
    state._processingGuard.finish();
  } else {
    state._isProcessing = false;
  }
  return wasProcessing;
}

/**
 * Resolves the logger and actor ID for diagnostics.
 *
 * @param {ProcessingCommandStateLike} state - Owning state instance.
 * @param {ITurnContext} turnCtx - Current turn context.
 * @param {string} actorIdFallback - Fallback actor ID when context is missing.
 * @returns {{ logger: ILogger, actorId: string }} The resolved logger and actor ID.
 */
export function resolveLogger(state, turnCtx, actorIdFallback) {
  let logger = console;
  let actorId = actorIdFallback;

  if (turnCtx && typeof turnCtx.getLogger === 'function') {
    logger = turnCtx.getLogger();
    actorId = turnCtx.getActor?.()?.id ?? actorIdFallback;
  } else {
    console.error(
      `${state.getStateName()}: Critical error - turnCtx is invalid in resolveLogger. Using console for logging. Actor context for this error: ${actorId}`
    );
  }

  return { logger, actorId };
}

/**
 * Dispatches a standardized system error event.
 *
 * @param {ISafeEventDispatcher|null} dispatcher - Dispatcher used for the event.
 * @param {ILogger} logger - Logger for error logging.
 * @param {string} stateName - Name of the state reporting the error.
 * @param {string} actorId - Actor ID for logging context.
 * @param {Error} error - The error that occurred.
 * @returns {void}
 */
export function dispatchSystemError(
  dispatcher,
  logger,
  stateName,
  actorId,
  error
) {
  if (dispatcher) {
    try {
      safeDispatchError(
        dispatcher,
        `System error in ${stateName} for actor ${actorId}: ${error.message}`,
        {
          raw: `OriginalError: ${error.name} - ${error.message}`,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        logger
      );
    } catch (dispatchError) {
      logger.error(
        `${stateName}: Unexpected error dispatching SYSTEM_ERROR_OCCURRED_ID via SafeEventDispatcher for ${actorId}: ${dispatchError.message}`,
        dispatchError
      );
    }
  } else {
    logger.warn(
      `${stateName}: SafeEventDispatcher not available for actor ${actorId}. Cannot dispatch system error event.`
    );
  }
}
