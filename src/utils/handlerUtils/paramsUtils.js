// src/utils/handlerUtils/paramsUtils.js

import { safeDispatchError } from '../safeDispatchErrorUtils.js';
import { isNonBlankString } from '../textUtils.js';

/**
 * @description Ensures an operation handler received a valid parameters object.
 * When `params` is null, undefined or not an object, a warning is logged or an
 * error event is dispatched if the provided `logger` exposes a `dispatch`
 * method.
 * @param {*} params - Parameters passed to the handler.
 * @param {object} logger - Logger with `warn` method or dispatcher with
 *   `dispatch` method.
 * @param {string} opName - Name of the operation for logging context.
 * @returns {boolean} `true` if `params` is a non-null object; otherwise `false`.
 */
export function assertParamsObject(params, logger, opName) {
  const valid = params && typeof params === 'object';
  if (valid) return true;

  const message = `${opName}: params missing or invalid.`;

  if (logger && typeof logger.warn === 'function') {
    logger.warn(message, { params });
  } else if (logger && typeof logger.dispatch === 'function') {
    safeDispatchError(logger, message, { params }, logger);
  } else {
    console.warn(message, { params });
  }
  return false;
}

/**
 * @description Validate that a parameter is a non-empty string.
 * If validation passes, the trimmed string is returned. Otherwise
 * an error is dispatched and `null` is returned.
 * @param {*} value - The value to validate.
 * @param {string} name - Parameter name for error messages.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger used for error reporting.
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Dispatcher for error events.
 * @returns {string|null} The trimmed string or `null` if invalid.
 */
export function validateStringParam(value, name, logger, dispatcher) {
  if (isNonBlankString(value)) {
    return value.trim();
  }
  safeDispatchError(
    dispatcher,
    `Invalid "${name}" parameter`,
    { [name]: value },
    logger
  );
  return null;
}

// deprecated default export removed in favor of named exports only
