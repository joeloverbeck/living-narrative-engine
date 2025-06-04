// src/core/interfaces/ICommandOutcomeInterpreter.js
// --- FILE START ---
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
// Or a more specific shared type
/** @typedef {import('../../turns/constants/turnDirectives.js').default} TurnDirective */

/**
 * @interface ICommandOutcomeInterpreter
 * @description Defines the contract for interpreting the result of a command and determining the next turn directive.
 */
export class ICommandOutcomeInterpreter {
  /**
   * Interprets a CommandResult and returns the appropriate TurnDirective.
   * @async
   * @param {CommandResult} result - The result object from command processing.
   * @param {string} actorId - The unique ID of the entity whose command result is being interpreted.
   * @returns {Promise<TurnDirective | string>} A promise resolving to a TurnDirective enum value (string).
   * @throws {Error} If actorId is invalid or result object is malformed.
   */
  async interpret(result, actorId) {
    throw new Error(
      'ICommandOutcomeInterpreter.interpret method not implemented.'
    );
  }
}
// --- FILE END ---
