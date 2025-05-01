// src/core/gameLoop.js

// --- Type Imports ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/IGameStateManager.js').IGameStateManager} IGameStateManager */
/** @typedef {import('./interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../core/interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */


// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository
 * @property {EntityManager} entityManager
 * @property {IGameStateManager} gameStateManager
 * @property {IActionExecutor} actionExecutor
 * @property {EventBus} eventBus
 * @property {IActionDiscoverySystem} actionDiscoverySystem
 * @property {IValidatedEventDispatcher} validatedEventDispatcher
 * @property {ITurnManager} turnManager
 * @property {ITurnHandlerResolver} turnHandlerResolver
 * @property {ILogger} logger
 */

import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../types/components.js";

class GameLoop {
    #gameDataRepository;
    #entityManager;
    #gameStateManager;
    #actionExecutor;
    #eventBus;
    #actionDiscoverySystem;
    #validatedEventDispatcher;
    #turnManager;
    /** @type {ITurnHandlerResolver} */ #turnHandlerResolver;
    #logger;

    #isRunning = false;

    // ****** Store bound handlers for unsubscribing ******
    #boundHandleTurnActorChanged;
    #boundHandleTurnManagerStopped;

    // ****************************************************

    /**
     * @param {GameLoopOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        const {
            gameDataRepository,
            entityManager,
            gameStateManager,
            actionExecutor,
            eventBus,
            actionDiscoverySystem,
            validatedEventDispatcher,
            turnManager,
            turnHandlerResolver,
            logger
        } = options || {};

        // --- Validate and Assign Logger FIRST ---
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            console.warn('GameLoop Constructor: Invalid logger provided. Falling back to console.');
            this.#logger = console;
        } else {
            this.#logger = logger;
        }

        // --- Validate Other Dependencies ---
        if (!gameDataRepository) throw new Error('GameLoop requires options.gameDataRepository.');
        if (!entityManager) throw new Error('GameLoop requires options.entityManager.');
        if (!gameStateManager || typeof gameStateManager.getCurrentLocation !== 'function' || typeof gameStateManager.getPlayer !== 'function') {
            throw new Error('GameLoop requires a valid options.gameStateManager implementing IGameStateManager (getCurrentLocation, getPlayer).');
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error('GameLoop requires a valid options.actionExecutor implementing IActionExecutor (executeAction).');
        }
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
            throw new Error('GameLoop requires a valid options.eventBus object.');
        }
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            throw new Error('GameLoop requires a valid options.actionDiscoverySystem implementing IActionDiscoverySystem (getValidActions).');
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('GameLoop requires a valid options.validatedEventDispatcher implementing IValidatedEventDispatcher (dispatchValidated).');
        }
        if (!turnManager || typeof turnManager.start !== 'function' || typeof turnManager.stop !== 'function' || typeof turnManager.getCurrentActor !== 'function' || typeof turnManager.advanceTurn !== 'function') {
            throw new Error('GameLoop requires a valid options.turnManager implementing ITurnManager (start, stop, getCurrentActor, advanceTurn).');
        }
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolveHandler !== 'function') {
            const errorMsg = 'GameLoop requires a valid options.turnHandlerResolver implementing ITurnHandlerResolver (resolveHandler).';
            this.#logger?.error(errorMsg);
            throw new Error(errorMsg);
        }

        // --- Assign Dependencies ---
        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#actionExecutor = actionExecutor;
        this.#eventBus = eventBus;
        this.#actionDiscoverySystem = actionDiscoverySystem;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#turnManager = turnManager;
        this.#turnHandlerResolver = turnHandlerResolver;

        // --- Initialize State ---
        this.#isRunning = false;

        // ****** Bind handlers ONCE in constructor ******
        this.#boundHandleTurnActorChanged = this.#handleTurnActorChanged.bind(this);
        this.#boundHandleTurnManagerStopped = this.#handleTurnManagerStopped.bind(this);
        // ***********************************************

        // --- Setup ---
        // Subscribe is now deferred to start() to ensure it only happens when loop begins.

        this.#logger.info('GameLoop: Instance created with dependencies. Ready to start.');
    }

    /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * Called internally by start().
     * @private
     */
    #subscribeToEvents() {
        // Turn lifecycle events from TurnManager
        this.#eventBus.subscribe('turn:actor_changed', this.#boundHandleTurnActorChanged); // Use bound handler
        this.#logger.info("GameLoop: Subscribed to 'turn:actor_changed' event.");
        this.#eventBus.subscribe('turn:manager_stopped', this.#boundHandleTurnManagerStopped); // Use bound handler
        this.#logger.info("GameLoop: Subscribed to 'turn:manager_stopped' event.");
    }

    /**
     * Removes event bus subscriptions.
     * Called internally by stop().
     * @private
     */
    #unsubscribeFromEvents() {
        // Ensure handlers exist before trying to unsubscribe
        if (this.#boundHandleTurnActorChanged) {
            this.#eventBus.unsubscribe('turn:actor_changed', this.#boundHandleTurnActorChanged);
            this.#logger.info("GameLoop: Unsubscribed from 'turn:actor_changed' event.");
        }
        if (this.#boundHandleTurnManagerStopped) {
            this.#eventBus.unsubscribe('turn:manager_stopped', this.#boundHandleTurnManagerStopped);
            this.#logger.info("GameLoop: Unsubscribed from 'turn:manager_stopped' event.");
        }
    }


    /**
     * Handles the 'turn:actor_changed' event from the TurnManager.
     * Triggers turn processing logic for the new actor.
     * @private
     * @param {object} eventData - The event payload.
     * @param {Entity | null} eventData.currentActor - The entity whose turn it is now, or null if none.
     * @param {Entity | null} eventData.previousActor - The entity whose turn just ended, or null if none.
     */
    async #handleTurnActorChanged(eventData) {
        const newActor = eventData?.currentActor ?? null;
        const previousActor = eventData?.previousActor ?? null;

        this.#logger.debug(`GameLoop: Received 'turn:actor_changed'. New Actor: ${newActor?.id ?? 'null'}. Previous: ${previousActor?.id ?? 'null'}`);

        if (!this.#isRunning) {
            this.#logger.debug('GameLoop received actor change event, but loop is not running.');
            return;
        }

        const currentActorForTurn = this.#turnManager.getCurrentActor();

        if (currentActorForTurn) {
            if (typeof currentActorForTurn.hasComponent !== 'function') {
                this.#logger.error(`GameLoop #handleTurnActorChanged: Invalid entity reported by TurnManager (ID: ${currentActorForTurn?.id}). Cannot process turn.`);
                await this.stop();
                return;
            }
            this.#logger.debug(`GameLoop #handleTurnActorChanged: Processing turn for ${currentActorForTurn.id}`);

            const handler = await this.#turnHandlerResolver.resolveHandler(currentActorForTurn);

            if (handler && typeof handler.handleTurn === 'function') {
                this.#logger.debug(`GameLoop #handleTurnActorChanged: Resolved handler ${handler.constructor?.name ?? 'UnknownHandler'} for ${currentActorForTurn.id}. Executing...`);
                try {
                    await handler.handleTurn(currentActorForTurn);
                } catch (handlerError) {
                    this.#logger.error(`Error during delegated turn handling for ${currentActorForTurn.id} by ${handler.constructor?.name ?? 'UnknownHandler'}: ${handlerError.message}`, handlerError);
                    try {
                        this.#logger.warn(`Attempting to advance turn after handler error for ${currentActorForTurn.id}...`);
                        await this.#turnManager.advanceTurn();
                    } catch (advanceError) {
                        this.#logger.error(`Failed to advance turn after handler error for ${currentActorForTurn.id}: ${advanceError.message}`, advanceError);
                        await this.stop();
                    }
                }
            } else if (handler === null) {
                this.#logger.warn(`No specific turn handler resolved for actor ${currentActorForTurn.id}. Advancing turn directly.`);
                try {
                    await this.#turnManager.advanceTurn();
                } catch (advanceError) {
                    this.#logger.error(`Failed to advance turn directly (null handler) for ${currentActorForTurn.id}: ${advanceError.message}`, advanceError);
                    await this.stop();
                }
            } else {
                this.#logger.error(`GameLoop #handleTurnActorChanged: Failed to resolve a valid turn handler for ${currentActorForTurn.id}. Skipping turn.`);
                try {
                    await this.#turnManager.advanceTurn();
                } catch (skipError) {
                    this.#logger.error(`Error advancing turn after failed handler resolution for ${currentActorForTurn.id}: ${skipError.message}`);
                    await this.stop();
                }
            }

        } else {
            this.#logger.info('GameLoop: TurnManager reported no current actor (null). Waiting...');
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting..."});
        }
    }

    /**
     * Handles the 'turn:manager_stopped' event from the TurnManager.
     * Ensures the GameLoop also stops cleanly.
     * @private
     * @param {object} eventData - The event payload.
     */
    async #handleTurnManagerStopped(eventData) {
        this.#logger.info("GameLoop: Received 'turn:manager_stopped' event. Initiating GameLoop stop.");
        // Avoid calling stop() again if it was already called and triggered this event
        if (this.#isRunning) {
            await this.stop();
        }
    }

    /**
     * Starts the main game loop. Sets the running state and tells TurnManager to start.
     * @async
     */
    async start() {
        if (this.#isRunning) {
            this.#logger.warn('GameLoop: start() called but loop is already running.');
            return;
        }

        // --- Subscribe to events FIRST ---
        this.#subscribeToEvents(); // Moved here from constructor

        // --- Set state and dispatch event ---
        this.#isRunning = true;
        this.#logger.info('GameLoop: Started.');
        await this.#eventBus.dispatch('game:started', {});

        // --- Start the Turn Manager ---
        this.#logger.info('GameLoop: Starting TurnManager...');
        try {
            await this.#turnManager.start();
            this.#logger.info('GameLoop: TurnManager started successfully.');
        } catch (error) {
            this.#logger.error(`GameLoop: Failed to start TurnManager: ${error.message}`, error);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Critical Error: Could not start turn management. ${error.message}`,
                type: 'error'
            });
            await this.stop();
        }
    }


    /**
     * Processes the turn for the currently active actor (passed as parameter).
     * @private
     * @param {Entity} actor The entity whose turn it currently is.
     * @async
     * @deprecated Superseded by `#handleTurnActorChanged`.
     */
    async _processCurrentActorTurn(actor) {
        this.#logger.warn(`DEPRECATED: GameLoop._processCurrentActorTurn called directly for ${actor?.id}. Logic moved to #handleTurnActorChanged.`);
        if (!actor || typeof actor.hasComponent !== 'function' || typeof actor.id === 'undefined') {
            this.#logger.error(`_processCurrentActorTurn called with invalid actor: ${actor?.id ?? 'undefined/null'}. Aborting turn process.`);
            try {
                this.#logger.warn(`_processCurrentActorTurn attempting to advance turn due to invalid actor.`);
                await this.#turnManager.advanceTurn();
            } catch (e) {
                this.#logger.error(`Error advancing turn after detecting invalid actor in _processCurrentActorTurn: ${e.message}`);
                await this.stop();
            }
            return;
        }
        if (!this.#isRunning) {
            this.#logger.debug(`_processCurrentActorTurn called for ${actor.id} while not running.`);
            return;
        }
        await this.#handleTurnActorChanged({currentActor: actor, previousActor: null});
    }


    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * @private
     * @param {Entity | null} actingEntity
     * @param {ParsedCommand} parsedCommand
     * @returns {Promise<ActionResult>}
     * @async
     */
    async executeAction(actingEntity, parsedCommand) {
        if (!actingEntity) {
            const errorMsg = 'GameLoop executeAction called but state missing: acting entity.';
            this.#logger.error(errorMsg);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            return {success: false, messages: [{text: errorMsg, type: 'internal'}]};
        }

        const currentLocation = this.#gameStateManager.getCurrentLocation(actingEntity.id);

        if (!currentLocation) {
            const errorMsg = `GameLoop executeAction called but state missing: current location context for ${actingEntity.id}.`;
            this.#logger.error(errorMsg);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            return {success: false, messages: [{text: errorMsg, type: 'internal'}]};
        }

        /** @type {ActionContext} */
        const context = {
            actingEntity: actingEntity,
            currentLocation: currentLocation,
            parsedCommand: parsedCommand,
            gameDataRepository: this.#gameDataRepository,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
            eventBus: this.#eventBus,
            logger: this.#logger,
        };

        this.#logger.debug(`Executing action: ${parsedCommand.actionId} for entity ${actingEntity.id}`);

        try {
            const result = await this.#actionExecutor.executeAction(parsedCommand.actionId, context);

            if (!result || typeof result.success !== 'boolean') {
                this.#logger.error(`Action ${parsedCommand.actionId} execution returned invalid result structure:`, result);
                return {
                    success: false,
                    messages: [{
                        text: `Action ${parsedCommand.actionId} execution returned invalid result structure.`,
                        type: 'internal'
                    }]
                };
            }
            await this.#eventBus.dispatch('action:executed', {
                actionId: parsedCommand.actionId,
                entityId: actingEntity.id,
                result: result
            });
            return result;

        } catch (error) {
            this.#logger.error(`Error during execution of action ${parsedCommand.actionId} for entity ${actingEntity.id}:`, error);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Error performing action: ${error.message}`,
                type: 'error'
            });
            const errorResult = {
                success: false,
                messages: [{text: `Exception during action execution: ${error.message}`, type: 'internal'}]
            };
            await this.#eventBus.dispatch('action:executed', {
                actionId: parsedCommand.actionId,
                entityId: actingEntity.id,
                result: errorResult
            });
            return errorResult;
        }
    }


    /**
     * Discovers available actions for a specific entity.
     * @private
     * @param {Entity} actingEntity
     * @returns {Promise<Array<ActionDefinition>>}
     * @async
     * @deprecated Should be invoked by PlayerTurnHandler.
     */
    async _discoverActionsForEntity(actingEntity) {
        this.#logger.warn(`DEPRECATED: GameLoop._discoverActionsForEntity called for ${actingEntity?.id}. Should be handled by PlayerTurnHandler.`);
        if (!this.#isRunning) {
            this.#logger.debug('_discoverActionsForEntity called while not running.');
            return [];
        }
        if (!actingEntity) {
            this.#logger.warn('Cannot discover actions: No valid acting entity provided.');
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                actions: [],
                entityId: null
            });
            return [];
        }

        const entityId = actingEntity.id;
        let validActions = [];

        this.#logger.debug(`Attempting to discover actions for entity ${entityId}...`);
        try {
            const currentLocation = this.#gameStateManager.getCurrentLocation(entityId);

            if (!currentLocation) {
                this.#logger.error(`Cannot discover actions for ${entityId}: Current location for this entity is missing from GameStateManager.`);
                validActions = [];
            } else {
                /** @type {ActionContext} */
                const discoveryContext = {
                    actingEntity: actingEntity,
                    currentLocation: currentLocation,
                    entityManager: this.#entityManager,
                    gameDataRepository: this.#gameDataRepository,
                    dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
                    eventBus: this.#eventBus,
                    parsedCommand: undefined,
                    logger: this.#logger,
                };

                this.#logger.debug(`Calling ActionDiscoverySystem.getValidActions for entity ${entityId}`);
                validActions = await this.#actionDiscoverySystem.getValidActions(actingEntity, discoveryContext);
                this.#logger.debug(`ActionDiscoverySystem returned ${validActions.length} valid actions for ${entityId}.`);
            }
        } catch (error) {
            this.#logger.error(`Error during action discovery for entity ${entityId}:`, error);
            validActions = [];
        } finally {
            const payload = {actions: validActions, entityId: entityId};
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', payload);
            this.#logger.debug(`Dispatched ${'event:update_available_actions'} for entity ${entityId} with ${validActions.length} actions.`);
        }
        return validActions;
    }


    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * @param {string} [message="Enter command..."]
     * @deprecated Logic moved to PlayerTurnHandler.
     */
    async promptInput(message = 'Enter command...') {
        this.#logger.warn(`DEPRECATED: GameLoop.promptInput called. This should be in PlayerTurnHandler.`);
        this.#logger.debug(`METHOD promptInput ENTRY: Reading this.#isRunning = ${this.#isRunning}`);

        if (!this.#isRunning) {
            this.#logger.debug('promptInput called while not running.');
            return;
        }

        const currentActor = this.#turnManager.getCurrentActor();

        if (!currentActor || !currentActor.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug(`promptInput called, but it's not a player's turn (Current: ${currentActor?.id ?? 'None'}). Input remains disabled.`);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting for others..."});
            return;
        }

        const currentActorId = currentActor.id;
        this.#logger.debug(`METHOD promptInput: Conditions passed, enabling input for ${currentActorId}...`);

        const payload = {
            placeholder: message,
            entityId: currentActorId
        };
        await this.#validatedEventDispatcher.dispatchValidated('textUI:enable_input', payload);
        this.#logger.debug(`Input enabled via 'textUI:enable_input' event for entity ${currentActorId}. Placeholder: "${message}"`);
    }

    /**
     * Stops the game loop, tells TurnManager to stop, cleans up subscriptions,
     * resets internal state, and dispatches events for UI updates.
     * @async
     */
    async stop() {
        if (!this.#isRunning) {
            this.#logger.info('GameLoop: Stop called, but already stopped.');
            return;
        }
        this.#isRunning = false;
        const stopMessage = 'Game stopped.';
        this.#logger.info(`GameLoop: Stopping... Message: "${stopMessage}"`);

        // --- Unsubscribe from events ---
        this.#unsubscribeFromEvents(); // ****** ADDED THIS CALL ******

        // --- Tell TurnManager to stop ---
        try {
            this.#logger.debug('GameLoop: Calling turnManager.stop().');
            await this.#turnManager.stop();
            this.#logger.debug('GameLoop: turnManager.stop() completed.');
        } catch (error) {
            this.#logger.error(`GameLoop: Error calling turnManager.stop(): ${error.message}`, error);
        }

        // --- Disable Input Handler (via event) ---
        const disablePayload = {message: stopMessage};
        await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', disablePayload);

        // --- Display stop message ---
        const messagePayload = {text: stopMessage, type: 'info'};
        await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', messagePayload);

        // --- Dispatch a general game stopped event ---
        await this.#eventBus.dispatch('game:stopped', {});

        this.#logger.info('GameLoop: Stopped successfully.');
    }

    /**
     * Gets the current running state.
     * @returns {boolean}
     */
    get isRunning() {
        return this.#isRunning;
    }

    /**
     * @private
     * @description **FOR TESTING PURPOSES ONLY.** Sets the internal running state.
     * @param {boolean} value - The desired running state.
     */
    _test_setRunning(value) {
        this.#logger?.debug(`[_test_setRunning]: Setting #isRunning to ${value}`);
        this.#isRunning = value;
    }
}

export default GameLoop;