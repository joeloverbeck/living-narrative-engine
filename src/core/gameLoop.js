// --- Type Imports ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./commandParser.js').default} CommandParser */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../systems/actionDiscoverySystem.js').ActionDiscoverySystem} ActionDiscoverySystem */
/** @typedef {import('../core/services/consoleLogger.js').default} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../core/interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */


// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository
 * @property {EntityManager} entityManager
 * @property {GameStateManager} gameStateManager
 * @property {InputHandler} inputHandler
 * @property {CommandParser} commandParser
 * @property {ActionExecutor} actionExecutor
 * @property {EventBus} eventBus
 * @property {ActionDiscoverySystem} actionDiscoverySystem
 * @property {ValidatedEventDispatcher} validatedEventDispatcher
 * @property {ITurnOrderService} turnOrderService
 * @property {ILogger} logger
 */

import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../types/components.js";

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies, processes user input via a turn-based cycle,
 * delegates action execution, discovers available actions, and uses the EventBus.
 * Relies on TurnOrderService to manage whose turn it is and round progression.
 */
class GameLoop {
    #gameDataRepository;
    #entityManager;
    #gameStateManager;
    #inputHandler;
    #commandParser;
    #actionExecutor;
    #eventBus;
    #actionDiscoverySystem;
    #validatedEventDispatcher;
    #turnOrderService;
    #logger; // Only one declaration needed

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
            logger // Get logger from options
        } = options || {};

        // --- Validate and Assign Logger FIRST (so it can be used) ---
        if (!logger || typeof logger.info !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            // Use a temporary console logger for the warning itself if the provided logger is unusable
            const consoleLogger = console;
            consoleLogger.warn('GameLoop Constructor: Invalid logger provided (missing methods). Falling back to console.');
            this.#logger = consoleLogger; // Assign console as the fallback logger
        } else {
            this.#logger = logger; // Assign the validated logger
        }

        // --- Validate Other Dependencies (using the assigned this.#logger) ---
        if (!gameDataRepository) throw new Error('GameLoop requires options.gameDataRepository.');
        if (!entityManager) throw new Error('GameLoop requires options.entityManager.');
        if (!gameStateManager) throw new Error('GameLoop requires options.gameStateManager.');
        if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function') {
            throw new Error('GameLoop requires a valid options.inputHandler object.');
        }
        if (!commandParser || typeof commandParser.parse !== 'function') {
            throw new Error('GameLoop requires a valid options.commandParser object.');
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error('GameLoop requires a valid options.actionExecutor object.');
        }
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
            throw new Error('GameLoop requires a valid options.eventBus object.');
        }
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            throw new Error('GameLoop requires a valid options.actionDiscoverySystem object.');
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('GameLoop requires a valid options.validatedEventDispatcher object.');
        }
        if (!turnOrderService) {
            throw new Error('GameLoop requires options.turnOrderService.');
        }
        // Optional: More detailed check for TurnOrderService methods (can use this.#logger now)
        if (typeof turnOrderService.isEmpty !== 'function' || typeof turnOrderService.startNewRound !== 'function' || typeof turnOrderService.getNextEntity !== 'function') {
            this.#logger.warn('GameLoop Constructor: TurnOrderService provided, but missing expected methods (isEmpty, startNewRound, getNextEntity). Runtime errors may occur.');
        }


        // --- Assign Other Dependencies ---
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
        // No need to assign this.#logger again here - it was assigned during validation

        // --- Initialize State ---
        this.#isRunning = false;
        this.#currentTurnEntity = null;

        // --- Setup ---
        this.#subscribeToEvents(); // Use the assigned logger

        this.#logger.info('GameLoop: Instance created with dependencies (including TurnOrderService). Ready to start.');
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
                this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
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
            await this._discoverActionsForEntity(this.#currentTurnEntity);
            this.promptInput(); // Re-prompt with default message
            return; // Exit without advancing turn
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
        this.#eventBus.dispatch('game:started', {});

        // --- Kick off the turn processing loop ---
        await this._processNextTurn(); // CHANGED HERE
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
        if (this.#turnOrderService.isEmpty()) {
            this.#logger.info('GameLoop: Turn queue is empty. Ending current round and attempting to start a new one.');
            const allEntities = Array.from(this.#entityManager.activeEntities.values());
            const actors = allEntities.filter(entity => entity.hasComponent(ACTOR_COMPONENT_ID));

            if (actors.length === 0) {
                this.#logger.error('GameLoop: Cannot start new round - no entities with ACTOR_COMPONENT_ID found.');
                this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: 'No active actors remaining. Game Over?',
                    type: 'error'
                });
                this.stop();
                return;
            }

            this.#logger.info(`GameLoop: Found ${actors.length} actors for the new round: [${actors.map(a => a.id).join(', ')}]`);

            try {
                const strategy = 'round-robin'; // TODO: Make configurable
                /** @type {TurnOrderStrategy} */
                const castStrategy = strategy;
                this.#turnOrderService.startNewRound(actors, castStrategy);
                this.#logger.info(`GameLoop: Successfully started new round using "${strategy}" strategy.`);
                // Recursively call to process the *first* turn of the *new* round
                await this._processNextTurn();
                return; // Exit after starting the new round processing

            } catch (error) {
                this.#logger.error(`GameLoop: Failed to start new round: ${error.message}`, error);
                this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: `Error starting new round: ${error.message}`,
                    type: 'error'
                });
                this.stop();
                return;
            }
        }

        // --- If queue is NOT empty, process the next entity's turn ---
        this.#logger.debug('GameLoop: Turn queue is not empty. Getting next entity...');

        // [AC1] Gets next entity from TurnOrderService
        const nextEntity = this.#turnOrderService.getNextEntity();

        // Handle null/undefined case (e.g., queue contained only lazily removed items)
        if (!nextEntity) {
            this.#logger.error('GameLoop: #processNextTurn - TurnOrderService reported not empty, but getNextEntity() returned null. Retrying process.');
            await this._processNextTurn(); // Retry
            return; // Exit after initiating the retry
        }

        // Update #currentTurnEntity
        this.#currentTurnEntity = nextEntity;
        const currentEntityId = this.#currentTurnEntity.id;

        // Log turn start
        this.#logger.info(`GameLoop: >>> Starting turn for Entity: ${currentEntityId} <<<`);
        this.#eventBus.dispatch('turn:start', {entityId: currentEntityId}); // Dispatch turn start event

        // --- Player Turn Logic ---
        if (this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
            this.#logger.debug(`GameLoop: Entity ${currentEntityId} is player-controlled. Preparing for input.`);
            // Discover actions *before* prompting
            await this._discoverActionsForEntity(this.#currentTurnEntity);
            // Prompt for input
            this.promptInput(`Your turn, ${currentEntityId}. Enter command...`);
            // Pause the loop here, waiting for #handleSubmittedCommandFromEvent
            return; // IMPORTANT: Return here to pause the loop for player input

        } else {
            // --- AI/NPC Turn Logic (Placeholder Implementation as per Refined Ticket) ---
            this.#logger.info(`GameLoop: Entity ${currentEntityId} is AI controlled. Triggering AI logic (placeholder)...`);
            // [AC3] Discover actions for AI (might be needed for decision making later)
            await this._discoverActionsForEntity(this.#currentTurnEntity);

            // [AC4] Placeholder AI Action (No IAiService call)
            // For now, simulate a 'wait' action or similar simple turn consumption.
            this.#logger.warn(`GameLoop: AI (${currentEntityId}) taking placeholder 'wait' action.`);
            // Optional: Simulate AI taking some time
            // await new Promise(resolve => setTimeout(resolve, 50)); // Example delay

            // [AC5] Simulate ending the AI's turn immediately after the placeholder action.
            const aiActionId = 'core:wait'; // Example placeholder action ID
            this.#logger.debug(`GameLoop: AI (${currentEntityId}) turn finished with action: ${aiActionId}.`); // [AC2] Log end
            this.#eventBus.dispatch('turn:end', {entityId: currentEntityId, actionTaken: aiActionId, success: true}); // Dispatch turn end event for AI

            // [AC6] AI finishes its turn, immediately process the next turn in the loop.
            // #currentTurnEntity is implicitly handled by the next call assigning the next entity.
            await this._processNextTurn(); // Continue the loop for the next entity
        }
    }

    /**
     * Processes a command string submitted by the input handler or event bus *for a specific entity*.
     * Parses the command, executes the action, handles errors, and then triggers the processing of the next turn.
     * This method now contains the core logic previously described in the ticket for `#handleSubmittedCommandFromEvent`.
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
            // Attempt to recover by re-prompting if it was supposed to be a player turn
            if (this.#currentTurnEntity && this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
                await this._discoverActionsForEntity(this.#currentTurnEntity);
                this.promptInput();
            }
            return;
        }

        // --- Disable input ---
        this.#inputHandler.disable();
        this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Processing..."}); // Notify UI

        this.#logger.debug(`Processing command: "${command}" for entity ${actingEntity.id}`);

        // --- Parse Command ---
        const parsedCommand = this.#commandParser.parse(command);

        let actionExecuted = false;
        let actionSuccess = false;
        let actionIdTaken = null;

        if (parsedCommand.error || !parsedCommand.actionId) {
            // --- Handle Parse Error ---
            const message = parsedCommand.error ||
                (parsedCommand.originalInput.trim().length > 0 ? `Unknown command "${parsedCommand.originalInput}". Try 'help'.` : '');

            if (message) {
                this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                    text: message,
                    type: 'error'
                });
            }
            this.#logger.warn(`Command parsing failed for "${command}". Error: ${message || 'No action ID found.'}`);

            // Re-discover actions and re-prompt the player - Allow retry within turn
            await this._discoverActionsForEntity(actingEntity);
            this.promptInput(); // Re-enable input for retry
            // **Do not** advance turn here.
            return; // Exit early, turn does not advance on parse error

        } else {
            // --- Execute Valid Command ---
            actionIdTaken = parsedCommand.actionId;
            const actionResult = await this.executeAction(actingEntity, parsedCommand);
            actionExecuted = true; // We attempted execution
            actionSuccess = actionResult?.success ?? false;
            this.#logger.debug(`Action ${actionIdTaken} completed for ${actingEntity.id}. Success: ${actionSuccess}.`);
        }

        // --- Turn End Logic ---
        // Regardless of action success/failure (as long as parsing was ok), the turn is consumed.
        this.#logger.info(`GameLoop: <<< Ending turn for Entity: ${actingEntity.id} (Action: ${actionIdTaken ?? 'ParseError'}) >>>`);
        this.#eventBus.dispatch('turn:end', {
            entityId: actingEntity.id,
            actionTaken: actionIdTaken,
            success: actionSuccess
        }); // Dispatch turn end event

        // Clear the current turn entity state is handled by #processNextTurn assigning the *next* entity
        // Do NOT clear `this.#currentTurnEntity = null;` here.

        // Advance the turn loop
        await this._processNextTurn();
    }

    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * @private
     * @param {Entity} actingEntity - The entity performing the action.
     * @param {ParsedCommand} parsedCommand - The parsed command details.
     * @returns {Promise<ActionResult>} The result of the action execution.
     * @async
     */
    async executeAction(actingEntity, parsedCommand) {
        // Ensure GameStateManager provides the location for the *acting* entity
        // Assuming GameStateManager's getCurrentLocation doesn't need the entity ID,
        // or if it does, it should be passed. Adjust if GameStateManager changes.
        // Let's assume for now it provides a global 'current location' relevant to the player's viewpoint
        // or perhaps the location of the *actingEntity* if it can resolve it.
        // Reverting to original assumption which seems more plausible in context:
        const currentLocation = this.#gameStateManager.getCurrentLocation(/* actingEntity.id */); // Passing ID might be needed depending on GameStateManager impl.


        if (!actingEntity || !currentLocation) {
            const missing = [];
            if (!actingEntity) missing.push('acting entity');
            // If currentLocation depends on actingEntity.id, the error message should reflect that.
            if (!currentLocation) missing.push(`current location context`);
            const errorMsg = `GameLoop executeAction called but state missing: ${missing.join(' and ')}.`;
            this.#logger.error(errorMsg);
            this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
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
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus), // Bind dispatch to eventBus instance
            eventBus: this.#eventBus,
            logger: this.#logger, // Provide logger to actions
        };

        this.#logger.debug(`Executing action: ${parsedCommand.actionId} for entity ${actingEntity.id}`);

        try {
            const result = await this.#actionExecutor.executeAction(parsedCommand.actionId, context);

            // TODO: Process result.newState if applicable (e.g., location change)
            // Should likely be handled by events dispatched from the action handler itself.

            // Basic validation of the returned result structure
            return result && typeof result.success === 'boolean'
                ? result
                : {
                    success: false,
                    messages: [{
                        text: `Action ${parsedCommand.actionId} execution returned invalid result structure.`,
                        type: 'internal'
                    }]
                };

        } catch (error) {
            this.#logger.error(`Error during execution of action ${parsedCommand.actionId} for entity ${actingEntity.id}:`, error);
            this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', {
                text: `Error performing action: ${error.message}`, // Be cautious about revealing internal details.
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
            this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                actions: [],
                entityId: null
            });
            return;
        }

        const entityId = actingEntity.id;
        let validActions = [];

        this.#logger.debug(`Attempting to discover actions for entity ${entityId}...`);
        try {
            // Assuming GameStateManager needs the entity ID to find *its* location
            const currentLocation = this.#gameStateManager.getCurrentLocation(/* Needs entity ID? */ entityId);

            if (!currentLocation) {
                // If location depends on the entity, specify that in the error
                this.#logger.error(`Cannot discover actions for ${entityId}: Current location for this entity is missing from GameStateManager.`);
                const payload = {actions: [], entityId: entityId};
                this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', payload);
                this.#logger.debug(`Dispatched ${'event:update_available_actions'} for ${entityId} with 0 actions (missing location).`);
                return;
            }

            /** @type {ActionContext} */
            const discoveryContext = {
                actingEntity: actingEntity,
                currentLocation: currentLocation,
                entityManager: this.#entityManager,
                gameDataRepository: this.#gameDataRepository,
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
                eventBus: this.#eventBus,
                parsedCommand: undefined, // Explicitly undefined for discovery
                logger: this.#logger,
            };

            this.#logger.debug(`Calling ActionDiscoverySystem.getValidActions for entity ${entityId}`);
            validActions = await this.#actionDiscoverySystem.getValidActions(actingEntity, discoveryContext);
            this.#logger.debug(`ActionDiscoverySystem returned ${validActions.length} valid actions for ${entityId}.`);

        } catch (error) {
            this.#logger.error(`Error during action discovery for entity ${entityId}:`, error);
            validActions = []; // Ensure empty array on error
        } finally {
            // Always dispatch the result (even if empty or errored)
            const payload = {actions: validActions, entityId: entityId};
            this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', payload);
            this.#logger.debug(`Dispatched ${'event:update_available_actions'} for entity ${entityId} with ${validActions.length} actions.`);
        }
    }


    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     * Should only be called when it's a player's turn.
     * @param {string} [message="Enter command..."] - Placeholder text for the input field.
     */
    promptInput(message = 'Enter command...') {
        // *** DIAGNOSTIC LOGGING ***
        console.log(`METHOD promptInput ENTRY: Reading this.#isRunning = ${this.#isRunning}`);
        // You can also add the logger call if you want to verify the logger is working
        // this.#logger.debug(`METHOD promptInput ENTRY: Reading this.#isRunning = ${this.#isRunning}`);

        if (!this.#isRunning) {
            // This is the path currently being taken incorrectly
            this.#logger.debug('promptInput called while not running.');
            console.log(`METHOD promptInput: Condition (!this.#isRunning) is TRUE`); // LOG PATH
            return;
        }

        console.log(`METHOD promptInput: Condition (!this.#isRunning) is FALSE`); // LOG PATH

        // Double check it's still the correct player entity's turn before enabling input
        if (!this.#currentTurnEntity || !this.#currentTurnEntity.hasComponent(PLAYER_COMPONENT_ID)) {
            console.log(`METHOD promptInput: Condition (!player turn) is TRUE`); // LOG PATH
            this.#logger.debug(`promptInput called, but it's not a player's turn (Current: ${this.#currentTurnEntity?.id ?? 'None'}). Input remains disabled.`);
            // Ensure input is disabled if called erroneously
            this.#inputHandler.disable();
            this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {message: "Waiting for others..."});
            return;
        }

        console.log(`METHOD promptInput: Conditions passed, enabling input...`); // LOG PATH

        // Enable the backend input handler
        this.#inputHandler.enable();

        // Dispatch event for the UI to enable its input field
        const payload = {
            placeholder: message,
            entityId: this.#currentTurnEntity.id // Include entityId for UI context
        };
        this.#validatedEventDispatcher.dispatchValidated('textUI:enable_input', payload);
        this.#logger.debug(`Input enabled via 'textUI:enable_input' event for entity ${this.#currentTurnEntity.id}. Placeholder: "${message}"`);
    }

    /**
     * Stops the game loop, disables input handler, clears turn state, and dispatches events for UI updates.
     */
    stop() {
        if (!this.#isRunning) {
            this.#logger.info('GameLoop: Stop called, but already stopped.');
            return;
        }
        this.#isRunning = false;
        const stopMessage = 'Game stopped.';
        this.#logger.info(`GameLoop: Stopping... Message: "${stopMessage}"`);

        // Disable input handler and notify UI
        this.#inputHandler.disable();
        const disablePayload = {message: stopMessage};
        this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', disablePayload);

        // Display stop message
        const messagePayload = {text: stopMessage, type: 'info'};
        this.#validatedEventDispatcher.dispatchValidated('textUI:display_message', messagePayload);

        // Clear turn order state
        if (this.#turnOrderService) {
            // Use the helper method if available (preferred)
            if (typeof this.#turnOrderService.clearCurrentRound === 'function') {
                try {
                    this.#turnOrderService.clearCurrentRound();
                    this.#logger.debug('GameLoop: Cleared current round state in TurnOrderService via clearCurrentRound().');
                } catch (e) {
                    this.#logger.error('GameLoop: Error calling turnOrderService.clearCurrentRound() during stop:', e);
                }
            } else {
                // Fallback if clearCurrentRound isn't on the service (maybe just the interface?)
                // This might indicate an issue elsewhere, but attempt basic cleanup.
                this.#logger.warn('GameLoop: TurnOrderService clearCurrentRound method not found. Attempting basic queue clear if possible.');
                if (this.#turnOrderService && typeof this.#turnOrderService.clear === 'function') { // Check for underlying queue's clear
                    try {
                        // This is less ideal as it might not clear strategy state etc.
                        // this.#turnOrderService.clear(); // Might error if it's the service, not queue
                    } catch (e) {
                        // Ignore error here, was a fallback attempt
                    }
                }
            }
        }

        // Reset internal loop state
        this.#currentTurnEntity = null;

        // Dispatch a general game stopped event
        this.#eventBus.dispatch('game:stopped', {});

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
     * @description **FOR TESTING PURPOSES ONLY.** Sets the internal current turn entity.
     * @param {Entity | null} entity - The entity to set as current.
     */
    _test_setCurrentTurnEntity(entity) {
        this.#logger?.debug(`[_test_setCurrentTurnEntity]: Setting #currentTurnEntity to ${entity?.id ?? null}`);
        this.#currentTurnEntity = entity;
    }
}

export default GameLoop;