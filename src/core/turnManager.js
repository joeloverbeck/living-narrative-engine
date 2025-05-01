// src/core/turnManager.js

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../types/components.js'; // Added PLAYER_COMPONENT_ID

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle within the game loop. It is responsible
 * for determining which entity acts next, initiating turns, and handling the transition
 * between turns or rounds.
 */
class TurnManager {
    /** @type {ITurnOrderService} */
    #turnOrderService;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {ILogger} */
    #logger;
    /** @type {IValidatedEventDispatcher} */
    #dispatcher;

    /** @type {boolean} */
    #isRunning = false;
    /** @type {Entity | null} */
    #currentActor = null;

    /**
     * Creates an instance of TurnManager.
     * @param {object} options - The dependencies for the TurnManager.
     * @param {ITurnOrderService} options.turnOrderService - Service for managing turn order within a round.
     * @param {EntityManager} options.entityManager - Service for managing entities.
     * @param {ILogger} options.logger - Logging service.
     * @param {IValidatedEventDispatcher} options.dispatcher - Service for dispatching validated events.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor(options) {
        const {turnOrderService, entityManager, logger, dispatcher} = options || {};

        // Validate dependencies
        if (!turnOrderService || typeof turnOrderService.clearCurrentRound !== 'function') {
            const errorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
            console.error(errorMsg); // Log before potentially throwing if logger is also invalid
            throw new Error(errorMsg);
        }
        // Basic check for EntityManager - more specific checks could be added if needed
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            const errorMsg = 'TurnManager requires a valid EntityManager instance.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = 'TurnManager requires a valid ILogger instance.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        // Basic check for IValidatedEventDispatcher
        if (!dispatcher || typeof dispatcher.dispatchValidated !== 'function') {
            const errorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance.';
            // Check if logger is valid before trying to use it
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg); // Fallback to console if logger is invalid
            }
            throw new Error(errorMsg);
        }

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;

        this.#isRunning = false;
        this.#currentActor = null;

        this.#logger.info('TurnManager initialized successfully.');
    }

    /**
     * Starts the turn management process.
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully started.
     */
    async start() {
        if (this.#isRunning) {
            this.#logger.warn('TurnManager.start() called but manager is already running.');
            return;
        }
        this.#isRunning = true;
        this.#logger.info('Turn Manager started.');
        // Future tickets will implement the logic to find the first actor and call advanceTurn if needed.
        // For now, let's call advanceTurn immediately to trigger the new round logic if needed.
        await this.advanceTurn();
    }

    /**
     * Stops the turn management process.
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully stopped.
     */
    async stop() {
        if (!this.#isRunning) {
            this.#logger.info('TurnManager.stop() called but manager is already stopped.');
            return;
        }
        this.#isRunning = false;
        this.#currentActor = null;

        try {
            // No need to await if clearCurrentRound is synchronous, but added for consistency if it changes
            await this.#turnOrderService.clearCurrentRound();
            this.#logger.debug('Turn order service current round cleared.');
        } catch (error) {
            this.#logger.error('Error calling turnOrderService.clearCurrentRound() during stop:', error);
            // Decide if this error should be re-thrown or just logged. Logging for now.
        }

        this.#logger.info('Turn Manager stopped.');
    }

    /**
     * Retrieves the entity instance whose turn it is currently.
     * @returns {Entity | null} The entity currently taking its turn, or `null`.
     */
    getCurrentActor() {
        return this.#currentActor;
    }

