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
        'i': 'core:action_inventory'
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

        let actionId = null;
        let targets = [];
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
            if (CommandParser.#directions.includes(verb)) {
                actionId = 'core:action_move';
                // Map aliases to full direction name for consistency
                targets = [CommandParser.#directionMap[verb] || verb]; // The direction is the target
            }
            // Handle "look at [target]" vs simple "look"
            else if (verb === 'look') {
                actionId = 'core:action_look'; // Ensure actionId is set for 'look'
                if (targets.length > 0 && targets[0] === 'at') {
                    targets = targets.slice(1); // Target is after "at"
                } else {
                    // If 'look' has targets but no 'at', we could treat them as targets
                    // or require 'at'. Current logic implies 'look thing' works same as 'look at thing'
                    // Keep original logic for now:  simple "look" (targets.length === 0) handled below
                    // or "look at thing" (targets handled above)
                    // or "look thing" (targets = ['thing'] as parsed initially)
                    // Let's refine slightly: if verb is look and targets exist but don't start with 'at',
                    // assume they meant 'look at'. This matches common MUD/IF behavior.
                    // NO, the *original* logic didn't require 'at' if targets were present.
                    // Let's stick to *functional equivalence* for this ticket.
                    // The previous logic:
                    // if (verb === 'look' && targets.length > 0 && targets[0] === 'at') { finalTargets = targets.slice(1); }
                    // else if (verb === 'look' && targets.length === 0) { finalTargets = []; }
                    // Otherwise `finalTargets` remained `parts.slice(1)`
                    // This means `look door` resulted in actionId: 'core:action_look', targets: ['door']
                    // And `look at door` also resulted in actionId: 'core:action_look', targets: ['door']
                    // And `look` resulted in actionId: 'core:action_look', targets: []
                    // So the current assignment `targets = parts.slice(1)` combined with the special
                    // 'look at' handling *already correctly replicates* the original logic.
                }
            }
            // } else if (verb === 'look' && targets.length === 0) {
            //     targets = []; // Handled naturally by initial `targets = parts.slice(1)` being empty
            // }

            // If after all checks, actionId is still null, it's an unknown command
            if (!actionId && parts.length > 0) { // Check parts.length avoids error on empty input
                // error = `Unknown command verb: "${verb}"`; // Optionally set a specific error
                // For now, just return null actionId as per original logic's outcome
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

        console.debug(`CommandParser.parse("${originalInput}") ->`, result); // Debug log
        return result;
    }
}

export default CommandParser;