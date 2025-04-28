// src/core/commandParser.js

// *** [REFACTOR-014-SUB-11] Updated Type Import ***
// Add GameDataRepository import
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */

// Import ParsedCommand definition for return type hinting
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// Assume ActionDefinition type exists from GameDataRepository types
// Use the actual schema definition which includes 'commandVerb'
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

/**
 * Defines the list of prepositions recognized by the parser. (No changes needed)
 * @type {ReadonlyArray<string>}
 */
const SUPPORTED_PREPOSITIONS = Object.freeze([
    'on', 'at', 'with', 'in', 'to', '>'
]);

class CommandParser {
    /**
     * @private
     * @type {GameDataRepository}
     */
    #repository;

    /**
     * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
     * @param {GameDataRepository} repository - The game data repository instance.
     */
    constructor(repository) {
        if (!repository) {
            // Updated error message to reflect new dependency
            throw new Error('CommandParser requires a GameDataRepository instance.');
        }
        // *** [REFACTOR-014-SUB-11] Added check for required method ***
        if (typeof repository.getAllActionDefinitions !== 'function') {
            // This check assumes the repository has been extended or will be.
            // If not, the CommandParser cannot function as originally designed.
            console.error("CommandParser Critical Error: GameDataRepository instance is missing the required 'getAllActionDefinitions' method.");
            throw new Error("CommandParser requires GameDataRepository with 'getAllActionDefinitions'.");
        }
        this.#repository = repository;
    }

