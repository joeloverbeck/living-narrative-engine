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

        // +++ Instantiate Entities Present in Starting Location +++
        this.ensureEntitiesPresentAreInstantiated(this.currentLocation);

        console.log(`GameLoop: Player starting at ${this.currentLocation.id}`);

        // --- Trigger initial room entered event (after setting location) ---
        this.dispatchGameEvent('event:room_entered', {
            playerEntity: this.playerEntity,
            newLocation: this.currentLocation
        });

        this.isRunning = true;
        this.renderer.renderMessage("Welcome to Dungeon Run Demo!");
        this.displayLocation();
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
     * Checks a location for an EntitiesPresentComponent and ensures all listed
     * entity IDs have corresponding instances created in the EntityManager.
     * @param {import('./src/entities/entity.js').default} locationEntity - The location entity instance to check.
     * @private
     */
    ensureEntitiesPresentAreInstantiated(locationEntity) {
        if (!locationEntity) return;

        const presentComp = locationEntity.getComponent(EntitiesPresentComponent);
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            console.log(`GameLoop: Ensuring entities present in ${locationEntity.id} are instantiated.`);
            presentComp.entityIds.forEach(entityId => {
                // Don't try to re-instantiate the player if listed (though unlikely)
                if (this.playerEntity && entityId === this.playerEntity.id) {
                    return;
                }
                // Attempt to create/get the instance. This will either create it
                // if it's the first time, or just return the existing one.
                const instance = this.entityManager.createEntityInstance(entityId);
                if (!instance) {
                    // Log an error if an entity listed couldn't be created
                    console.error(`GameLoop: Failed to ensure instance for entity ID '${entityId}' listed in location '${locationEntity.id}'. Definition might be missing or invalid.`);
                    // Decide if this should halt the game or just warn
                } else {
                    // Optional: Log success only if newly created? createEntityInstance logs it currently.
                }
            });
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
            dispatch: this.dispatchGameEvent.bind(this)
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
                    const previousLocation = this.currentLocation; // Store previous location (optional use)
                    this.currentLocation = newLocation; // Update GameLoop's state
                    console.log(`GameLoop: Successfully updated currentLocation to ${this.currentLocation.id}`);

                    // +++ Instantiate Entities Present in New Location +++
                    this.ensureEntitiesPresentAreInstantiated(this.currentLocation);

                    // --- Dispatch Event: Room Entered (P1-EVT-001) ---
                    // This happens *after* the state transition is confirmed and completed.
                    this.dispatchGameEvent('event:room_entered', {
                        playerEntity: this.playerEntity,
                        newLocation: this.currentLocation,
                        // previousLocation: previousLocation // Optional future enhancement
                    });
                    // --- End Event Dispatch ---

                    // --- Post-State-Update Action ---
                    // Display the details of the *new* location after the move is complete
                    // and after the event has been dispatched.
                    // We display *after* the event so listeners could potentially modify
                    // the description lookup or add messages before the default display.
                    this.displayLocation();

                } else {
                    // Handler indicated a successful move attempt to a location,
                    // but that location entity couldn't be instantiated. Critical error.
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
     * Checks for and executes simple event triggers based on loaded data.
     * Basic MVP implementation.
     * @param {string} eventName The name of the event that was just dispatched.
     * @param {object} eventData The data associated with the dispatched event.
     * @private
     */
    checkTriggers(eventName, eventData) {
        console.log(`GameLoop: Checking triggers for event: ${eventName}`);
        const allTriggers = this.dataManager.getAllTriggers(); // Assumes DataManager has this

        for (const triggerDef of allTriggers) {
            // Basic check if trigger is active (implement one_shot disabling later)
            // if (triggerDef.disabled) continue; // Add mechanism for this later

            const listenCondition = triggerDef.listen_to;

            // 1. Check Event Type
            if (listenCondition.event_type !== eventName) {
                continue; // Does not match event type
            }

            // 2. Check Filters (MVP: source_id for entity_died)
            let filtersMatch = true;
            if (listenCondition.filters) {
                if (eventName === 'event:entity_died' && listenCondition.filters.source_id) {
                    // Ensure eventData has the expected structure
                    if (!eventData || typeof eventData.deceasedEntityId !== 'string') {
                        console.warn(`Trigger Check: ${triggerDef.id} expects 'deceasedEntityId' in eventData for 'entity_died', but not found or invalid.`, eventData);
                        filtersMatch = false;
                    } else if (eventData.deceasedEntityId !== listenCondition.filters.source_id) {
                        filtersMatch = false; // Specific entity ID doesn't match
                    }
                }
                // Add other filter checks for different events/filters later
            }

            if (!filtersMatch) {
                continue; // Filter condition not met
            }

            // --- Trigger Matches! Execute Actions ---
            console.log(`GameLoop: Trigger MATCHED: ${triggerDef.id}`);

            for (const action of triggerDef.actions) {
                console.log(`GameLoop: Executing trigger action:`, action);
                try {
                    switch (action.type) {
                        case 'set_connection_state':
                            this.executeTriggerAction_SetConnectionState(action.target, action.parameters);
                            break;
                        // Add more trigger action types later
                        default:
                            console.warn(`GameLoop: Unknown trigger action type '${action.type}' in trigger ${triggerDef.id}`);
                    }
                } catch (error) {
                    console.error(`GameLoop: Error executing action for trigger ${triggerDef.id}:`, error);
                }
            }

            // Handle one_shot (basic MVP: just log it needs disabling)
            if (triggerDef.one_shot) {
                console.log(`GameLoop: Trigger ${triggerDef.id} is one_shot and should be disabled.`);
                // TODO MVP+: Implement disabling mechanism (e.g., add flag to instance state or remove from active list)
            }

        } // End loop through triggers
    }

    /**
     * Executes the 'set_connection_state' trigger action.
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

        // --- Update the state ---
        const oldState = connection.state;
        connection.state = parameters.state; // Directly modify the component data instance
        console.log(`Trigger Action: Set connection '${target.connection_direction}' in '${target.location_id}' state from '${oldState || 'undefined'}' to '${parameters.state}'.`);

        // Notify player? Optional. Might spam messages.
        // For 'unlocked', a message might be good.
        if (parameters.state === 'unlocked' && oldState === 'locked') {
            this.renderer.renderMessage(`You hear a click from the ${target.connection_direction}.`, 'sound'); // Use a 'sound' type maybe
        }
        // If the player is IN the location where the change happened, maybe redisplay exits?
        if (this.currentLocation && this.currentLocation.id === target.location_id) {
            // This requires the Look action to re-evaluate connections
            // For MVP, this state change will just be reflected next time player 'look's or tries 'move'
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