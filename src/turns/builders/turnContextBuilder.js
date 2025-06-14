// src/turns/builders/turnContextBuilder.js
/**
 * @file Defines a builder for creating TurnContext instances, abstracting away the setup complexity.
 * @module TurnContextBuilder
 */

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../context/turnContext.js').OnEndTurnCallback} OnEndTurnCallback
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

/**
 * @description Simplifies the creation of TurnContext instances by orchestrating validation and factory usage.
 * @class TurnContextBuilder
 */
export class TurnContextBuilder {
  /** @type {ILogger} */
  #logger;
  /** @type {ITurnContextFactory} */
  #turnContextFactory;
  /** @type {function(Entity, ILogger, string): void} */
  #assertValidEntity;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnContextFactory} deps.turnContextFactory
   * @param {function(Entity, ILogger, string): void} deps.assertValidEntity - Injected validation utility.
   */
  constructor({ logger, turnContextFactory, assertValidEntity }) {
    if (!logger) throw new Error('TurnContextBuilder: logger is required.');
    if (!turnContextFactory)
      throw new Error('TurnContextBuilder: turnContextFactory is required.');
    if (typeof assertValidEntity !== 'function')
      throw new Error(
        'TurnContextBuilder: assertValidEntity function is required.'
      );

    this.#logger = logger;
    this.#turnContextFactory = turnContextFactory;
    this.#assertValidEntity = assertValidEntity;
  }

  /**
   * Builds a new TurnContext using the configured factory and dependencies.
   *
   * @param {object} params
   * @param {Entity} params.actor - The actor for the turn.
   * @param {IActorTurnStrategy} params.strategy - The actor's turn strategy.
   * @param {OnEndTurnCallback} params.onEndTurn - Callback for when the turn ends.
   * @param {BaseTurnHandler} params.handlerInstance - The owning turn handler instance for state transitions.
   * @param {function():boolean} [params.awaitFlagProvider] - Optional function to check if awaiting an external event.
   * @param {function(boolean, string|null):void} [params.setAwaitFlag] - Optional callback to set the awaiting flag.
   * @returns {ITurnContext} The newly created turn context.
   */
  build({
    actor,
    strategy,
    onEndTurn,
    handlerInstance,
    awaitFlagProvider,
    setAwaitFlag,
  }) {
    this.#assertValidEntity(actor, this.#logger, this.constructor.name);

    this.#logger.debug(
      `${this.constructor.name}: Building context for actor ${actor.id}.`
    );

    const turnContext = this.#turnContextFactory.create({
      actor,
      strategy,
      onEndTurnCallback: onEndTurn,
      handlerInstance,
      // Pass through the optional await-flag handlers
      isAwaitingExternalEventProvider: awaitFlagProvider,
      onSetAwaitingExternalEventCallback: setAwaitFlag,
    });

    return turnContext;
  }
}
