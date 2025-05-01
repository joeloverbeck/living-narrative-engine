// src/core/gameLoop.js

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
    #logger; // Interface: ILogger

    #isRunning = false;
    #currentTurnEntity = null; // Set by 'turn:actor_changed', nulled on stop, NOT read by core logic.

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
        // Logger already assigned

        // --- Initialize State ---
        this.#isRunning = false;
        this.#currentTurnEntity = null; // Will be updated by TurnManager events

        // --- Setup ---
        this.#subscribeToEvents();

        this.#logger.info('GameLoop: Instance created with dependencies. Ready to start.');
    }

    /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * @private
     */
    #subscribeToEvents() {
        // Command submission handling
        this.#eventBus.subscribe('command:submit', this.#handleSubmittedCommandFromEvent.bind(this));
        this.#logger.info("GameLoop: Subscribed to 'command:submit' event.");

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
     * Updates the internal (but not directly read) `currentTurnEntity` and triggers turn processing logic.
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

        // Update the internal reference (for potential debugging/external tools, not core logic)
        this.#currentTurnEntity = newActor;
        this.#logger.debug(`GameLoop #handleTurnActorChanged: Internal #currentTurnEntity SET to ${this.#currentTurnEntity?.id ?? 'null'}`); // Log after setting

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
                // Potentially stop or advance?
                return;
            }
            this.#logger.debug(`GameLoop #handleTurnActorChanged: Processing turn for ${currentActorForTurn.id}`);
            // Start processing the turn for the new entity
            await this._processCurrentActorTurn(currentActorForTurn);
        } else {
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


    /**
     * Handles commands received via the 'command:submit' event (e.g., from UI input field).
     * Ensures the command is from the entity whose turn it currently is (fetched from TurnManager),
     * and that the game is running. Delegates actual command processing to `processSubmittedCommand`.
     * @private
     * @param {object} eventData - The event payload. Expected to contain `entityId` and `command`.
     * @param {string} eventData.entityId - The ID of the entity submitting the command.
     * @param {string} eventData.command - The command string.
     */
    async #handleSubmittedCommandFromEvent(eventData) {
        // --- Guard Clause (Not Running) ---
        if (!this.#isRunning) {
            this.#logger.warn('GameLoop received command submission via event, but loop is not running.');
            return;
        }

        // --- Get Current Actor ---
        const currentActor = this.#turnManager.getCurrentActor(); // Fetch authoritative actor

        // --- Guard Clause (Turn Context Validation) ---
        const receivedEntityId = eventData?.entityId ?? null; // Extract for clarity
        // Use the fetched currentActor for validation
        const isCorrectPlayersTurn = currentActor &&
            receivedEntityId && // Ensure eventData.entityId exists
            currentActor.id === receivedEntityId &&
            currentActor.hasComponent(PLAYER_COMPONENT_ID);

        if (!isCorrectPlayersTurn) {
            const currentTurnId = currentActor?.id ?? 'None'; // Use currentActor for logging
            this.#logger.warn(`GameLoop received command event for entity ${receivedEntityId}, but it's not that player's turn (Current: ${currentTurnId}). Ignoring.`);

            // Optional Feedback: Only send "Not your turn" if the game *is* expecting input from *some* player
            if (currentActor && currentActor.hasComponent(PLAYER_COMPONENT_ID)) { // Use currentActor
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: "It's not your turn.",
                    type: 'warning'
                });
            }
            return; // Exit immediately if not the correct player's turn
        }

        // --- Event Data Validation & Delegation ---
        // At this point, currentActor is valid and it's their turn.
        const commandString = eventData?.command;
        if (commandString && typeof commandString === 'string' && commandString.trim().length > 0) {
            // If Valid: Delegate processing
            this.#logger.info(`GameLoop: Received command via event: "${commandString}" from ${currentActor.id}`); // Use currentActor.id
            // Delegate the core logic (parsing, execution, turn advancement via TurnManager)
            // Pass the validated currentActor
            await this.processSubmittedCommand(currentActor, commandString);
        } else {
            // If Invalid: Log, recover, and allow retry
            this.#logger.warn("GameLoop received invalid 'command:submit' event data (missing or empty command string):", eventData);
            // Re-prompt the current player to allow them to try again.
            // Pass the validated currentActor
            await this._promptPlayerInput(currentActor); // Use helper
        }
    }


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
     * Differentiates between player and AI turns.
     * @private
     * @param {Entity} actor The entity whose turn it currently is.
     * @async
     */
    async _processCurrentActorTurn(actor) {
        // Add extra check for actor validity at the START
        if (!actor || typeof actor.hasComponent !== 'function' || typeof actor.id === 'undefined') {
            this.#logger.error(`_processCurrentActorTurn called with invalid actor: ${actor?.id ?? 'undefined/null'}. Aborting turn process.`);
            // Try advancing turn to prevent getting stuck
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

        const actorId = actor.id;
        this.#logger.info(`GameLoop: >>> Processing turn for Actor: ${actorId} <<<`);

        // --- Player Turn Logic ---
        if (actor.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug(`GameLoop: Actor ${actorId} is player-controlled. Preparing for input.`);
            // Discover actions and prompt input using the passed actor
            await this._promptPlayerInput(actor);

        } else {
            // --- AI/NPC Turn Logic ---
            this.#logger.info(`GameLoop: Actor ${actorId} is AI controlled. Triggering AI logic (placeholder)...`);
            // Uses IActionDiscoverySystem.getValidActions (even for AI, might inform decisions)
            // Pass the current actor to discovery
            const availableActions = await this._discoverActionsForEntity(actor);

            // Placeholder AI Action (No IAiService call yet)
            // TODO: Replace with actual AI service call that chooses an action
            this.#logger.warn(`GameLoop: AI (${actorId}) taking placeholder 'wait' action.`);
            const aiActionId = 'core:wait';
            const aiParsedCommand = {actionId: aiActionId, originalInput: '(AI wait)', targets: [], prepositions: {}}; // Simulate parse

            // Execute the placeholder action using the passed actor
            const actionResult = await this.executeAction(actor, aiParsedCommand);

            // AI finishes its turn, tell TurnManager to advance.
            this.#logger.debug(`GameLoop: AI (${actorId}) turn finished with action: ${aiActionId}. Success: ${actionResult.success}. Advancing turn...`);
            // Uses ITurnManager.advanceTurn
            try {
                await this.#turnManager.advanceTurn(); // Signal TurnManager the AI turn is done
            } catch (error) {
                this.#logger.error(`GameLoop: Error occurred when advancing turn after AI action for ${actorId}: ${error.message}`, error);
                // Potentially stop the loop if advancing fails critically
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: `Critical Error during AI turn advancement: ${error.message}`,
                    type: 'error'
                });
                await this.stop();
            }
        }
    }


    /**
     * Processes a command string submitted by the input handler or event bus *for a specific player entity*.
     * Verifies the acting player matches the actor provided by TurnManager.
     * Parses the command, executes the action, handles errors, and then tells TurnManager to advance the turn.
     * @param {Entity} actingPlayer - The player entity performing the command (should match TurnManager's current actor).
     * @param {string} command - The raw command string from the input.
     * @async
     */
    async processSubmittedCommand(actingPlayer, command) {
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
            // If it's somehow a player turn but the wrong player sent the command, re-prompt the *correct* player.
            if (currentActor && currentActor.hasComponent(PLAYER_COMPONENT_ID)) { // Use currentActor
                await this._promptPlayerInput(currentActor); // Pass currentActor
            }
            // Do not proceed further with the incorrect entity's command.
            return;
        }

        // --- Disable input ---
        // Uses IInputHandler.disable
        this.#inputHandler.disable();
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Processing..."});

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

            // Re-discover actions and re-prompt the player - Allow retry within turn
            // Pass actingPlayer (which we've confirmed is the current actor)
            await this._promptPlayerInput(actingPlayer); // Use helper
            // **Do not** advance turn here.
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

            // --- Player Turn End Logic ---
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
     */
    async _discoverActionsForEntity(actingEntity) {
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

    /**
     * Helper to discover actions and prompt player input.
     * @private
     * @param {Entity} playerEntity The player entity to prompt.
     * @async
     */
    async _promptPlayerInput(playerEntity) {
        if (!this.#isRunning || !playerEntity || !playerEntity.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug('_promptPlayerInput called inappropriately. Aborting.');
            return;
        }
        // Discover actions first using the passed player entity
        await this._discoverActionsForEntity(playerEntity); // Uses IActionDiscoverySystem

        // Then prompt for input using the passed player entity
        await this.promptInput(`Your turn, ${playerEntity.id}. Enter command...`); // Uses IInputHandler
    }


    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * Should only be called when it's a player's turn (verified via TurnManager).
     * @param {string} [message="Enter command..."] - Placeholder text for the input field.
     */
    async promptInput(message = 'Enter command...') { // Made async to match dispatcher
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

        // Reset internal loop state (still useful for debugging/external observation)
        this.#logger.debug(`GameLoop stop: Setting internal #currentTurnEntity to null. Was: ${this.#currentTurnEntity?.id ?? 'null'}`); // Log before nulling
        this.#currentTurnEntity = null;

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

    /**
     * @private
     * @description **FOR TESTING PURPOSES ONLY.** Sets the internal current turn entity state.
     * Note: Core methods now read from TurnManager. This only affects the internal state.
     * @param {Entity | null} entity - The entity to set as internal current.
     */
    _test_setInternalCurrentTurnEntity(entity) {
        // Add check before assignment
        if (!entity) {
            this.#logger?.warn(`[_test_setInternalCurrentTurnEntity]: Attempted to set internal #currentTurnEntity to null/undefined.`);
        } else if (typeof entity.id === 'undefined') {
            this.#logger?.error(`[_test_setInternalCurrentTurnEntity]: Attempted to set internal #currentTurnEntity with invalid entity (missing ID).`);
            // Optionally throw an error or just don't set it
            // return; // Don't set if invalid
        }
        this.#logger?.debug(`[_test_setInternalCurrentTurnEntity]: Setting internal #currentTurnEntity to ${entity?.id ?? 'null'}`);
        this.#currentTurnEntity = entity;
        this.#logger?.debug(`[_test_setInternalCurrentTurnEntity]: Internal #currentTurnEntity is NOW ${this.#currentTurnEntity?.id ?? 'null'}`); // Log after setting
    }

    /**
     * @private // Logically private, but public for test access
     * @description **FOR TESTING PURPOSES ONLY.** Gets the internal current turn entity state.
     * Note: Core methods now read from TurnManager. This reads only the internal state.
     * @returns {Entity | null}
     */
    _test_getInternalCurrentTurnEntity() {
        this.#logger?.debug(`[_test_getInternalCurrentTurnEntity]: Reading internal #currentTurnEntity (currently ${this.#currentTurnEntity?.id ?? 'null'})`);
        return this.#currentTurnEntity;
    }
}

export default GameLoop;