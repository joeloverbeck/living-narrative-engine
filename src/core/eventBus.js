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
    async dispatch(eventName, eventData) { // <<< Make dispatch async >>>
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for dispatch.", eventName);
            return;
        }

        // console.log(`EventBus: Dispatching event "${eventName}"`, eventData); // Keep or remove logging as needed
        if (this.#listeners.has(eventName)) {
            const listenersToNotify = Array.from(this.#listeners.get(eventName)); // Get listeners as an array

            // Use Promise.all to execute all listeners concurrently and wait for them
            // This correctly handles both sync and async listeners.
            await Promise.all(listenersToNotify.map(async (listener) => { // <<< map with async and await Promise.all >>>
                try {
                    // Await the listener in case it's async. If it's sync, await has no effect.
                    await listener(eventData);
                } catch (error) {
                    console.error(`EventBus: Error executing listener for event "${eventName}":`, error);
                    // Continue notifying other listeners even if one fails
                }
            }));
        } else {
            // console.debug(`EventBus: No listeners registered for event "${eventName}".`);
        }
    }
}

export default EventBus;