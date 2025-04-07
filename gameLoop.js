// GameLoop.js
import { NameComponent } from './src/components/nameComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';
import { ConnectionsComponent } from "./src/components/connectionsComponent.js";
import { EntitiesPresentComponent } from './src/components/entitiesPresentComponent.js';
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
     * @param {GameStateManager} gameStateManager - Manages core game state.
     * @param {object} renderer - An object implementing the IGameRenderer interface (like DomRenderer).
     * @param {import('./InputHandler.js').default} inputHandler - The handler for user input events.
     * @param {CommandParser} commandParser // +++ Add commandParser parameter
     * @param {ActionExecutor} actionExecutor
     */
    constructor(dataManager, entityManager, gameStateManager, renderer, inputHandler, commandParser, actionExecutor) {
        // --- Validate constructor arguments ---
        if (!dataManager) throw new Error("GameLoop requires DataManager.");
        if (!entityManager) throw new Error("GameLoop requires EntityManager.");
        if (!gameStateManager || typeof gameStateManager.getPlayer !== 'function' || typeof gameStateManager.setPlayer !== 'function') {
            throw new Error("GameLoop requires a valid GameStateManager object.");
        }
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
        this.gameStateManager = gameStateManager;
        this.renderer = renderer;       // +++ Store the renderer instance
        this.inputHandler = inputHandler; // +++ Store the handler instance
        this.commandParser = commandParser;
        this.actionExecutor = actionExecutor;

        this.isRunning = false;
    }

    /**
     * Initializes the game loop, sets up the player, and starts the first turn.
     */
    async initializeAndStart() {
        console.log("GameLoop: Initializing...");

        // Fetch player instance (already created in main.js, just retrieving)
        const player = this.entityManager.getEntityInstance('core:player');
        if (!player) {
            // This should ideally not happen if main.js succeeded
            this.renderer.renderMessage("Error: Player entity 'core:player' could not be retrieved!", "error");
            console.error("GameLoop: Could not retrieve player entity 'core:player'.");
            this.stop();
            return;
        }
        // --- Set initial state via GameStateManager ---
        this.gameStateManager.setPlayer(player);

        // Fetch starting location instance
        const startLocationId = 'demo:room_entrance';
        const startLocation = this.entityManager.createEntityInstance(startLocationId);
        if (!startLocation) {
            this.renderer.renderMessage(`Error: Starting location '${startLocationId}' not found!`, "error");
            console.error("GameLoop: Could not find or create entity instance for starting location:", startLocationId);
            this.stop();
            return;
        }
        // --- Set initial state via GameStateManager ---
        this.gameStateManager.setCurrentLocation(startLocation); // Assign the instance

        // --- Get state from GameStateManager for subsequent operations ---
        const initialLocation = this.gameStateManager.getCurrentLocation();
        const initialPlayer = this.gameStateManager.getPlayer();

        if (!initialLocation || !initialPlayer) {
            // Should not happen if setters worked
            console.error("GameLoop: State not set correctly in GameStateManager after init.");
            this.stop();
            return;
        }

        // +++ Instantiate Entities Present in Starting Location +++
        // Pass the location retrieved from the state manager
        this.ensureEntitiesPresentAreInstantiated(initialLocation);

        console.log(`GameLoop: Player starting at ${initialLocation.id}`);

        // --- Trigger initial room entered event (using state from manager) ---
        this.dispatchGameEvent('event:room_entered', {
            playerEntity: initialPlayer,
            newLocation: initialLocation
        });

        this.isRunning = true;
        this.renderer.renderMessage("Welcome to Dungeon Run Demo!");
        this.displayLocation();
        this.promptInput();
        console.log("GameLoop: Started.");
    }

    /**
     * Gathers current location data from GameStateManager and tells the renderer to display it.
     */
    displayLocation() {
        // --- Get state from GameStateManager ---
        const location = this.gameStateManager.getCurrentLocation();

        if (!location) {
            this.renderer.renderMessage("Error: Current location is not set in Game State.", "error");
            console.error("GameLoop: displayLocation called, but no current location found in GameStateManager.");
            return;
        }

        // --- Gather Data (using the retrieved location) ---
        const nameComp = location.getComponent(NameComponent);
        const descComp = location.getComponent(DescriptionComponent);
        const connectionsComp = location.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${location.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        let availableDirections = [];
        if (connectionsComp && Array.isArray(connectionsComp.connections) && connectionsComp.connections.length > 0) {
            availableDirections = connectionsComp.connections
                .filter(conn => conn.state !== 'hidden') // Consider filtering non-visible exits
                .map(conn => conn.direction)
                .filter(dir => dir);
        }

        /** @type {LocationRenderData} */
        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections,
        };

        this.renderer.renderLocation(locationData);
    }

    /**
     * Processes a command string submitted by the input handler.
     * @param {string} command - The raw command string from the input.
     */
    processSubmittedCommand(command) {
        if (!this.isRunning) return;

        this.renderer.renderMessage(`> ${command}`, "command");
        const parsedCommand = this.commandParser.parse(command);
        const { actionId, targets, originalInput } = parsedCommand;

        if (!actionId) {
            if (originalInput.trim().length > 0) {
                this.renderer.renderMessage("Unknown command. Try 'move [direction]', 'look', 'inventory', etc.", "error");
            }
        } else {
            // --- Check state via GameStateManager before executing action ---
            if (!this.gameStateManager.getPlayer() || !this.gameStateManager.getCurrentLocation()) {
                console.error("GameLoop Error: Attempted to execute action but game state (player/location) is missing from GameStateManager!");
                this.renderer.renderMessage("Internal Error: Game state not fully initialized.", "error");
            } else {
                this.executeAction(actionId, targets); // State is confirmed available
            }
        }

        if (this.isRunning) {
            this.promptInput();
        }
    }

    /**
     * Checks a location for EntitiesPresentComponent and ensures listed entities exist.
     * @param {Entity} locationEntity - The location entity instance (retrieved from GameStateManager).
     * @private
     */
    ensureEntitiesPresentAreInstantiated(locationEntity) {
        if (!locationEntity) return;

        // --- Get Player from GameStateManager for comparison ---
        const player = this.gameStateManager.getPlayer();

        const presentComp = locationEntity.getComponent(EntitiesPresentComponent);
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            console.log(`GameLoop: Ensuring entities present in ${locationEntity.id} are instantiated.`);
            presentComp.entityIds.forEach(entityId => {
                // --- Use player state from GameStateManager ---
                if (player && entityId === player.id) {
                    return; // Don't reinstantiate player
                }
                const instance = this.entityManager.createEntityInstance(entityId);
                if (!instance) {
                    console.error(`GameLoop: Failed to ensure instance for entity ID '${entityId}' listed in location '${locationEntity.id}'.`);
                }
            });
        }
    }

    /**
     * Prepares context using GameStateManager, delegates action execution,
     * processes the ActionResult, potentially updating state via GameStateManager.
     *
     * @param {string} actionId - The ID of the action to execute.
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionId, targets) {
        // --- Retrieve current state JUST BEFORE execution ---
        const currentPlayer = this.gameStateManager.getPlayer();
        const currentLocation = this.gameStateManager.getCurrentLocation();

        // Null check (should be redundant due to check in processSubmittedCommand, but safe)
        if (!currentPlayer || !currentLocation) {
            console.error("executeAction called but state missing from GameStateManager.");
            this.renderer.renderMessage("Internal Error: Game state inconsistent.", "error");
            return;
        }

        console.log(`GameLoop: Executing action: ${actionId}, Targets: ${targets.join(', ')}`);

        const actionDefinition = this.dataManager.getAction(actionId);
        if (!actionDefinition) {
            console.error(`GameLoop: Action definition NOT FOUND for ID: ${actionId}.`);
            this.renderer.renderMessage(`Internal Error: System configuration issue for action '${actionId}'.`, "error");
            return;
        }

        // --- Prepare Action Context using state from GameStateManager ---
        /** @type {ActionContext} */
        const context = {
            playerEntity: currentPlayer,
            currentLocation: currentLocation,
            targets: targets,
            dataManager: this.dataManager,
            entityManager: this.entityManager,
            // Pass bound dispatch function, which now uses GameStateManager internally
            dispatch: this.dispatchGameEvent.bind(this)
        };

        // --- Delegate to Action Executor ---
        /** @type {ActionResult} */
        const result = this.actionExecutor.executeAction(actionId, context);

        // --- Process Action Result ---
        // 1. Render messages (unaffected by state manager change)
        if (result.messages && Array.isArray(result.messages)) {
            result.messages.forEach(msg => this.renderer.renderMessage(msg.text, msg.type || 'info'));
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

                const newLocation = this.entityManager.createEntityInstance(newLocationId);

                if (newLocation) {
                    // --- State Update via GameStateManager ---
                    this.gameStateManager.setCurrentLocation(newLocation);
                    console.log(`GameLoop: Successfully updated currentLocation in GameStateManager to ${newLocation.id}`);

                    // --- Get updated state for subsequent logic ---
                    const updatedLocation = this.gameStateManager.getCurrentLocation(); // Re-get the *just set* location
                    const playerForEvent = this.gameStateManager.getPlayer(); // Get player for event

                    if (!updatedLocation || !playerForEvent) {
                        console.error("GameLoop: State became invalid immediately after setting location in GameStateManager!");
                        this.renderer.renderMessage("Critical Internal Error: State inconsistency.", "error");
                        this.stop(); // Potentially stop the game
                        return;
                    }


                    // +++ Instantiate Entities in New Location (using updated location) +++
                    this.ensureEntitiesPresentAreInstantiated(updatedLocation);

                    // --- Dispatch Event (using updated state from manager) ---
                    this.dispatchGameEvent('event:room_entered', {
                        playerEntity: playerForEvent,
                        newLocation: updatedLocation,
                    });
                    // --- End Event Dispatch ---

                    // --- Post-State-Update Action (uses manager implicitly) ---
                    this.displayLocation(); // displayLocation now uses GameStateManager

                } else {
                    console.error(`GameLoop: Failed to get/create entity instance for target location ID: ${newLocationId}`);
                    this.renderer.renderMessage("There seems to be a problem with where you were trying to go. You remain here.", "error");
                }
            }
            // Handle other potential newState flags here...
        }
        // 3. Future event dispatch remains the same conceptually
    }

    /**
     * Checks for and executes simple event triggers. (Trigger logic itself unaffected,
     * but relies on GameStateManager for context if needed).
     * @param {string} eventName
     * @param {object} eventData
     * @private
     */
    checkTriggers(eventName, eventData) {
        // This method's core logic doesn't directly use player/location state from GameLoop.
        // However, the actions executed *by* the trigger might need it.
        // We pass the necessary context (like EntityManager) into the trigger action handlers.
        // If a trigger needed the *current* player/location, its execution method
        // (e.g., executeTriggerAction_...) would need access to GameStateManager.
        // For now, 'set_connection_state' doesn't need the player's location.

        console.log(`GameLoop: Checking triggers for event: ${eventName}`);
        const allTriggers = this.dataManager.getAllTriggers();

        for (const triggerDef of allTriggers) {
            const listenCondition = triggerDef.listen_to;
            if (listenCondition.event_type !== eventName) continue;

            let filtersMatch = true;
            // Filter checking remains the same logic
            if (listenCondition.filters) {
                // ... (filter logic unchanged) ...
                if (eventName === 'event:entity_died' && listenCondition.filters.source_id) {
                    if (!eventData || typeof eventData.deceasedEntityId !== 'string') {
                        console.warn(`Trigger Check: ${triggerDef.id} expects 'deceasedEntityId'...`, eventData);
                        filtersMatch = false;
                    } else if (eventData.deceasedEntityId !== listenCondition.filters.source_id) {
                        filtersMatch = false;
                    }
                }
            }
            if (!filtersMatch) continue;


            console.log(`GameLoop: Trigger MATCHED: ${triggerDef.id}`);
            for (const action of triggerDef.actions) {
                console.log(`GameLoop: Executing trigger action:`, action);
                try {
                    switch (action.type) {
                        case 'set_connection_state':
                            // Pass necessary dependencies if needed. EntityManager is usually sufficient here.
                            this.executeTriggerAction_SetConnectionState(action.target, action.parameters);
                            break;
                        default:
                            console.warn(`GameLoop: Unknown trigger action type '${action.type}' in trigger ${triggerDef.id}`);
                    }
                } catch (error) {
                    console.error(`GameLoop: Error executing action for trigger ${triggerDef.id}:`, error);
                }
            }

            if (triggerDef.one_shot) {
                console.log(`GameLoop: Trigger ${triggerDef.id} is one_shot and should be disabled.`);
                // TODO MVP+: Implement disabling mechanism
            }
        }
    }

    /**
     * Executes the 'set_connection_state' trigger action.
     * (This action only needs EntityManager, doesn't directly need player/current location state).
     * @param {{location_id: string, connection_direction: string}} target
     * @param {{state: string}} parameters
     * @private
     */
    executeTriggerAction_SetConnectionState(target, parameters) {
        const locationEntity = this.entityManager.getEntityInstance(target.location_id);
        if (!locationEntity) {
            console.error(`Trigger Action Error: Target location '${target.location_id}' not found.`);
            return;
        }

        const connectionsComp = locationEntity.getComponent(ConnectionsComponent);
        if (!connectionsComp || !Array.isArray(connectionsComp.connections)) {
            console.error(`Trigger Action Error: Location '${target.location_id}' has no valid ConnectionsComponent.`);
            return;
        }

        const connection = connectionsComp.connections.find(c => c.direction === target.connection_direction);
        if (!connection) {
            console.error(`Trigger Action Error: Connection '${target.connection_direction}' not found in location '${target.location_id}'.`);
            return;
        }

        const oldState = connection.state;
        connection.state = parameters.state; // Direct modification still okay here
        console.log(`Trigger Action: Set connection '${target.connection_direction}' in '${target.location_id}' state from '${oldState || 'undefined'}' to '${parameters.state}'.`);

        if (parameters.state === 'unlocked' && oldState === 'locked') {
            this.renderer.renderMessage(`You hear a click from the ${target.connection_direction}.`, 'sound');
        }

        // Get current location from manager to check if player is present
        const currentLocation = this.gameStateManager.getCurrentLocation();
        if (currentLocation && currentLocation.id === target.location_id) {
            // Player is in the location where the change happened.
            // Optionally re-render location or just let next 'look' handle it.
            // console.log("Player is in the affected location. State change will be visible on next look/move attempt.");
        }
    }

    /**
     * Dispatches a game event. Now bound and passed in context.
     * In Phase 1, this logs the event and checks simple triggers.
     *
     * @param {string} eventName The name of the event (e.g., 'event:room_entered', 'event:entity_died').
     * @param {object} eventData Associated data payload for the event.
     */
    dispatchGameEvent(eventName, eventData) {
        // MVP Implementation: Log the event
        console.log(`Game Event Dispatched: ${eventName}`, eventData);

        // +++ Basic MVP Trigger Check +++
        this.checkTriggers(eventName, eventData);
        // ---

        // Phase 2+ TODO: Integrate with a proper Event Bus
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