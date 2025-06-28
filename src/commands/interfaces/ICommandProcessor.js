/**
 * @file Defines the contract for processing commands from an actor.
 * @see src/commands/interfaces/ICommandProcessor.js
 */

/**
 * @interface ICommandProcessor
 * @classdesc Defines the contract for processing commands from an actor.
 */
export class ICommandProcessor {
  /**
   * Dispatches a pre-resolved action, bypassing parsing and target resolution.
   *
   * @function dispatchAction
   * @async
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnAction} turnAction - The pre-resolved action object.
   * @returns {Promise<{success: boolean, commandResult: CommandResult | null}>} A promise that resolves to an object indicating the outcome.
   * @throws {Error} May throw on critical, unrecoverable errors.
   */
  async dispatchAction(actor, turnAction) {
    throw new Error('ICommandProcessor.dispatchAction method not implemented.');
  }
}
