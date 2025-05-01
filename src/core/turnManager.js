// src/core/turnManager.js
// --- FILE START (Entire file content as requested) ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */ // <<< ADDED

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../types/components.js';

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle within the game loop. It is responsible
 * for determining which entity acts next, initiating turns, and handling the transition
 * between turns or rounds by delegating to appropriate turn handlers.
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
    /** @type {ITurnHandlerResolver} */ // <<< ADDED
    #turnHandlerResolver; // <<< ADDED

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
     * @param {ITurnHandlerResolver} options.turnHandlerResolver - Service to resolve the correct turn handler. // <<< ADDED
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor(options) {
        const {turnOrderService, entityManager, logger, dispatcher, turnHandlerResolver} = options || {}; // <<< ADDED turnHandlerResolver

        // Validate dependencies
        if (!turnOrderService || typeof turnOrderService.clearCurrentRound !== 'function') {
            const errorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
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
        if (!dispatcher || typeof dispatcher.dispatchValidated !== 'function') {
            const errorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance.';
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg);
            }
            throw new Error(errorMsg);
        }
        // <<< ADDED turnHandlerResolver validation ---
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolve !== 'function') {
            const errorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance.';
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg);
            }
            throw new Error(errorMsg);
        }
        // --- END turnHandlerResolver validation ---

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;
        this.#turnHandlerResolver = turnHandlerResolver; // <<< ADDED assignment

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
            await this.#turnOrderService.clearCurrentRound();
            this.#logger.debug('Turn order service current round cleared.');
        } catch (error) {
            this.#logger.error('Error calling turnOrderService.clearCurrentRound() during stop:', error);
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
     * Delegates turn execution to the appropriate handler (Player/AI).
     * @async
     * @returns {Promise<void>} A promise that resolves when the transition is complete.
     */
    async advanceTurn() {
        if (!this.#isRunning) {
            this.#logger.debug('TurnManager.advanceTurn() called while manager is not running. Returning.');
            return;
        }

        this.#logger.debug('TurnManager.advanceTurn() called.');

        const isQueueEmpty = await this.#turnOrderService.isEmpty();

        if (isQueueEmpty) {
            this.#logger.info('Turn queue is empty. Attempting to start a new round.');
            const allEntities = Array.from(this.#entityManager.activeEntities.values());
            const actors = allEntities.filter(e => e.hasComponent(ACTOR_COMPONENT_ID));

            if (actors.length === 0) {
                this.#logger.error('Cannot start a new round: No active entities with an Actor component found.');
                await this.#dispatcher.dispatchValidated('textUI:display_message', {
                    text: 'System Error: No active actors found to start a round. Stopping.',
                    type: 'error'
                });
                await this.stop();
                return;
            }

            const actorIds = actors.map(a => a.id);
            this.#logger.info(`Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`);
            const strategy = 'round-robin';

            try {
                await this.#turnOrderService.startNewRound(actors, strategy);
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);
                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn();
                return;

            } catch (error) {
                this.#logger.error(`Error starting new round: ${error.message}`, error);
                await this.#dispatcher.dispatchValidated('textUI:display_message', {
                    text: `System Error: Failed to start a new round. Stopping. Details: ${error.message}`,
                    type: 'error'
                });
                await this.stop();
                return;
            }
        } else {
            // --- Turn Handling Logic ---
            this.#logger.debug('Queue not empty, retrieving next entity.');
            const nextEntity = await this.#turnOrderService.getNextEntity();

            if (!nextEntity) {
                this.#logger.error('Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.');
                await this.#dispatcher.dispatchValidated('textUI:display_message', {
                    text: 'Internal Error: Turn order inconsistency detected. Stopping manager.',
                    type: 'error'
                });
                await this.stop();
                return;
            }

            this.#currentActor = nextEntity;
            this.#logger.info(`>>> Starting turn for Entity: ${this.#currentActor.id} <<<`);

            // --- MODIFICATION START: Delegate to Turn Handler ---
            const actorType = this.#currentActor.hasComponent(PLAYER_COMPONENT_ID) ? 'player' : 'ai';
            this.#logger.debug(`Entity ${this.#currentActor.id} identified as type: ${actorType}`);

            try {
                const handler = this.#turnHandlerResolver.resolve(actorType);
                if (!handler) {
                    // This case should ideally be prevented by TurnHandlerResolver throwing an error,
                    // but good to have a fallback.
                    throw new Error(`Could not resolve a turn handler for type '${actorType}'.`);
                }

                this.#logger.debug(`Calling handleTurn on ${handler.constructor.name} for entity ${this.#currentActor.id}`);
                await handler.handleTurn(this.#currentActor); // Await the handler
                this.#logger.debug(`handleTurn completed for ${handler.constructor.name} for entity ${this.#currentActor.id}`);

                // Note: advanceTurn() will be called again by the handler (e.g., PlayerTurnHandler on action completion, AITurnHandler immediately).

            } catch (error) {
                this.#logger.error(`Error during turn handling for entity ${this.#currentActor.id} (type: ${actorType}): ${error.message}`, error);
                // Display an error to the UI
                await this.#dispatcher.dispatchValidated('textUI:display_message', {
                    text: `Error during ${actorType}'s turn: ${error.message}. See console for details.`,
                    type: 'error'
                });
                // Decide on recovery: Should we stop? Or try to advance to the next turn?
                // For now, let's log the error and attempt to continue to avoid complete stoppage.
                // If the error is critical, stopping might be necessary, but that requires more context.
                // We might need to force the next turn if the handler didn't call advanceTurn due to the error.
                // Consider adding logic here if needed, but for now, the GameLoop will continue.
                // If the handler failed *before* calling advanceTurn, the game might stall.
                // Let's assume for now that handlers will either complete or throw,
                // and the responsibility of advancing lies with them (or the error handling here if necessary).
                // A possible safety measure if a handler consistently fails:
                // if (error.isFatal) { await this.stop(); }
            }
            // --- MODIFICATION END: Delegate to Turn Handler ---

            // --- REMOVED Temporary Delegation Logic ---
            // The if/else block dispatching 'player:turn_start' or 'ai:turn_start' is now removed.
            // --- End Removal ---
        }
    }
}

export default TurnManager;
// --- FILE END ---