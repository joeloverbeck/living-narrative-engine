// GameLoop.js
import { NameComponent } from './src/components/nameComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';
import { ConnectionsComponent } from "./src/components/connectionsComponent.js";
// ... import other necessary components ...
import ActionExecutor from './src/actions/actionExecutor.js';

/** @typedef {import('./src/actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./src/actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('./domRenderer.js').LocationRenderData} LocationRenderData */

/**
 * GameLoop orchestrates the main game flow.
 * It holds core game state (player, location), manages dependencies
 * (DataManager, EntityManager), processes user input via InputHandler/CommandParser,
 * delegates action execution to ActionExecutor, processes the results (updating state
 * based on ActionResult.newState), and manages rendering via the Renderer.
 * It ensures action logic resides in handlers and state management follows the
 * defined Context/Result pattern.
 */
class GameLoop {
    /**
     * @param {import('./dataManager.js').default} dataManager
     * @param {import('./src/entities/entityManager.js').default} entityManager
     * @param {object} renderer - An object implementing the IGameRenderer interface (like DomRenderer).
     * @param {import('./InputHandler.js').default} inputHandler - The handler for user input events.
     * @param {CommandParser} commandParser // +++ Add commandParser parameter
     * @param {ActionExecutor} actionExecutor
     */
    constructor(dataManager, entityManager, renderer, inputHandler, commandParser, actionExecutor) {
        // --- Validate constructor arguments ---
        if (!dataManager) throw new Error("GameLoop requires DataManager.");
        if (!entityManager) throw new Error("GameLoop requires EntityManager.");
        if (!renderer || typeof renderer.renderMessage !== 'function' || typeof renderer.renderLocation !== 'function' || typeof renderer.setInputState !== 'function') {
            // Basic check for renderer interface compliance
            throw new Error("GameLoop requires a valid renderer object.");
        }
        if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function') {
            throw new Error("GameLoop requires a valid InputHandler object.");
        }
        if (!commandParser || typeof commandParser.parse !== 'function') {
            throw new Error("GameLoop requires a valid CommandParser object.");
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error("GameLoop requires a valid ActionExecutor object.");
        }

        this.dataManager = dataManager;
        this.entityManager = entityManager;
        this.renderer = renderer;       // +++ Store the renderer instance
        this.inputHandler = inputHandler; // +++ Store the handler instance
        this.commandParser = commandParser;
        this.actionExecutor = actionExecutor;