    /**
     * Advances the game state to the next entity's turn, or starts a new round if needed.
     * This method encapsulates the core turn progression logic.
     * @async
     * @returns {Promise<void>} A promise that resolves when the transition is complete.
     */
    async advanceTurn() {
        // Add initial check: If #isRunning is false, log debug and return immediately.
        if (!this.#isRunning) {
            this.#logger.debug('TurnManager.advanceTurn() called while manager is not running. Returning.');
            return;
        }

        this.#logger.debug('TurnManager.advanceTurn() called.');

        // Call this.#turnOrderService.isEmpty().
        const isQueueEmpty = await this.#turnOrderService.isEmpty(); // Assume isEmpty might be async

        // Implement Empty Queue Logic: If isEmpty() returns true:
        if (isQueueEmpty) {
            this.#logger.info('Turn queue is empty. Attempting to start a new round.');

            // Get all active entities: Array.from(this.#entityManager.activeEntities.values()).
            const allEntities = Array.from(this.#entityManager.activeEntities.values());

            // Filter entities to find actors: entities.filter(e => e.hasComponent(ACTOR_COMPONENT_ID)).
            const actors = allEntities.filter(e => e.hasComponent(ACTOR_COMPONENT_ID));

            // Handle "No Actors Found":
            if (actors.length === 0) {
                // Log an error (this.#logger.error(...)).
                this.#logger.error('Cannot start a new round: No active entities with an Actor component found.');
                // Dispatch a message via this.#dispatcher.dispatchValidated('textUI:display_message', { text: 'No active actors...', type: 'error' }).
                await this.#dispatcher.dispatchValidated('textUI:display_message', { // Added await
                    text: 'System Error: No active actors found to start a round. Stopping.',
                    type: 'error'
                });
                // Call this.stop().
                await this.stop();
                // Return immediately after calling stop().
                return;
            }

            // Start New Round:
            // If actors are found:
            // Log the number of actors found and their IDs (this.#logger.info(...)).
            const actorIds = actors.map(a => a.id);
            this.#logger.info(`Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`);

            // Define the strategy (e.g., const strategy = 'round-robin').
            const strategy = 'round-robin'; // Default strategy for now

            // Wrap the call to startNewRound in a try...catch block.
            try {
                // Call this.#turnOrderService.startNewRound(actors, strategy).
                await this.#turnOrderService.startNewRound(actors, strategy);
                // Log success (this.#logger.info(...)).
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);

                // (Self-Correction): After successfully starting the round, recursively call this.advanceTurn()
                // to process the first turn of the new round. Return after this recursive call.
                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn(); // Process the first turn of the newly started round
                return; // Important: return here to avoid executing the 'else' block below

            } catch (error) {
                // Handle startNewRound Error:
                // In the catch block:
                // Log the error (this.#logger.error(...)).
                this.#logger.error(`Error starting new round: ${error.message}`, error);
                // Dispatch an error message via this.#dispatcher.dispatchValidated('textUI:display_message', { text: \`Error starting round: ${error.message}\`, type: 'error' }).
                await this.#dispatcher.dispatchValidated('textUI:display_message', { // Added await
                    text: `System Error: Failed to start a new round. Stopping. Details: ${error.message}`,
                    type: 'error'
                });
                // Call this.stop().
                await this.stop();
                // Return immediately after calling stop().
                return;
            }
        } else {
            // Implement !isEmpty() Logic (Ticket 2.1.3)
            this.#logger.debug('Queue not empty, retrieving next entity.');
            const nextEntity = await this.#turnOrderService.getNextEntity(); // Assume async

            // Handle getNextEntity() Null Return:
            if (!nextEntity) {
                this.#logger.error('Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.');
                await this.#dispatcher.dispatchValidated('textUI:display_message', { // Added await
                    text: 'Internal Error: Turn order inconsistency detected. Stopping manager.',
                    type: 'error'
                });
                await this.stop(); // Stop the manager
                return; // Exit the function
            }

            // Update State:
            this.#currentActor = nextEntity;
            this.#logger.info(`>>> Starting turn for Entity: ${this.#currentActor.id} <<<`);

            // Identify Actor Type and Dispatch Event (Ticket 2.1.4):
            if (this.#currentActor.hasComponent(PLAYER_COMPONENT_ID)) {
                this.#logger.debug(`Entity ${this.#currentActor.id} is player-controlled.`);
                const eventName = 'player:turn_start';
                const payload = {entityId: this.#currentActor.id};
                await this.#dispatcher.dispatchValidated(eventName, payload);
                this.#logger.debug(`Dispatched '${eventName}' event for player entity: ${payload.entityId}`);
            } else {
                this.#logger.info(`Entity ${this.#currentActor.id} is AI-controlled.`);
                const eventName = 'ai:turn_start';
                const payload = {entityId: this.#currentActor.id};
                await this.#dispatcher.dispatchValidated(eventName, payload);
                this.#logger.debug(`Dispatched '${eventName}' event for AI entity: ${payload.entityId}`);
            }

            // Placeholder for triggering the actual turn logic (e.g., AI processing or waiting for player input)
            // This will likely involve listening for the events dispatched above.
        }
    }
}

export default TurnManager;