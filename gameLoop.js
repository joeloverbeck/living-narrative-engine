// GameLoop.js
import { NameComponent } from './src/components/nameComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';
// ... import other necessary components ...

class GameLoop {
    /**
     * @param {import('./DataManager.js').default} dataManager
     * @param {import('./src/entities/entityManager.js').default} entityManager
     * @param {HTMLElement} outputElement - The HTML element to display game output.
     * @param {HTMLElement} inputElement - The HTML input element for player commands.
     */
    constructor(dataManager, entityManager, outputElement, inputElement) {
        if (!dataManager || !entityManager || !outputElement || !inputElement) {
            throw new Error("GameLoop requires DataManager, EntityManager, outputElement, and inputElement.");
        }
        this.dataManager = dataManager;
        this.entityManager = entityManager;
        this.outputElement = outputElement;
        this.inputElement = inputElement;

        this.playerEntity = null; // Will be set during initialization
        this.currentLocation = null; // Will track the player's current location entity
        this.isRunning = false;

        this._bindInputElement();
    }

    /**
     * Initializes the game loop, sets up the player, and starts the first turn.
     * Should be called after DataManager and EntityManager are ready.
     */
    async initializeAndStart() {
        console.log("GameLoop: Initializing...");

        // Get the player entity instance
        this.playerEntity = this.entityManager.getEntityInstance('core:player'); // Assuming player is already created in main.js
        if (!this.playerEntity) {
            this.output("Error: Player entity 'core:player' not found!", "error");
            console.error("GameLoop: Could not find player entity 'core:player'. Was it created by EntityManager?");
            return;
        }

        // Set the starting location (assuming player definition has a starting location ID)
        // TODO: Add a 'currentLocationId' or similar component/property to the player definition or handle starting location logic
        const startLocationId = 'demo:room_entrance'; // Example - get this dynamically if possible
        this.currentLocation = this.entityManager.createEntityInstance(startLocationId); // Or get from DM if locations aren't entities
        if (!this.currentLocation) {
            this.output(`Error: Starting location '${startLocationId}' not found!`, "error");
            console.error("GameLoop: Could not find starting location definition:", startLocationId);
            return;
        }

        // Store player's location reference (you might add a LocationComponent to the player)
        // For now, we just track it in the GameLoop
        console.log(`GameLoop: Player starting at ${this.currentLocation.id}`);


        this.isRunning = true;
        this.output("Welcome to Dungeon Run Demo!");
        this.displayLocation(); // Show initial location description
        this.promptInput(); // Prepare for first command
        console.log("GameLoop: Started.");
    }

