/**
 * @file This interface provides data regarding the available actions for an actor.
 * @see src/interfaces/IAvailableActionsProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */
/** @typedef {import('../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */

/**
 * @interface IAvailableActionsProvider
 * @description Defines the contract for a service that discovers available actions for an actor.
 */
export class IAvailableActionsProvider {
  /**
   * Asynchronously discovers and indexes all valid actions for an actor in a given context.
   *
   * @param {Entity} actor - The entity performing the action.
   * @param {ITurnContext} turnContext - The context of the current turn.
   * @param {ILogger} logger - An instance of the logger.
   * @returns {Promise<ActionComposite[]>} A promise that resolves to an array of indexed, composite actions.
   */
  async get(actor, turnContext, logger) {
    throw new Error(
      "Method 'get(actor, turnContext, logger)' must be implemented."
    );
  }
}
