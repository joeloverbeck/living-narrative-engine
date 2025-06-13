// src/interfaces/IPromptCoordinator.js

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @interface IPromptCoordinator
 * @description Coordinates prompting a player for their action.
 */
export class IPromptCoordinator {
  /**
   * Prompts the player for an action.
   *
   * @param {Entity} actor - The actor being prompted.
   * @param {object} [options]
   * @param {AbortSignal} [options.cancellationSignal] - Signal to cancel the prompt.
   * @returns {Promise<any>} Resolves with prompt data.
   */
  async prompt(actor, options) {
    throw new Error('IPromptCoordinator.prompt not implemented.');
  }
}

export default IPromptCoordinator;
