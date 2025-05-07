// src/core/turnManager.js
// --- FILE START (Corrected section) ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */
/** @typedef {import('./interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */

/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// Import the necessary component ID constants
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../types/components.js';
import {TURN_ENDED_ID} from "./constants/eventIds.js"; // Assuming TURN_ENDED_ID is 'core:turn_ended'

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
    /** @type {ITurnHandler | null} */
    #currentHandler = null;
    /** @type { (() => void) | null } */
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

        this.#turnOrderService = turnOrderService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#dispatcher = dispatcher;
        this.#turnHandlerResolver = turnHandlerResolver;

        this.#isRunning = false;
        this.#currentActor = null;
        this.#currentHandler = null;
        this.#turnEndedUnsubscribe = null;

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
     * Advances the game state to the next entity's turn, or starts a new round.
     * Resolves the handler, calls its `startTurn` method, and then *waits* for the
     * `core:turn_ended` event before proceeding.
     * Handles system-level errors by dispatching 'core:system_error_occurred'.
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
        // Clear previous actor/handler at the beginning of advancing to a new turn
        this.#currentActor = null;
        this.#currentHandler = null;

        try {
            const isQueueEmpty = await this.#turnOrderService.isEmpty();

            if (isQueueEmpty) {
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
                const strategy = 'round-robin';

                await this.#turnOrderService.startNewRound(actors, strategy);
                this.#logger.info(`Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`);
                this.#logger.debug('New round started, recursively calling advanceTurn() to process the first turn.');
                await this.advanceTurn(); // Recursive call to process the first turn of the new round
                return;

            } else {
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
                }

                this.#logger.debug(`Resolving turn handler for entity ${actorId}...`);
                const handler = await this.#turnHandlerResolver.resolveHandler(this.#currentActor);
                this.#currentHandler = handler; // Set the new current handler

                if (!handler) {
                    this.#logger.warn(`Could not resolve a turn handler for actor ${actorId}. Skipping turn and advancing.`);
                    // No need to explicitly call advanceTurn() again here, as the current one will complete,
                    // and if this was the last actor, the next call to advanceTurn would start a new round or stop.
                    // However, to ensure the flow continues if this happens mid-round:
                    setTimeout(() => this.advanceTurn(), 0); // Schedule next advancement
                    return;
                }

                const handlerName = handler.constructor?.name || 'resolved handler';
                this.#logger.debug(`Calling startTurn on ${handlerName} for entity ${actorId}`);

                // TurnManager is now WAITING for '${TURN_ENDED_ID}' event, subscription is active.
                handler.startTurn(this.#currentActor).catch(startTurnError => {
                    const errorMsg = `Error during handler.startTurn() initiation for entity ${actorId} (${handlerName}): ${startTurnError.message}`;
                    this.#logger.error(errorMsg, startTurnError);
                    this.#dispatchSystemError(`Error initiating turn for ${actorId}.`, startTurnError)
                        .catch(e => this.#logger.error(`Failed to dispatch system error after startTurn failure: ${e.message}`));

                    // If startTurn fails, we need to ensure the turn still advances.
                    // Check if the actor for whom startTurn failed is still the one we expect.
                    if (this.#currentActor?.id === actorId) {
                        this.#logger.warn(`Manually advancing turn after startTurn initiation failure for ${actorId}.`);
                        // Simulate a turn end to trigger cleanup and advanceTurn
                        this.#handleTurnEndedEvent({payload: {entityId: actorId, success: false}}); // Or a more direct advance
                    } else {
                        this.#logger.warn(`startTurn initiation failed for ${actorId}, but current actor changed before manual advance could occur. No advance triggered by this error handler.`);
                    }
                });
                this.#logger.debug(`Turn initiation for ${actorId} started via ${handlerName}. TurnManager now WAITING for '${TURN_ENDED_ID}' event.`);
            }
        } catch (error) {
            const errorMsg = `CRITICAL Error during turn advancement logic (before handler initiation): ${error.message}`;
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
        if (this.#turnEndedUnsubscribe) {
            this.#logger.warn("Attempted to subscribe to turn end event, but already subscribed.");
            return;
        }
        try {
            this.#logger.debug(`Subscribing to '${TURN_ENDED_ID}' event.`);
            /**
             * Handles the incoming event from the dispatcher.
             * @param {{ type: typeof TURN_ENDED_ID, payload: SystemEventPayloads[typeof TURN_ENDED_ID] }} event - The full event object.
             */
            const handler = (event) => { // Parameter 'event' is the full event object
                this.#handleTurnEndedEvent(event); // Pass the full event object
            };
            this.#turnEndedUnsubscribe = this.#dispatcher.subscribe(TURN_ENDED_ID, handler);
            if (typeof this.#turnEndedUnsubscribe !== 'function') {
                this.#turnEndedUnsubscribe = null;
                throw new Error("Subscription function did not return an unsubscribe callback.");
            }
        } catch (error) {
            this.#logger.error(`CRITICAL: Failed to subscribe to ${TURN_ENDED_ID}. Turn advancement will likely fail. Error: ${error.message}`, error);
            this.#dispatchSystemError(`Failed to subscribe to ${TURN_ENDED_ID}. Game cannot proceed reliably.`, error)
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
    }

    /**
     * Handles the received TURN_ENDED_ID event.
     * Checks if it matches the current actor and advances the turn if so.
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
        const successStatus = payload.success;

        this.#logger.debug(`Received '${TURN_ENDED_ID}' event for entity ${endedActorId}. Success: ${successStatus ?? 'N/A'}. Current actor: ${this.#currentActor?.id || 'None'}`);

        if (!this.#currentActor || this.#currentActor.id !== endedActorId) {
            // This log will now primarily catch genuinely unexpected/out-of-order core:turn_ended events.
            // The one from PlayerTurnHandler.destroy's failsafe should be prevented by the change above.
            this.#logger.warn(`Received '${TURN_ENDED_ID}' for entity ${endedActorId}, but current active actor is ${this.#currentActor?.id || 'None'}. This event will be IGNORED by TurnManager's primary turn cycling logic.`);
            return;
        }

        this.#logger.info(`Turn for current actor ${endedActorId} confirmed ended (Internal Status from Event: Success=${successStatus ?? 'N/A'}). Advancing turn...`);

        const handlerToDestroy = this.#currentHandler;

        this.#currentActor = null;
        this.#currentHandler = null;

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
        const detailString = detailsOrError instanceof Error ? detailsOrError.message : String(detailsOrError);
        try {
            await this.#dispatcher.dispatchValidated('core:system_error_occurred', {
                // eventName: 'core:system_error_occurred', // VED might need eventName in payload
                message: message,
                type: 'error',
                details: detailString
            });
        } catch (dispatchError) {
            this.#logger.error(`Failed to dispatch core:system_error_occurred: ${dispatchError.message}`, dispatchError);
        }
    }
}

export default TurnManager;

// --- FILE END ---