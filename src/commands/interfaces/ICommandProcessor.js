/**
 * @file Defines the contract for processing commands from an actor.
 * @see src/commands/interfaces/ICommandProcessor.js
 */

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../types/commandResult.js').CommandResult} CommandResult */

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
   * @returns {Promise<CommandResult>} A promise that resolves to the command result.
   * @throws {Error} May throw on critical, unrecoverable errors.
   */
  async dispatchAction(actor, turnAction) {
    throw new Error('ICommandProcessor.dispatchAction method not implemented.');
  }
}
