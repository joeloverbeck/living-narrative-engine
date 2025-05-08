// src/core/services/subscriptionLifecycleManager.js
// --- FILE START ---
// --- Interface Imports for JSDoc ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../ports/commonTypes.js').UnsubscribeFn} UnsubscribeFn */

// --- Constant Imports ---
import { TURN_ENDED_ID } from '../constants/eventIds.js';

class SubscriptionLifecycleManager {
    /** @type {ILogger} **/
    #logger;
    /** @type {ICommandInputPort} **/
    #commandInputPort;
    /** @type {ISafeEventDispatcher} **/
    #safeEventDispatcher;

    /** @type {UnsubscribeFn | null} **/
    #commandUnsubscribeFn = null;
    /** @type {UnsubscribeFn | null} **/
    #turnEndedUnsubscribeFn = null;
    /** @type {boolean} **/
    #isCommandSubscribed = false;
    /** @type {boolean} **/
    #isTurnEndedSubscribed = false;

    /**
     * Manages the lifecycle of subscriptions for command input and turn ended events.
     * @param {object} dependencies - The dependencies for the manager.
     * @param {ILogger} dependencies.logger - The logger service.
     * @param {ICommandInputPort} dependencies.commandInputPort - The command input port.
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - The safe event dispatcher.
     */
    constructor({ logger, commandInputPort, safeEventDispatcher }) {
        const className = this.constructor.name;

        // Validate logger based on a method defined in ILogger, e.g., 'debug'
        if (!logger || typeof logger.debug !== 'function') {
            console.error(`${className} Constructor: Invalid or missing logger dependency (must include a debug method).`);
            throw new Error(`${className}: Invalid or missing logger dependency.`);
        }
        this.#logger = logger;

        if (!commandInputPort || typeof commandInputPort.onCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandInputPort dependency.`);
            throw new Error(`${className}: Invalid or missing commandInputPort dependency.`);
        }
        this.#commandInputPort = commandInputPort;

        if (!safeEventDispatcher || typeof safeEventDispatcher.subscribe !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher dependency.`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher dependency.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;

        this.#logger.debug(`${className}: Initialized.`); // Adjusted log message slightly for clarity
    }

    /**
     * Subscribes to command input. If already subscribed, it unsubscribes first and then re-subscribes.
     * @param {function(string): void} commandHandler - The function to call when a command is submitted.
     * @returns {boolean} True if successfully subscribed, false otherwise.
     */
    subscribeToCommandInput(commandHandler) {
        const className = this.constructor.name; // For logging context
        if (typeof commandHandler !== 'function') {
            this.#logger.error(`${className}: subscribeToCommandInput: commandHandler must be a function.`);
            return false;
        }

        if (this.#isCommandSubscribed || this.#commandUnsubscribeFn !== null) {
            this.#logger.warn(`${className}: subscribeToCommandInput called when already subscribed. Unsubscribing from previous command input first.`);
            this.unsubscribeFromCommandInput();
        }

        this.#logger.debug(`${className}: Attempting to subscribe to command input.`);
        try {
            this.#commandUnsubscribeFn = this.#commandInputPort.onCommand(commandHandler);

            if (typeof this.#commandUnsubscribeFn === 'function') {
                this.#isCommandSubscribed = true;
                this.#logger.debug(`${className}: Successfully subscribed to command input.`);
                return true;
            } else {
                this.#isCommandSubscribed = false; // Ensure it's false
                this.#commandUnsubscribeFn = null; // Ensure it's null if not a function
                this.#logger.error(`${className}: Failed to subscribe to command input. onCommand did not return an unsubscribe function.`);
                return false;
            }
        } catch (error) {
            this.#isCommandSubscribed = false;
            this.#commandUnsubscribeFn = null;
            this.#logger.error(`${className}: Error during command input subscription attempt: ${error.message}`, error);
            return false;
        }
    }

    /**
     * Unsubscribes from command input.
     */
    unsubscribeFromCommandInput() {
        const className = this.constructor.name; // For logging context
        if (this.#isCommandSubscribed && typeof this.#commandUnsubscribeFn === 'function') {
            this.#logger.debug(`${className}: Unsubscribing from command input.`);
            try {
                this.#commandUnsubscribeFn();
            } catch (error) {
                this.#logger.error(`${className}: Error during command input unsubscription: ${error.message}`, error);
            } finally {
                this.#commandUnsubscribeFn = null;
                this.#isCommandSubscribed = false;
                this.#logger.debug(`${className}: Command input unsubscribe process completed.`);
            }
        } else {
            if (this.#isCommandSubscribed && typeof this.#commandUnsubscribeFn !== 'function') {
                this.#logger.warn(`${className}: unsubscribeFromCommandInput: Inconsistent state. isCommandSubscribed is true, but no valid unsubscribe function stored. Resetting state.`);
            } else {
                this.#logger.debug(`${className}: unsubscribeFromCommandInput called but no active command subscription to unsubscribe.`);
            }
            this.#commandUnsubscribeFn = null;
            this.#isCommandSubscribed = false;
        }
    }

    /**
     * Subscribes to the TURN_ENDED_ID event. If already subscribed, it unsubscribes first and then re-subscribes.
     * @param {function(any): void} turnEndedListener - The function to call when the TURN_ENDED_ID event is dispatched.
     * @returns {boolean} True if successfully subscribed, false otherwise.
     */
    subscribeToTurnEnded(turnEndedListener) {
        const className = this.constructor.name; // For logging context
        if (typeof turnEndedListener !== 'function') {
            this.#logger.error(`${className}: subscribeToTurnEnded: turnEndedListener must be a function for ${TURN_ENDED_ID}.`);
            return false;
        }

        if (this.#isTurnEndedSubscribed || this.#turnEndedUnsubscribeFn !== null) {
            this.#logger.warn(`${className}: subscribeToTurnEnded called when already subscribed to ${TURN_ENDED_ID}. Unsubscribing first.`);
            this.unsubscribeFromTurnEnded();
        }

        this.#logger.debug(`${className}: Attempting to subscribe to ${TURN_ENDED_ID} event.`);
        try {
            this.#turnEndedUnsubscribeFn = this.#safeEventDispatcher.subscribe(TURN_ENDED_ID, turnEndedListener);

            if (typeof this.#turnEndedUnsubscribeFn === 'function') {
                this.#isTurnEndedSubscribed = true;
                this.#logger.debug(`${className}: Successfully subscribed to ${TURN_ENDED_ID} event.`);
                return true;
            } else {
                this.#isTurnEndedSubscribed = false;
                this.#turnEndedUnsubscribeFn = null; // Ensure it's null
                this.#logger.error(`${className}: Failed to subscribe to ${TURN_ENDED_ID}. SafeEventDispatcher.subscribe did not return an unsubscribe function.`);
                return false;
            }
        } catch (error) {
            this.#isTurnEndedSubscribed = false;
            this.#turnEndedUnsubscribeFn = null;
            this.#logger.error(`${className}: Error during ${TURN_ENDED_ID} event subscription attempt: ${error.message}`, error);
            return false;
        }
    }

    /**
     * Unsubscribes from the TURN_ENDED_ID event.
     */
    unsubscribeFromTurnEnded() {
        const className = this.constructor.name; // For logging context
        if (this.#isTurnEndedSubscribed && typeof this.#turnEndedUnsubscribeFn === 'function') {
            this.#logger.debug(`${className}: Unsubscribing from ${TURN_ENDED_ID} event.`);
            try {
                this.#turnEndedUnsubscribeFn();
            } catch (error) {
                this.#logger.error(`${className}: Error during ${TURN_ENDED_ID} event unsubscription: ${error.message}`, error);
            } finally {
                this.#turnEndedUnsubscribeFn = null;
                this.#isTurnEndedSubscribed = false;
                this.#logger.debug(`${className}: ${TURN_ENDED_ID} event unsubscribe process completed.`);
            }
        } else {
            if (this.#isTurnEndedSubscribed && typeof this.#turnEndedUnsubscribeFn !== 'function') {
                this.#logger.warn(`${className}: unsubscribeFromTurnEnded: Inconsistent state for ${TURN_ENDED_ID}. isTurnEndedSubscribed is true, but no valid unsubscribe function stored. Resetting state.`);
                this.#turnEndedUnsubscribeFn = null;
                this.#isTurnEndedSubscribed = false;
            } else {
                this.#logger.debug(`${className}: unsubscribeFromTurnEnded called but no active ${TURN_ENDED_ID} subscription.`);
            }
            // Ensure state is reset if not subscribed or inconsistent
            if (!this.#isTurnEndedSubscribed) {
                this.#turnEndedUnsubscribeFn = null;
            }
        }
    }

    /**
     * Clears all managed subscriptions.
     */
    unsubscribeAll() {
        const className = this.constructor.name; // For logging context
        this.#logger.debug(`${className}: unsubscribeAll called. Clearing all managed subscriptions.`);
        this.unsubscribeFromCommandInput();
        this.unsubscribeFromTurnEnded();
        this.#logger.debug(`${className}: unsubscribeAll completed.`);
    }
}

export default SubscriptionLifecycleManager;
// --- FILE END ---