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
/** @typedef {import('../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */ // Using existing interface
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
 * @property {ITurnOrderService} turnOrderService - Manages the sequence of entity turns.
 * @property {ILogger} logger - Service for logging messages.
 */

import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../types/components.js";

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies via interfaces, processes user input via a turn-based cycle,
 * delegates action execution, discovers available actions, and uses the EventBus.
 * Relies on TurnOrderService to manage whose turn it is and round progression.
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
    #turnOrderService; // Interface: ITurnOrderService
    #logger; // Interface: ILogger

    #isRunning = false;
    #currentTurnEntity = null;

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
            turnOrderService,
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
        // ITurnOrderService Check
        if (!turnOrderService || typeof turnOrderService.isEmpty !== 'function' || typeof turnOrderService.startNewRound !== 'function' || typeof turnOrderService.getNextEntity !== 'function') {
            // Note: Also uses clearCurrentRound in stop(), but not strictly required for core loop start/run
            throw new Error('GameLoop requires a valid options.turnOrderService implementing ITurnOrderService (isEmpty, startNewRound, getNextEntity).');
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
        this.#turnOrderService = turnOrderService;
        // Logger already assigned

        // --- Initialize State ---
        this.#isRunning = false;
        this.#currentTurnEntity = null;

        // --- Setup ---
        this.#subscribeToEvents();

        this.#logger.info('GameLoop: Instance created with dependencies. Ready to start.');
    }

    /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * @private
     */
    #subscribeToEvents() {
        this.#eventBus.subscribe('command:submit', this.#handleSubmittedCommandFromEvent.bind(this));
        this.#logger.info("GameLoop: Subscribed to 'command:submit' event.");
        // TODO: Add subscriptions for entity death/removal to update turn order?
    }

    /**
     * Handles commands received via the 'command:submit' event (e.g., from UI input field).
     * Ensures the command is from the entity whose turn it currently is, and that the game is running.
     * Delegates actual command processing to `processSubmittedCommand`.
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

        // --- Guard Clause (Turn Context Validation) ---
        const isPlayerTurn = this.#currentTurnEntity &&
            eventData && // Ensure eventData exists before accessing entityId
            this.#currentTurnEntity.id === eventData.entityId &&
            this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID);

        if (!isPlayerTurn) {
            const currentTurnId = this.#currentTurnEntity?.id ?? 'None';
            const receivedEntityId = eventData?.entityId ?? 'Unknown';
            this.#logger.warn(`GameLoop received command event for entity ${receivedEntityId}, but it's not that player's turn (Current: ${currentTurnId}). Ignoring.`);

            // Optional Feedback: Only send "Not your turn" if the game *is* expecting input from *some* player
            if (this.#currentTurnEntity && this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: "It's not your turn.",
                    type: 'warning'
                });
            }
            return; // Exit immediately if not the correct player's turn
        }

        // --- Event Data Validation & Delegation ---
        const commandString = eventData?.command;
        if (commandString && typeof commandString === 'string' && commandString.trim().length > 0) {
            // If Valid: Delegate processing
            this.#logger.info(`GameLoop: Received command via event: "${commandString}" from ${this.#currentTurnEntity.id}`);
            // Delegate the core logic (parsing, execution, turn advancement)
            await this.processSubmittedCommand(this.#currentTurnEntity, commandString);
        } else {
            // If Invalid: Log, recover, and allow retry
            this.#logger.warn("GameLoop received invalid 'command:submit' event data (missing or empty command string):", eventData);
            // Rediscover actions and re-prompt the current player to allow them to try again.
            await this._discoverActionsForEntity(this.#currentTurnEntity); // Uses IActionDiscoverySystem
            await this.promptInput(); // Uses IInputHandler
        }
    }


    /**
     * Starts the main game loop. Sets the running state and initiates the turn processing.
     * Assumes GameInitializer/Engine has already run successfully and dependencies are valid.
     * The actual first round is initiated by #processNextTurn when it detects the empty queue.
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

        // --- Kick off the turn processing loop ---
        await this._processNextTurn();
    }


    /**
     * Core method to process the next turn or start a new round.
     * Handles finding actors and starting the round if the queue is empty.
     * @private
     * @async
     */
    async _processNextTurn() {
        if (!this.#isRunning) {
            this.#logger.debug('#processNextTurn called while not running. Exiting.');
            return;
        }

        this.#logger.debug('GameLoop: #processNextTurn - Checking turn order state...');

        // Check if the current round's queue is empty (handles starting new rounds)
        // Uses ITurnOrderService.isEmpty
        if (this.#turnOrderService.isEmpty()) {
            this.#logger.info('GameLoop: Turn queue is empty. Ending current round and attempting to start a new one.');
            // Uses EntityManager.activeEntities
            const allEntities = Array.from(this.#entityManager.activeEntities.values());
            const actors = allEntities.filter(entity => entity.hasComponent(ACTOR_COMPONENT_ID));

            if (actors.length === 0) {
                this.#logger.error('GameLoop: Cannot start new round - no entities with ACTOR_COMPONENT_ID found.');
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: 'No active actors remaining. Game Over?',
                    type: 'error'
                });

                await this.stop(); // Uses ITurnOrderService.clearCurrentRound, IInputHandler.disable, etc.
                return; // <<< Added return after stop to prevent further execution
            }

            this.#logger.info(`GameLoop: Found ${actors.length} actors for the new round: [${actors.map(a => a.id).join(', ')}]`);

            try {
                const strategy = 'round-robin'; // TODO: Make configurable
                /** @type {TurnOrderStrategy} */
                const castStrategy = strategy;
                // Uses ITurnOrderService.startNewRound
                this.#turnOrderService.startNewRound(actors, castStrategy);
                this.#logger.info(`GameLoop: Successfully started new round using "${strategy}" strategy.`);
                // Recursively call to process the *first* turn of the *new* round
                await this._processNextTurn();
                return; // Exit after starting the new round processing

            } catch (error) {
                this.#logger.error(`GameLoop: Failed to start new round: ${error.message}`, error);
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: `Error starting new round: ${error.message}`,
                    type: 'error'
                });

                await this.stop();
                return; // <<< Added return after stop
            }
        }

        // --- If queue is NOT empty, process the next entity's turn ---
        this.#logger.debug('GameLoop: Turn queue is not empty. Getting next entity...');

        // Uses ITurnOrderService.getNextEntity
        const nextEntity = this.#turnOrderService.getNextEntity();

        // Handle null/undefined case (e.g., queue contained only lazily removed items)
        if (!nextEntity) {
            this.#logger.error('GameLoop: #processNextTurn - TurnOrderService reported not empty, but getNextEntity() returned null. Retrying process.');
            // Avoid infinite loop possibility by stopping if this happens unexpectedly
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: 'Internal Error: Turn order inconsistency detected.',
                type: 'error'
            });
            await this.stop();
            // await this._processNextTurn(); // Retry (Original - potentially risky)
            return; // Exit after initiating the retry or stop
        }

        // Update #currentTurnEntity
        this.#currentTurnEntity = nextEntity;
        const currentEntityId = this.#currentTurnEntity.id;

        // Log turn start
        this.#logger.info(`GameLoop: >>> Starting turn for Entity: ${currentEntityId} <<<`);
        await this.#eventBus.dispatch('turn:start', {entityId: currentEntityId}); // Dispatch turn start event

        // --- Player Turn Logic ---
        if (this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug(`GameLoop: Entity ${currentEntityId} is player-controlled. Preparing for input.`);
            // Uses IActionDiscoverySystem.getValidActions
            await this._discoverActionsForEntity(this.#currentTurnEntity);

            // Uses IInputHandler.enable (indirectly via promptInput)
            await this.promptInput(`Your turn, ${currentEntityId}. Enter command...`);
        } else {
            // --- AI/NPC Turn Logic (Placeholder Implementation as per Refined Ticket) ---
            this.#logger.info(`GameLoop: Entity ${currentEntityId} is AI controlled. Triggering AI logic (placeholder)...`);
            // Uses IActionDiscoverySystem.getValidActions
            await this._discoverActionsForEntity(this.#currentTurnEntity);

            // Placeholder AI Action (No IAiService call)
            this.#logger.warn(`GameLoop: AI (${currentEntityId}) taking placeholder 'wait' action.`);

            // Simulate ending the AI's turn immediately.
            const aiActionId = 'core:wait'; // Example placeholder action ID
            this.#logger.debug(`GameLoop: AI (${currentEntityId}) turn finished with action: ${aiActionId}.`);
            await this.#eventBus.dispatch('turn:end', {
                entityId: currentEntityId,
                actionTaken: aiActionId,
                success: true
            }); // Dispatch turn end event for AI

            // AI finishes its turn, immediately process the next turn in the loop.
            await this._processNextTurn();
        }
    }

    /**
     * Processes a command string submitted by the input handler or event bus *for a specific entity*.
     * Parses the command, executes the action, handles errors, and then triggers the processing of the next turn.
     * @param {Entity} actingEntity - The entity performing the command. MUST be `this.#currentTurnEntity`.
     * @param {string} command - The raw command string from the input.
     * @async
     */
    async processSubmittedCommand(actingEntity, command) {
        if (!this.#isRunning) {
            this.#logger.debug('processSubmittedCommand called while not running.');
            return;
        }

        // Verify the call is for the current turn entity (safety check)
        if (!actingEntity || actingEntity !== this.#currentTurnEntity) {
            this.#logger.error(`processSubmittedCommand called for ${actingEntity?.id} but current turn is ${this.#currentTurnEntity?.id}. State inconsistency?`);
            // If it's somehow a player turn but the wrong player sent the command, re-prompt the *correct* player.
            if (this.#currentTurnEntity && this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
                await this._discoverActionsForEntity(this.#currentTurnEntity); // Uses IActionDiscoverySystem
                await this.promptInput(); // Uses IInputHandler
            }
            // Do not proceed further with the incorrect entity's command.
            return;
        }

        // --- Disable input ---
        // Uses IInputHandler.disable
        this.#inputHandler.disable();
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Processing..."});

        this.#logger.debug(`Processing command: "${command}" for entity ${actingEntity.id}`);

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
            await this._discoverActionsForEntity(actingEntity); // Uses IActionDiscoverySystem
            await this.promptInput(); // Uses IInputHandler
            // **Do not** advance turn here.
            return; // <<< Explicitly return to prevent advancing turn

        } else {
            // --- Execute Valid Command ---
            actionIdTaken = parsedCommand.actionId;
            // Uses IActionExecutor.executeAction (indirectly via executeAction helper)
            const actionResult = await this.executeAction(actingEntity, parsedCommand);
            actionExecuted = true; // We attempted execution
            actionSuccess = actionResult?.success ?? false;
            this.#logger.debug(`Action ${actionIdTaken} completed for ${actingEntity.id}. Success: ${actionSuccess}.`);
        }

        // --- Turn End Logic ---
        // Only proceed if an action was actually executed (or attempted after successful parse)
        this.#logger.info(`GameLoop: <<< Ending turn for Entity: ${actingEntity.id} (Action: ${actionIdTaken ?? 'ParseError'}) >>>`);
        await this.#eventBus.dispatch('turn:end', { // Uses EventBus
            entityId: actingEntity.id,
            actionTaken: actionIdTaken,
            success: actionSuccess
        });

        // Advance the turn loop only after a successful parse and action attempt
        await this._processNextTurn();
    }

    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * Handles cases where the acting entity or location is missing.
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
            actingEntity: actingEntity,
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
            return result;


        } catch (error) {
            this.#logger.error(`Error during execution of action ${parsedCommand.actionId} for entity ${actingEntity.id}:`, error);
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Error performing action: ${error.message}`,
                type: 'error'
            });
            return {
                success: false,
                messages: [{text: `Exception during action execution: ${error.message}`, type: 'internal'}]
            };
        }
    }


    /**
     * Discovers available actions for a specific entity based on the current state
     * via ActionDiscoverySystem and dispatches the result via the EventBus.
     * @private
     * @param {Entity} actingEntity - The entity whose actions are being discovered.
     * @async
     */
    async _discoverActionsForEntity(actingEntity) {
        if (!this.#isRunning) {
            this.#logger.debug('_discoverActionsForEntity called while not running.');
            return;
        }
        if (!actingEntity) {
            this.#logger.warn('Cannot discover actions: No valid acting entity provided.');
            // Uses IValidatedEventDispatcher.dispatchValidated
            // Dispatch with null entityId to indicate no specific entity context
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                actions: [],
                entityId: null
            });
            return;
        }

        const entityId = actingEntity.id;
        let validActions = [];

        this.#logger.debug(`Attempting to discover actions for entity ${entityId}...`);
        try {
            // Uses IGameStateManager.getCurrentLocation
            const currentLocation = this.#gameStateManager.getCurrentLocation(entityId);

            if (!currentLocation) {
                this.#logger.error(`Cannot discover actions for ${entityId}: Current location for this entity is missing from GameStateManager.`);
                const payload = {actions: [], entityId: entityId};
                // Uses IValidatedEventDispatcher.dispatchValidated
                await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', payload);
                this.#logger.debug(`Dispatched ${'event:update_available_actions'} for ${entityId} with 0 actions (missing location).`);
                return;
            }

            /** @type {ActionContext} */
            const discoveryContext = {
                actingEntity: actingEntity,
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
    }


    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * Should only be called when it's a player's turn.
     * @param {string} [message="Enter command..."] - Placeholder text for the input field.
     */
    async promptInput(message = 'Enter command...') { // Made async to match dispatcher
        this.#logger.debug(`METHOD promptInput ENTRY: Reading this.#isRunning = ${this.#isRunning}`);

        if (!this.#isRunning) {
            this.#logger.debug('promptInput called while not running.');
            return;
        }

        // Double check it's still the correct player entity's turn before enabling input
        if (!this.#currentTurnEntity || !this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug(`promptInput called, but it's not a player's turn (Current: ${this.#currentTurnEntity?.id ?? 'None'}). Input remains disabled.`);
            // Ensure input handler is disabled if we reach here unexpectedly
            // Uses IInputHandler.disable
            this.#inputHandler.disable();
            // Uses IValidatedEventDispatcher.dispatchValidated
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting for others..."});
            return;
        }

        this.#logger.debug(`METHOD promptInput: Conditions passed, enabling input for ${this.#currentTurnEntity.id}...`);

        // Uses IInputHandler.enable
        this.#inputHandler.enable();

        // Dispatch event for the UI to enable its input field
        const payload = {
            placeholder: message,
            entityId: this.#currentTurnEntity.id // Include entityId for UI context
        };
        // Uses IValidatedEventDispatcher.dispatchValidated
        await this.#validatedEventDispatcher.dispatchValidated('textUI:enable_input', payload);
        this.#logger.debug(`Input enabled via 'textUI:enable_input' event for entity ${this.#currentTurnEntity.id}. Placeholder: "${message}"`);
    }

    /**
     * Stops the game loop, disables input handler, clears turn state, and dispatches events for UI updates.
     */
    async stop() { // Made async to match dispatcher
        if (!this.#isRunning) {
            this.#logger.info('GameLoop: Stop called, but already stopped.');
            return;
        }
        this.#isRunning = false;
        const stopMessage = 'Game stopped.';
        this.#logger.info(`GameLoop: Stopping... Message: "${stopMessage}"`);

        // Disable Input Handler
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

        // Clear turn order state
        if (this.#turnOrderService) {
            // Uses ITurnOrderService.clearCurrentRound (optional method check)
            if (typeof this.#turnOrderService.clearCurrentRound === 'function') {
                try {
                    // Call the method - this should now be caught by the test
                    this.#turnOrderService.clearCurrentRound();
                    this.#logger.debug('GameLoop: Cleared current round state in TurnOrderService via clearCurrentRound().');
                } catch (e) {
                    this.#logger.error('GameLoop: Error calling turnOrderService.clearCurrentRound() during stop:', e);
                }
            } else {
                this.#logger.warn('GameLoop: TurnOrderService clearCurrentRound method not found. Turn state might persist.');
            }
        }

        // Reset internal loop state
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
        // Use optional chaining for logger in case it wasn't fully initialized during early errors
        this.#logger?.debug(`[_test_setRunning]: Setting #isRunning to ${value}`);
        this.#isRunning = value;
    }

    /**
     * @private
     * @description **FOR TESTING PURPOSES ONLY.** Sets the internal current turn entity.
     * @param {Entity | null} entity - The entity to set as current.
     */
    _test_setCurrentTurnEntity(entity) {
        // Use optional chaining for logger
        this.#logger?.debug(`[_test_setCurrentTurnEntity]: Setting #currentTurnEntity to ${entity?.id ?? null}`);
        this.#currentTurnEntity = entity;
    }
}

export default GameLoop;