    /**
     * Parses a command string to identify action, objects, and preposition
     * based on matching the first word against ActionDefinition.commandVerb.
     * // *** [REFACTOR-014-SUB-11] Updated to use GameDataRepository ***
     * // *** Task 2.1: Refactored parse method ***
     * @param {string} commandString
     * @returns {ParsedCommand}
     */
    parse(commandString) {
        // --- Initial Setup ---
        console.log('CommandParser: Will parse the command string \'' + commandString + '\'.');
        const originalInput = commandString;
        const allActionDefinitions = this.#repository.getAllActionDefinitions(); // Fetch definitions
        const parsedCommand = {
            actionId: null,
            directObjectPhrase: null,
            preposition: null,
            indirectObjectPhrase: null,
            originalInput: originalInput,
            error: null
        };

        const inputTrimmedStart = commandString.trimStart();
        if (inputTrimmedStart === '') {
            return parsedCommand; // Handle empty/whitespace input
        }

        // --- Implement New Verb Matching ---
        const lowerInputTrimmedStart = inputTrimmedStart.toLowerCase();
        const inputWords = lowerInputTrimmedStart.split(/\s+/);
        const inputVerb = inputWords.length > 0 ? inputWords[0] : null;

        let matchedActionId = null;
        let matchedVerbLength = 0;

        if (inputVerb !== null) {
            for (const actionDefinition of allActionDefinitions) {
                // Compare input verb with the canonical commandVerb from the definition
                if (actionDefinition.commandVerb === inputVerb) {
                    matchedActionId = actionDefinition.id;
                    matchedVerbLength = inputVerb.length; // Store length of the matched verb
                    break; // Found the unique match based on commandVerb
                }
            }
        }
        // Note: The case where inputVerb is null (e.g., only whitespace) is handled by the initial empty string check.

        // --- Adapt Argument Parsing ---
        if (matchedActionId !== null) {
            parsedCommand.actionId = matchedActionId;

            // Calculate remainder based on the matched command verb's length
            const remainingText = inputTrimmedStart.substring(matchedVerbLength);
            const textAfterCommand = remainingText.trimStart();

            // Reuse existing argument parsing logic block
            if (textAfterCommand) {
                // --- REVISED PREPOSITION FINDING LOGIC V3 --- (Kept as-is)
                let firstMatchIndex = -1;
                let firstMatchPrep = null;
                let firstMatchLength = 0;
                const words = textAfterCommand.split(/\s+/).filter(Boolean);

                for (const word of words) {
                    const lowerWord = word.toLowerCase();
                    if (SUPPORTED_PREPOSITIONS.includes(lowerWord)) {
                        // Use regex to ensure whole word match, considering start/end of string or whitespace boundaries
                        const wordBoundaryPattern = new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'i');
                        const match = wordBoundaryPattern.exec(textAfterCommand);
                        if (match) {
                            // Find the precise start index of the matched preposition within the textAfterCommand
                            const prepStartIndex = match.index + match[0].toLowerCase().indexOf(lowerWord);

                            // Check if this preposition occurs *before* any previously found one
                            if (firstMatchIndex === -1 || prepStartIndex < firstMatchIndex) {
                                firstMatchIndex = prepStartIndex;
                                firstMatchPrep = lowerWord; // Store the matched preposition (lowercase)
                                firstMatchLength = word.length; // Store the original length for substring calculation
                                // Keep searching to ensure we find the *first* one.
                                // break; // NO BREAK - must find the *first* occurrence in textAfterCommand
                            }
                        }
                    }
                }
                // Corrected logic: break should have been outside the inner `if (match)` but inside the `if (SUPPORTED_PREPOSITIONS.includes(lowerWord))`?
                // Let's re-evaluate the V3 logic's intent. It iterates all words. If a word is a prep, it finds its index using regex. It stores the *first* match's details (index, prep, length).
                // The original loop structure without a break inside the `if(SUPPORTED_PREPOSITIONS)` correctly finds the details of the first preposition encountered. No change needed here.

                // --- END REVISED PREPOSITION FINDING LOGIC V3 ---

                if (firstMatchPrep !== null) {
                    // Found a preposition
                    const prepositionIndexInText = firstMatchIndex;
                    const foundPreposition = firstMatchPrep; // Already lowercase
                    const textBeforePrep = textAfterCommand.substring(0, prepositionIndexInText).trimEnd();
                    const textAfterPrep = textAfterCommand.substring(prepositionIndexInText + firstMatchLength).trimStart(); // Use firstMatchLength here

                    parsedCommand.preposition = foundPreposition;
                    parsedCommand.directObjectPhrase = textBeforePrep === '' ? null : textBeforePrep;
                    parsedCommand.indirectObjectPhrase = textAfterPrep === '' ? null : textAfterPrep; // trimEnd() potentially needed if punctuation handling requires it later

                    // Refined assignment based on whether textBeforePrep is empty (handles V+P+IO case)
                    // This refinement seems unnecessary given the check above. Reverting to simpler logic.
                    /*
                              if (textBeforePrep.trim() !== "") {
                                  parsedCommand.preposition = foundPreposition;
                                  parsedCommand.directObjectPhrase = textBeforePrep.trimEnd();
                                  const potentialIO = textAfterPrep.trimStart();
                                  parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                              } else {
                                  // Handles cases like "look > north" (V+P+IO)
                                  parsedCommand.preposition = foundPreposition;
                                  parsedCommand.directObjectPhrase = null;
                                  const potentialIO = textAfterPrep.trimStart();
                                  parsedCommand.indirectObjectPhrase = potentialIO === "" ? null : potentialIO.trimEnd();
                              }
                              */

                } else {
                    // No preposition found, the entire remaining text is the direct object
                    parsedCommand.directObjectPhrase = textAfterCommand.trimEnd(); // trimEnd needed? Yes, potentially.
                    parsedCommand.preposition = null;
                    parsedCommand.indirectObjectPhrase = null;
                }
            } else {
                // textAfterCommand is empty (e.g., just "look" or "inventory")
                // DO/Prep/IO should remain null as initialized.
                // --- REMOVED Alias Handling ---
                // Deleted the 'else' block containing special logic for 'core:move' and matchedAlias.
                parsedCommand.directObjectPhrase = null;
                parsedCommand.preposition = null;
                parsedCommand.indirectObjectPhrase = null;
            }

        } else {
            // --- Update Error Handling ---
            // matchedActionId is null, meaning the inputVerb didn't match any actionDefinition.commandVerb
            if (inputTrimmedStart !== '') { // Avoid error on purely whitespace input
                // As per ticket instructions, assume this indicates an internal issue if commands
                // are expected to be generated system-side via ActionDiscovery.
                // If user typing is primary, "Unknown command." might be better, but following spec:
                parsedCommand.error = 'Internal Error: Command verb mismatch.';
                // If a user-facing error is preferred for direct typing:
                // parsedCommand.error = "Unknown command.";
            }
            // If input was only whitespace, error remains null (handled by initial check).
        }

        return parsedCommand;
    }
}

export default CommandParser;