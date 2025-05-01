// src/core/gameLoop.js
// ****** CORRECTED FILE ******

// --- Type Imports ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Keep concrete for now if no interface used directly by GameLoop
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Keep concrete for now if no interface used directly by GameLoop
/** @typedef {import('./interfaces/IGameStateManager.js').IGameStateManager} IGameStateManager */
/** @typedef {import('./interfaces/IInputHandler.js').IInputHandler} IInputHandler */
/** @typedef {import('./interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('./interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('./eventBus.js').default} EventBus */ // Keep concrete type
/** @typedef {import('./interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('./interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */ // Using existing typedef
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // Updated Interface
/** @typedef {import('../core/interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */
/** @typedef {import('./interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */ // Added Interface


// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository - Provides access to game definition data. (Interface TBD if direct usage increases)
 * @property {EntityManager} entityManager - Manages entity instances and components. (Interface TBD if direct usage increases)
 * @property {IGameStateManager} gameStateManager - Manages mutable game state like current location.
 * @property {IInputHandler} inputHandler - Handles user command input.
 * @property {ICommandParser} commandParser - Parses raw command strings.
 * @property {IActionExecutor} actionExecutor - Executes parsed actions.
 * @property {EventBus} eventBus - Core event bus for pub/sub.
 * @property {IActionDiscoverySystem} actionDiscoverySystem - Discovers available actions for entities.
 * @property {IValidatedEventDispatcher} validatedEventDispatcher - Dispatches events, potentially with validation.
 * @property {ITurnManager} turnManager - Manages the overall turn lifecycle.
 * @property {ITurnHandlerResolver} turnHandlerResolver - Service to resolve turn handlers for actors.
 * @property {ILogger} logger - Service for logging messages.
 */

import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../types/components.js";

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies via interfaces, processes user input via a turn-based cycle,
 * delegates action execution, discovers available actions, and uses the EventBus.
 * Relies on TurnManager to manage whose turn it is and round progression.
 */
class GameLoop {
    #gameDataRepository; // Remains concrete for now
    #entityManager; // Remains concrete for now
    #gameStateManager; // Interface: IGameStateManager
    #inputHandler; // Interface: IInputHandler
    #commandParser; // Interface: ICommandParser
    #actionExecutor; // Interface: IActionExecutor
    #eventBus; // Remains concrete
    #actionDiscoverySystem; // Interface: IActionDiscoverySystem
    #validatedEventDispatcher; // Interface: IValidatedEventDispatcher
    #turnManager; // Interface: ITurnManager
    /** @type {ITurnHandlerResolver} */ #turnHandlerResolver; // Added field
    #logger; // Interface: ILogger

    #isRunning = false;

    // #currentTurnEntity = null; // REMOVED: This field is no longer used by core logic

