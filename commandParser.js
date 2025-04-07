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

        let actionId;
        let targets;
        let error = null; // Initialize error as null

        if (parts.length === 0) {
            // Handle empty input - it's valid input, just results in no action
            actionId = null;
            targets = [];
        } else {
            const verb = parts[0];
            targets = parts.slice(1); // Initial target assignment

            // Attempt direct verb-to-action mapping
            actionId = CommandParser.#actionMap[verb] || null;

            // Special handling for movement directions as the verb
            if (!actionId && CommandParser.#directions.includes(verb)) { // Check !actionId to avoid overriding equip/unequip if they matched
                actionId = 'core:action_move';
                targets = [CommandParser.#directionMap[verb] || verb];
            }
            // Handle "look at [target]" vs simple "look"
            else if (verb === 'look') { // Keep existing look logic
                actionId = 'core:action_look';
                if (targets.length > 0 && targets[0] === 'at') {
                    targets = targets.slice(1);
                }
                // 'look thing' and 'look' are handled by initial targets assignment
            }

            // If actionId is still null, it's unknown
            if (!actionId && parts.length > 0) {
                // Unknown command
            }
        }

        // TODO: Implement more sophisticated parsing in future tickets:
        // - Match targets against entities in the current location.
        // - Handle prepositions ("take key from chest").
        // - Use action definitions from DataManager to guide parsing.

        /** @type {ParsedCommand} */
        const result = {
            actionId: actionId,
            targets: targets,
            originalInput: originalInput,
            error: error
        };

        // Use console.debug for less noise, or remove in production
        console.debug(`CommandParser.parse("${originalInput}") ->`, JSON.stringify(result)); // Stringify for cleaner log
        return result;
    }
}

export default CommandParser;