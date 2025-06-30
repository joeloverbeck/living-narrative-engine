// src/events/eventBus.js

/**
 * A simple Event Bus for decoupled communication between systems using a publish/subscribe pattern.
 */
import { IEventBus } from '../interfaces/IEventBus.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

class EventBus extends IEventBus {
  #listeners = new Map(); // Stores eventName -> Set<listenerFn>
  #logger;

  /**
   * @param {{ logger?: ILogger }} [deps]
   */
  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /**
   * Validates that an event name is a non-empty string.
   *
   * @param {string} name - The event name to validate.
   * @returns {boolean} True if the name is valid, false otherwise.
   */
  #validateEventName(name) {
    const isValid = typeof name === 'string' && name.length > 0;
    if (!isValid) {
      this.#logger.error('EventBus: Invalid event name provided.', name);
    }
    return isValid;
  }

  /**
   * Validates that the listener is a function.
   *
   * @param {*} listener - The listener to validate.
   * @returns {boolean} True if the listener is valid, false otherwise.
   */
  #validateListener(listener) {
    const isValid = typeof listener === 'function';
    if (!isValid) {
      this.#logger.error(
        'EventBus: Invalid listener provided. Expected a function.'
      );
    }
    return isValid;
  }

  /**
   * Subscribes a listener to a specific event.
   *
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {EventListener} listener - Function to invoke when the event is dispatched.
   * @returns {(() => boolean) | null} An unsubscribe function on success, or `null` on failure.
   */
  subscribe(eventName, listener) {
    if (
      !this.#validateEventName(eventName) ||
      !this.#validateListener(listener)
    ) {
      return null;
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(listener);

    return () => this.unsubscribe(eventName, listener);
  }

  /**
   * Unsubscribes a listener from a specific event.
   *
   * @param {string} eventName - The event identifier.
   * @param {EventListener} listener - The previously subscribed listener.
   * @returns {boolean} `true` if a listener was removed, otherwise `false`.
   */
  unsubscribe(eventName, listener) {
    if (
      !this.#validateEventName(eventName) ||
      !this.#validateListener(listener)
    ) {
      return false;
    }

    if (this.#listeners.has(eventName)) {
      const eventListeners = this.#listeners.get(eventName);
      const deleted = eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
      return deleted;
    }
    return false;
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
    if (!this.#validateEventName(eventName)) {
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
            this.#logger.error(
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
    if (!this.#validateEventName(eventName)) {
      return 0;
    }

    return this.#listeners.get(eventName)?.size || 0;
  }
}

export default EventBus;