    /**
     * @param {GameLoopOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        const {
            gameDataRepository,
            entityManager,
            gameStateManager,
            inputHandler,
            commandParser,
            actionExecutor,
            eventBus,
            actionDiscoverySystem,
            validatedEventDispatcher,
            turnManager, // Changed from turnOrderService
            turnHandlerResolver, // Added parameter
            logger
        } = options || {};

        // --- Validate and Assign Logger FIRST ---
        // Logger validation (ILogger interface check - simplified)
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            console.warn('GameLoop Constructor: Invalid logger provided. Falling back to console.');
            this.#logger = console;
        } else {
            this.#logger = logger;
        }

        // --- Validate Other Dependencies against Interfaces/Required Methods ---
        // Keep GameDataRepository/EntityManager checks basic for now, as interfaces aren't primary focus yet
        if (!gameDataRepository) throw new Error('GameLoop requires options.gameDataRepository.'); // TODO: Check methods if interface defined
        if (!entityManager) throw new Error('GameLoop requires options.entityManager.'); // TODO: Check methods if interface defined

        // IGameStateManager Check
        if (!gameStateManager || typeof gameStateManager.getCurrentLocation !== 'function' || typeof gameStateManager.getPlayer !== 'function') {
            throw new Error('GameLoop requires a valid options.gameStateManager implementing IGameStateManager (getCurrentLocation, getPlayer).');
        }
        // IInputHandler Check
        if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function' || typeof inputHandler.setCommandCallback !== 'function') {
            throw new Error('GameLoop requires a valid options.inputHandler implementing IInputHandler (enable, disable, setCommandCallback).');
        }
        // ICommandParser Check
        if (!commandParser || typeof commandParser.parse !== 'function') {
            throw new Error('GameLoop requires a valid options.commandParser implementing ICommandParser (parse).');
        }
        // IActionExecutor Check
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error('GameLoop requires a valid options.actionExecutor implementing IActionExecutor (executeAction).');
        }
        // EventBus Check (keep concrete check for now)
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
            throw new Error('GameLoop requires a valid options.eventBus object.');
        }
        // IActionDiscoverySystem Check
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            throw new Error('GameLoop requires a valid options.actionDiscoverySystem implementing IActionDiscoverySystem (getValidActions).');
        }
        // IValidatedEventDispatcher Check
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('GameLoop requires a valid options.validatedEventDispatcher implementing IValidatedEventDispatcher (dispatchValidated).');
        }
        // ITurnManager Check (NEW)
        if (!turnManager || typeof turnManager.start !== 'function' || typeof turnManager.stop !== 'function' || typeof turnManager.getCurrentActor !== 'function' || typeof turnManager.advanceTurn !== 'function') {
            throw new Error('GameLoop requires a valid options.turnManager implementing ITurnManager (start, stop, getCurrentActor, advanceTurn).');
        }
        // ITurnHandlerResolver Check (NEW)
        if (!turnHandlerResolver || typeof turnHandlerResolver.resolveHandler !== 'function') {
            const errorMsg = 'GameLoop requires a valid options.turnHandlerResolver implementing ITurnHandlerResolver (resolveHandler).';
            this.#logger?.error(errorMsg); // Log before throwing if logger exists
            throw new Error(errorMsg);
        }

        // --- Assign Dependencies ---
        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#inputHandler = inputHandler;
        this.#commandParser = commandParser;
        this.#actionExecutor = actionExecutor;
        this.#eventBus = eventBus;
        this.#actionDiscoverySystem = actionDiscoverySystem;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#turnManager = turnManager; // Changed from turnOrderService
        this.#turnHandlerResolver = turnHandlerResolver; // Added assignment
        // Logger already assigned

        // --- Initialize State ---
        this.#isRunning = false;
        // REMOVED: No need to initialize #currentTurnEntity

        // --- Setup ---
        this.#subscribeToEvents();

        this.#logger.info('GameLoop: Instance created with dependencies. Ready to start.');
    }

    /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * @private
     */
    #subscribeToEvents() {
        // REMOVED: command:submit subscription

        // Turn lifecycle events from TurnManager
        this.#eventBus.subscribe('turn:actor_changed', this.#handleTurnActorChanged.bind(this));
        this.#logger.info("GameLoop: Subscribed to 'turn:actor_changed' event.");
        this.#eventBus.subscribe('turn:manager_stopped', this.#handleTurnManagerStopped.bind(this));
        this.#logger.info("GameLoop: Subscribed to 'turn:manager_stopped' event.");

        // Consider subscribing to entity lifecycle events (e.g., death) if they need to interact with TurnManager directly.
        // this.#eventBus.subscribe('entity:died', this.#handleEntityDied.bind(this));
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
        // Add check for eventData validity
        const newActor = eventData?.currentActor ?? null;
        const previousActor = eventData?.previousActor ?? null;

        this.#logger.debug(`GameLoop: Received 'turn:actor_changed'. New Actor: ${newActor?.id ?? 'null'}. Previous: ${previousActor?.id ?? 'null'}`);

        if (!this.#isRunning) {
            this.#logger.debug('GameLoop received actor change event, but loop is not running.');
            return;
        }

        // Fetch the authoritative actor directly from TurnManager for processing
        const currentActorForTurn = this.#turnManager.getCurrentActor();

