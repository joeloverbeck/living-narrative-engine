// src/core/GameLoop.js

// --- Existing imports ---
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */ // Added for type hinting
/** @typedef {import('../core/services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./commandParser.js').default} CommandParser */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./eventBus.js').default} EventBus */

// --- Define the options object structure ---
/**
 * @typedef {object} GameLoopOptions
 * @property {GameDataRepository} gameDataRepository - Manages game data loading and access.
 * @property {EntityManager} entityManager - Manages entity creation and components.
 * @property {GameStateManager} gameStateManager - Manages core game state (player, location).
 * @property {InputHandler} inputHandler - Handles raw user input.
 * @property {CommandParser} commandParser - Parses user input into actions.
 * @property {ActionExecutor} actionExecutor - Executes game actions.
 * @property {EventBus} eventBus - Facilitates decoupled communication.
 */

import {EVENT_DISPLAY_MESSAGE} from "../types/eventTypes.js";

/**
 * GameLoop orchestrates the main game flow *after* initialization.
 * It manages dependencies, processes user input, delegates action execution,
 * processes results, and relies on the EventBus for decoupled communication.
 * Assumes GameInitializer has successfully set up the initial game state.
 */
class GameLoop {
    #gameDataRepository;
    #entityManager;
    #gameStateManager;
    #inputHandler;
    #commandParser;
    #actionExecutor;
    #eventBus;

    #isRunning = false;

    /**
     * @param {GameLoopOptions} options - Configuration object containing all dependencies.
     */
    constructor(options) {
        // --- Destructure and Validate constructor arguments ---
        const {
            gameDataRepository: gameDataRepository,
            entityManager,
            gameStateManager,
            inputHandler,
            commandParser,
            actionExecutor,
            eventBus
        } = options || {};

        if (!gameDataRepository) throw new Error("GameLoop requires options.gameDataRepository.");
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
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') {
            throw new Error("GameLoop requires a valid options.eventBus object.");
        }

        this.#gameDataRepository = gameDataRepository;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#inputHandler = inputHandler;
        this.#commandParser = commandParser;
        this.#actionExecutor = actionExecutor;
        this.#eventBus = eventBus;

        this.#isRunning = false; // Initialize running state

        this.#subscribeToEvents();

