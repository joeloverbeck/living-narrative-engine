// src/turns/interfaces/ITurnContextFactory.js
// ****** MODIFIED FILE ******
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('./IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext
 */
/**
 * @typedef {function(Error | null): void} OnEndTurnCallback
 * @description Callback function to signal the end of a turn.
 */

/**
 * @class ITurnContextFactory
 * @interface
 * @description
 * Defines the interface for a factory that creates turn contexts.
 */
export class ITurnContextFactory {
  /**
   * Creates a turn context instance.
   *
   * @param {object} params - The parameters required to create the turn context.
   * @param {Entity} params.actor - The current actor whose turn is being processed.
   * @param {IActorTurnStrategy} params.strategy - The turn strategy for the current actor.
   * @param {OnEndTurnCallback} params.onEndTurnCallback - Callback to execute when endTurn() is called.
   * @param {BaseTurnHandler} params.handlerInstance - The turn handler instance for requesting transitions.
   * @returns {ITurnContext} The created turn context.
   * @throws {Error} If the method is not implemented by a concrete class.
   */
  create({ actor, strategy, onEndTurnCallback, handlerInstance }) {
    throw new Error(
      'ITurnContextFactory.create must be implemented by concrete classes.'
    );
  }
}
