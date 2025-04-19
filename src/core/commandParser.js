// src/core/commandParser.js

// *** [REFACTOR-014-SUB-11] Updated Type Import ***
// Add GameDataRepository import
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */

// Import ParsedCommand definition for return type hinting
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// Assume ActionDefinition type exists from GameDataRepository types
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

/**
 * Defines the list of prepositions recognized by the parser. (No changes needed)
 * @type {ReadonlyArray<string>}
 */
const SUPPORTED_PREPOSITIONS = Object.freeze([
    "on", "at", "with", "in", "to", ">"
]);

class CommandParser {
    /**
     * @private
     * @type {GameDataRepository} // <-- UPDATED Type
     */
    #repository; // <-- UPDATED Property Name

    /**
     * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
     * @param {GameDataRepository} repository - The game data repository instance.
     */
    constructor(repository) { // <-- UPDATED Parameter name
        if (!repository) {
            // Updated error message to reflect new dependency
            throw new Error("CommandParser requires a GameDataRepository instance.");
        }
        // *** [REFACTOR-014-SUB-11] Added check for required method ***
        if (typeof repository.getAllActionDefinitions !== 'function') {
            // This check assumes the repository has been extended or will be.
            // If not, the CommandParser cannot function as originally designed.
            console.error("CommandParser Critical Error: GameDataRepository instance is missing the required 'getAllActionDefinitions' method.");
            throw new Error("CommandParser requires GameDataRepository with 'getAllActionDefinitions'.");
        }
        this.#repository = repository; // <-- UPDATED Assignment
    }

    /**
     * Parses a command string to identify action, objects, and preposition.
     * // *** [REFACTOR-014-SUB-11] Updated to use GameDataRepository ***
     * @param {string} commandString
     * @returns {ParsedCommand}
     */
    parse(commandString) {
        const originalInput = commandString;
        // *** [REFACTOR-014-SUB-11] Fetch actions using repository method ***
        // Assuming repository provides a method to get all actions for parsing.
        // If the repository only offers getAction(id), this parser logic needs a complete rewrite.
        const allActionDefinitions = this.#repository.getAllActionDefinitions(); // <-- UPDATED: Fetch all definitions

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

        // Find Command (Iterate through definitions from repository)
        // *** [REFACTOR-014-SUB-11] Use fetched definitions ***
        for (const actionDefinition of allActionDefinitions) { // <-- UPDATED: Iterate over fetched array
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
            let matchedAlias = '';
            // *** [REFACTOR-014-SUB-11] Use fetched definitions ***
            for (const actionDefinition of allActionDefinitions) { // <-- UPDATED: Iterate over fetched array
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
                // --- REVISED PREPOSITION FINDING LOGIC V3 --- (No changes needed here)
                let firstMatchIndex = -1;
                let firstMatchPrep = null;
                let firstMatchLength = 0;
                const words = textAfterCommand.split(/\s+/).filter(Boolean);

                for (const word of words) {
                    const lowerWord = word.toLowerCase();
                    if (SUPPORTED_PREPOSITIONS.includes(lowerWord)) {
                        const wordBoundaryPattern = new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'i');
                        const match = wordBoundaryPattern.exec(textAfterCommand);
                        if (match) {
                            const prepStartIndex = match[0].toLowerCase().indexOf(lowerWord) + match.index;
                            firstMatchIndex = prepStartIndex;
                            firstMatchPrep = lowerWord;
                            firstMatchLength = word.length;
                            break;
                        }
                    }
                }
                // --- END REVISED PREPOSITION FINDING LOGIC V3 ---

                if (firstMatchPrep !== null) {
                    const prepositionIndexInText = firstMatchIndex;
                    const foundPreposition = firstMatchPrep;
                    const textBeforePrep = textAfterCommand.substring(0, prepositionIndexInText);
                    const textAfterPrep = textAfterCommand.substring(prepositionIndexInText + foundPreposition.length);

                    if (textBeforePrep.trim() !== "") {
                        parsedCommand.preposition = foundPreposition;
                        parsedCommand.directObjectPhrase = textBeforePrep.trimEnd();
                        const potentialIO = textAfterPrep.trimStart();
                        parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                    } else {
                        parsedCommand.preposition = foundPreposition;
                        parsedCommand.directObjectPhrase = null;
                        const potentialIO = textAfterPrep.trimStart();
                        parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                    }
                } else {
                    parsedCommand.directObjectPhrase = textAfterCommand.trimEnd();
                    parsedCommand.preposition = null;
                    parsedCommand.indirectObjectPhrase = null;
                }
            } else {
                // --- NEW LOGIC FOR ALIAS-AS-OBJECT --- (No changes needed here)
                const moveActionVerbs = ['move', 'go'];
                if (matchedActionId === 'core:move' && matchedAlias && !moveActionVerbs.includes(matchedAlias)) {
                    parsedCommand.directObjectPhrase = matchedAlias;
                } else {
                    parsedCommand.directObjectPhrase = null;
                }
                parsedCommand.preposition = null;
                parsedCommand.indirectObjectPhrase = null;
            }

        } else {
            if (commandString.trim() !== "") {
                parsedCommand.error = "Unknown command.";
            }
        }

        return parsedCommand;
    }
}

export default CommandParser;