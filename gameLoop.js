// GameLoop.js

// ... import other necessary components ...

/** @typedef {import('./src/actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./src/actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('./src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./InputHandler.js').default} InputHandler */
/** @typedef {import('./commandParser.js').default} CommandParser */
/** @typedef {import('./src/actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./src/actions/actionResultProcessor.js').default} ActionResultProcessor */

/** @typedef {import('./eventBus.js').default} EventBus */

// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {DataManager} dataManager - Manages game data loading and access.
 * @property {EntityManager} entityManager - Manages entity creation and components.
 * @property {GameStateManager} gameStateManager - Manages core game state (player, location).
 * @property {InputHandler} inputHandler - Handles raw user input.
 * @property {CommandParser} commandParser - Parses user input into actions.
 * @property {ActionExecutor} actionExecutor - Executes game actions.
 * @property {EventBus} eventBus - Facilitates decoupled communication.
 */

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies, processes user input, delegates action execution,
 * processes results, and relies on the EventBus for decoupled communication.
 * Assumes GameInitializer has successfully set up the initial game state.
 */
class GameLoop {
    #dataManager;
    #entityManager;
    #gameStateManager;
    #inputHandler;
    #commandParser;
    #actionExecutor;
    #actionResultProcessor;
    #eventBus;

    #isRunning = false;

    /**
     * @param {GameLoopOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        // --- Destructure and Validate constructor arguments ---
        // (Constructor logic remains the same - dependencies are still needed for execution)
        const {
            dataManager,
            entityManager,
            gameStateManager,
            inputHandler,
            commandParser,
            actionExecutor,
            actionResultProcessor,
            eventBus
        } = options || {};

        if (!dataManager) throw new Error("GameLoop requires options.dataManager.");
        if (!entityManager) throw new Error("GameLoop requires options.entityManager.");
        if (!gameStateManager) throw new Error("GameLoop requires options.gameStateManager.");
        if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function') {
            throw new Error("GameLoop requires a valid options.inputHandler object.");
        }
        if (!commandParser || typeof commandParser.parse !== 'function') {
            throw new Error("GameLoop requires a valid options.commandParser object.");
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error("GameLoop requires a valid options.actionExecutor object.");
        }
        if (!actionResultProcessor || typeof actionResultProcessor.process !== 'function') {
            throw new Error("GameLoop requires a valid options.actionResultProcessor object.");
        }
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
            throw new Error("GameLoop requires a valid options.eventBus object.");
        }

        this.#dataManager = dataManager;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#inputHandler = inputHandler;
        this.#commandParser = commandParser;
        this.#actionExecutor = actionExecutor;
        this.#actionResultProcessor = actionResultProcessor;
        this.#eventBus = eventBus;

        this.#isRunning = false; // Initialize running state
        console.log("GameLoop: Instance created (using options object). Ready to start.");
    }

    /**
     * Starts the main game loop, enabling input processing.
     * Assumes GameInitializer has already run successfully.
     */
    start() {
        // Check if already running to prevent issues
        if (this.#isRunning) {
            console.warn("GameLoop: start() called but loop is already running.");
            return;
        }

        // --- Game state should be already set by GameInitializer ---
        // Perform a basic check just in case.
        if (!this.#gameStateManager.getPlayer() || !this.#gameStateManager.getCurrentLocation()) {
            const errorMsg = "Critical Error: GameLoop cannot start because initial game state (player/location) is missing!";
            console.error("GameLoop:", errorMsg);
            this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: "error"});
            // Attempt to stop cleanly even though it didn't start properly
            this.stop();
            return;
        }

        this.#isRunning = true;
        console.log("GameLoop: Started.");

        // Prompt for the first command *after* the loop is marked as running.
        this.promptInput();
    }


    /**
     * Processes a command string submitted by the input handler.
     * Parses the command, executes the corresponding action, and prompts for the next input.
     * @param {string} command - The raw command string from the input.
     */
    processSubmittedCommand(command) {
        if (!this.#isRunning) return;

        const parsedCommand = this.#commandParser.parse(command);
        const {actionId, targets, originalInput} = parsedCommand;

        if (!actionId) {
            if (originalInput.trim().length > 0) {
                // Dispatch unknown command message via EventBus
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Unknown command. Try 'move [direction]', 'look', 'inventory', etc.",
                    type: "error"
                });
            }
            // Still prompt for input even if command was unknown/empty
        } else {
            if (!this.#gameStateManager.getPlayer() || !this.#gameStateManager.getCurrentLocation()) {
                console.error("GameLoop Error: Attempted to execute action but game state is missing!");
                // Dispatch internal error message via EventBus
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Internal Error: Game state not fully initialized.",
                    type: "error"
                });
            } else {
                this.executeAction(actionId, targets); // State confirmed available
            }
        }

        // Prompt for next command IF still running
        if (this.#isRunning) {
            this.promptInput();
        }
    }

    /**
     * Prepares context, delegates action execution, processes state changes via ActionResultProcessor,
     * triggers follow-up 'look' on location change, and relies on handlers/EventBus for messages.
     * @param {string} actionId - The ID of the action to execute.
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionId, targets) {
        const currentPlayer = this.#gameStateManager.getPlayer();
        // Get current location *before* the action executes, in case the action needs it
        const currentLocationBeforeAction = this.#gameStateManager.getCurrentLocation();

        if (!currentPlayer || !currentLocationBeforeAction) {
            console.error("executeAction called but state missing from GameStateManager.");
            this.#eventBus.dispatch('ui:message_display', {
                text: "Internal Error: Game state inconsistent.",
                type: "error"
            });
            return;
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: currentPlayer,
            currentLocation: currentLocationBeforeAction, // Provide the location at the start of the action
            targets: targets,
            dataManager: this.#dataManager,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus)
        };

        /** @type {ActionResult} */
        const result = this.#actionExecutor.executeAction(actionId, context);

        // --- Process Action Result using the dedicated processor ---
        const processResult = this.#actionResultProcessor.process(result);

        // --- Trigger 'look' action automatically AFTER a successful location change ---
        // --- Use the result from the processor to make the decision ---
        if (processResult.locationChanged) {
            // console.log("GameLoop: Location changed, executing automatic 'look'."); // Verbose
            // Execute look action non-recursively.
            // NOTE: 'look' action itself should use GameStateManager.getCurrentLocation()
            // to get the *new* location when it executes.
            this.executeAction('core:action_look', []);
        }

    }

    /**
     * Enables the input handler and dispatches an event to update the UI input state.
     */
    promptInput(message = "Enter command...") {
        if (!this.#isRunning) return;
        this.#inputHandler.enable(); // Logically enable input capture
        // Dispatch event for UI update
        this.#eventBus.dispatch('ui:enable_input', {placeholder: message});
    }

    /**
     * Stops the game loop, disables input handler, and dispatches events for UI updates.
     */
    stop() {
        if (!this.#isRunning) return;
        this.#isRunning = false;
        const stopMessage = "Game stopped.";

        this.#inputHandler.disable(); // Logically disable input capture

        // Dispatch events for UI updates
        this.#eventBus.dispatch('ui:disable_input', {message: stopMessage});
        this.#eventBus.dispatch('ui:message_display', {text: stopMessage, type: 'info'});

        console.log("GameLoop: Stopped.");
    }

    /**
     * Gets the current running state.
     * @returns {boolean}
     */
    get isRunning() {
        return this.#isRunning;
    }
}

export default GameLoop;