    /**
     * Binds the Enter key press event to the input element.
     * @private
     */
    _bindInputElement() {
        this.inputElement.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && this.isRunning) {
                const command = this.inputElement.value.trim();
                this.inputElement.value = ''; // Clear input field
                if (command) {
                    this.handleCommand(command);
                } else {
                    this.promptInput(); // Re-prompt if empty command entered
                }
            }
        });
    }

    /**
     * Displays the current location description and prompts for input.
     */
    displayLocation() {
        if (!this.currentLocation) return;

        // Fetch location details (assuming locations are entities with components)
        const nameComp = this.currentLocation.getComponent(NameComponent);
        const descComp = this.currentLocation.getComponent(DescriptionComponent);
        // TODO: Add logic to list visible entities (items, NPCs) in the location

        let description = "";
        if (nameComp) {
            description += `<h2>${nameComp.value}</h2>`;
        }
        if (descComp) {
            description += `<p>${descComp.text}</p>`;
        } else {
            description += "<p>You are in an undescribed location.</p>";
        }

        // TODO: Add listing of connections (exits) from ConnectionsComponent
        // TODO: Add listing of items/entities present in the room

        this.output(description);
    }

    /**
     * Handles the raw command input by the player.
     * @param {string} command - The command string entered by the player.
     */
    handleCommand(command) {
        console.log(`GameLoop: Received command: "${command}"`);
        this.output(`> ${command}`, "command"); // Echo command

        const { actionId, targets } = this.parseCommand(command);

        if (!actionId) {
            this.output("Unknown command.", "error");
            this.promptInput();
            return;
        }

        const actionDefinition = this.dataManager.getAction(actionId);
        if (!actionDefinition) {
            this.output(`Error: Action definition not found for ID: ${actionId}`, "error");
            this.promptInput();
            return;
        }

        console.log(`GameLoop: Parsed action: ${actionId}, Targets: ${targets.join(', ')}`);

        // --- Action Execution & State Update ---
        this.executeAction(actionDefinition, targets);

        // --- Event Triggering (Minimal) ---
        this.checkTriggers(); // Check simple triggers after action

        // --- Loop ---
        // Display updated location info (if moved) or action results
        // This might be part of executeAction or called separately
        if (actionId !== 'core:action_look') { // Avoid double description on 'look'
            // Re-displaying location might be too verbose for some actions, adjust as needed
            // this.displayLocation();
        }
        this.promptInput(); // Prompt for next command
    }

    /**
     * Parses the raw command string into an action ID and targets.
     * VERY basic parser, needs significant improvement.
     * @param {string} command
     * @returns {{actionId: string | null, targets: string[]}}
     * @private
     */
    parseCommand(command) {
        const lowerCommand = command.toLowerCase();
        const parts = lowerCommand.split(' ').filter(p => p); // Split and remove empty strings
        const verb = parts[0];
        const targets = parts.slice(1);

        // Simple verb-to-actionID mapping (replace with more robust lookup)
        const actionMap = {
            'move': 'core:action_move',
            'go': 'core:action_move',
            'north': 'core:action_move', // Handle directions as targets later
            'south': 'core:action_move',
            'east': 'core:action_move',
            'west': 'core:action_move',
            'attack': 'core:action_attack',
            'hit': 'core:action_attack',
            'take': 'core:action_take',
            'get': 'core:action_take',
            'use': 'core:action_use',
            'look': 'core:action_look',
            'l': 'core:action_look',
            'examine': 'core:action_look',
            'inventory': 'core:action_inventory', // Example: Add an inventory action
            'inv': 'core:action_inventory',
            'i': 'core:action_inventory'
        };

        let actionId = actionMap[verb] || null;
        let finalTargets = targets;

        // Special handling for movement directions
        if (['north', 'south', 'east', 'west'].includes(verb)) {
            actionId = 'core:action_move';
            finalTargets = [verb]; // The direction is the target
        }
        // Handle "look at [target]"
        if (verb === 'look' && targets.length > 0 && targets[0] === 'at') {
            finalTargets = targets.slice(1); // Target is after "at"
        } else if (verb === 'look' && targets.length === 0) {
            finalTargets = []; // Simple "look" (at the room)
        }


        // TODO: Implement more sophisticated parsing:
        // - Match targets against entities in the current location.
        // - Handle prepositions ("take key from chest").
        // - Use action definitions from DataManager to guide parsing.

        return { actionId, targets: finalTargets };
    }

    /**
     * Executes the given action with the specified targets.
     * Placeholder implementation - needs specific logic for each action.
     * @param {object} actionDefinition - The action definition JSON from DataManager.
     * @param {string[]} targets - The target identifiers from the parser.
     * @private
     */
    executeAction(actionDefinition, targets) {
        const actionId = actionDefinition.id;

        switch (actionId) {
            case 'core:action_move':
                this.executeMove(targets[0]); // Expecting direction as the first target
                break;
            case 'core:action_look':
                if (targets.length > 0) {
                    this.executeLookAt(targets.join(' ')); // Look at specific target
                } else {
                    this.displayLocation(); // Look at the current room
                }
                break;
            case 'core:action_take':
                this.executeTake(targets.join(' ')); // Expecting item name/ID
                break;
            case 'core:action_attack':
                this.executeAttack(targets.join(' ')); // Expecting enemy name/ID
                break;
            case 'core:action_use':
                this.executeUse(targets.join(' ')); // Expecting item name/ID from inventory
                break;
            case 'core:action_inventory':
                this.executeInventory();
                break;
            default:
                this.output(`Action '${actionId}' is not implemented yet.`, "warning");
        }
    }

    /** Placeholder for move action */
    executeMove(direction) {
        if (!direction) {
            this.output("Move where? (north, south, east, west)", "error");
            return;
        }
        // TODO: Get ConnectionsComponent from this.currentLocation
        // TODO: Check if direction is a valid connection ID
        // TODO: If valid, get the target location ID from the connection
        // TODO: Get the new location entity/definition
        // TODO: Update this.currentLocation
        // TODO: Call this.displayLocation() to show the new room
        this.output(`(Placeholder) Attempting to move ${direction}...`);
        this.output("Movement not fully implemented.", "warning");
        // Example if implemented:
        // const connectionsComp = this.currentLocation.getComponent(ConnectionsComponent);
        // const targetLocationId = connectionsComp?.connections?.[direction];
        // if (targetLocationId) {
        //     const newLocation = this.entityManager.getEntityInstance(targetLocationId); // Or get from DM
        //     if (newLocation) {
        //         this.currentLocation = newLocation;
        //         this.output(`You move ${direction}.`);
        //         this.displayLocation();
        //     } else {
        //         this.output(`Error finding location definition for ${targetLocationId}`, "error");
        //     }
        // } else {
        //     this.output("You can't go that way.", "error");
        // }
    }

    /** Placeholder for look at target action */
    executeLookAt(targetName) {
        // TODO: Find entity matching targetName in current location or player inventory
        // TODO: Get its DescriptionComponent or generate description
        this.output(`(Placeholder) You look closely at ${targetName}...`);
        this.output("Looking at specific things not fully implemented.", "warning");
    }

    /** Placeholder for take action */
    executeTake(itemName) {
        // TODO: Find item entity matching itemName in the current location
        // TODO: Check if it's takable (maybe ItemComponent property)
        // TODO: Get player's InventoryComponent
        // TODO: Add item ID to player inventory
        // TODO: Remove item entity from location's inventory/contained entities
        this.output(`(Placeholder) You try to take the ${itemName}...`);
        this.output("Taking items not fully implemented.", "warning");
    }

    /** Placeholder for attack action */
    executeAttack(targetName) {
        // TODO: Find enemy entity matching targetName in the current location
        // TODO: Get player's AttackComponent (if needed)
        // TODO: Get enemy's HealthComponent
        // TODO: Implement basic damage calculation
        // TODO: Update enemy's HealthComponent.current
        // TODO: Output attack result ("You attack the goblin.", "The goblin attacks you!")
        this.output(`(Placeholder) You attack the ${targetName}!`);
        this.output("Combat not fully implemented.", "warning");
    }

    /** Placeholder for use action */
    executeUse(itemName) {
        // TODO: Find item entity matching itemName in player's InventoryComponent
        // TODO: Get item's ItemComponent and check its 'use' effect definition
        // TODO: Apply effect (e.g., modify player's HealthComponent if potion)
        // TODO: Remove item from inventory if consumable
        this.output(`(Placeholder) You use the ${itemName}...`);
        this.output("Using items not fully implemented.", "warning");
    }

    /** Placeholder for inventory action */
    executeInventory() {
        // TODO: Get player's InventoryComponent
        // TODO: List item IDs/names in the inventory
        this.output("(Placeholder) You check your inventory...");
        // Example:
        // const invComp = this.playerEntity.getComponent(InventoryComponent);
        // if (invComp && invComp.items.length > 0) {
        //     let invList = "You are carrying:\n";
        //     invComp.items.forEach(itemId => {
        //         const itemEntity = this.entityManager.getEntityInstance(itemId); // Might need instance
        //         const nameComp = itemEntity?.getComponent(NameComponent);
        //         invList += `- ${nameComp ? nameComp.value : itemId}\n`;
        //     });
        //     this.output(invList);
        // } else {
        //     this.output("Your inventory is empty.");
        // }
        this.output("Inventory display not fully implemented.", "warning");
    }


    /**
     * Checks for and executes simple event triggers.
     * Placeholder - needs real trigger logic based on data.
     * @private
     */
    checkTriggers() {
        // TODO: Get all trigger definitions from DataManager
        // TODO: Iterate through triggers and evaluate their conditions against the current game state
        //       (e.g., check if enemy health <= 0, check if player is in a specific location)
        // TODO: If a trigger condition is met, execute its effects
        //       (e.g., update entity state, display a message, unlock a connection)

        // Example pseudo-code:
        // const allTriggers = this.dataManager.getAllTriggers();
        // for (const trigger of allTriggers) {
        //    if (this.evaluateTriggerCondition(trigger.condition)) {
        //        this.executeTriggerEffect(trigger.effect);
        //        // Mark trigger as fired if needed, remove it, etc.
        //    }
        // }
    }

    /**
     * Adds a message to the output element.
     * @param {string} message - The HTML or text message to display.
     * @param {string} [type='info'] - Optional type ('info', 'error', 'command', 'warning') for styling.
     */
    output(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `message-${type}`);
        messageDiv.innerHTML = message; // Use innerHTML to render basic HTML tags like <p>, <h2>
        this.outputElement.appendChild(messageDiv);
        // Auto-scroll to the bottom
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    /**
     * Enables the input field and sets placeholder text.
     */
    promptInput() {
        this.inputElement.disabled = false;
        this.inputElement.placeholder = "Enter command...";
        this.inputElement.focus();
    }

    stop() {
        this.isRunning = false;
        this.inputElement.disabled = true;
        this.inputElement.placeholder = "Game stopped.";
        console.log("GameLoop: Stopped.");
    }
}

export default GameLoop;