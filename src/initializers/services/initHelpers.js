// src/initializers/services/initHelpers.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/safeEventDispatcher.js').default} ISafeEventDispatcher */

/**
 * @description Registers event listeners with a SafeEventDispatcher for
 *   persistence-related events.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to subscribe.
 * @param {Array<{eventId: string, handler: Function}>} listeners - Listener
 *   definitions.
 * @param {ILogger} [logger] - Optional logger for debug output.
 * @returns {void}
 * @throws {Error} If dispatcher or listeners are invalid.
 */
export function setupPersistenceListeners(dispatcher, listeners, logger) {
  if (!dispatcher || typeof dispatcher.subscribe !== 'function') {
    throw new Error('setupPersistenceListeners: invalid dispatcher');
  }
  if (!Array.isArray(listeners)) {
    throw new Error('setupPersistenceListeners: listeners must be an array');
  }

  for (const { eventId, handler } of listeners) {
    if (!eventId || typeof handler !== 'function') {
      throw new Error('setupPersistenceListeners: invalid listener definition');
    }
    dispatcher.subscribe(eventId, handler);
  }
  logger?.debug('Registered AI persistence listeners.');
}

export default {
  setupPersistenceListeners,
};
