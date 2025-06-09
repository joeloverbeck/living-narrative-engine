/**
 * @file This interface provides data regarding the available actions for an actor.
 * @see src/interfaces/IAvailableActionsProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

/**
 * @interface IAvailableActionsProvider
 * @description Defines the contract for a service that discovers available actions for an actor.
 */
export class IAvailableActionsProvider {
  /**
   * Asynchronously discovers all valid actions for an actor in a given context.
   * @param {Entity} actor - The AI-controlled entity.
   * @param {ITurnContext} turnContext - The context of the current turn.
   * @param {ILogger} logger - An instance of the logger.
   * @returns {Promise<AIAvailableActionDTO[]>} A promise that resolves to an array of available actions.
   */
  async get(actor, turnContext, logger) {
    throw new Error(
      "Method 'get(actor, turnContext, logger)' must be implemented."
    );
  }
}
