// src/core/turnManager.js
// --- FILE START (Corrected) ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */
/** @typedef {import('./interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */ // <<< Added for type hint
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */ // <<< Added for event payload type

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../types/components.js';

// <<< Define the event type we expect for turn completion >>>
const TURN_ENDED_EVENT_TYPE = 'core:turn_ended'; // Assuming this event is dispatched when ITurnEndPort.notifyTurnEnded is called

/**
 * @class TurnManager
 * @implements {ITurnManager}
 * @classdesc Manages the overall turn lifecycle. Determines the next actor,
 * initiates their turn via the appropriate handler, and waits for a turn completion
 * event (`core:turn_ended`) before advancing to the next turn or round.
 * Dispatches semantic events like 'core:turn_started' and 'core:system_error_occurred'.
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
    /** @type {ITurnHandler | null} */ // Keep track of the current handler for potential cleanup/checks
    #currentHandler = null;
    /** @type { (() => void) | null } */ // Store the unsubscribe function
    #turnEndedUnsubscribe = null;


    /**
     * Creates an instance of TurnManager.
     * @param {object} options - The dependencies for the TurnManager.
     * @param {ITurnOrderService} options.turnOrderService - Service for managing turn order within a round.
     * @param {EntityManager} options.entityManager - Service for managing entities.
     * @param {ILogger} options.logger - Logging service.
     * @param {IValidatedEventDispatcher} options.dispatcher - Service for dispatching events AND subscribing.
     * @param {ITurnHandlerResolver} options.turnHandlerResolver - Service to resolve the correct turn handler.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor(options) {
        const {turnOrderService, entityManager, logger, dispatcher, turnHandlerResolver} = options || {};
        const className = this.constructor.name;

        // --- Dependency Validations (Ensure dispatcher has subscribe) ---
        if (!turnOrderService || typeof turnOrderService.clearCurrentRound !== 'function') {
            const errorMsg = `${className} requires a valid ITurnOrderService instance.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            const errorMsg = `${className} requires a valid EntityManager instance.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            const errorMsg = `${className} requires a valid ILogger instance.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        // <<< Updated check for dispatcher >>>
        if (!dispatcher || typeof dispatcher.dispatchValidated !== 'function' || typeof dispatcher.subscribe !== 'function') {
            const errorMsg = `${className} requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).`;
            (logger || console).error(errorMsg); // Use logger if available
            throw new Error(errorMsg);
        }
        // <<< End updated check >>>
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolveHandler !== 'function') {
            const errorMsg = `${className} requires a valid ITurnHandlerResolver instance (with resolveHandler method).`;
            (logger || console).error(errorMsg);
            throw new Error(errorMsg);
        }
        // --- End Dependency Validations ---

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;
        this.#turnHandlerResolver = turnHandlerResolver;

        this.#isRunning = false;
        this.#currentActor = null;
        this.#currentHandler = null;
        this.#turnEndedUnsubscribe = null; // Initialize unsubscribe callback store

        this.#logger.info('TurnManager initialized successfully.');
    }

    /**
     * Starts the turn management process. Subscribes to turn end events.
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully started and the first turn advance is initiated.
     */
    async start() {
        if (this.#isRunning) {
            this.#logger.warn('TurnManager.start() called but manager is already running.');
            return;
        }
        this.#isRunning = true;
        this.#logger.info('Turn Manager started.');

        // <<< Subscribe to the Turn Ended event (Ticket #7) >>>
        this.#subscribeToTurnEnd();

        // TODO: Dispatch a 'core:game_started' or 'core:round_started' event here or in TurnOrderService?
        // Initiate the first turn
        await this.advanceTurn();
    }

    /**
     * Stops the turn management process. Unsubscribes from turn end events.
     * @async
     * @returns {Promise<void>} A promise that resolves when the manager has successfully stopped.
     */
    async stop() {
        if (!this.#isRunning) {
            this.#logger.info('TurnManager.stop() called but manager is already stopped.');
            return;
        }
        this.#isRunning = false;

        // <<< Unsubscribe from Turn Ended event (Ticket #7) >>>
        this.#unsubscribeFromTurnEnd();

        // Destroy the current handler if one exists
        if (this.#currentHandler && typeof this.#currentHandler.destroy === 'function') {
            try {
                this.#logger.debug(`Calling destroy() on current handler (${this.#currentHandler.constructor?.name || 'Unknown'}) for actor ${this.#currentActor?.id || 'N/A'}`);
                await Promise.resolve(this.#currentHandler.destroy()); // Handle sync or async destroy
            } catch (destroyError) {
                this.#logger.error(`Error calling destroy() on current handler during stop: ${destroyError.message}`, destroyError);
            }
        }

        this.#currentActor = null; // Clear current actor on stop
        this.#currentHandler = null; // Clear current handler

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
     * Advances the game state to the next entity's turn, or starts a new round.
     * Resolves the handler, calls its `startTurn` method, and then *waits* for the
     * `core:turn_ended` event before proceeding.
     * Handles system-level errors by dispatching 'core:system_error_occurred'.
     * @async
     * @private - Should only be called internally or by the turn ended event handler.
     * @returns {Promise<void>} A promise that resolves when the next turn has been *initiated*.
     */
    async advanceTurn() {
        // This property is private, accessing via _TurnManager_isRunning is a convention/workaround for tests sometimes.
        // Using the public getter or internal #isRunning is preferred.
        // const isRunning = this._TurnManager_isRunning ?? true; // Example access from test - not ideal
        if (!this.#isRunning) {
            this.#logger.debug('TurnManager.advanceTurn() called while manager is not running. Returning.');
            return;
        }

        this.#logger.debug('TurnManager.advanceTurn() initiating...');
        // Clear previous actor/handler *before* getting the next one
        this.#currentActor = null;
        this.#currentHandler = null; // Ensures we resolve a fresh handler

        try {
            const isQueueEmpty = await this.#turnOrderService.isEmpty();

            if (isQueueEmpty) {
                // --- Start New Round Logic ---
                this.#logger.info('Turn queue is empty. Attempting to start a new round.');
                const allEntities = Array.from(this.#entityManager.activeEntities.values());
                const actors = allEntities.filter(e => e.hasComponent(ACTOR_COMPONENT_ID));

                if (actors.length === 0) {
                    const errorMsg = 'Cannot start a new round: No active entities with an Actor component found.';
                    this.#logger.error(errorMsg);
                    await this.#dispatchSystemError('System Error: No active actors found to start a round. Stopping game.', errorMsg);
                    await this.stop();
                    return;
                }

                const actorIds = actors.map(a => a.id);
                this.#logger.info(`Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`);
                const strategy = 'round-robin'; // TODO: Make strategy configurable

                await this.#turnOrderService.startNewRound(actors, strategy);
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);
                // TODO: Dispatch 'core:round_started'?
                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn(); // Recursively call to get the first actor of the new round
                return;
                // --- End Start New Round Logic ---

            } else {
                // --- Get Next Actor ---
                this.#logger.debug('Queue not empty, retrieving next entity.');
                const nextEntity = await this.#turnOrderService.getNextEntity();

                if (!nextEntity) {
                    const errorMsg = 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.';
                    this.#logger.error(errorMsg);
                    await this.#dispatchSystemError('Internal Error: Turn order inconsistency detected. Stopping game.', errorMsg);
                    await this.stop();
                    return;
                }

                // --- Set Current Actor & Dispatch Turn Started ---
                this.#currentActor = nextEntity; // <<< SET current actor
                const actorId = this.#currentActor.id;
                const isPlayer = this.#currentActor.hasComponent(PLAYER_COMPONENT_ID);
                const entityType = isPlayer ? 'player' : 'ai';

                this.#logger.info(`>>> Starting turn initiation for Entity: ${actorId} (${entityType}) <<<`);
                try {
                    await this.#dispatcher.dispatchValidated('core:turn_started', {
                        entityId: actorId,
                        entityType: entityType
                    });
                } catch (dispatchError) {
                    this.#logger.error(`Failed to dispatch core:turn_started for ${actorId}: ${dispatchError.message}`, dispatchError);
                    // Decide how to proceed - maybe stop the game? For now, log and attempt to continue.
                }

                // --- Resolve and Initiate Turn Handler ---
                this.#logger.debug(`Resolving turn handler for entity ${actorId}...`);
                const handler = await this.#turnHandlerResolver.resolveHandler(this.#currentActor);
                this.#currentHandler = handler; // <<< STORE current handler

                if (!handler) {
                    this.#logger.warn(`Could not resolve a turn handler for actor ${actorId}. Skipping turn and advancing.`);
                    // TODO: Dispatch a 'core:turn_skipped' event?
                    // Don't set currentActor/Handler to null here, advanceTurn loop start does that.
                    // Directly call advanceTurn again to skip to the next.
                    await Promise.resolve(); // Microtask delay
                    await this.advanceTurn();
                    return;
                }

                const handlerName = handler.constructor?.name || 'resolved handler';
                this.#logger.debug(`Calling startTurn on ${handlerName} for entity ${actorId}`);

                // <<< MODIFIED: Call startTurn, do NOT await completion (Ticket #7) >>>
                // Fire-and-forget the initiation. Completion is handled by the event listener.
                handler.startTurn(this.#currentActor).catch(startTurnError => {
                    // Catch errors *during the initiation phase* of startTurn.
                    const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
                    this.#logger.error(errorMsg, startTurnError);

                    // --- Pass the ORIGINAL error object to dispatch helper ---
                    this.#dispatchSystemError(`Error initiating turn for ${actorId}.`, startTurnError) // Pass Error obj
                        .catch(e => this.#logger.error(`Failed to dispatch system error after startTurn failure: ${e.message}`));
                    // --- End correction ---

                    // If startTurn initiation fails critically, advance turn manually
                    if (this.#currentActor?.id === actorId) {
                        this.#logger.warn(`Manually advancing turn after startTurn initiation failure for ${actorId}.`);
                        setTimeout(() => this.advanceTurn(), 0); // Use setTimeout
                    } else {
                        this.#logger.warn(`startTurn initiation failed for ${actorId}, but current actor changed before manual advance could occur. No advance triggered.`);
                    }
                });

                this.#logger.debug(`Turn initiation for ${actorId} started via ${handlerName}. TurnManager now WAITING for '${TURN_ENDED_EVENT_TYPE}' event.`);
                // --- The Turn Manager now passively waits for the event ---
            }
        } catch (error) {
            // Catch errors from TurnOrderService, EntityManager, Handler Resolution etc. (before handler startTurn)
            const errorMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${error.message}`;
            this.#logger.error(errorMsg, error);

            // Pass the original error object; #dispatchSystemError will extract message
            await this.#dispatchSystemError(
                'System Error during turn advancement. Stopping game.',
                error // Pass the original Error object
            );

            await this.stop(); // Stop the game on critical advancement errors
        }
    }

    /**
     * Subscribes to the event indicating a turn has ended.
     * @private
     */
    #subscribeToTurnEnd() {
        if (this.#turnEndedUnsubscribe) {
            this.#logger.warn("Attempted to subscribe to turn end event, but already subscribed.");
            return;
        }
        try {
            this.#logger.debug(`Subscribing to '${TURN_ENDED_EVENT_TYPE}' event.`);
            // Type assertion for the payload based on assumed event structure
            /** @param {SystemEventPayloads['core:turn_ended']} payload */
            const handler = (payload) => {
                this.#handleTurnEndedEvent(payload);
            };
            this.#turnEndedUnsubscribe = this.#dispatcher.subscribe(TURN_ENDED_EVENT_TYPE, handler);
            if (typeof this.#turnEndedUnsubscribe !== 'function') { // More robust check
                this.#turnEndedUnsubscribe = null; // Reset if invalid
                throw new Error("Subscription function did not return an unsubscribe callback.");
            }
        } catch (error) {
            this.#logger.error(`CRITICAL: Failed to subscribe to ${TURN_ENDED_EVENT_TYPE}. Turn advancement will likely fail. Error: ${error.message}`, error);
            this.#dispatchSystemError(`Failed to subscribe to ${TURN_ENDED_EVENT_TYPE}. Game cannot proceed reliably.`, error) // Pass error obj
                .catch(e => this.#logger.error(`Failed to dispatch system error after subscription failure: ${e.message}`));
            this.stop().catch(e => this.#logger.error(`Error stopping manager after subscription failure: ${e.message}`));
        }
    }

    /**
     * Unsubscribes from the turn ended event.
     * @private
     */
    #unsubscribeFromTurnEnd() {
        if (this.#turnEndedUnsubscribe) {
            this.#logger.debug(`Unsubscribing from '${TURN_ENDED_EVENT_TYPE}' event.`);
            try {
                this.#turnEndedUnsubscribe();
            } catch (error) {
                this.#logger.error(`Error calling unsubscribe function for ${TURN_ENDED_EVENT_TYPE}: ${error.message}`, error);
            } finally {
                this.#turnEndedUnsubscribe = null;
            }
        } else {
            this.#logger.debug("Attempted to unsubscribe from turn end event, but was not subscribed.");
        }
    }

    /**
     * Handles the received 'core:turn_ended' event.
     * Checks if it matches the current actor and advances the turn if so.
     * @param {SystemEventPayloads['core:turn_ended']} payload - The event payload. Expected: { entityId: string, success: boolean }
     * @private
     */
    #handleTurnEndedEvent(payload) {
        if (!this.#isRunning) {
            this.#logger.debug(`Received '${TURN_ENDED_EVENT_TYPE}' but manager is stopped. Ignoring.`);
            return;
        }

        const endedActorId = payload?.entityId;
        const successStatus = payload?.success; // true for success, false for failure

        this.#logger.debug(`Received '${TURN_ENDED_EVENT_TYPE}' event for entity ${endedActorId}. Success: ${successStatus}. Current actor: ${this.#currentActor?.id || 'None'}`);

        if (!this.#currentActor) {
            this.#logger.warn(`Received '${TURN_ENDED_EVENT_TYPE}' for ${endedActorId}, but there is no current actor set in TurnManager. Ignoring.`);
            return;
        }

        if (this.#currentActor.id === endedActorId) {
            this.#logger.info(`Turn for current actor ${endedActorId} confirmed ended (Success: ${successStatus}). Advancing turn...`);

            // Destroy the handler for the completed turn *before* advancing
            if (this.#currentHandler && typeof this.#currentHandler.destroy === 'function') {
                this.#logger.debug(`Calling destroy() on handler (${this.#currentHandler.constructor?.name || 'Unknown'}) for completed turn ${endedActorId}`);
                Promise.resolve(this.#currentHandler.destroy()) // Fire-and-forget destroy
                    .catch(destroyError => this.#logger.error(`Error destroying handler for ${endedActorId} after turn end: ${destroyError.message}`, destroyError));
            }
            this.#currentHandler = null; // Clear handler reference

            // Advance the turn asynchronously using setTimeout to yield execution.
            setTimeout(() => this.advanceTurn(), 0);

        } else {
            this.#logger.warn(`Received '${TURN_ENDED_EVENT_TYPE}' for entity ${endedActorId}, but expected end for current actor ${this.#currentActor.id}. Ignoring event.`);
            // Consider adding timeout logic if turns stall.
        }
    }

    /**
     * Helper to dispatch system errors. Extracts message from Error objects.
     * @param {string} message - User-friendly message.
     * @param {string | Error} detailsOrError - Technical details string or an Error object.
     * @returns {Promise<void>}
     * @private
     */
    async #dispatchSystemError(message, detailsOrError) {
        // Extract message if an Error object is passed, otherwise use the string directly.
        const detailString = detailsOrError instanceof Error ? detailsOrError.message : String(detailsOrError);
        try {
            await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                message: message,
                type: 'error',
                details: detailString // Contains error.message or the original string
            });
        } catch (dispatchError) {
            this.#logger.error(`Failed to dispatch core:system_error_occurred: ${dispatchError.message}`, dispatchError);
        }
    }
}

export default TurnManager;
// --- FILE END ---