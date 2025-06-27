// src/interfaces/ICommandOutcomeInterpreter.js
// --- FILE START ---
/** @typedef {import('../../types/commandResult.js').CommandResult} CommandResult */
// Or a more specific shared type
/** @typedef {import('../../turns/constants/turnDirectives.js').default} TurnDirective */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */

/**
 * @interface ICommandOutcomeInterpreter
 * @description Defines the contract for interpreting the result of a command and determining the next turn directive.
 */
export class ICommandOutcomeInterpreter {
  /**
   * Interprets a CommandResult and returns the appropriate TurnDirective.
   *
   * @async
   * @param {CommandResult} _result - The result object from command processing.
   * @param {ITurnContext} _turnContext - The active turn context for the actor whose result is being interpreted.
   * @returns {Promise<TurnDirective>} A promise resolving to a TurnDirective enum value.
   * @throws {Error} If turnContext or result object is malformed.
   */
  async interpret(_result, _turnContext) {
    throw new Error(
      'ICommandOutcomeInterpreter.interpret method not implemented.'
    );
  }
}

// --- FILE END ---
