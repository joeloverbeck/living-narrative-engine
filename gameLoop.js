// GameLoop.js
import { NameComponent } from './src/components/nameComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';
import { ConnectionsComponent } from "./src/components/connectionsComponent.js";
import { InventoryComponent } from "./src/components/inventoryComponent.js";
// ... import other necessary components ...
import commandParser from "./commandParser.js";

class GameLoop {
    /**
     * @param {import('./dataManager.js').default} dataManager
     * @param {import('./src/entities/entityManager.js').default} entityManager
     * @param {object} renderer - An object implementing the IGameRenderer interface (like DomRenderer).
     * @param {import('./InputHandler.js').default} inputHandler - The handler for user input events.
     * @param {CommandParser} commandParser // +++ Add commandParser parameter
     */
    constructor(dataManager, entityManager, renderer, inputHandler, commandParser) {
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

        this.dataManager = dataManager;
        this.entityManager = entityManager;
        this.renderer = renderer;       // +++ Store the renderer instance
        this.inputHandler = inputHandler; // +++ Store the handler instance
        this.commandParser = commandParser;

        this.playerEntity = null;
        this.currentLocation = null;
        this.isRunning = false;

        // InputHandler and Renderer state are managed separately now.
        // GameLoop calls both when needed (e.g., in promptInput, stop).
    }

    /**
     * Initializes the game loop, sets up the player, and starts the first turn.
     */
    async initializeAndStart() {
        console.log("GameLoop: Initializing...");

        this.playerEntity = this.entityManager.getEntityInstance('core:player');
        if (!this.playerEntity) {
            // Use renderer for error output
            this.renderer.renderMessage("Error: Player entity 'core:player' not found!", "error");
            console.error("GameLoop: Could not find player entity 'core:player'.");
            this.stop(); // Stop gracefully
            return;
        }

        const startLocationId = 'demo:room_entrance';
        this.currentLocation = this.entityManager.createEntityInstance(startLocationId);
        if (!this.currentLocation) {
            // Use renderer for error output
            this.renderer.renderMessage(`Error: Starting location '${startLocationId}' not found!`, "error");
            console.error("GameLoop: Could not find or create entity instance for starting location:", startLocationId);
            this.stop(); // Stop gracefully
            return;
        }

        console.log(`GameLoop: Player starting at ${this.currentLocation.id}`);

        this.isRunning = true;
        // Use renderer for welcome message
        this.renderer.renderMessage("Welcome to Dungeon Run Demo!");
        this.displayLocation(); // Show initial location (now uses renderer)
        this.promptInput();     // Prepare for first command (now uses renderer for state)
        console.log("GameLoop: Started.");
    }

    /**
     * Gathers location data and tells the renderer to display it.
     */
    displayLocation() {
        if (!this.currentLocation) {
            this.renderer.renderMessage("Error: Current location is not set.", "error");
            return;
        }

        // --- Gather Data ---
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

        // TODO: Gather items and NPCs in the future
        // const items = ... ;
        // const npcs = ... ;

        // --- Prepare Data Structure for Renderer ---
        /** @type {import('./DomRenderer.js').LocationRenderData} */
        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections,
            // items: items, // Add later
            // npcs: npcs,   // Add later
        };

