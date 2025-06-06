// src/turns/handlers/aiTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  AITurnHandler Class (Refactored for Dependency Injection)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../interfaces/ILLMAdapter.js').LLMAdapter} LLMAdapter
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor
 * @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../events/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../../interfaces/./IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService
 * @typedef {import('../../prompting/promptBuilder.js').PromptBuilder} IPromptBuilder
 */

/**
 * @typedef {import('../interfaces/factories/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory
 * @typedef {import('../interfaces/factories/IAIPlayerStrategyFactory.js').IAIPlayerStrategyFactory} IAIPlayerStrategyFactory
 * @typedef {import('../interfaces/factories/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory
 * @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider
 * @typedef {import('../../prompting/AIPromptContentProvider.js').AIPromptContentProvider} IAIPromptContentProvider
 * @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor
 * @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory
 * @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline_Interface
 */

import { BaseTurnHandler } from './baseTurnHandler.js';

/**
 * @class AITurnHandler
 * @augments BaseTurnHandler
 * @description
 * Handles turns for AI-controlled actors. Relies on injected factories and services for its operations.
 */
export class AITurnHandler extends BaseTurnHandler {
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {object} */
  #gameWorldAccess;
  /** @type {LLMAdapter} */ // FIXED: Corrected type
  #llmAdapter;
  /** @type {ICommandProcessor} */
  #commandProcessor;
  /** @type {ICommandOutcomeInterpreter} */
  #commandOutcomeInterpreter;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {SubscriptionLifecycleManager} */
  #subscriptionManager;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IActionDiscoveryService} */
  #actionDiscoverySystem;
  /** @type {IPromptBuilder} */
  #promptBuilder;
  /** @type {IAIFallbackActionFactory} */
  #aiFallbackActionFactory;
  /** @type {IAIPlayerStrategyFactory} */
  #aiPlayerStrategyFactory;
  /** @type {ITurnContextFactory} */
  #turnContextFactory;
  /** @type {IAIGameStateProvider} */
  #gameStateProvider;
  /** @type {IAIPromptContentProvider} */
  #promptContentProvider;
  /** @type {ILLMResponseProcessor} */
  #llmResponseProcessor;
  /** @type {IAIPromptPipeline_Interface} */
  #aiPromptPipeline;

  #aiIsAwaitingExternalEvent = false;
  #aiAwaitingExternalEventForActorId = null;