        /** @type {import('./src/entities/entity.js').default | null} */
        this.playerEntity = null;
        /** @type {import('./src/entities/entity.js').default | null} */
        this.currentLocation = null;
        this.isRunning = false;
    }

    /**
     * Initializes the game loop, sets up the player, and starts the first turn.
     */
    async initializeAndStart() {
        console.log("GameLoop: Initializing...");

        this.playerEntity = this.entityManager.getEntityInstance('core:player');
        if (!this.playerEntity) {
            this.renderer.renderMessage("Error: Player entity 'core:player' not found!", "error");
            console.error("GameLoop: Could not find player entity 'core:player'.");
            this.stop();
            return;
        }

        const startLocationId = 'demo:room_entrance';
        // Use createEntityInstance directly here for the initial setup
        const startLocation = this.entityManager.createEntityInstance(startLocationId);
        if (!startLocation) {
            this.renderer.renderMessage(`Error: Starting location '${startLocationId}' not found!`, "error");
            console.error("GameLoop: Could not find or create entity instance for starting location:", startLocationId);
            this.stop();
            return;
        }
        this.currentLocation = startLocation; // Assign the instance

        console.log(`GameLoop: Player starting at ${this.currentLocation.id}`);

        this.isRunning = true;
        this.renderer.renderMessage("Welcome to Dungeon Run Demo!");
        // --- Display initial location ---
        // Look handler now manages formatting, but GameLoop triggers the initial look
        this.displayLocation(); // Display initial location info ONCE. Subsequent looks handled by LookActionHandler.

        this.promptInput();
        console.log("GameLoop: Started.");
    }

    /**
     * Gathers current location data and tells the renderer to display it.
     * This is now primarily for the *initial* display or forced redisplays,
     * as the 'look' action handler generates the description during gameplay.
     */
    displayLocation() {
        if (!this.currentLocation) {
            this.renderer.renderMessage("Error: Current location is not set.", "error");
            return;
        }

        // --- Gather Data (similar to LookActionHandler's room look) ---
        const nameComp = this.currentLocation.getComponent(NameComponent);
        const descComp = this.currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = this.currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${this.currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        let availableDirections = [];
        if (connectionsComp && Array.isArray(connectionsComp.connections) && connectionsComp.connections.length > 0) {
            availableDirections = connectionsComp.connections
                .map(conn => conn.direction)
                .filter(dir => dir);
        }

        // --- Prepare Data Structure for Renderer ---
        /** @type {LocationRenderData} */
        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections,
        };

        // --- Call Renderer ---
        this.renderer.renderLocation(locationData); // Use the dedicated location renderer method
    }

    /**
     * Processes a command string submitted by the input handler.
     * @param {string} command - The raw command string from the input.
     */
    processSubmittedCommand(command) {
        if (!this.isRunning) return;

        // Echo command before processing
        this.renderer.renderMessage(`> ${command}`, "command");

        // --- Parse Command ---
        const parsedCommand = this.commandParser.parse(command);
        const { actionId, targets, originalInput } = parsedCommand;

        if (!actionId) {
            if (originalInput.trim().length > 0) {
                this.renderer.renderMessage("Unknown command. Try 'move [direction]', 'look', 'inventory', etc.", "error");
            }
            // Error message/unknown command handled
        } else {
            // --- Execute Action via Executor ---
            // Ensure player and location are set before executing actions that need them
            if (!this.playerEntity || !this.currentLocation) {
                console.error("GameLoop Error: Attempted to execute action before player/location were initialized!");
                this.renderer.renderMessage("Internal Error: Game state not fully initialized.", "error");
            } else {
                this.executeAction(actionId, targets); // Pass validated state
            }
        }

        // --- Always re-prompt if still running ---
        // This ensures input is re-enabled after any command (success, failure, unknown)
        // unless the game was stopped during execution.
        if (this.isRunning) {
            this.promptInput();
        }
    }

    /**
     * Prepares context and delegates action execution to the ActionExecutor.
     * Processes the ActionResult to update game state and render messages.
     *
     * @param {string} actionId - The ID of the action to execute (e.g., 'core:action_move').
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionId, targets) {
        // Null checks already performed in processSubmittedCommand if required
        if (!this.playerEntity || !this.currentLocation) {
            // This case should be prevented by checks in processSubmittedCommand
            console.error("executeAction called with null playerEntity or currentLocation.");
            return; // Or throw error
        }

        console.log(`GameLoop: Executing action: ${actionId}, Targets: ${targets.join(', ')}`);

        // --- Check if action definition exists (optional but good sanity check) ---
        const actionDefinition = this.dataManager.getAction(actionId);
        if (!actionDefinition) {
            // This indicates an issue where the parser recognized an actionId
            // but the corresponding data file wasn't loaded or is incorrect.
            console.error(`GameLoop: Action definition NOT FOUND for ID: ${actionId}. Parser produced this ID, but data is missing.`);
            this.renderer.renderMessage(`Internal Error: System configuration issue for action '${actionId}'.`, "error");
            return; // Halt execution of this action
        }

        // --- Prepare Action Context ---
        /** @type {ActionContext} */
        const context = {
            // Provide all necessary state and dependencies to the handler
            playerEntity: this.playerEntity,
            currentLocation: this.currentLocation,
            targets: targets,
            dataManager: this.dataManager,
            entityManager: this.entityManager,
        };

        // --- Delegate to Action Executor ---
        /** @type {ActionResult} */
        const result = this.actionExecutor.executeAction(actionId, context);
        // console.debug("Action Result:", result); // Optional debug log

        // --- Process Action Result ---
        // 1. Render messages
        if (result.messages && Array.isArray(result.messages)) {
            result.messages.forEach(msg => {
                // Add default type if missing
                const type = msg.type || 'info';
                this.renderer.renderMessage(msg.text, type)
            });
        } else {
            console.warn(`Action ${actionId} returned invalid/missing messages array.`);
        }

        // 2. Apply state changes ONLY if signaled via newState
        if (result.newState) {
            console.log("GameLoop: Processing newState from action result:", result.newState);
            // Handle location change request
            if (typeof result.newState.currentLocationId === 'string') {
                const newLocationId = result.newState.currentLocationId;
                console.log(`GameLoop: Handler requested location change to: ${newLocationId}`);

                // Get/Create the entity instance for the new location
                const newLocation = this.entityManager.createEntityInstance(newLocationId);

                if (newLocation) {
                    // --- State Update ---
                    this.currentLocation = newLocation; // Update GameLoop's state
                    console.log(`GameLoop: Successfully updated currentLocation to ${this.currentLocation.id}`);

                    // --- Post-State-Update Action ---
                    // Display the details of the *new* location after the move is complete.
                    this.displayLocation();

                } else {
                    // Handler indicated success moving to a location, but it couldn't be instantiated.
                    console.error(`GameLoop: Failed to get/create entity instance for target location ID: ${newLocationId} (requested by handler for ${actionId}).`);
                    this.renderer.renderMessage("There seems to be a problem with where you were trying to go. You remain here.", "error");
                    // Potentially consider reverting other side-effects if the action was complex
                }
            }
            // Handle other potential newState flags here...
            // if (result.newState.playerRespawn) { /* ... handle respawn ... */ }
        }

        // 3. (Future) Dispatch Events
        // if (result.eventsToDispatch) { ... }

        // --- Input prompt is now handled uniformly after command processing ---
    }

    /**
     * Checks for and executes simple event triggers.
     * Placeholder for future phases.
     * @private
     */
    checkTriggers() {
        // TODO: Implement in Phase 2+ based on data definitions
    }

    /**
     * Dispatches a game event. Basic placeholder for MVP.
     * @param {string} eventName The name of the event (e.g., 'event:room_entered').
     * @param {object} eventData Associated data for the event.
     */
    dispatchGameEvent(eventName, eventData) {
        console.log(`Game Event Dispatched: ${eventName}`, eventData);
        // TODO: Integrate with a proper Event Bus in Phase 2+
    }

    /**
     * Enables input and updates visual state via renderer.
     */
    promptInput(message = "Enter command...") {
        if (!this.isRunning) return;
        this.inputHandler.enable();
        this.renderer.setInputState(true, message);
    }

    /**
     * Stops the game loop and updates visual state via renderer.
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        const stopMessage = "Game stopped.";
        this.inputHandler.disable();
        if (this.renderer) {
            this.renderer.setInputState(false, stopMessage);
            this.renderer.renderMessage(stopMessage, "info");
        }
        console.log("GameLoop: Stopped.");
    }
}

export default GameLoop;