        console.log("GameLoop: Instance created (using options object). Ready to start.");
    }

    /**
     * Sets up necessary event bus subscriptions for the GameLoop.
     * @private
     */
    #subscribeToEvents() {
        // Listen for commands submitted internally (e.g., from UI buttons)
        this.#eventBus.subscribe('command:submit', this.#handleSubmittedCommandFromEvent.bind(this));
        console.log("GameLoop: Subscribed to 'command:submit' event.");

        // Add any other GameLoop-specific subscriptions here if needed in the future
    }

    /**
     * Handles commands received via the 'command:submit' event (e.g., from UI).
     * @private
     * @param {{command: string}} eventData - The event payload containing the command string.
     */
    #handleSubmittedCommandFromEvent(eventData) {
        if (!this.#isRunning) {
            console.warn("GameLoop received command submission via event, but loop is not running.");
            return;
        }
        if (eventData && typeof eventData.command === 'string') {
            // Optional: Echo command if needed (DomRenderer doesn't echo its own commands)
            // this.#eventBus.dispatch('ui:command_echo', { command: eventData.command });

            // Process the command using the main processing logic
            console.log(`GameLoop: Received command via event: "${eventData.command}"`);
            this.processSubmittedCommand(eventData.command);
        } else {
            console.warn("GameLoop received invalid 'command:submit' event data:", eventData);
            // Still prompt for input if the event data was bad
            this.promptInput();
        }
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
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: errorMsg, type: "error"});

            // --- Perform necessary "stop-like" cleanup directly ---
            // Ensure isRunning remains false (it is already, but for clarity)
            this.#isRunning = false; // Should already be false, but ensures consistency
            const stopMessage = "Game stopped."; // Use a consistent message if needed by UI

            // Mimic essential stop() cleanup actions needed when start fails:
            // We need to ensure input is disabled if start fails before enabling it.
            this.#inputHandler.disable();
            // Notify UI that input should be disabled (matching stop behavior)
            this.#eventBus.dispatch('ui:disable_input', {message: stopMessage});
            // Optionally, notify user game stopped here too, like in stop()
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: stopMessage, type: 'info'});

            return; // Exit start method
        }

        // --- If checks pass, proceed with starting ---
        this.#isRunning = true;
        console.log("GameLoop: Started.");

        // Prompt for the first command *after* the loop is marked as running.
        this.promptInput();
    }


    /**
     * Processes a command string submitted by the input handler or event bus.
     * Parses the command, handles parsing errors, executes the corresponding action
     * if valid, and prompts for the next input.
     * @param {string} command - The raw command string from the input.
     */
    processSubmittedCommand(command) {
        if (!this.#isRunning) return; // Don't process if not running

        // AC1: Retrieve the full ParsedCommand object
        const parsedCommand = this.#commandParser.parse(command);

        // AC2: Check for parsing errors reported by the parser
        if (parsedCommand.error) {
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: parsedCommand.error, // Use the specific error from the parser
                type: "error"
            });
            // Prompt for next command and stop processing this one
            this.promptInput();
            return;
        }

        // AC3: Handle cases where parsing didn't find an action but didn't set a specific error
        // (e.g., unknown command, or just whitespace entered which results in null actionId)
        if (!parsedCommand.actionId) {
            // Only show "Unknown command" if the user actually typed something
            if (parsedCommand.originalInput.trim().length > 0) {
                this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                    text: "Unknown command. Try 'help'.", // Generic unknown command message
                    type: "error"
                });
            }
            // Prompt for next command and stop processing this one
            this.promptInput();
            return;
        }

        // --- If we reach here, parsing was successful and we have a valid actionId ---

        // AC4: Use parsedCommand.actionId (implicit in passing it to executeAction)

        // Check game state consistency before execution
        if (!this.#gameStateManager.getPlayer() || !this.#gameStateManager.getCurrentLocation()) {
            console.error("GameLoop Error: Attempted to execute action but game state is missing!");
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: "Internal Error: Game state not fully initialized.",
                type: "error"
            });
            // Prompt for next command even after internal error
            this.promptInput();
            return;
        }

        // AC5: Pass the entire parsedCommand object to executeAction
        this.executeAction(parsedCommand.actionId, parsedCommand); // State confirmed available

        // AC8: Prompt for next command IF still running (promptInput checks #isRunning internally)
        // This is called *after* executeAction has finished
        this.promptInput();
    }

    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * @private
     * @param {string} actionId - The ID of the action to execute.
     * @param {ParsedCommand} parsedCommand - The full parsed command object from the parser.
     */
    executeAction(actionId, parsedCommand) { // AC5: Signature updated
        const currentPlayer = this.#gameStateManager.getPlayer();
        const currentLocationBeforeAction = this.#gameStateManager.getCurrentLocation();

        // This state check is slightly redundant due to the check in processSubmittedCommand,
        // but provides an extra layer of safety.
        if (!currentPlayer || !currentLocationBeforeAction) {
            console.error("GameLoop executeAction called but state missing from GameStateManager.");
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: "Internal Error: Game state inconsistent.",
                type: "error"
            });
            return; // Don't proceed if state is missing here
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: currentPlayer,
            currentLocation: currentLocationBeforeAction,
            // targets: targets, // AC7: Removed obsolete targets array
            parsedCommand: parsedCommand, // AC6: Added the full parsedCommand object
            gameDataRepository: this.#gameDataRepository,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
            eventBus: this.#eventBus
            // Note: The ActionContext type definition (Ticket 4.1) must match this structure
        };

        // Execute the action via the ActionExecutor
        // We don't directly use the ActionResult here in GameLoop anymore,
        // as state changes (like location) and messages are primarily handled via events.
        /** @type {ActionResult} */
        this.#actionExecutor.executeAction(actionId, context);

        // Potential future use: Process ActionResult if needed for things not handled by events.
        // For now, action results primarily signal success/failure internally or trigger events.
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
        // Only perform stop actions if the loop IS currently running
        if (!this.#isRunning) {
            // console.log("GameLoop: stop() called but loop was not running."); // Optional logging
            return;
        }

        // If we reach here, the loop WAS running. Mark it as stopped NOW.
        this.#isRunning = false;
        const stopMessage = "Game stopped.";

        // Perform ALL cleanup actions associated with stopping.
        this.#inputHandler.disable(); // Logically disable input capture
        this.#eventBus.dispatch('ui:disable_input', {message: stopMessage});
        this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: stopMessage, type: 'info'});

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