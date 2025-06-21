// src/turns/factories/ConcreteTurnContextFactory.js
/**
 * @file Defines a concrete factory for creating TurnContext instances.
 */
// ──────────────────────────────────────────────────────────────────────────────

import { ITurnContextFactory } from '../interfaces/ITurnContextFactory.js';
import { TurnContext } from '../context/turnContext.js';

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService
 */

/** @typedef {function(Error | null): void} OnEndTurnCallback */

/**
 * @class ConcreteTurnContextFactory
 * @implements {ITurnContextFactory}
 * @description
 * Concrete factory for creating turn contexts. This factory is pre-configured with
 * all necessary services via its constructor and caches them. The create method
 * then uses these cached dependencies to assemble and provide a fully-equipped
 * TurnContext, simplifying the caller's responsibilities.
 */
export class ConcreteTurnContextFactory extends ITurnContextFactory {
  /** @type {ILogger} */
  #logger;
  /** @type {IWorldContext} */
  #gameWorldAccess;
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {ICommandProcessor} */
  #commandProcessor;
  /** @type {ICommandOutcomeInterpreter} */
  #commandOutcomeInterpreter;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IActionDiscoveryService} */
  #actionDiscoverySystem;

  /**
   * Constructs the factory and caches all necessary dependencies.
   *
   * @param {object} dependencies - The services to be injected.
   * @param {ILogger} dependencies.logger
   * @param {IWorldContext} dependencies.gameWorldAccess
   * @param {ITurnEndPort} dependencies.turnEndPort
   * @param {ICommandProcessor} dependencies.commandProcessor
   * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
   * @param {IEntityManager} dependencies.entityManager
   * @param {IActionDiscoveryService} dependencies.actionDiscoverySystem
   */
  constructor({
    logger,
    gameWorldAccess,
    turnEndPort,
    commandProcessor,
    commandOutcomeInterpreter,
    safeEventDispatcher,
    entityManager,
    actionDiscoverySystem,
  }) {
    super();
    if (!logger)
      throw new Error('ConcreteTurnContextFactory: logger is required.');
    if (!gameWorldAccess)
      throw new Error(
        'ConcreteTurnContextFactory: gameWorldAccess is required.'
      );
    if (!turnEndPort)
      throw new Error('ConcreteTurnContextFactory: turnEndPort is required.');
    if (!commandProcessor)
      throw new Error(
        'ConcreteTurnContextFactory: commandProcessor is required.'
      );
    if (!commandOutcomeInterpreter)
      throw new Error(
        'ConcreteTurnContextFactory: commandOutcomeInterpreter is required.'
      );
    if (!safeEventDispatcher)
      throw new Error(
        'ConcreteTurnContextFactory: safeEventDispatcher is required.'
      );
    if (!entityManager)
      throw new Error('ConcreteTurnContextFactory: entityManager is required.');
    if (!actionDiscoverySystem)
      throw new Error(
        'ConcreteTurnContextFactory: actionDiscoverySystem is required.'
      );

    this.#logger = logger;
    this.#gameWorldAccess = gameWorldAccess;
    this.#turnEndPort = turnEndPort;
    this.#commandProcessor = commandProcessor;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#entityManager = entityManager;
    this.#actionDiscoverySystem = actionDiscoverySystem;
  }

  /**
   * Creates a TurnContext instance using the cached services.
   *
   * @override
   * @param {object} params - The parameters required to create the turn context.
   * @param {Entity} params.actor
   * @param {IActorTurnStrategy} params.strategy
   * @param {OnEndTurnCallback} params.onEndTurnCallback
   * @param {BaseTurnHandler} params.handlerInstance
   * @param {function():boolean} [params.isAwaitingExternalEventProvider]
   * @param {function(boolean,string|null):void} [params.onSetAwaitingExternalEventCallback]
   * @returns {ITurnContext} The created TurnContext.
   */
  create({
    actor,
    strategy,
    onEndTurnCallback,
    handlerInstance,
    isAwaitingExternalEventProvider,
    onSetAwaitingExternalEventCallback,
  }) {
    // The `services` object is now created internally from cached dependencies.
    const servicesForContext = {
      game: this.#gameWorldAccess,
      turnEndPort: this.#turnEndPort,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
      safeEventDispatcher: this.#safeEventDispatcher,
      entityManager: this.#entityManager,
      actionDiscoverySystem: this.#actionDiscoverySystem,
    };

    return new TurnContext({
      actor,
      logger: this.#logger, // The factory now provides the logger.
      services: servicesForContext,
      strategy,
      onEndTurnCallback,
      handlerInstance,
      isAwaitingExternalEventProvider,
      onSetAwaitingExternalEventCallback,
    });
  }
}
