// commandParser.js

/**
 * Represents the structured output of the command parser.
 * @typedef {object} ParsedCommand
 * @property {string | null} actionId - The identified action (e.g., 'core:action_move') or null if parsing failed or no action identified.
 * @property {string[]} targets - An array of strings representing the targets/arguments of the command.
 * @property {string} originalInput - The original, unmodified command string entered by the user.
 * @property {string | null} error - An optional error message if parsing failed in a specific way (e.g., "Ambiguous command"). Defaults to null.
 */

class CommandParser {
    // Keep the maps internal for now as per the ticket scope
    static #actionMap = {
        'move': 'core:action_move',
        'go': 'core:action_move',
        'north': 'core:action_move',
        'south': 'core:action_move',
        'east': 'core:action_move',
        'west': 'core:action_move',
        // Add other directions if needed (up, down, ne, sw, etc.)
        'n': 'core:action_move',
        's': 'core:action_move',
        'e': 'core:action_move',
        'w': 'core:action_move',
        'attack': 'core:action_attack',
        'hit': 'core:action_attack',
        'take': 'core:action_take',
        'drop': 'core:action_drop',
        'get': 'core:action_take',
        'use': 'core:action_use',
        'look': 'core:action_look',
        'l': 'core:action_look',
        'examine': 'core:action_look',
        'inventory': 'core:action_inventory',
        'inv': 'core:action_inventory',
        'i': 'core:action_inventory',
        'equip': 'core:action_equip',
        'wear': 'core:action_equip',
        'wield': 'core:action_equip',
        'unequip': 'core:action_unequip',
        'remove': 'core:action_unequip'
        // Add other aliases as needed
    };

    static #directionMap = {
        n: 'north', s: 'south', e: 'east', w: 'west'
        // Add other direction aliases if needed
    };

    static #directions = ['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']; // Includes aliases

    /**
     * Parses the raw command string into an action ID and targets.
     * VERY basic parser, needs significant improvement later.
     * @param {string} commandString - The raw input string from the user.
     * @returns {ParsedCommand} The parsed command structure.
     */
    parse(commandString) {
        const originalInput = commandString; // Keep original input
        const lowerCommand = commandString.trim().toLowerCase();
        const parts = lowerCommand.split(' ').filter(p => p); // Split and remove empty strings

        let actionId = null; // Initialize
        let targets = [];    // Initialize
        let error = null;   // Initialize error as null

        if (parts.length === 0) {
            // Handle empty input - it's valid input, just results in no action
            // actionId and targets remain null/[]
        } else {
            const verb = parts[0];
            // Initial target assignment ONLY if there's more than one part
            targets = parts.length > 1 ? parts.slice(1) : [];

            // Attempt direct verb-to-action mapping
            actionId = CommandParser.#actionMap[verb] || null;

            // Check if the verb itself is a direction. This takes precedence
            // for setting the target if it's a single-word command.
            if (CommandParser.#directions.includes(verb)) {
                // If the verb is a direction, ensure the action is move
                // and the target *is* the direction (normalized).
                actionId = 'core:action_move'; // Ensure/overwrite action is move
                targets = [CommandParser.#directionMap[verb] || verb]; // Set the target correctly
            }

            // Handle specific verbs like "look" if they weren't directions
            else if (verb === 'look') { // Use 'else if' to avoid conflict with directions
                actionId = 'core:action_look'; // Ensure correct action
                // Handle "look at [target]" vs simple "look"
                if (targets.length > 0 && targets[0] === 'at') {
                    targets = targets.slice(1); // Remove 'at'
                }
                // If 'look' was single word, targets is already [], which is correct for 'look' (look around)
                // If 'look target', targets is already ['target'] from initial assignment.
            }
            // Add other 'else if' blocks here for verbs with special target handling
            // if needed in the future.

            // If actionId is still null after all checks, it's an unknown command
            // (We can optionally add an error message here later)
            // if (!actionId) { ... }
        }

        /** @type {ParsedCommand} */
        return {
            actionId: actionId,
            targets: targets,
            originalInput: originalInput,
            error: error
        };
    }
}

export default CommandParser;