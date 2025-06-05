// src/events/eventBus.js

/**
 * A simple Event Bus for decoupled communication between systems using a publish/subscribe pattern.
 */
class EventBus {
  #listeners = new Map(); // Stores eventName -> Set<listenerFn>

  subscribe(eventName, listener) {
    if (typeof eventName !== 'string' || !eventName) {
      console.error(
        'EventBus: Invalid event name provided for subscription.',
        eventName
      );
      return;
    }
    if (typeof listener !== 'function') {
      console.error(
        `EventBus: Invalid listener provided for event "${eventName}". Expected a function.`
      );
      return;
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(listener);
  }

  unsubscribe(eventName, listener) {
    if (typeof eventName !== 'string' || !eventName) {
      console.error(
        'EventBus: Invalid event name provided for unsubscription.',
        eventName
      );
      return;
    }
    if (typeof listener !== 'function') {
      console.error(
        `EventBus: Invalid listener provided for unsubscription from event "${eventName}".`
      );
      return;
    }

    if (this.#listeners.has(eventName)) {
      const eventListeners = this.#listeners.get(eventName);
      const deleted = eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
    }
  }

  /**
   * Dispatches an event, ASYNCHRONOUSLY calling all subscribed listeners for that specific event name
   * AND listeners subscribed to the wildcard ('*').
   * Waits for all listener promises to settle.
   *
   * @param {string} eventName - The name of the event to dispatch (becomes event.type).
   * @param {object} [eventPayload] - The data payload associated with the event (becomes event.payload). Defaults to empty object.
   * @returns {Promise<void>} A promise that resolves when all relevant listeners have been processed.
   */
  async dispatch(eventName, eventPayload = {}) {
    // Renamed second arg for clarity, added default
    if (typeof eventName !== 'string' || !eventName) {
      console.error(
        'EventBus: Invalid event name provided for dispatch.',
        eventName
      );
      return;
    }

    const specificListeners = this.#listeners.get(eventName) || new Set();
    const wildcardListeners = this.#listeners.get('*') || new Set();
    const listenersToNotify = new Set([
      ...specificListeners,
      ...wildcardListeners,
    ]);

    if (listenersToNotify.size > 0) {
      // Construct the full event object expected by listeners like #handleEvent
      const eventObject = {
        type: eventName,
        payload: eventPayload,
      };

      const listenersArray = Array.from(listenersToNotify);

      await Promise.all(
        listenersArray.map(async (listener) => {
          try {
            // Pass the constructed event object, not just the payload
            await listener(eventObject);
          } catch (error) {
            console.error(
              `EventBus: Error executing listener for event "${eventName}":`,
              error
            );
          }
        })
      );
    }
  }

  /**
   * Returns the number of listeners currently subscribed to a specific event
   * (excluding wildcard listeners unless eventName is '*').
   *
   * @param {string} eventName - The name of the event.
   * @returns {number} The number of listeners for the given event name. Returns 0 if the event has no listeners or the event name is invalid.
   */
  listenerCount(eventName) {
    if (typeof eventName !== 'string' || !eventName) {
      console.error(
        'EventBus: Invalid event name provided for listenerCount.',
        eventName
      );
      return 0;
    }

    return this.#listeners.get(eventName)?.size || 0;
  }
}

export default EventBus;
