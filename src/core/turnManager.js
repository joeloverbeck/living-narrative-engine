// src/core/turnManager.js

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

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
            this.#logger.error(errorMsg); // Use logger now that we know it's potentially valid
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
        // await this.advanceTurn(); // Deferred
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
     * Advances the game state to the next entity's turn.
     * (Stub for now - Full implementation in later tickets).
     * @async
     * @returns {Promise<void>} A promise that resolves when the transition is complete.
     */
    async advanceTurn() {
        // Stub implementation - Logic to determine next actor and update state will be added later.
        this.#logger.debug('TurnManager.advanceTurn() called (stub).');
        // Placeholder for future logic:
        // if (!this.#isRunning) return;
        // find next actor from #turnOrderService
        // set #currentActor
        // dispatch 'turn:started' event?
        // etc.
        return Promise.resolve();
    }
}

export default TurnManager;