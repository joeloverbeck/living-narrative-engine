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
 * @param {object} [options] - Optional dispatcher configuration (e.g. schema overrides).
 * @returns {Promise<void>} Resolves when the dispatch attempt completes.
 */
export async function safeDispatchEvent(
  dispatcher,
  eventId,
  payload,
  logger,
  options
) {
  const log = ensureValidLogger(logger, 'safeDispatchEvent');

  if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
    log.warn(`SafeEventDispatcher unavailable for ${eventId}`);
    return;
  }

  try {
    const dispatchResult =
      typeof options === 'undefined'
        ? await dispatcher.dispatch(eventId, payload)
        : await dispatcher.dispatch(eventId, payload, options);

    const metadata =
      typeof options === 'undefined' ? { payload } : { payload, options };

    if (dispatchResult === false) {
      log.warn(
        `Dispatcher reported failure for ${eventId}. Payload may have been rejected.`,
        metadata
      );
      return;
    }

    log.debug(`Dispatched ${eventId}`, metadata);
  } catch (error) {
    log.error(`Failed to dispatch ${eventId}`, error);
  }
}

export default safeDispatchEvent;
