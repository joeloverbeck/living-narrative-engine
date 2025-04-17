// eventBus.js

/**
 * A simple Event Bus for decoupled communication between systems using a publish/subscribe pattern.
 */
class EventBus {
    #listeners = new Map();

    subscribe(eventName, listener) {
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for subscription.", eventName);
            return;
        }
        if (typeof listener !== 'function') {
            console.error(`EventBus: Invalid listener provided for event "${eventName}". Expected a function.`);
            return;
        }

        if (!this.#listeners.has(eventName)) {
            this.#listeners.set(eventName, new Set());
        }
        this.#listeners.get(eventName).add(listener);
    }

    unsubscribe(eventName, listener) {
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for unsubscription.", eventName);
            return;
        }
        if (typeof listener !== 'function') {
            console.error(`EventBus: Invalid listener provided for unsubscription from event "${eventName}".`);
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
     * Dispatches an event, ASYNCHRONOUSLY calling all subscribed listeners for that event name.
     * Waits for all listener promises to settle.
     * @param {string} eventName - The name of the event to dispatch.
     * @param {object} eventData - The data payload associated with the event.
     * @returns {Promise<void>} A promise that resolves when all listeners have been processed.
     */
    async dispatch(eventName, eventData) {
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for dispatch.", eventName);
            return;
        }

        // console.log(`EventBus: Dispatching event "${eventName}"`, eventData);
        if (this.#listeners.has(eventName)) {
            const listenersToNotify = Array.from(this.#listeners.get(eventName));

            await Promise.all(listenersToNotify.map(async (listener) => {
                try {
                    await listener(eventData);
                } catch (error) {
                    console.error(`EventBus: Error executing listener for event "${eventName}":`, error);
                }
            }));
        } else {
            // console.debug(`EventBus: No listeners registered for event "${eventName}".`);
        }
    }

    /**
     * Returns the number of listeners currently subscribed to a specific event.
     * @param {string} eventName - The name of the event.
     * @returns {number} The number of listeners for the given event name. Returns 0 if the event has no listeners or the event name is invalid.
     */
    listenerCount(eventName) {
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for listenerCount.", eventName);
            return 0; // Return 0 for invalid event names
        }

        if (this.#listeners.has(eventName)) {
            // Get the Set of listeners for the event and return its size
            return this.#listeners.get(eventName).size;
        } else {
            // No listeners registered for this event name
            return 0;
        }
    }
}

export default EventBus;