        // --- Call Renderer ---
        this.renderer.renderLocation(locationData);
        // --- All direct DOM manipulation / outputHtml building is REMOVED ---
    }

    /**
     * Processes a command string submitted by the input handler.
     * @param {string} command - The raw command string from the input.
     */
    processSubmittedCommand(command) {
        if (!this.isRunning) return;
        this.handleCommand(command);
        if (this.isRunning) { // Check if stop() was called during handleCommand
            this.promptInput(); // Re-prompt is now handled here uniformly after command processing
        }
    }

    /**
     * Handles the parsed command logic after receiving input.
     * @param {string} command - The command string entered by the player.
     * @private
     */
    handleCommand(command) {
        console.log(`GameLoop: Received command: "${command}"`);
        this.renderer.renderMessage(`> ${command}`, "command"); // Echo command

        // +++ Use the CommandParser +++
        const parsedCommand = this.commandParser.parse(command);
        const { actionId, targets, originalInput } = parsedCommand; // Destructure result

        if (!actionId) {
            // Handle unknown or empty commands
            if (originalInput.trim().length > 0) { // Only show error for non-empty unknowns
                this.renderer.renderMessage("Unknown command. Try 'move [direction]', 'look', 'inventory', etc.", "error");
            }
            // Don't prompt here anymore, handled in processSubmittedCommand
            return;
        }

        // Action definition check remains useful
        const actionDefinition = this.dataManager.getAction(actionId);
        if (!actionDefinition) {
            console.warn(`GameLoop: Action definition not found for ID: ${actionId}, but proceeding with hardcoded logic.`);
            // Optionally render a warning: this.renderer.renderMessage(`Warning: Action definition missing for ${actionId}.`, "warning");
        } else {
            console.log(`GameLoop: Found action definition for ${actionId}`);
        }

        console.log(`GameLoop: Executing action: ${actionId}, Targets: ${targets.join(', ')}`);

        this.executeAction(actionId, targets);

        // --- Re-enable input prompt removed from here ---
        // It's now handled after handleCommand returns in processSubmittedCommand
        // This ensures prompt happens even if executeAction leads to early return,
        // unless stop() is called.
    }

    /**
     * Executes the given action with the specified targets. Uses renderer for output.
     * @param {string} actionId - The ID of the action to execute.
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionId, targets) {
        // Content of executeAction remains the same...
        switch (actionId) {
            case 'core:action_move':
                if (targets.length > 0) {
                    this.executeMove(targets[0]);
                } else {
                    this.renderer.renderMessage("Move where? (Specify a direction like 'north', 'south', 'east', or 'west')", "error");
                }
                break;
            case 'core:action_look':
                if (targets.length > 0) {
                    // Handles both 'look target' and 'look at target' because parser produces same targets array
                    this.executeLookAt(targets.join(' '));
                } else {
                    // Looking at the room just re-displays location info
                    this.displayLocation();
                }
                break;
            // ... other cases (take, attack, use, inventory) remain the same ...
            case 'core:action_take':
                if (targets.length > 0) {
                    this.executeTake(targets.join(' '));
                } else {
                    this.renderer.renderMessage("Take what?", "error");
                }
                break;
            case 'core:action_attack':
                if (targets.length > 0) {
                    this.executeAttack(targets.join(' '));
                } else {
                    this.renderer.renderMessage("Attack what?", "error");
                }
                break;
            case 'core:action_use':
                if (targets.length > 0) {
                    this.executeUse(targets.join(' '));
                } else {
                    this.renderer.renderMessage("Use what?", "error");
                }
                break;
            case 'core:action_inventory':
                this.executeInventory();
                break;

            default:
                this.renderer.renderMessage(`Action '${actionId}' is recognized but not implemented yet.`, "warning");
        }
    }

    /**
     * Executes the move action: checks connections and updates player location.
     * @param {string} direction - The direction the player wants to move (e.g., 'north').
     */
    executeMove(direction) {
        if (!direction) {
            this.renderer.renderMessage("Move where? Specify a direction.", "error");
            return;
        }
        if (!this.currentLocation) {
            this.renderer.renderMessage("Cannot move: current location is unknown.", "error");
            return;
        }

        const connectionsComp = this.currentLocation.getComponent(ConnectionsComponent);
        if (!connectionsComp || !Array.isArray(connectionsComp.connections)) {
            this.renderer.renderMessage("There are no obvious exits leading that way.", "info"); // Changed to info, less error-like
            console.warn(`Location ${this.currentLocation.id} missing valid ConnectionsComponent data.`);
            return;
        }

        const lowerDirection = direction.toLowerCase();
        const connection = connectionsComp.connections.find(
            conn => conn.direction && conn.direction.toLowerCase() === lowerDirection
        );

        if (connection) {
            // ... (Check connection state - Phase 2) ...
            const targetLocationId = connection.target;
            if (!targetLocationId) {
                this.renderer.renderMessage(`Connection '${direction}' is invalid (missing target).`, "error");
                console.error(`Invalid connection data in ${this.currentLocation.id} for direction ${direction}: missing target.`);
                return;
            }

            const newLocation = this.entityManager.createEntityInstance(targetLocationId);
            if (newLocation) {
                this.currentLocation = newLocation;
                this.renderer.renderMessage(`You move ${direction}.`); // Use renderer

                this.dispatchGameEvent('event:room_entered', { /* ... */ });
                this.displayLocation(); // Display new location (uses renderer)

            } else {
                this.renderer.renderMessage(`Something is wrong with the passage leading ${direction}.`, "error"); // Use renderer
                console.error(`Failed to get/create entity instance for target location ID: ${targetLocationId}`);
            }
        } else {
            this.renderer.renderMessage("You can't go that way.", "info"); // Use renderer (changed to info)
        }
    }

    executeLookAt(targetName) {
        // TODO: Implement full look logic
        this.renderer.renderMessage(`(Placeholder) You look closely at ${targetName}...`, 'info'); // Use renderer
        this.renderer.renderMessage("Looking at specific things not fully implemented.", "warning"); // Use renderer
    }

    executeTake(itemName) {
        // TODO: Implement full take logic
        this.renderer.renderMessage(`(Placeholder) You try to take the ${itemName}...`, 'info'); // Use renderer
        this.renderer.renderMessage("Taking items not fully implemented.", "warning"); // Use renderer
    }

    executeAttack(targetName) {
        // TODO: Implement full attack logic
        this.renderer.renderMessage(`(Placeholder) You attack the ${targetName}!`, 'info'); // Use renderer
        this.renderer.renderMessage("Combat not fully implemented.", "warning"); // Use renderer
    }

    executeUse(itemName) {
        // TODO: Implement full use logic
        this.renderer.renderMessage(`(Placeholder) You use the ${itemName}...`, 'info'); // Use renderer
        this.renderer.renderMessage("Using items not fully implemented.", "warning"); // Use renderer
    }

    executeInventory() {
        this.renderer.renderMessage("(Placeholder) You check your inventory...", 'info'); // Use renderer
        const invComp = this.playerEntity.getComponent(InventoryComponent);
        if (invComp && Array.isArray(invComp.items) && invComp.items.length > 0) {
            // Simple version: just list IDs for now
            // let invList = "You are carrying:\n";
            // invList += invComp.items.map(id => `- ${id}`).join('\n');
            // this.renderer.renderMessage(invList); // Use renderer

            // Slightly better: Try to get names (sync for now)
            let invList = "You are carrying:\n";
            const itemNames = invComp.items.map(itemId => {
                const itemEntity = this.entityManager.getEntityInstance(itemId); // Needs items to be actual entities
                // Check if the item instance exists AND has a NameComponent
                const nameComp = itemEntity?.getComponent(NameComponent);
                return nameComp ? nameComp.value : itemId; // Fallback to ID
            });
            invList += itemNames.map(name => `- ${name}`).join('\n');
            this.renderer.renderMessage(invList); // Use renderer

        } else {
            this.renderer.renderMessage("Your inventory is empty.", 'info'); // Use renderer
        }
        // Remove comment below if implemented
        // this.renderer.renderMessage("Inventory display not fully implemented.", "warning"); // Use renderer
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
     * In Phase 2, this should integrate with a proper Event Bus.
     * @param {string} eventName The name of the event (e.g., 'event:room_entered').
     * @param {object} eventData Associated data for the event.
     */
    dispatchGameEvent(eventName, eventData) {
        console.log(`Game Event Dispatched: ${eventName}`, eventData);
        // In a real event bus:
        // this.eventBus.publish(eventName, eventData);
    }

    /**
     * Enables the input handler to listen AND tells the renderer
     * to update the input field's visual state (enabled, placeholder).
     */
    promptInput(message = "Enter command...") {
        if (!this.isRunning) return; // Don't prompt if stopped
        this.inputHandler.enable();
        this.renderer.setInputState(true, message);
    }

    /**
     * Stops the game loop, tells input handler to stop listening,
     * and tells renderer to update the input field's visual state (disabled).
     */
    stop() {
        // ... stop() method remains the same ...
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