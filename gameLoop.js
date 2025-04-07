// GameLoop.js

import {EntitiesPresentComponent} from './src/components/entitiesPresentComponent.js';
// ... import other necessary components ...
import ActionExecutor from './src/actions/actionExecutor.js';
import EventBus from './eventBus.js';

/** @typedef {import('./src/actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./src/actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('./src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./InputHandler.js').default} InputHandler */
/** @typedef {import('./commandParser.js').default} CommandParser */

/** @typedef {import('./src/entities/entity.js').default} Entity */

/**
 * GameLoop orchestrates the main game flow.
 * It manages dependencies, processes user input, delegates action execution,
 * processes results (updating state via GameStateManager),
 * and relies on the EventBus for decoupled event communication.
 */
class GameLoop {
    #dataManager;
    #entityManager;
    #gameStateManager;
    #inputHandler;
    #commandParser;
    #actionExecutor;
    #eventBus;

    #isRunning = false;

    /**
     * @param {DataManager} dataManager
     * @param {EntityManager} entityManager
     * @param {GameStateManager} gameStateManager - Manages core game state.
     * @param {InputHandler} inputHandler - The handler for user input events.
     * @param {CommandParser} commandParser
     * @param {ActionExecutor} actionExecutor
     * @param {EventBus} eventBus
     */
    constructor(dataManager, entityManager, gameStateManager, inputHandler, commandParser, actionExecutor, eventBus) {
        // --- Validate constructor arguments ---
        if (!dataManager) throw new Error("GameLoop requires DataManager.");
        if (!entityManager) throw new Error("GameLoop requires EntityManager.");
        if (!gameStateManager) throw new Error("GameLoop requires a valid GameStateManager object.");
        if (!inputHandler || typeof inputHandler.enable !== 'function' || typeof inputHandler.disable !== 'function') {
            throw new Error("GameLoop requires a valid InputHandler object.");
        }
        if (!commandParser || typeof commandParser.parse !== 'function') {
            throw new Error("GameLoop requires a valid CommandParser object.");
        }
        if (!actionExecutor || typeof actionExecutor.executeAction !== 'function') {
            throw new Error("GameLoop requires a valid ActionExecutor object.");
        }
        if (!eventBus || typeof eventBus.dispatch !== 'function' || typeof eventBus.subscribe !== 'function') { // <-- Validate eventBus
            throw new Error("GameLoop requires a valid EventBus object.");
        }

        this.#dataManager = dataManager;
        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#inputHandler = inputHandler;
        this.#commandParser = commandParser;
        this.#actionExecutor = actionExecutor;
        this.#eventBus = eventBus;

        this.#isRunning = false; // Initialize running state
        console.log("GameLoop: Instance created.");
    }

