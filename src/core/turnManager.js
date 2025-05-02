// src/core/turnManager.js
// --- FILE START (Entire file content as requested) ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../types/components.js';

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle within the game loop. It is responsible
 * for determining which entity acts next, initiating turns, and handling the transition
 * between turns or rounds by delegating to appropriate turn handlers. Dispatches semantic events
 * like 'core:turn_started' and 'core:system_error_occurred'.
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
    /** @type {ITurnHandlerResolver} */
    #turnHandlerResolver;

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
     * @param {ITurnHandlerResolver} options.turnHandlerResolver - Service to resolve the correct turn handler.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor(options) {
        const {turnOrderService, entityManager, logger, dispatcher, turnHandlerResolver} = options || {};

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
            logger.error(errorMsg); // Use logger if available
            throw new Error(errorMsg);
        }
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolveHandler !== 'function') {
            const errorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;
        this.#turnHandlerResolver = turnHandlerResolver;

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
        // TODO: Dispatch a 'core:game_started' or 'core:round_started' event here or in TurnOrderService?
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
        this.#currentActor = null; // Clear current actor on stop

        try {
            await this.#turnOrderService.clearCurrentRound();
            this.#logger.debug('Turn order service current round cleared.');
            // TODO: Dispatch a 'core:game_ended' or 'core:round_ended' event here?
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
     * Dispatches 'core:turn_started' and delegates turn execution to the appropriate handler.
     * Handles system-level errors by dispatching 'core:system_error_occurred'.
     * @async
     * @returns {Promise<void>} A promise that resolves when the transition is complete.
     */
    async advanceTurn() {
        if (!this.#isRunning) {
            this.#logger.debug('TurnManager.advanceTurn() called while manager is not running. Returning.');
            return;
        }

        this.#logger.debug('TurnManager.advanceTurn() called.');
        // Note: 'core:turn_ended' for the *previous* actor should be dispatched by the handler *before* it calls advanceTurn.

        const isQueueEmpty = await this.#turnOrderService.isEmpty();

        if (isQueueEmpty) {
            this.#logger.info('Turn queue is empty. Attempting to start a new round.');
            const allEntities = Array.from(this.#entityManager.activeEntities.values());
            const actors = allEntities.filter(e => e.hasComponent(ACTOR_COMPONENT_ID));

            if (actors.length === 0) {
                const errorMsg = 'Cannot start a new round: No active entities with an Actor component found.';
                this.#logger.error(errorMsg);
                // --- SEMANTIC EVENT DISPATCH ---
                try {
                    await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                        message: 'System Error: No active actors found to start a round. Stopping game.',
                        type: 'error',
                        details: errorMsg
                    });
                } catch (dispatchError) {
                    this.#logger.error(`Failed to dispatch core:system_error_occurred: ${dispatchError.message}`, dispatchError);
                }
                // --- END SEMANTIC EVENT DISPATCH ---
                await this.stop();
                return;
            }

            const actorIds = actors.map(a => a.id);
            this.#logger.info(`Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`);
            const strategy = 'round-robin'; // TODO: Make strategy configurable

            try {
                await this.#turnOrderService.startNewRound(actors, strategy);
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);
                // TODO: Dispatch 'core:round_started' here or in TurnOrderService?
                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn(); // Recursively call to get the first actor of the new round
                return;

            } catch (error) {
                const errorMsg = `Error starting new round: ${error.message}`;
                this.#logger.error(errorMsg, error);
                // --- SEMANTIC EVENT DISPATCH ---
                try {
                    await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                        message: `System Error: Failed to start a new round. Stopping game.`,
                        type: 'error',
                        details: errorMsg
                    });
                } catch (dispatchError) {
                    this.#logger.error(`Failed to dispatch core:system_error_occurred: ${dispatchError.message}`, dispatchError);
                }
                // --- END SEMANTIC EVENT DISPATCH ---
                await this.stop();
                return;
            }
        } else {
            // --- Turn Handling Logic ---
            this.#logger.debug('Queue not empty, retrieving next entity.');
            const nextEntity = await this.#turnOrderService.getNextEntity();

            if (!nextEntity) {
                const errorMsg = 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.';
                this.#logger.error(errorMsg);
                // --- SEMANTIC EVENT DISPATCH ---
                try {
                    await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                        message: 'Internal Error: Turn order inconsistency detected. Stopping game.',
                        type: 'error',
                        details: errorMsg
                    });
                } catch (dispatchError) {
                    this.#logger.error(`Failed to dispatch core:system_error_occurred: ${dispatchError.message}`, dispatchError);
                }
                // --- END SEMANTIC EVENT DISPATCH ---
                await this.stop();
                return;
            }

            this.#currentActor = nextEntity;
            const actorId = this.#currentActor.id;
            const isPlayer = this.#currentActor.hasComponent(PLAYER_COMPONENT_ID);
            const entityType = isPlayer ? 'player' : 'ai';

            this.#logger.info(`>>> Starting turn for Entity: ${actorId} (${entityType}) <<<`);

            // --- SEMANTIC EVENT DISPATCH: core:turn_started ---
            try {
                await this.#dispatcher.dispatchValidated('core:turn_started', {
                    entityId: actorId,
                    entityType: entityType
                });
                this.#logger.debug(`Dispatched core:turn_started for ${actorId}`);
            } catch(dispatchError) {
                this.#logger.error(`Failed to dispatch core:turn_started for ${actorId}: ${dispatchError.message}`, dispatchError);
                // Decide how to proceed - maybe stop the game? For now, log and continue.
            }
            // --- END SEMANTIC EVENT DISPATCH ---

            // --- Delegate to Turn Handler ---
            this.#logger.debug(`Resolving turn handler for entity ${actorId}...`);
            try {
                const handler = await this.#turnHandlerResolver.resolveHandler(this.#currentActor);

                if (!handler) {
                    this.#logger.warn(`Could not resolve a turn handler for actor ${actorId}. Skipping turn.`);
                    // TODO: Dispatch a 'core:turn_skipped' event?
                    this.#currentActor = null; // Clear actor before advancing
                    await this.advanceTurn(); // Move to the next actor
                    return;
                }

                const handlerName = handler.constructor?.name || 'resolved handler';
                this.#logger.debug(`Calling handleTurn on ${handlerName} for entity ${actorId}`);

                // Await the handler. The handler is responsible for eventually calling advanceTurn().
                // It should also dispatch 'core:turn_ended' before doing so.
                await handler.handleTurn(this.#currentActor);

                this.#logger.debug(`handleTurn promise resolved for ${handlerName} for entity ${actorId}. Waiting for advanceTurn call.`);
                // The game loop naturally waits here until the handler's logic completes and triggers the next advanceTurn.

            } catch (error) {
                // Log errors originating from resolveHandler OR handler.handleTurn
                const errorMsg = `Error during turn handling resolution or execution for entity ${actorId}: ${error.message}`;
                this.#logger.error(errorMsg, error);

                // --- SEMANTIC EVENT DISPATCH ---
                try {
                    await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                        message: `Error during turn processing for ${actorId}. Attempting recovery.`,
                        type: 'error',
                        details: errorMsg
                    });
                } catch (dispatchError) {
                    this.#logger.error(`Failed to dispatch core:system_error_occurred after turn handling error: ${dispatchError.message}`, dispatchError);
                }
                // --- END SEMANTIC EVENT DISPATCH ---

                // Recovery Strategy: Attempt to advance to prevent complete stall.
                this.#logger.warn(`Attempting to advance turn after handling error for actor ${actorId}.`);
                this.#currentActor = null; // Ensure actor is cleared before advancing
                // Add a small delay? Optional, might help prevent tight error loops.
                // await new Promise(resolve => setTimeout(resolve, 50));
                await this.advanceTurn(); // Try to move to the next actor
            }
        }
    }
}

export default TurnManager;
// --- FILE END ---