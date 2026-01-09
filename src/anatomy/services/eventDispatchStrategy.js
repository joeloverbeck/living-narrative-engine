/**
 * @typedef {object} IEventDispatchStrategy
 * @property {function(string, object, object=): void} dispatch - Dispatch or queue an event
 * @property {function(string, string, object=): void} recordEffect - Record an effect trigger
 */

class ImmediateDispatchStrategy {
  /** @type {import('../../interfaces/coreServices.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ safeEventDispatcher }) {
    if (!safeEventDispatcher || typeof safeEventDispatcher.dispatch !== 'function') {
      throw new Error(
        'ImmediateDispatchStrategy requires safeEventDispatcher with dispatch.'
      );
    }
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Dispatch event immediately via safeEventDispatcher.
   *
   * @param {string} eventType - Event type to dispatch
   * @param {object} payload - Event payload
   * @param {object} [_sessionContext] - Ignored in immediate mode
   */
  dispatch(eventType, payload, _sessionContext = null) {
    this.#dispatcher.dispatch(eventType, payload);
  }

  /**
   * No-op in immediate mode (no session to record to).
   *
   * @param {string} _partId
   * @param {string} _effectName
   * @param {object} [_sessionContext]
   */
  recordEffect(_partId, _effectName, _sessionContext = null) {}
}

class SessionQueueStrategy {
  /**
   * Queue event to session's pendingEvents array.
   *
   * @param {string} eventType - Event type to queue
   * @param {object} payload - Event payload
   * @param {object} damageSession - The damage session object with pendingEvents array
   */
  dispatch(eventType, payload, damageSession) {
    damageSession.pendingEvents.push({ eventType, payload });
  }

  /**
   * Record effect in session entry's effectsTriggered array.
   *
   * @param {string} partId - Part ID to find in entries
   * @param {string} effectName - Effect name to record
   * @param {object} damageSession - The damage session object with entries array
   */
  recordEffect(partId, effectName, damageSession) {
    const entry = damageSession.entries.find((e) => e.partId === partId);
    if (!entry) {
      return;
    }
    entry.effectsTriggered = entry.effectsTriggered || [];
    entry.effectsTriggered.push(effectName);
  }
}

/**
 * Create appropriate dispatch strategy based on session presence.
 *
 * @param {object} safeEventDispatcher - Dispatcher for immediate mode
 * @param {object | null} damageSession - Session object if present
 * @returns {IEventDispatchStrategy}
 */
function createDispatchStrategy(safeEventDispatcher, damageSession) {
  if (damageSession) {
    return new SessionQueueStrategy();
  }
  return new ImmediateDispatchStrategy({ safeEventDispatcher });
}

export {
  ImmediateDispatchStrategy,
  SessionQueueStrategy,
  createDispatchStrategy,
};
