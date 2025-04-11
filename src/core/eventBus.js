// eventBus.js

/**
 * A simple Event Bus for decoupled communication between systems using a publish/subscribe pattern.
 */
class EventBus {
    // Use a Map where keys are event names (string) and values are Sets of listener functions.
    // Using a Set prevents duplicate listeners for the same event.
    #listeners = new Map();

    /**
     * Subscribes a listener function to a specific event name.
     * @param {string} eventName - The name of the event to subscribe to.
     * @param {Function} listener - The callback function to execute when the event is dispatched.
     */
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
        // console.debug(`EventBus: Listener subscribed to "${eventName}"`); // Keep debug logs minimal unless needed
    }

    /**
     * Unsubscribes a specific listener function from an event name.
     * @param {string} eventName - The name of the event to unsubscribe from.
     * @param {Function} listener - The specific listener function to remove.
     */
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
            const deleted = eventListeners.delete(listener); // delete returns true if successful
            if (deleted) {
                // console.debug(`EventBus: Listener unsubscribed from "${eventName}"`);
            }

            // Clean up the Set and Map entry if no listeners remain for this event
            if (eventListeners.size === 0) {
                this.#listeners.delete(eventName);
                // console.debug(`EventBus: Removed event entry "${eventName}" as no listeners remain.`);
            }
        } else {
            // console.debug(`EventBus: No listeners found for event "${eventName}" to unsubscribe from.`);
        }
    }

    /**
     * Dispatches an event, calling all subscribed listeners for that event name.
     * @param {string} eventName - The name of the event to dispatch.
     * @param {object} eventData - The data payload associated with the event.
     */
    dispatch(eventName, eventData) {
        if (typeof eventName !== 'string' || !eventName) {
            console.error("EventBus: Invalid event name provided for dispatch.", eventName);
            return;
        }

        console.log(`EventBus: Dispatching event "${eventName}"`, eventData); // Log dispatched events
        if (this.#listeners.has(eventName)) {
            // Iterate over a *copy* of the Set to prevent issues if a listener
            // unsubscribes itself or another listener during the dispatch.
            const listenersToNotify = new Set(this.#listeners.get(eventName));

            listenersToNotify.forEach(listener => {
                try {
                    // Pass only the event data. The listener's closure/context
                    // should know which event it's handling if needed.
                    listener(eventData);
                } catch (error) {
                    console.error(`EventBus: Error executing listener for event "${eventName}":`, error);
                    // Continue notifying other listeners
                }
            });
        } else {
            // console.debug(`EventBus: No listeners registered for event "${eventName}".`);
        }
    }
}

export default EventBus;