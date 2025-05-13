// src/core/turnManager.js
// --- FILE START ---

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */
/** @typedef {import('./interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManagerInterface */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {TURN_ENDED_ID, SYSTEM_ERROR_OCCURRED_ID} from "../constants/eventIds.js"; // Assuming TURN_ENDED_ID is 'core:turn_ended' and SYSTEM_ERROR_OCCURRED_ID is 'core:system_error_occurred'

/**
 * @class TurnManager
 * @implements {ITurnManagerInterface}
 * @classdesc Manages the overall turn lifecycle. Determines the next actor,
 * initiates their turn via the appropriate handler, and waits for a turn completion
 * event (`core:turn_ended`) before advancing to the next turn or round.
 * Dispatches semantic events like 'core:turn_started' and 'core:system_error_occurred'.
 * Includes logic to stop if a round completes with no successful turns.
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
    /** @type {ITurnHandler | null} */
    #currentHandler = null;
    /** @type { (() => void) | null } */
    #turnEndedUnsubscribe = null;

    // --- NEW FIELDS ---
    /**
     * Tracks if at least one turn completed successfully within the current round.
     * Reset to false when a new round starts.
     * @type {boolean}
     */
    #roundHadSuccessfulTurn = false;
    /**
     * Tracks if a round is currently considered in progress (i.e., after startNewRound was called successfully).
     * Reset to false when stopped or before starting the very first round.
     * @type {boolean}
     */
    #roundInProgress = false;

    // --- END NEW FIELDS ---


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

        // --- Dependency Validation (unchanged) ---
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
        if (!dispatcher || typeof dispatcher.dispatchValidated !== 'function' || typeof dispatcher.subscribe !== 'function') {
            const errorMsg = `${className} requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).`;
            (logger || console).error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolveHandler !== 'function') {
            const errorMsg = `${className} requires a valid ITurnHandlerResolver instance (with resolveHandler method).`;
            (logger || console).error(errorMsg);
            throw new Error(errorMsg);
        }
        // --- End Dependency Validation ---

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;
        this.#turnHandlerResolver = turnHandlerResolver;

        // --- State Initialization (reset flags) ---
        this.#isRunning = false;
        this.#currentActor = null;
        this.#currentHandler = null;
        this.#turnEndedUnsubscribe = null;
        this.#roundHadSuccessfulTurn = false; // Initialize new flag
        this.#roundInProgress = false;      // Initialize new flag
        // --- End State Initialization ---

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
        this.#roundInProgress = false;      // Reset on start
        this.#roundHadSuccessfulTurn = false; // Reset on start
        this.#logger.info('Turn Manager started.');

        this.#subscribeToTurnEnd(); // Subscribe when manager starts
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
        this.#unsubscribeFromTurnEnd(); // Unsubscribe when manager stops

        if (this.#currentHandler && typeof this.#currentHandler.destroy === 'function') {
            try {
                this.#logger.debug(`Calling destroy() on current handler (${this.#currentHandler.constructor?.name || 'Unknown'}) for actor ${this.#currentActor?.id || 'N/A'}`);
                await Promise.resolve(this.#currentHandler.destroy());
            } catch (destroyError) {
                this.#logger.error(`Error calling destroy() on current handler during stop: ${destroyError.message}`, destroyError);
            }
        }

        this.#currentActor = null;
        this.#currentHandler = null;

        try {
            await this.#turnOrderService.clearCurrentRound();
            this.#roundInProgress = false; // Reset round progress flag on stop/clear
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
     * Retrieves the turn handler instance that is currently managing the active turn.
     * @returns {ITurnHandler | null} The currently active turn handler, or `null`.
     */
    getActiveTurnHandler() {
        return this.#currentHandler;
    }

    /**
     * Advances the game state to the next entity's turn, or starts a new round.
     * Resolves the handler, calls its `startTurn` method, and then *waits* for the
     * `core:turn_ended` event before proceeding.
     * Handles system-level errors by dispatching 'core:system_error_occurred'.
     * **Includes logic to stop if a round completes with no successful turns.**
     * @async
     * @private
     * @returns {Promise<void>} A promise that resolves when the next turn has been *initiated*.
     */
    async advanceTurn() {
        if (!this.#isRunning) {
            this.#logger.debug('TurnManager.advanceTurn() called while manager is not running. Returning.');
            return;
        }

        this.#logger.debug('TurnManager.advanceTurn() initiating...');
        // Clear previous actor/handler
        const previousActorIdForLog = this.#currentActor?.id;
        if (previousActorIdForLog) {
            this.#logger.debug(`Clearing previous actor ${previousActorIdForLog} and handler before advancing.`);
        }
        this.#currentActor = null;
        this.#currentHandler = null;

        try {
            const isQueueEmpty = await this.#turnOrderService.isEmpty();

            if (isQueueEmpty) {
                this.#logger.info('Turn queue is empty. Preparing for new round or stopping.');

                // --- NEW CHECK: Stop if previous round had no success ---
                if (this.#roundInProgress && !this.#roundHadSuccessfulTurn) {
                    const errorMsg = 'No successful turns completed in the previous round. Stopping TurnManager.';
                    this.#logger.error(errorMsg);
                    await this.#dispatchSystemError('System Error: No progress made in the last round.', errorMsg);
                    await this.stop();
                    return; // Stop processing
                }
                // --- END NEW CHECK ---

                // --- Reset for new round ---
                this.#logger.info('Attempting to start a new round.');
                this.#roundHadSuccessfulTurn = false; // Reset success tracker *before* starting new round
                // #roundInProgress will be set to true *after* startNewRound succeeds below
                // --- End Reset ---

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
                const strategy = 'round-robin'; // Or determine dynamically

                // Start the new round in the service
                await this.#turnOrderService.startNewRound(actors, strategy);
                this.#roundInProgress = true; // Mark round as officially in progress *after* successful start
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);

                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn(); // Recursive call to process the first turn of the new round
                return;

            } else { // Queue is not empty, process next turn
                this.#logger.debug('Queue not empty, retrieving next entity.');
                const nextEntity = await this.#turnOrderService.getNextEntity();

                if (!nextEntity) {
                    const errorMsg = 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.';
                    this.#logger.error(errorMsg);
                    await this.#dispatchSystemError('Internal Error: Turn order inconsistency detected. Stopping game.', errorMsg);
                    await this.stop();
                    return;
                }

                this.#currentActor = nextEntity; // Set the new current actor
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
                    // Continue processing the turn even if event dispatch fails
                }

                this.#logger.debug(`Resolving turn handler for entity ${actorId}...`);
                const handler = await this.#turnHandlerResolver.resolveHandler(this.#currentActor);
                this.#currentHandler = handler; // Set the new current handler

                if (!handler) {
                    this.#logger.warn(`Could not resolve a turn handler for actor ${actorId}. Skipping turn and advancing.`);
                    // Simulate an unsuccessful turn end to allow round progression check
                    this.#handleTurnEndedEvent({
                        type: TURN_ENDED_ID, // Added type for consistency with event object structure
                        payload: {
                            entityId: actorId,
                            success: false, // Mark as unsuccessful
                            error: new Error(`No turn handler resolved for actor ${actorId}.`)
                        }
                    });
                    // Schedule next advancement (handleTurnEndedEvent now calls setTimeout)
                    // setTimeout(() => this.advanceTurn(), 0); // Removed, handled by #handleTurnEndedEvent
                    return;
                }

                const handlerName = handler.constructor?.name || 'resolved handler';
                this.#logger.debug(`Calling startTurn on ${handlerName} for entity ${actorId}`);

                // Start the turn, but don't await it here. Wait for TURN_ENDED_ID event.
                handler.startTurn(this.#currentActor).catch(startTurnError => {
                    const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
                    this.#logger.error(errorMsg, startTurnError);
                    this.#dispatchSystemError(`Error initiating turn for ${actorId}.`, startTurnError)
                        .catch(e => this.#logger.error(`Failed to dispatch system error after startTurn failure: ${e.message}`));

                    // If startTurn fails immediately, treat it as the turn ending unsuccessfully
                    if (this.#currentActor?.id === actorId) { // Check if still the current actor
                        this.#logger.warn(`Manually advancing turn after startTurn initiation failure for ${actorId}.`);
                        this.#handleTurnEndedEvent({
                            type: TURN_ENDED_ID, // Added type for consistency
                            payload: {
                                entityId: actorId,
                                success: false, // Mark as unsuccessful
                                error: startTurnError
                            }
                        });
                    } else {
                        this.#logger.warn(`startTurn initiation failed for ${actorId}, but current actor changed before manual advance could occur. No advance triggered by this error handler.`);
                    }
                });
                this.#logger.debug(`Turn initiation for ${actorId} started via ${handlerName}. TurnManager now WAITING for '${TURN_ENDED_ID}' event.`);
            }
        } catch (error) {
            // --- CORRECTED ERROR MESSAGE ---
            const errorMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${error.message}`;
            // --- END CORRECTION ---
            this.#logger.error(errorMsg, error);
            await this.#dispatchSystemError('System Error during turn advancement. Stopping game.', error);
            await this.stop();
        }
    }

    /**
     * Subscribes to the event indicating a turn has ended.
     * @private
     */
    #subscribeToTurnEnd() {
        // --- Subscription logic (unchanged) ---
        if (this.#turnEndedUnsubscribe) {
            this.#logger.warn("Attempted to subscribe to turn end event, but already subscribed.");
            return;
        }
        try {
            this.#logger.debug(`Subscribing to '${TURN_ENDED_ID}' event.`);
            const handlerCallback = (event) => {
                // Wrap in try-catch to prevent subscriber errors from breaking TurnManager
                try {
                    this.#handleTurnEndedEvent(event);
                } catch (handlerError) {
                    this.#logger.error(`Error processing ${TURN_ENDED_ID} event: ${handlerError.message}`, handlerError);
                    // Decide if a system error should be dispatched or if the manager should stop
                    this.#dispatchSystemError('Error processing turn ended event.', handlerError).catch(e => this.#logger.error(`Failed to dispatch system error after event handler failure: ${e.message}`));
                    // Maybe stop the manager if event handling fails critically?
                    // this.stop().catch(e => this.#logger.error(`Error stopping manager after event handler failure: ${e.message}`));
                }
            };
            this.#turnEndedUnsubscribe = this.#dispatcher.subscribe(TURN_ENDED_ID, handlerCallback);
            if (typeof this.#turnEndedUnsubscribe !== 'function') {
                this.#turnEndedUnsubscribe = null; // Ensure it's nulled if not a function
                throw new Error("Subscription function did not return an unsubscribe callback.");
            }
        } catch (error) {
            this.#logger.error(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}. Turn advancement will likely fail. Error: ${error.message}`, error);
            this.#dispatchSystemError(`Failed to subscribe to ${TURN_ENDED_ID}. Game cannot proceed reliably.`, error)
                .catch(e => this.#logger.error(`Failed to dispatch system error after subscription failure: ${e.message}`));
            this.stop().catch(e => this.#logger.error(`Error stopping manager after subscription failure: ${e.message}`));
        }
        // --- End Subscription logic ---
    }

    /**
     * Unsubscribes from the turn ended event.
     * @private
     */
    #unsubscribeFromTurnEnd() {
        // --- Unsubscription logic (unchanged) ---
        if (this.#turnEndedUnsubscribe) {
            this.#logger.debug(`Unsubscribing from '${TURN_ENDED_ID}' event.`);
            try {
                this.#turnEndedUnsubscribe();
            } catch (error) {
                this.#logger.error(`Error calling unsubscribe function for ${TURN_ENDED_ID}: ${error.message}`, error);
            } finally {
                this.#turnEndedUnsubscribe = null;
            }
        } else {
            this.#logger.debug("Attempted to unsubscribe from turn end event, but was not subscribed.");
        }
        // --- End Unsubscription logic ---
    }

    /**
     * Handles the received TURN_ENDED_ID event.
     * Checks if it matches the current actor, **updates the round success flag**,
     * and advances the turn if appropriate.
     * @param {{ type?: typeof TURN_ENDED_ID, payload: SystemEventPayloads[typeof TURN_ENDED_ID] }} event - The full event object or a simulated payload.
     * @private
     */
    #handleTurnEndedEvent(event) {
        if (!this.#isRunning) {
            this.#logger.debug(`Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`);
            return;
        }

        const payload = event?.payload;
        if (!payload) {
            this.#logger.warn(`Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring. Event:`, event);
            return;
        }

        const endedActorId = payload.entityId;
        const successStatus = payload.success; // true, false, or potentially undefined/null

        this.#logger.debug(`Received '${TURN_ENDED_ID}' event for entity ${endedActorId}. Success: ${successStatus ?? 'N/A'}. Current actor: ${this.#currentActor?.id || 'None'}`);

        if (!this.#currentActor || this.#currentActor.id !== endedActorId) {
            this.#logger.warn(`Received '${TURN_ENDED_ID}' for entity ${endedActorId}, but current active actor is ${this.#currentActor?.id || 'None'}. This event will be IGNORED by TurnManager's primary turn cycling logic.`);
            // Note: Even if ignored for turn *advancement*, we might still want to record success if the round is in progress?
            // Decision: For now, only record success if it's for the *current* actor, simplifies logic.
            return;
        }

        // --- NEW: Update round success flag ---
        if (successStatus === true) {
            this.#logger.debug(`Marking round as having had a successful turn (actor: ${endedActorId}).`);
            this.#roundHadSuccessfulTurn = true;
        }
        // --- END NEW ---

        // --- MODIFIED LOG LINE ---
        this.#logger.info(`Turn for current actor ${endedActorId} confirmed ended (Internal Status from Event: Success=${successStatus === undefined ? 'N/A' : successStatus}). Advancing turn...`);
        // --- END MODIFIED LOG LINE ---

        const handlerToDestroy = this.#currentHandler;

        // Clear currentActor and currentHandler *before* potential async ops
        this.#currentActor = null;
        this.#currentHandler = null;

        // Destroy the handler for the completed turn asynchronously
        if (handlerToDestroy) {
            if (typeof handlerToDestroy.signalNormalApparentTermination === 'function') {
                handlerToDestroy.signalNormalApparentTermination();
            }
            if (typeof handlerToDestroy.destroy === 'function') {
                this.#logger.debug(`Calling destroy() on handler (${handlerToDestroy.constructor?.name || 'Unknown'}) for completed turn ${endedActorId}`);
                Promise.resolve(handlerToDestroy.destroy())
                    .catch(destroyError => this.#logger.error(`Error destroying handler for ${endedActorId} after turn end: ${destroyError.message}`, destroyError));
            }
        }

        // Schedule advanceTurn to run after the current event processing stack clears.
        // This allows the destroy promise above to proceed without blocking advancement.
        setTimeout(() => this.advanceTurn(), 0);
    }

    /**
     * Helper to dispatch system errors. Extracts message from Error objects.
     * @param {string} message - User-friendly message.
     * @param {string | Error} detailsOrError - Technical details string or an Error object.
     * @returns {Promise<void>}
     * @private
     */
    async #dispatchSystemError(message, detailsOrError) {
        // --- Dispatch logic (unchanged, ensure SYSTEM_ERROR_OCCURRED_ID is imported) ---
        const detailString = detailsOrError instanceof Error ? detailsOrError.message : String(detailsOrError);
        try {
            await this.#dispatcher.dispatchValidated(SYSTEM_ERROR_OCCURRED_ID, {
                // eventName: SYSTEM_ERROR_OCCURRED_ID, // VED might need eventName in payload
                message: message,
                type: 'error',
                details: detailString
            });
        } catch (dispatchError) {
            this.#logger.error(`Failed to dispatch ${SYSTEM_ERROR_OCCURRED_ID}: ${dispatchError.message}`, dispatchError);
        }
        // --- End Dispatch logic ---
    }
}

export default TurnManager;

// --- FILE END ---