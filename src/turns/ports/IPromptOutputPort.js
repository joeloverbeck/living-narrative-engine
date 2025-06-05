// src/turns/ports/IPromptOutputPort.js
// --- FILE START ---

/**
 * @file Defines the interface for sending prompts to the player.
 */

/** @typedef {import('./commonTypes.js').DiscoveredActionInfo} DiscoveredActionInfo */

/**
 * @interface IPromptOutputPort
 * @description An interface representing the output boundary for prompting the player for their turn.
 * Implementations (Adapters) will bridge this port to specific output mechanisms
 * (like dispatching an EventBus event, sending a WebSocket message, updating UI state, etc.),
 * allowing the PlayerTurnHandler to request a prompt without knowing the details of *how*
 * the prompt is presented.
 */
export class IPromptOutputPort {
  /**
   * Sends a prompt to the specified player entity, typically indicating it's their turn
   * and providing available actions.
   *
   * @async
   * @param {string} entityId - The unique ID of the player entity being prompted.
   * @param {DiscoveredActionInfo[]} availableActions - An array of objects describing the actions
   * the player can currently take.
   * @param {string} [error] - An optional error message to include in the prompt, usually
   * indicating why the player is being re-prompted (e.g., invalid previous command).
   * @returns {Promise<void>} A promise that resolves when the prompt has been successfully sent
   * (or queued for sending) by the adapter. It might reject if sending fails critically.
   * @throws {Error} Implementations might throw if required parameters are invalid or sending fails critically.
   */
  async prompt(entityId, availableActions, error) {
    throw new Error('IPromptOutputPort.prompt method not implemented.');
  }
}

// --- FILE END ---