        if (currentActorForTurn) {
            // Add check before processing
            if (typeof currentActorForTurn.hasComponent !== 'function') {
                this.#logger.error(`GameLoop #handleTurnActorChanged: Invalid entity reported by TurnManager (ID: ${currentActorForTurn?.id}). Cannot process turn.`);
                // Potentially stop or advance? This might be a critical error. Consider stopping.
                await this.stop();
                return;
            }
            this.#logger.debug(`GameLoop #handleTurnActorChanged: Processing turn for ${currentActorForTurn.id}`);

            // --- TICKET 3.1.6.2.3: Resolve Handler ---
            const handler = await this.#turnHandlerResolver.resolveHandler(currentActorForTurn);

            if (handler && typeof handler.handleTurn === 'function') {
                this.#logger.debug(`GameLoop #handleTurnActorChanged: Resolved handler ${handler.constructor.name} for ${currentActorForTurn.id}. Executing...`);
                // --- TICKET 3.1.6.2.4/3.1.6.2.5 START: Execute Handler with Error Handling ---
                try {
                    await handler.handleTurn(currentActorForTurn);
                    // Handler is responsible for advancing turn if successful (e.g., after AI action or player input)
                } catch (handlerError) {
                    // --- TICKET 3.1.6.2.5: Handle Error from handler.handleTurn ---
                    // Log Handler Error
                    this.#logger.error(`Error during delegated turn handling for ${currentActorForTurn.id} by ${handler.constructor.name}: ${handlerError.message}`, handlerError);

                    // Nested try...catch for advanceTurn
                    try {
                        // Call advanceTurn
                        this.#logger.warn(`Attempting to advance turn after handler error for ${currentActorForTurn.id}...`);
                        await this.#turnManager.advanceTurn();
                    } catch (advanceError) {
                        // Handle advanceTurn Error
                        // Log the advancement error
                        this.#logger.error(`Failed to advance turn after handler error for ${currentActorForTurn.id}: ${advanceError.message}`, advanceError);
                        // Consider stopping the loop
                        // Critical failure if turn cannot advance, as the game state is likely stuck.
                        await this.stop();
                    }
                }
                // --- TICKET 3.1.6.2.4/3.1.6.2.5 END ---
            } else {
                // Handle case where no valid handler was resolved
                this.#logger.error(`GameLoop #handleTurnActorChanged: Failed to resolve a valid turn handler for ${currentActorForTurn.id}. Skipping turn.`);
                // Attempt to advance turn to prevent stall
                try {
                    await this.#turnManager.advanceTurn();
                } catch (skipError) {
                    this.#logger.error(`Error advancing turn after failed handler resolution for ${currentActorForTurn.id}: ${skipError.message}`);
                    // Critical failure if turn cannot advance even after skipping a failed resolution.
                    await this.stop();
                }
            }

        } else {
            // Handle case where TurnManager reports no current actor
            this.#logger.info('GameLoop: TurnManager reported no current actor (null). Waiting...');
            this.#inputHandler.disable();
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting..."});
        }
    }

    /**
     * Handles the 'turn:manager_stopped' event from the TurnManager.
     * Ensures the GameLoop also stops cleanly.
     * @private
     * @param {object} eventData - The event payload (content TBD based on TurnManager).
     */
    async #handleTurnManagerStopped(eventData) {
        this.#logger.info("GameLoop: Received 'turn:manager_stopped' event. Initiating GameLoop stop.");
        await this.stop(); // Ensure GameLoop stops its state/input handling too.
    }


    // REMOVED: Method definition for #handleSubmittedCommandFromEvent


    /**
     * Starts the main game loop. Sets the running state and tells TurnManager to start.
     * Assumes GameInitializer/Engine has already run successfully and dependencies are valid.
     * @async
     */
    async start() {
        if (this.#isRunning) {
            this.#logger.warn('GameLoop: start() called but loop is already running.');
            return;
        }

        // --- Set state and dispatch event ---
        this.#isRunning = true;
        this.#logger.info('GameLoop: Started.');
        await this.#eventBus.dispatch('game:started', {}); // Uses EventBus

        // --- Start the Turn Manager ---
        this.#logger.info('GameLoop: Starting TurnManager...');
        try {
            // Uses ITurnManager.start
            await this.#turnManager.start(); // TurnManager will emit 'turn:actor_changed' to kick things off
            this.#logger.info('GameLoop: TurnManager started successfully.');
        } catch (error) {
            this.#logger.error(`GameLoop: Failed to start TurnManager: ${error.message}`, error);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Critical Error: Could not start turn management. ${error.message}`,
                type: 'error'
            });
            await this.stop(); // Stop the GameLoop if TurnManager fails to start
        }
    }


    /**
     * Processes the turn for the currently active actor (passed as parameter).
     * Differentiates between player and AI turns using the TurnHandlerResolver.
     * @private
     * @param {Entity} actor The entity whose turn it currently is.
     * @async
     * @deprecated This method is superseded by the logic within `#handleTurnActorChanged` which now directly uses the TurnHandlerResolver and TurnHandlers. Kept for potential reference.
     */
    async _processCurrentActorTurn(actor) {
        this.#logger.warn(`DEPRECATED: GameLoop._processCurrentActorTurn called directly for ${actor?.id}. Logic moved to #handleTurnActorChanged.`);
        // The core logic from this method has been integrated into #handleTurnActorChanged
        // using the TurnHandlerResolver and associated handlers (like PlayerTurnHandler).
        // This method should no longer be the primary entry point for turn processing.

        // Add extra check for actor validity at the START
        if (!actor || typeof actor.hasComponent !== 'function' || typeof actor.id === 'undefined') {
            this.#logger.error(`_processCurrentActorTurn called with invalid actor: ${actor?.id ?? 'undefined/null'}. Aborting turn process.`);
            try {
                this.#logger.warn(`_processCurrentActorTurn attempting to advance turn due to invalid actor.`);
                await this.#turnManager.advanceTurn();
            } catch (e) {
                this.#logger.error(`Error advancing turn after detecting invalid actor in _processCurrentActorTurn: ${e.message}`);
                await this.stop(); // Stop if advancing also fails
            }
            return;
        }

        if (!this.#isRunning) {
            this.#logger.debug(`_processCurrentActorTurn called for ${actor.id} while not running.`);
            return;
        }

        // Call the new handler logic as a fallback (though direct calls should be avoided)
        await this.#handleTurnActorChanged({currentActor: actor, previousActor: null});
    }


    /**
     * Processes a command string submitted by the input handler or event bus *for a specific player entity*.
     * Verifies the acting player matches the actor provided by TurnManager.
     * Parses the command, executes the action, handles errors, and then tells TurnManager to advance the turn.
     * @param {Entity} actingPlayer - The player entity performing the command (should match TurnManager's current actor).
     * @param {string} command - The raw command string from the input.
     * @async
     * @deprecated Logic moved to PlayerTurnHandler. Keeping for reference/potential reuse if needed. Should not be called directly by core loop now.
     */
    async processSubmittedCommand(actingPlayer, command) {
        this.#logger.warn(`DEPRECATED: GameLoop.processSubmittedCommand called directly for ${actingPlayer?.id}. This logic should be in PlayerTurnHandler.`);
        if (!this.#isRunning) {
            this.#logger.debug('processSubmittedCommand called while not running.');
            return;
        }

        // --- Get Current Actor from Turn Manager ---
        const currentActor = this.#turnManager.getCurrentActor(); // Fetch authoritative actor

        // --- Verification ---
        // Verify the entity passed in (actingPlayer) is indeed the current actor from the TurnManager.
        if (!actingPlayer || actingPlayer !== currentActor || !actingPlayer.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.error(`processSubmittedCommand called for ${actingPlayer?.id} but current turn is ${currentActor?.id} or not a player. State inconsistency?`);
            // If it's somehow a player turn but the wrong player sent the command, re-prompt the *correct* player (via handler).
            // if (currentActor && currentActor.hasComponent(PLAYER_COMPONENT_ID)) { // Use currentActor
            //    // PlayerTurnHandler should handle re-prompting.
            // }
            return;
        }

        // --- Disable input (Handler should do this) ---
        // this.#inputHandler.disable();
        // await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Processing..."});

        this.#logger.debug(`Processing command: "${command}" for player ${actingPlayer.id}`);

        // --- Parse Command ---
        // Uses ICommandParser.parse
        const parsedCommand = this.#commandParser.parse(command);

        let actionExecuted = false;
        let actionSuccess = false;
        let actionIdTaken = null;

        if (parsedCommand.error || !parsedCommand.actionId) {
            // --- Handle Parse Error ---
            const message = parsedCommand.error ||
                (parsedCommand.originalInput.trim().length > 0 ? `Unknown command "${parsedCommand.originalInput}". Try 'help'.` : '');

            if (message) {
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: message,
                    type: 'error'
                });
            }
            this.#logger.warn(`Command parsing failed for "${command}". Error: ${message || 'No action ID found.'}`);

            // Re-prompt should be handled by PlayerTurnHandler.
            // await this._promptPlayerInput(actingPlayer); // DEPRECATED HELPER CALL, REMOVED IN 3.1.6.4
            return; // <<< Explicitly return to prevent advancing turn

        } else {
            // --- Execute Valid Command ---
            actionIdTaken = parsedCommand.actionId;
            // Uses IActionExecutor.executeAction (indirectly via executeAction helper)
            // Pass actingPlayer (confirmed current actor)
            const actionResult = await this.executeAction(actingPlayer, parsedCommand);
            actionExecuted = true; // We attempted execution
            actionSuccess = actionResult?.success ?? false;
            this.#logger.debug(`Action ${actionIdTaken} completed for ${actingPlayer.id}. Success: ${actionSuccess}.`);

            // --- Player Turn End Logic (Handler should do this) ---
            // Only advance if an action was successfully parsed and attempted
            this.#logger.info(`GameLoop: Player ${actingPlayer.id} completed action ${actionIdTaken}. Advancing turn...`);

            // Uses ITurnManager.advanceTurn
            try {
                await this.#turnManager.advanceTurn(); // Signal TurnManager the player's turn is done
            } catch (error) {
                this.#logger.error(`GameLoop: Error occurred when advancing turn after player action for ${actingPlayer.id}: ${error.message}`, error);
                // Potentially stop the loop if advancing fails critically
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: `Critical Error during player turn advancement: ${error.message}`,
                    type: 'error'
                });
                await this.stop();
            }
        }
    }

    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * Handles cases where the acting entity or location is missing. Relies on the `actingEntity` parameter.
     * @private
     * @param {Entity | null} actingEntity - The entity performing the action. Can be null for error testing/edge cases.
     * @param {ParsedCommand} parsedCommand - The parsed command details.
     * @returns {Promise<ActionResult>} The result of the action execution.
     * @async
     */
    async executeAction(actingEntity, parsedCommand) {
        // --- FIX START: Check actingEntity FIRST ---
        if (!actingEntity) {
            const errorMsg = 'GameLoop executeAction called but state missing: acting entity.';
            this.#logger.error(errorMsg);
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            return {success: false, messages: [{text: errorMsg, type: 'internal'}]};
        }
        // --- FIX END: Check actingEntity FIRST ---

        // Now it's safe to use actingEntity.id
        // Uses IGameStateManager.getCurrentLocation
        const currentLocation = this.#gameStateManager.getCurrentLocation(actingEntity.id);

        // --- FIX START: Check currentLocation separately ---
        if (!currentLocation) {
            const errorMsg = `GameLoop executeAction called but state missing: current location context for ${actingEntity.id}.`;
            this.#logger.error(errorMsg);
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: 'Internal Error: Game state inconsistent during action execution.',
                type: 'error'
            });
            return {success: false, messages: [{text: errorMsg, type: 'internal'}]};
        }
        // --- FIX END: Check currentLocation separately ---

        /** @type {ActionContext} */
        const context = {
            actingEntity: actingEntity, // Uses the passed parameter
            currentLocation: currentLocation,
            parsedCommand: parsedCommand,
            gameDataRepository: this.#gameDataRepository, // Passed down
            entityManager: this.#entityManager, // Passed down
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus), // Passed down
            eventBus: this.#eventBus, // Passed down
            logger: this.#logger, // Passed down
        };

        this.#logger.debug(`Executing action: ${parsedCommand.actionId} for entity ${actingEntity.id}`);

        try {
            // Uses IActionExecutor.executeAction
            const result = await this.#actionExecutor.executeAction(parsedCommand.actionId, context);

            // Basic validation of the returned result structure
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
            // Dispatch action result event *before* returning
            await this.#eventBus.dispatch('action:executed', {
                actionId: parsedCommand.actionId,
                entityId: actingEntity.id,
                result: result // Include the full ActionResult
            });
            return result;


        } catch (error) {
            this.#logger.error(`Error during execution of action ${parsedCommand.actionId} for entity ${actingEntity.id}:`, error);
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Error performing action: ${error.message}`,
                type: 'error'
            });
            const errorResult = {
                success: false,
                messages: [{text: `Exception during action execution: ${error.message}`, type: 'internal'}]
            };
            // Dispatch failure event
            await this.#eventBus.dispatch('action:executed', {
                actionId: parsedCommand.actionId,
                entityId: actingEntity.id,
                result: errorResult
            });
            return errorResult;
        }
    }


    /**
     * Discovers available actions for a specific entity based on the current state
     * via ActionDiscoverySystem, dispatches the result via the EventBus, and returns the actions.
     * Relies on the `actingEntity` parameter.
     * @private
     * @param {Entity} actingEntity - The entity whose actions are being discovered.
     * @returns {Promise<Array<ActionDefinition>>} A promise resolving to the array of valid actions.
     * @async
     * @deprecated This should be invoked by the PlayerTurnHandler, not directly by GameLoop.
     */
    async _discoverActionsForEntity(actingEntity) {
        this.#logger.warn(`DEPRECATED: GameLoop._discoverActionsForEntity called for ${actingEntity?.id}. Should be handled by PlayerTurnHandler.`);
        if (!this.#isRunning) {
            this.#logger.debug('_discoverActionsForEntity called while not running.');
            return [];
        }
        if (!actingEntity) {
            this.#logger.warn('Cannot discover actions: No valid acting entity provided.');
            // Uses IValidatedEventDispatcher.dispatchValidated
            // Dispatch with null entityId to indicate no specific entity context
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
            // Uses IGameStateManager.getCurrentLocation
            const currentLocation = this.#gameStateManager.getCurrentLocation(entityId);

            if (!currentLocation) {
                this.#logger.error(`Cannot discover actions for ${entityId}: Current location for this entity is missing from GameStateManager.`);
                validActions = []; // Ensure empty on error
            } else {
                /** @type {ActionContext} */
                const discoveryContext = {
                    actingEntity: actingEntity, // Uses the passed parameter
                    currentLocation: currentLocation,
                    entityManager: this.#entityManager, // Passed down
                    gameDataRepository: this.#gameDataRepository, // Passed down
                    dispatch: this.#eventBus.dispatch.bind(this.#eventBus), // Passed down
                    eventBus: this.#eventBus, // Passed down
                    parsedCommand: undefined, // No parsed command during discovery phase
                    logger: this.#logger, // Passed down
                };

                this.#logger.debug(`Calling ActionDiscoverySystem.getValidActions for entity ${entityId}`);
                // Uses IActionDiscoverySystem.getValidActions
                validActions = await this.#actionDiscoverySystem.getValidActions(actingEntity, discoveryContext);
                this.#logger.debug(`ActionDiscoverySystem returned ${validActions.length} valid actions for ${entityId}.`);
            }
        } catch (error) {
            this.#logger.error(`Error during action discovery for entity ${entityId}:`, error);
            validActions = []; // Ensure empty array on error
        } finally {
            // Always dispatch the result (even if empty or errored)
            const payload = {actions: validActions, entityId: entityId};
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', payload);
            this.#logger.debug(`Dispatched ${'event:update_available_actions'} for entity ${entityId} with ${validActions.length} actions.`);
        }
        return validActions; // Return the discovered actions
    }

    // REMOVED: Method definition for _promptPlayerInput deleted as per ticket 3.1.6.4


    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * Should only be called when it's a player's turn (verified via TurnManager).
     * @param {string} [message="Enter command..."] - Placeholder text for the input field.
     * @deprecated Logic moved to PlayerTurnHandler. Should not be called directly by core loop.
     */
    async promptInput(message = 'Enter command...') { // Made async to match dispatcher
        this.#logger.warn(`DEPRECATED: GameLoop.promptInput called. This should be in PlayerTurnHandler.`);
        this.#logger.debug(`METHOD promptInput ENTRY: Reading this.#isRunning = ${this.#isRunning}`);

        if (!this.#isRunning) {
            this.#logger.debug('promptInput called while not running.');
            return;
        }

        // --- Get Current Actor ---
        const currentActor = this.#turnManager.getCurrentActor(); // Fetch authoritative actor

        // Verify it's still the correct player entity's turn before enabling input
        if (!currentActor || !currentActor.hasComponent(PLAYER_COMPONENT_ID)) { // Use currentActor
            this.#logger.debug(`promptInput called, but it's not a player's turn (Current: ${currentActor?.id ?? 'None'}). Input remains disabled.`); // Use currentActor
            // Ensure input handler is disabled if we reach here unexpectedly
            // Uses IInputHandler.disable
            this.#inputHandler.disable();
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting for others..."});
            return;
        }

        // Ensure currentActor is valid before accessing id
        const currentActorId = currentActor.id;
        this.#logger.debug(`METHOD promptInput: Conditions passed, enabling input for ${currentActorId}...`); // Use currentActorId

        // Uses IInputHandler.enable
        this.#inputHandler.enable();

        // Dispatch event for the UI to enable its input field
        const payload = {
            placeholder: message,
            entityId: currentActorId // Use currentActorId
        };
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:enable_input', payload);
        this.#logger.debug(`Input enabled via 'textUI:enable_input' event for entity ${currentActorId}. Placeholder: "${message}"`); // Use currentActorId
    }

    /**
     * Stops the game loop, tells TurnManager to stop, disables input handler,
     * resets internal state, and dispatches events for UI updates.
     * @async
     */
    async stop() {
        if (!this.#isRunning) {
            this.#logger.info('GameLoop: Stop called, but already stopped.');
            return;
        }
        this.#isRunning = false; // Set internal flag immediately
        const stopMessage = 'Game stopped.';
        this.#logger.info(`GameLoop: Stopping... Message: "${stopMessage}"`);

        // --- Tell TurnManager to stop ---
        // It should handle its internal state cleanup and potentially emit 'turn:manager_stopped'
        try {
            // Uses ITurnManager.stop
            this.#logger.debug('GameLoop: Calling turnManager.stop().');
            await this.#turnManager.stop();
            this.#logger.debug('GameLoop: turnManager.stop() completed.');
        } catch (error) {
            this.#logger.error(`GameLoop: Error calling turnManager.stop(): ${error.message}`, error);
            // Continue stopping GameLoop even if TurnManager fails to stop gracefully
        }

        // --- Disable Input Handler ---
        // Uses IInputHandler.disable
        this.#inputHandler.disable();
        const disablePayload = {message: stopMessage};
        // Dispatch disable event
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', disablePayload);

        // --- FIX 1: Display stop message ---
        const messagePayload = {text: stopMessage, type: 'info'};
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', messagePayload);
        // -----------------------------------

        // REMOVED: Reset internal loop state (still useful for debugging/external observation)
        // this.#logger.debug(`GameLoop stop: Setting internal #currentTurnEntity to null. Was: ${this.#currentTurnEntity?.id ?? 'null'}`); // Log before nulling
        // this.#currentTurnEntity = null;

        // --- FIX 2: Dispatch a general game stopped event ---
        // Uses EventBus
        await this.#eventBus.dispatch('game:stopped', {});
        // --------------------------------------------------

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

    // REMOVED: Test helper for setting internal #currentTurnEntity is obsolete
    // REMOVED: Test helper for getting internal #currentTurnEntity is obsolete
}

export default GameLoop;