  /**
   * Creates an instance of AITurnHandler.
   *
   * @param {object} dependencies - The dependencies required by the handler.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {ITurnStateFactory} dependencies.turnStateFactory - Factory for creating turn states.
   * @param {ITurnEndPort} dependencies.turnEndPort
   * @param {object} dependencies.gameWorldAccess
   * @param {LLMAdapter} dependencies.llmAdapter
   * @param {ICommandProcessor} dependencies.commandProcessor
   * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
   * @param {SubscriptionLifecycleManager} dependencies.subscriptionManager
   * @param {IEntityManager} dependencies.entityManager
   * @param {IActionDiscoveryService} dependencies.actionDiscoverySystem
   * @param {IPromptBuilder} dependencies.promptBuilder
   * @param {IAIPlayerStrategyFactory} dependencies.aiPlayerStrategyFactory
   * @param {ITurnContextFactory} dependencies.turnContextFactory
   * @param {IAIGameStateProvider} dependencies.gameStateProvider
   * @param {IAIPromptContentProvider} dependencies.promptContentProvider
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor
   * @param {IAIFallbackActionFactory} dependencies.aiFallbackActionFactory
   * @param {IAIPromptPipeline_Interface} dependencies.aiPromptPipeline
   */
  constructor({
    logger,
    turnStateFactory,
    turnEndPort,
    gameWorldAccess,
    llmAdapter, // FIXED: Corrected parameter name
    commandProcessor,
    commandOutcomeInterpreter,
    safeEventDispatcher,
    subscriptionManager,
    entityManager,
    actionDiscoverySystem,
    promptBuilder,
    aiFallbackActionFactory,
    aiPlayerStrategyFactory,
    turnContextFactory,
    gameStateProvider,
    promptContentProvider,
    llmResponseProcessor,
    aiPromptPipeline,
  }) {
    super({ logger, turnStateFactory });

    if (!turnEndPort) throw new Error('AITurnHandler: Invalid ITurnEndPort');
    if (!gameWorldAccess)
      throw new Error('AITurnHandler: Missing gameWorldAccess');
    if (!llmAdapter) throw new Error('AITurnHandler: Invalid LLMAdapter'); // FIXED: Corrected check
    if (!commandProcessor)
      throw new Error('AITurnHandler: Invalid ICommandProcessor');
    if (!commandOutcomeInterpreter)
      throw new Error('AITurnHandler: Invalid ICommandOutcomeInterpreter');
    if (!safeEventDispatcher)
      throw new Error('AITurnHandler: Invalid ISafeEventDispatcher');
    if (!subscriptionManager)
      throw new Error('AITurnHandler: Invalid SubscriptionLifecycleManager');
    if (!entityManager)
      throw new Error('AITurnHandler: Invalid IEntityManager');
    if (!actionDiscoverySystem)
      throw new Error('AITurnHandler: Invalid IActionDiscoveryService');
    if (!promptBuilder)
      throw new Error('AITurnHandler: Invalid IPromptBuilder');
    if (!aiFallbackActionFactory)
      throw new Error('AITurnHandler: Invalid IAIFallbackActionFactory');
    if (!aiPlayerStrategyFactory)
      throw new Error('AITurnHandler: Invalid IAIPlayerStrategyFactory');
    if (!turnContextFactory)
      throw new Error('AITurnHandler: Invalid ITurnContextFactory');
    if (!gameStateProvider)
      throw new Error('AITurnHandler: Invalid IAIGameStateProvider');
    if (!promptContentProvider)
      throw new Error('AITurnHandler: Invalid IAIPromptContentProvider');
    if (!llmResponseProcessor)
      throw new Error('AITurnHandler: Invalid ILLMResponseProcessor');
    if (!aiPromptPipeline)
      throw new Error('AITurnHandler: Invalid IAIPromptPipeline');

    this.#turnEndPort = turnEndPort;
    this.#gameWorldAccess = gameWorldAccess;
    this.#llmAdapter = llmAdapter; // FIXED: Corrected assignment
    this.#commandProcessor = commandProcessor;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#subscriptionManager = subscriptionManager;
    this.#entityManager = entityManager;
    this.#actionDiscoverySystem = actionDiscoverySystem;
    this.#promptBuilder = promptBuilder;
    this.#aiFallbackActionFactory = aiFallbackActionFactory;
    this.#aiPlayerStrategyFactory = aiPlayerStrategyFactory;
    this.#turnContextFactory = turnContextFactory;
    this.#gameStateProvider = gameStateProvider;
    this.#promptContentProvider = promptContentProvider;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#aiPromptPipeline = aiPromptPipeline;

    this.#aiIsAwaitingExternalEvent = false;
    this.#aiAwaitingExternalEventForActorId = null;

    const initialState = this._turnStateFactory.createInitialState(this);
    this._setInitialState(initialState);
    this._logger.debug(
      `${this.constructor.name} initialized successfully with injected dependencies.`
    );
  }

  _getAIIsAwaitingExternalEventFlag() {
    const currentActorInContext = this.getTurnContext()?.getActor();
    if (
      this.#aiIsAwaitingExternalEvent &&
      this.#aiAwaitingExternalEventForActorId === currentActorInContext?.id
    ) {
      return true;
    }
    if (
      this.#aiIsAwaitingExternalEvent &&
      this.#aiAwaitingExternalEventForActorId !== currentActorInContext?.id
    ) {
      this._logger.warn(
        `${this.constructor.name}._getAIIsAwaitingExternalEventFlag: Flag true for ${this.#aiAwaitingExternalEventForActorId}, context actor ${currentActorInContext?.id}.`
      );
    }
    return false;
  }

  _setAIIsAwaitingExternalEventFlag(isAwaiting, actorId) {
    const currentActorInContext = this.getTurnContext()?.getActor();
    if (actorId !== currentActorInContext?.id) {
      this._logger.error(
        `${this.constructor.name}._setAIIsAwaitingExternalEventFlag: Actor mismatch. Attempt for ${actorId}, context ${currentActorInContext?.id}.`
      );
      return;
    }
    this.#aiIsAwaitingExternalEvent = !!isAwaiting;
    this.#aiAwaitingExternalEventForActorId = this.#aiIsAwaitingExternalEvent
      ? actorId
      : null;
    this._logger.debug(
      `${this.constructor.name}._setAIIsAwaitingExternalEventFlag: AI waiting flag for actor ${actorId} set to ${this.#aiIsAwaitingExternalEvent}.`
    );
  }

