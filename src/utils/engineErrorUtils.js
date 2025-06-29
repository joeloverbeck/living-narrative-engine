// src/utils/engineErrorUtils.js
/**
 * @module engineErrorUtils
 * @description Utilities for dispatching failure UI events and standardizing
 * engine errors.
 */
import { ENGINE_OPERATION_FAILED_UI } from '../constants/eventIds.js';

/**
 * Dispatches a failure UI event and resets the engine state.
 *
 * @description Sends a standardized failure event to the UI and resets the
 * engine so it can safely recover from errors.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Dispatcher used to send the event.
 * @param {string} errorMessage - User-facing error message.
 * @param {string} title - Title for the failure UI event.
 * @param {() => void} resetEngineState - Function that resets engine state.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @returns {Promise<void>} Resolves when the event is dispatched and state reset.
 */
export async function dispatchFailureAndReset(
  dispatcher,
  errorMessage,
  title,
  resetEngineState,
  logger
) {
  logger.debug(
    'engineErrorUtils.dispatchFailureAndReset: Dispatching UI event for operation failed.'
  );

  if (dispatcher) {
    await dispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
      errorMessage,
      errorTitle: title,
    });
  } else {
    logger.error(
      'engineErrorUtils.dispatchFailureAndReset: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
    );
  }

  resetEngineState();
}

/**
 * Logs an error, dispatches a failure event and optionally returns a result.
 *
 * @description Converts errors to a standardized structure while ensuring the
 * UI is notified and the engine state is reset.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used for error output.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Event dispatcher.
 * @param {string} contextMessage - Context for the log entry.
 * @param {unknown} error - Error or message to process.
 * @param {string} title - Title for the failure UI event.
 * @param {string} userPrefix - Prefix for the user-facing error message.
 * @param {() => void} resetEngineState - Function that resets engine state.
 * @param {boolean} [returnResult] - Whether to return a standardized result.
 * @returns {Promise<void | {success: false, error: string, data: null}>} Resolves when complete or returns the failure result.
 */
export async function processOperationFailure(
  logger,
  dispatcher,
  contextMessage,
  error,
  title,
  userPrefix,
  resetEngineState,
  returnResult = false
) {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));

  logger.error(
    `GameEngine.${contextMessage}: ${normalizedError.message}`,
    normalizedError
  );

  await dispatchFailureAndReset(
    dispatcher,
    `${userPrefix}: ${normalizedError.message}`,
    title,
    resetEngineState,
    logger
  );

  if (returnResult) {
    return { success: false, error: normalizedError.message, data: null };
  }
}
