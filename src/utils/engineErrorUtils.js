// src/utils/engineErrorUtils.js
/**
 * @module engineErrorUtils
 * @description Utilities for dispatching failure UI events and standardizing
 * engine errors.
 */
import { ENGINE_OPERATION_FAILED_UI } from '../constants/eventIds.js';

/**
 * Derives a readable error message from arbitrary error-like values.
 *
 * @param {unknown} error - Value describing the failure.
 * @returns {string} Human-friendly error message.
 */
function getReadableErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || 'Unknown error.';
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || 'Unknown error.';
  }

  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  if (error && typeof error === 'object') {
    const messageCandidates = ['message', 'error', 'details', 'reason', 'description'];
    for (const key of messageCandidates) {
      const value = /** @type {Record<string, unknown>} */ (error)[key];
      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue) {
          return trimmedValue;
        }
      }
    }

    if (
      typeof error.toString === 'function' &&
      error.toString !== Object.prototype.toString
    ) {
      const asString = String(error);
      if (asString && asString !== '[object Object]') {
        return asString;
      }
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        return serialized;
      }
    } catch {
      // Ignore serialization errors and fall back to default message
    }
  }

  return 'Unknown error.';
}

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

  try {
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
  } catch (dispatchError) {
    const normalizedError =
      dispatchError instanceof Error
        ? dispatchError
        : new Error(String(dispatchError));
    logger.error(
      'engineErrorUtils.dispatchFailureAndReset: Failed to dispatch UI failure event.',
      normalizedError
    );
  } finally {
    try {
      resetEngineState();
    } catch (resetError) {
      const normalizedResetError =
        resetError instanceof Error
          ? resetError
          : new Error(String(resetError));
      logger.error(
        'engineErrorUtils.dispatchFailureAndReset: Failed to reset engine state after failure.',
        normalizedResetError
      );
    }
  }
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
  const readableMessage = getReadableErrorMessage(error);
  const normalizedError =
    error instanceof Error ? error : new Error(readableMessage);

  if (!(error instanceof Error)) {
    try {
      // Preserve the original error context for downstream loggers if supported.
      normalizedError.cause = error;
    } catch {
      // Setting cause failed (older runtimes); attach as metadata instead.
      normalizedError.originalError = error;
    }
  }

  logger.error(
    `GameEngine.${contextMessage}: ${readableMessage}`,
    normalizedError
  );

  await dispatchFailureAndReset(
    dispatcher,
    `${userPrefix}: ${readableMessage}`,
    title,
    resetEngineState,
    logger
  );

  if (returnResult) {
    return { success: false, error: readableMessage, data: null };
  }
}