  async startTurn(actor) {
    this._logger.debug(
      `${this.constructor.name}.startTurn called for AI actor ${actor?.id}.`
    );
    super._assertHandlerActive();

    if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
      this._logger.error(
        `${this.constructor.name}.startTurn: actor is required and must have a valid id.`
      );
      throw new Error(`${this.constructor.name}.startTurn: actor is required.`);
    }
    this._setCurrentActorInternal(actor);

    const aiStrategy = this.#aiPlayerStrategyFactory.create({
      llmAdapter: this.#llmAdapter, // FIXED: Now consistent
      aiPromptPipeline: this.#aiPromptPipeline,
      llmResponseProcessor: this.#llmResponseProcessor,
      aiFallbackActionFactory: this.#aiFallbackActionFactory,
      logger: this._logger,
    });

    const servicesForContext = {
      game: this.#gameWorldAccess,
      turnEndPort: this.#turnEndPort,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
      safeEventDispatcher: this.#safeEventDispatcher,
      subscriptionManager: this.#subscriptionManager,
      entityManager: this.#entityManager,
      actionDiscoverySystem: this.#actionDiscoverySystem,
    };

    const newTurnContext = this.#turnContextFactory.create({
      actor: actor,
      logger: this._logger,
      services: servicesForContext,
      strategy: aiStrategy,
      onEndTurnCallback: (errorOrNull) =>
        this._handleTurnEnd(actor.id, errorOrNull),
      isAwaitingExternalEventProvider:
        this._getAIIsAwaitingExternalEventFlag.bind(this),
      onSetAwaitingExternalEventCallback:
        this._setAIIsAwaitingExternalEventFlag.bind(this),
      handlerInstance: this,
    });
    this._setCurrentTurnContextInternal(newTurnContext);

    if (!this._currentState) {
      this._logger.error(
        `${this.constructor.name}.startTurn: _currentState is null for actor ${actor.id}. This should have been set by turnStateFactory.`
      );
      const fallbackInitialState =
        this._turnStateFactory.createInitialState(this);
      if (fallbackInitialState) {
        this._logger.warn(
          `${this.constructor.name}.startTurn: Attempting to set initial state again.`
        );
        this._setInitialState(fallbackInitialState);
        if (!this._currentState)
          throw new Error(
            'AITurnHandler: _currentState is null, and recovery failed.'
          );
      } else {
        throw new Error(
          'AITurnHandler: _currentState is null, and turnStateFactory failed to provide a state.'
        );
      }
    }
    await this._currentState.startTurn(this, actor);
    this._logger.info(
      `${this.constructor.name}.startTurn: Turn for AI actor ${actor.id} delegated.`
    );
  }

  _resetTurnStateAndResources(logContext = 'N/A') {
    super._resetTurnStateAndResources(logContext);
    this.#aiIsAwaitingExternalEvent = false;
    this.#aiAwaitingExternalEventForActorId = null;
    this._logger.debug(
      `${this.constructor.name}: AI 'isAwaitingExternalEvent' flags reset. Context: '${logContext}'.`
    );
  }

  async destroy() {
    if (this._isDestroyed) return;
    this._logger.info(`${this.constructor.name}.destroy() invoked.`);
    if (
      this.#llmAdapter && // FIXED: Corrected property name
      typeof this.#llmAdapter.cancelOngoingOperations === 'function' // FIXED: Corrected property name
    ) {
      try {
        await Promise.resolve(this.#llmAdapter.cancelOngoingOperations()); // FIXED: Corrected property name
      } catch (e) {
        this._logger.warn(
          `${this.constructor.name}: Error cancelling LLMAdapter ops: ${e.message}`,
          e
        );
      }
    }
    this.#aiIsAwaitingExternalEvent = false;
    this.#aiAwaitingExternalEventForActorId = null;
    await super.destroy();
    this._logger.debug(`${this.constructor.name}.destroy() complete.`);
  }
}

export default AITurnHandler;