    /**
     * Initializes the game loop, sets up the player, dispatches initial events,
     * triggers initial look, and prompts for input.
     */
    async initializeAndStart() {
        console.log("GameLoop: Initializing...");

        // Fetch player instance (already created in main.js, just retrieving)
        const player = this.#entityManager.getEntityInstance('core:player');
        if (!player) {
            // Use EventBus for error message
            this.#eventBus.dispatch('ui:message_display', {
                text: "Error: Player entity 'core:player' could not be retrieved!",
                type: "error"
            });
            console.error("GameLoop: Could not retrieve player entity 'core:player'.");
            this.stop(); // stop still dispatches events
            return;
        }
        this.#gameStateManager.setPlayer(player);

        // Fetch starting location instance
        const startLocationId = 'demo:room_entrance';
        const startLocation = this.#entityManager.createEntityInstance(startLocationId);
        if (!startLocation) {
            // Use EventBus for error message
            this.#eventBus.dispatch('ui:message_display', {
                text: `Error: Starting location '${startLocationId}' not found!`,
                type: "error"
            });
            console.error("GameLoop: Could not find or create entity instance for starting location:", startLocationId);
            this.stop();
            return;
        }
        this.#gameStateManager.setCurrentLocation(startLocation);

        // --- Get state from GameStateManager for subsequent operations ---
        const initialLocation = this.#gameStateManager.getCurrentLocation();
        const initialPlayer = this.#gameStateManager.getPlayer();

        if (!initialLocation || !initialPlayer) {
            console.error("GameLoop: State not set correctly in GameStateManager after init.");
            this.#eventBus.dispatch('ui:message_display', {
                text: "Internal Error: Failed to initialize game state.",
                type: "error"
            });
            this.stop();
            return;
        }

        this.ensureEntitiesPresentAreInstantiated(initialLocation);
        console.log(`GameLoop: Player starting at ${initialLocation.id}`);

        // --- Dispatch initial room entered event via EventBus ---
        this.#eventBus.dispatch('event:room_entered', { // <-- Use EventBus
            playerEntity: initialPlayer,
            newLocation: initialLocation
        });

        this.#isRunning = true;

        // Dispatch welcome message via EventBus
        this.#eventBus.dispatch('ui:message_display', {
            text: "Welcome to Dungeon Run Demo!",
            type: "info" // or a specific 'welcome' type
        });

        // Trigger initial 'look' action instead of calling displayLocation
        this.executeAction('core:action_look', []);

        // Prompt for input via EventBus
        this.promptInput();

        console.log("GameLoop: Started.");
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
     * Checks a location for EntitiesPresentComponent and ensures listed entities exist.
     * Dispatches warnings via EventBus if issues are found.
     * @param {Entity} locationEntity - The location entity instance.
     * @private
     */
    ensureEntitiesPresentAreInstantiated(locationEntity) {
        if (!locationEntity) return;
        const player = this.#gameStateManager.getPlayer();
        const presentComp = locationEntity.getComponent(EntitiesPresentComponent);

        if (presentComp && Array.isArray(presentComp.entityIds)) {
            presentComp.entityIds.forEach(entityId => {
                if (player && entityId === player.id) return; // Don't reinstantiate player
                const instance = this.#entityManager.createEntityInstance(entityId); // Ensures it exists
                if (!instance) {
                    const warningMsg = `Warning: Entity '${entityId}' listed in ${locationEntity.id} could not be found or created.`;
                    console.error(`GameLoop: Failed to ensure instance for entity ID '${entityId}' listed in location '${locationEntity.id}'.`);
                    // Dispatch warning via EventBus
                    this.#eventBus.dispatch('ui:message_display', {text: warningMsg, type: 'warning'});
                }
            });
        }
    }

    /**
     * Prepares context, delegates action execution, processes state changes,
     * triggers follow-up 'look' on location change, and relies on handlers/EventBus for messages.
     * @param {string} actionId - The ID of the action to execute.
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionId, targets) {
        const currentPlayer = this.#gameStateManager.getPlayer();
        let currentLocation = this.#gameStateManager.getCurrentLocation(); // Use let as it might change

        if (!currentPlayer || !currentLocation) {
            console.error("executeAction called but state missing from GameStateManager.");
            // Dispatch error via EventBus
            this.#eventBus.dispatch('ui:message_display', {
                text: "Internal Error: Game state inconsistent.",
                type: "error"
            });
            return;
        }

        // console.log(`GameLoop: Executing action: ${actionId}, Targets: ${targets.join(', ')}`); // Verbose

        /** @type {ActionContext} */
        const context = {
            playerEntity: currentPlayer,
            currentLocation: currentLocation,
            targets: targets,
            dataManager: this.#dataManager,
            entityManager: this.#entityManager,
            dispatch: this.#eventBus.dispatch.bind(this.#eventBus) // Provide dispatch directly
        };

        /** @type {ActionResult} */
        const result = this.#actionExecutor.executeAction(actionId, context);

        // --- Process Action Result ---

        // Apply state changes via GameStateManager based on newState
        let locationChanged = false; // Flag to check if we need to trigger 'look'
        if (result.newState) {
            if (typeof result.newState.currentLocationId === 'string') {
                const newLocationId = result.newState.currentLocationId;
                const newLocation = this.#entityManager.createEntityInstance(newLocationId);

                if (newLocation) {
                    const previousLocation = currentLocation; // Store previous location before updating state
                    this.#gameStateManager.setCurrentLocation(newLocation);

                    // --- Get updated state for post-action logic ---
                    const updatedLocation = this.#gameStateManager.getCurrentLocation(); // Re-get
                    const playerForEvent = this.#gameStateManager.getPlayer(); // Re-get (usually same)

                    if (!updatedLocation || !playerForEvent) { // Should not happen
                        console.error("GameLoop: State became invalid after setting location in GameStateManager!");
                        this.#eventBus.dispatch('ui:message_display', {
                            text: "Critical Internal Error: State inconsistency after move.",
                            type: "error"
                        });
                        this.stop();
                        return;
                    }
                    currentLocation = updatedLocation; // Update local variable for context if needed later

                    this.ensureEntitiesPresentAreInstantiated(updatedLocation);

                    // Dispatch room entered event
                    this.#eventBus.dispatch('event:room_entered', {
                        playerEntity: playerForEvent,
                        newLocation: updatedLocation,
                        previousLocation: previousLocation
                    });

                    locationChanged = true; // Mark that location changed successfully

                } else {
                    console.error(`GameLoop: Failed to get/create entity instance for target location ID: ${newLocationId}`);
                    // Dispatch error via EventBus - Move Handler should ideally do this
                    this.#eventBus.dispatch('ui:message_display', {
                        text: "There seems to be a problem with where you were trying to go. You remain here.",
                        type: "error"
                    });
                }
            }
            // Handle other potential newState flags here...
        }

        // Trigger 'look' action automatically AFTER a successful location change
        if (locationChanged) {
            // console.log("GameLoop: Location changed, executing automatic 'look'."); // Verbose
            // Execute look action non-recursively (using a fresh call, not tail recursion)
            // Ensure the context for 'look' uses the *new* location from GameStateManager
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