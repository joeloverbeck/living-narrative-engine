// src/utils/safeDispatchEvent.js

/**
 * @file Utility for safely dispatching events with logging.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { ensureValidLogger } from './loggerUtils.js';

/**
 * Safely dispatches an event using the provided dispatcher.
 *
 * @param {ISafeEventDispatcher|null|undefined} dispatcher - Dispatcher used to emit the event.
 * @param {string} eventId - Identifier of the event to dispatch.
 * @param {object} payload - Payload for the event.
 * @param {ILogger} [logger] - Logger for debug and error output.
 * @returns {Promise<void>} Resolves when the dispatch attempt completes.
 */
export async function safeDispatchEvent(dispatcher, eventId, payload, logger) {
  const log = ensureValidLogger(logger, 'safeDispatchEvent');

  if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
    log.warn(`SafeEventDispatcher unavailable for ${eventId}`);
    return;
  }

  try {
    await dispatcher.dispatch(eventId, payload);
    log.debug(`Dispatched ${eventId}`, { payload });
  } catch (error) {
    log.error(`Failed to dispatch ${eventId}`, error);
  }
}

export default safeDispatchEvent;
