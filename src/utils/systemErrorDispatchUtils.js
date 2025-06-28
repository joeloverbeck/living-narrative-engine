// src/utils/systemErrorDispatchUtils.js

/**
 * @file Helper wrapper for dispatching system error events.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * @description Dispatches a `SYSTEM_ERROR_OCCURRED_ID` event using the provided dispatcher.
 * @param {ISafeEventDispatcher} safeDispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @param {ILogger} [logger] - Optional logger for the dispatch.
 * @returns {void}
 */
export function dispatchSystemErrorEvent(
  safeDispatcher,
  message,
  details,
  logger
) {
  safeDispatchError(safeDispatcher, message, details, logger);
}
