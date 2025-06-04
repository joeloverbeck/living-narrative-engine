// src/turns/interfaces/ITurnContextFactory.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../context/turnContext.js').TurnContextServices} TurnContextServices // Assuming path to the typedef
 * @typedef {import('./IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext
 */
/**
 * @typedef {function(Error | null): void} OnEndTurnCallback
 * @description Callback function to signal the end of a turn.
 */
/**
 * @typedef {function(): boolean} IsAwaitingExternalEventProvider
 * @description Function that returns true if the turn is awaiting an external event.
 */

/**
 * @typedef {function(boolean, string): void} OnSetAwaitingExternalEventCallback
 * @description Callback to inform handler to set its waiting flag.
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
   * @param {object} params - The parameters required to create the turn context.
   * @param {Entity} params.actor - The current actor whose turn is being processed.
   * @param {ILogger} params.logger - The logger instance for turn-specific logging.
   * @param {TurnContextServices} params.services - A bag of services accessible during the turn.
   * @param {IActorTurnStrategy} params.strategy - The turn strategy for the current actor.
   * @param {OnEndTurnCallback} params.onEndTurnCallback - Callback to execute when endTurn() is called.
   * @param {IsAwaitingExternalEventProvider} params.isAwaitingExternalEventProvider - Function to check if awaiting an external event.
   * @param {OnSetAwaitingExternalEventCallback} params.onSetAwaitingExternalEventCallback - Callback to inform handler to set its waiting flag.
   * @param {BaseTurnHandler} params.handlerInstance - The turn handler instance for requesting transitions.
   * @returns {ITurnContext} The created turn context.
   * @throws {Error} If the method is not implemented by a concrete class.
   */
  create({
    actor,
    logger,
    services,
    strategy,
    onEndTurnCallback,
    isAwaitingExternalEventProvider,
    onSetAwaitingExternalEventCallback,
    handlerInstance,
  }) {
    throw new Error(
      'ITurnContextFactory.create must be implemented by concrete classes.'
    );
  }
}

// --- FILE END ---
