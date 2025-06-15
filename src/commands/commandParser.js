// src/commands/commandParser.js

// *** [REFACTOR-014-SUB-11] Updated Type Import ***
// Add GameDataRepository import
/** @typedef {import('../data/gameDataRepository.js').GameDataRepository} GameDataRepository */

// Import ParsedCommand definition for return type hinting
/** @typedef {import('../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// Assume ActionDefinition type exists from GameDataRepository types
// Use the actual schema definition which includes 'commandVerb'
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

import { ICommandParser } from './interfaces/ICommandParser.js';

class CommandParser extends ICommandParser {
  /**
   * @private
   * @type {GameDataRepository}
   */
  #repository;

  /**
   * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
   *
   * @param {GameDataRepository} repository - The game data repository instance.
   */
  constructor(repository) {
    super();
    if (!repository) {
      // Updated error message to reflect new dependency
      throw new Error('CommandParser requires a GameDataRepository instance.');
    }
    // *** [REFACTOR-014-SUB-11] Added check for required method ***
    if (typeof repository.getAllActionDefinitions !== 'function') {
      // This check assumes the repository has been extended or will be.
      // If not, the CommandParser cannot function as originally designed.
      console.error(
        "CommandParser Critical Error: GameDataRepository instance is missing the required 'getAllActionDefinitions' method."
      );
      throw new Error(
        "CommandParser requires GameDataRepository with 'getAllActionDefinitions'."
      );
    }
    this.#repository = repository;
  }

  /**
   * Parses a command string to identify the action and direct object phrase
   * based on matching the first word against ActionDefinition.commandVerb.
   * // *** [REFACTOR-014-SUB-11] Updated to use GameDataRepository ***
   * // *** Task 2.1: Refactored parse method ***
   *
   * @param {string} commandString
   * @returns {ParsedCommand}
   */
  parse(commandString) {
    // --- Initial Setup ---
    console.log(
      "CommandParser: Will parse the command string '" + commandString + "'."
    );
    const originalInput = commandString;
    const allActionDefinitions = this.#repository.getAllActionDefinitions(); // Fetch definitions
    const parsedCommand = {
      actionId: null,
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: originalInput,
      error: null,
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
        if (
          typeof actionDefinition.commandVerb === 'string' &&
          actionDefinition.commandVerb.toLowerCase() === inputVerb
        ) {
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

      if (textAfterCommand) {
        parsedCommand.directObjectPhrase = textAfterCommand.trimEnd();
      } else {
        parsedCommand.directObjectPhrase = null;
      }
      parsedCommand.preposition = null;
      parsedCommand.indirectObjectPhrase = null;
    } else {
      // --- Update Error Handling ---
      if (inputTrimmedStart !== '') {
        parsedCommand.error = 'Internal Error: Command verb mismatch.';
      }
    }

    return parsedCommand;
  }
}

export default CommandParser;
