// src/utils/eventHelpers.js

/**
 * @file Helper functions for dispatching events safely.
 */

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */
/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Dispatches an event and logs if dispatch fails.
 *
 * @param {IValidatedEventDispatcher} bus - Dispatcher used to emit the event.
 * @param {string} id - Event identifier.
 * @param {object} payload - Event payload to dispatch.
 * @param {ILogger} logger - Logger for error output.
 * @returns {Promise<void>} Resolves when dispatch completes or failure is logged.
 */
export async function safeDispatch(bus, id, payload, logger) {
  try {
    await bus.dispatch(id, payload);
  } catch (e) {
    logger.error(`Dispatch ${id} failed: ${e.message}`, e);
  }
}

// --- FILE END ---
