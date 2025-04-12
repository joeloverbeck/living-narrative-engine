// src/core/commandParser.js

// Import DataManager for type hinting in constructor
/** @typedef {import('./dataManager.js').default} DataManager */

// Import ParsedCommand definition for return type hinting
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// Assume ActionDefinition type exists
/** @typedef {object} ActionDefinition @property {string} id @property {string[]} commands */

/**
 * Defines the list of prepositions recognized by the parser.
 * Used to help identify V+DO+Prep+IO command structures.
 * All prepositions must be lowercase.
 * @type {ReadonlyArray<string>}
 */
const SUPPORTED_PREPOSITIONS = Object.freeze([
    "on",
    "at",
    "with",
    "in",
    "to",
    ">" // Added '>' as per potential use cases like 'put coin > slot'
]);

class CommandParser {
    #dataManager;

    constructor(dataManager) {
        if (!dataManager) {
            throw new Error("CommandParser requires a DataManager instance.");
        }
        this.#dataManager = dataManager;
    }

    parse(commandString) {
        const originalInput = commandString;
        const actionsMap = this.#dataManager.actions;

        const parsedCommand = {
            actionId: null,
            directObjectPhrase: null,
            preposition: null,
            indirectObjectPhrase: null,
            originalInput: originalInput,
            error: null
        };

        const inputTrimmedStart = commandString.trimStart();
        if (inputTrimmedStart === "") {
            return parsedCommand;
        }

        let longestMatchLength = 0;
        let matchedActionId = null;
        const lowerInputTrimmedStart = inputTrimmedStart.toLowerCase();

        // Find Command (no changes here)
        for (const actionDefinition of actionsMap.values()) {
            if (actionDefinition.commands && Array.isArray(actionDefinition.commands)) {
                for (const commandOrAlias of actionDefinition.commands) {
                    if (typeof commandOrAlias === 'string' && commandOrAlias.length > 0) {
                        const lowerCommandOrAlias = commandOrAlias.toLowerCase();
                        if (lowerInputTrimmedStart.startsWith(lowerCommandOrAlias)) {
                            const isEndOfCommand = lowerInputTrimmedStart.length === lowerCommandOrAlias.length;
                            const charAfterCommandIndex = lowerCommandOrAlias.length;
                            const isFollowedByWhitespaceOrEnd = isEndOfCommand ||
                                (lowerInputTrimmedStart.length > charAfterCommandIndex && /\s/.test(lowerInputTrimmedStart[charAfterCommandIndex]));

                            if (isFollowedByWhitespaceOrEnd) {
                                if (lowerCommandOrAlias.length > longestMatchLength) {
                                    longestMatchLength = lowerCommandOrAlias.length;
                                    matchedActionId = actionDefinition.id;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (matchedActionId !== null) {
            parsedCommand.actionId = matchedActionId;
            // Find the actual command/alias string that caused the match
            // This requires finding which lowerCommandOrAlias led to matchedActionId
            let matchedAlias = '';
            for (const actionDefinition of actionsMap.values()) {
                if (actionDefinition.id === matchedActionId && actionDefinition.commands) {
                    for (const commandOrAlias of actionDefinition.commands) {
                        const lowerCommandOrAlias = commandOrAlias.toLowerCase();
                        if (lowerInputTrimmedStart.startsWith(lowerCommandOrAlias) && lowerCommandOrAlias.length === longestMatchLength) {
                            matchedAlias = lowerCommandOrAlias;
                            break; // Found the specific alias that matched
                        }
                    }
                }
                if (matchedAlias) break;
            }


            const remainingText = inputTrimmedStart.substring(longestMatchLength);
            const textAfterCommand = remainingText.trimStart();

            if (textAfterCommand) {
                // --- REVISED PREPOSITION FINDING LOGIC V3 ---
                let firstMatchIndex = -1;
                let firstMatchPrep = null;
                let firstMatchLength = 0;

                // Split by any whitespace, keeping only non-empty parts (the words)
                const words = textAfterCommand.split(/\s+/).filter(Boolean);

                // Find the first word that is a supported preposition
                for (const word of words) {
                    const lowerWord = word.toLowerCase();
                    if (SUPPORTED_PREPOSITIONS.includes(lowerWord)) {
                        // Found the first preposition word. Now find its actual
                        // starting index in the original textAfterCommand string.
                        // This handles cases where the word might appear earlier as a substring.
                        // We need a regex to find the word surrounded by whitespace or start/end.
                        // Pattern: (^|\s)word(\s|$)
                        const wordBoundaryPattern = new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'i');
                        const match = wordBoundaryPattern.exec(textAfterCommand);

                        if (match) {
                            // Find the index of the actual word within the match
                            // Need to account for potential leading space in the match
                            const prepStartIndex = match[0].toLowerCase().indexOf(lowerWord) + match.index;

                            firstMatchIndex = prepStartIndex;
                            firstMatchPrep = lowerWord; // Use the matched lowercase preposition
                            firstMatchLength = word.length; // Length of the actual word
                            break; // Found the first valid preposition word separator
                        }
                        // If regex didn't find it with boundaries (edge case?), continue loop.
                        // This shouldn't happen if split worked correctly, but as a fallback.
                    }
                }
                // --- END REVISED PREPOSITION FINDING LOGIC V3 ---


                // Check if a valid separating preposition was found
                if (firstMatchPrep !== null) { // Use firstMatchPrep as the flag
                    const prepositionIndexInText = firstMatchIndex;
                    const foundPreposition = firstMatchPrep;
                    const textBeforePrep = textAfterCommand.substring(0, prepositionIndexInText);
                    const textAfterPrep = textAfterCommand.substring(prepositionIndexInText + foundPreposition.length); // Use actual length if needed? No, use foundPrep length

                    // Determine structure based on index and textBeforePrep
                    if (textBeforePrep.trim() !== "") {
                        // V+DO+P+IO structure
                        parsedCommand.preposition = foundPreposition; // Already lowercase
                        parsedCommand.directObjectPhrase = textBeforePrep.trimEnd();
                        const potentialIO = textAfterPrep.trimStart();
                        parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                    } else {
                        // V+P+IO structure (Prep found, but only whitespace before)
                        parsedCommand.preposition = foundPreposition; // Already lowercase
                        parsedCommand.directObjectPhrase = null;
                        const potentialIO = textAfterPrep.trimStart();
                        parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                    }
                    
                } else {
                    // No separating preposition found - Assume V+DO
                    parsedCommand.directObjectPhrase = textAfterCommand.trimEnd();
                    parsedCommand.preposition = null;
                    parsedCommand.indirectObjectPhrase = null;
                }
            } else {
                // --- NEW LOGIC FOR ALIAS-AS-OBJECT ---
                // No text after the command - Pure V command OR Alias acting as object.
                // Check if the matched alias IS the intended direct object (e.g., 'north')
                // You might need a better way to determine this, e.g., checking if
                // matchedActionId is 'core:action_move' and matchedAlias is a direction.
                // Simple approach: If action is move, and alias isn't 'move' or 'go', assume it's the direction.
                const moveActionVerbs = ['move', 'go']; // Define primary verbs
                if (matchedActionId === 'core:action_move' && matchedAlias && !moveActionVerbs.includes(matchedAlias)) {
                    parsedCommand.directObjectPhrase = matchedAlias; // Use the matched alias itself (already lowercase)
                } else {
                    // It's likely just a pure verb command (like 'look', 'inventory')
                    parsedCommand.directObjectPhrase = null;
                }
                parsedCommand.preposition = null;
                parsedCommand.indirectObjectPhrase = null;
            }

        } else {
            // Unknown command
            if (commandString.trim() !== "") {
                parsedCommand.error = "Unknown command.";
            }
        }

        return parsedCommand;
    }
}

export default CommandParser;