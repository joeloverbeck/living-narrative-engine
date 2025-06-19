// src/turns/interfaces/ICommandHandlingState.js
/**
 * @interface ICommandHandlingState
 * @description Interface for states that participate in command
 * processing. Implementations handle command submission as well as
 * the directive and result flow from the command pipeline.
 */
export class ICommandHandlingState {
  /**
   * Handles a command string submitted by an actor.
   *
   * @param {import('./ITurnStateHost.js').ITurnStateHost} handler
   * @param {string} commandString
   * @param {import('../../entities/entity.js').default} actorEntity
   * @returns {Promise<void>}
   */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    throw new Error(
      'ICommandHandlingState.handleSubmittedCommand must be implemented.'
    );
  }

  /**
   * Handles the result from the command processor.
   *
   * @param {import('./ITurnStateHost.js').ITurnStateHost} handler
   * @param {import('../../entities/entity.js').default} actor
   * @param {import('../../types/commandResult.js').CommandResult} cmdProcResult
   * @param {string} commandString
   * @returns {Promise<void>}
   */
  async processCommandResult(handler, actor, cmdProcResult, commandString) {
    throw new Error(
      'ICommandHandlingState.processCommandResult must be implemented.'
    );
  }

  /**
   * Handles a directive emitted from the command pipeline.
   *
   * @param {import('./ITurnStateHost.js').ITurnStateHost} handler
   * @param {import('../../entities/entity.js').default} actor
   * @param {import('../constants/turnDirectives.js').default} directive
   * @param {import('../../types/commandResult.js').CommandResult} [cmdProcResult]
   * @returns {Promise<void>}
   */
  async handleDirective(handler, actor, directive, cmdProcResult) {
    throw new Error(
      'ICommandHandlingState.handleDirective must be implemented.'
    );
  }
}
