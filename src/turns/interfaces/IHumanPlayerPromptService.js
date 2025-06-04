// src/core/interfaces/IPlayerPromptService.js
// --- FILE START ---
/** @typedef {import('../../entities/entity.js').default} Entity */
// Assuming AvailableAction might be defined elsewhere or is a more generic type.
// If it's very specific, its definition or import might be needed here for JSDoc.
/** @typedef {import('../services/humanPlayerPromptService.js').DiscoveredActionInfo} AvailableAction */ // Or appropriate path

/**
 * @typedef {object} PlayerPromptResolution
 * @property {AvailableAction} action - The selected available action object.
 * @property {string | null} speech - The optional speech input from the player, or null if not provided.
 */

/**
 * @typedef {object} PlayerPromptOptions
 * @property {AbortSignal} [cancellationSignal] - An optional AbortSignal to cancel the prompt operation.
 */

/**
 * @interface IHumanPlayerPromptService
 * @description Defines the contract for a service that prompts a player for their turn
 * and asynchronously returns their chosen action.
 */
export class IHumanPlayerPromptService {
  /**
   * Prompts the specified actor for their next action and awaits their response.
   *
   * @async
   * @param {Entity} actor - The entity (player) to prompt.
   * @param {PlayerPromptOptions} [options] - Optional parameters for the prompt, including a cancellation signal.
   * @returns {Promise<PlayerPromptResolution>} A promise that resolves with an object containing
   * the player's selected action and any accompanying speech.
   * @throws {Error|DOMException} If prompting fails critically (e.g., invalid actor, underlying system error,
   * or failure to set up the prompt mechanism), or if the operation is aborted (DOMException with name 'AbortError').
   */
  async prompt(actor, options = {}) {
    // This is an interface method and should not be called directly.
    // Implementations of this interface should provide the actual logic.
    throw new Error('IPlayerPromptService.prompt method not implemented.');
  }

  /**
   * Externally requests the cancellation of any currently active prompt being managed by this service.
   * This is a non-blocking call. If a prompt is active, its promise will be rejected
   * (typically with a PromptError or AbortError if a signal was also aborted).
   * If no prompt is active, this method should be a no-op or log appropriately.
   *
   * @returns {void}
   */
  cancelCurrentPrompt() {
    throw new Error(
      'IPlayerPromptService.cancelCurrentPrompt method not implemented.'
    );
  }
}

// --- FILE END ---
