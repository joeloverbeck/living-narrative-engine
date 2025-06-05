// src/turns/handlers/playerTurnHandler.js
// (Assuming this path is correct based on your test output context)
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – MODIFIED TO EXTEND BaseTurnHandler & USE ITurnContext
// ──────────────────────────────────────────────────────────────────────────────

import { BaseTurnHandler } from './baseTurnHandler.js';
import { TurnContext } from '../context/turnContext.js'; // Adjusted path relative to src/turns/handlers/
import { HumanPlayerStrategy } from '../strategies/humanPlayerStrategy.js'; // Adjusted path

// This import might not be strictly necessary if SubscriptionLifecycleManagerType is well-defined elsewhere
// and only its instance is passed. However, keeping for potential type inference or direct use if any.
import ActualSubscriptionLifecycleManagerClass from '../../events/subscriptionLifecycleManager.js'; // Adjusted path

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
// Use the actual class for type if it's imported, otherwise a generic 'object' or a specific interface
/** @typedef {ActualSubscriptionLifecycleManagerClass} SubscriptionLifecycleManagerType */

/** @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState */
/** @typedef {import('../interfaces/factories/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */

class PlayerTurnHandler extends BaseTurnHandler {
  /** @type {ICommandProcessor} */
  #commandProcessor;
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {IPlayerPromptService} */
  #playerPromptService;
  /** @type {ICommandOutcomeInterpreter} */
  #commandOutcomeInterpreter;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {SubscriptionLifecycleManagerType} */
  #subscriptionManager; // This internal field name is fine, it's how it's stored.
  /** @type {object} */
  #gameWorldAccess;

  /** @type {boolean} */
  #isAwaitingTurnEndEvent = false;
  /** @type {string|null} */
  #awaitingTurnEndForActorId = null;
  /** @type {boolean} */
  #isTerminatingNormally = false;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory
   * @param {ICommandProcessor} deps.commandProcessor
   * @param {ITurnEndPort} deps.turnEndPort
   * @param {IPlayerPromptService} deps.playerPromptService
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {SubscriptionLifecycleManagerType} deps.subscriptionLifecycleManager // <<<< CORRECTED PARAMETER NAME
   * @param {object} [deps.gameWorldAccess]
   */
  constructor({
    logger,
    turnStateFactory,
    commandProcessor,
    turnEndPort,
    playerPromptService,
    commandOutcomeInterpreter,
    safeEventDispatcher,
    subscriptionLifecycleManager, // <<<< CORRECTED PARAMETER NAME to match DI container's output
    gameWorldAccess = {},
  }) {
    super({ logger, turnStateFactory });

    if (!commandProcessor)
      throw new Error('PlayerTurnHandler: commandProcessor is required');
    if (!turnEndPort)
      throw new Error('PlayerTurnHandler: turnEndPort is required');
    if (!playerPromptService)
      throw new Error('PlayerTurnHandler: playerPromptService is required');
    if (!commandOutcomeInterpreter)
      throw new Error(
        'PlayerTurnHandler: commandOutcomeInterpreter is required'
      );
    if (!safeEventDispatcher)
      throw new Error('PlayerTurnHandler: safeEventDispatcher is required');
    // --- CORRECTED CHECK BELOW ---
    // The check is now on the corrected constructor parameter `subscriptionLifecycleManager`
    if (!subscriptionLifecycleManager)
      throw new Error(
        'PlayerTurnHandler: injected subscriptionManager is required'
      );
    // --- END CORRECTION ---

    this.#commandProcessor = commandProcessor;
    this.#turnEndPort = turnEndPort;
    this.#playerPromptService = playerPromptService;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#safeEventDispatcher = safeEventDispatcher;
    // --- CORRECTED ASSIGNMENT BELOW ---
    this.#subscriptionManager = subscriptionLifecycleManager; // Assigns the (now validated) injected instance
    // --- END CORRECTION ---
    this.#gameWorldAccess = gameWorldAccess;

    const initialState = this._turnStateFactory.createInitialState(this);
    this._setInitialState(initialState);

    this._logger.debug(
      `${this.constructor.name} initialised. Dependencies assigned. Initial state set.`
    );
  }

  /**
   * @override
   * @param {Entity} actor
   */
  async startTurn(actor) {
    super._assertHandlerActive();

    if (!actor) {
      this._logger.error('PlayerTurnHandler.startTurn: actor is required.');
      throw new Error('PlayerTurnHandler.startTurn: actor is required.');
    }
    this._setCurrentActorInternal(actor);

    const humanPlayerStrategy = new HumanPlayerStrategy();
    this._logger.debug(
      `${this.constructor.name}: Instantiated HumanPlayerStrategy for actor ${actor.id}.`
    );

    /** @type {TurnContextServices} */
    const servicesForContext = {
      playerPromptService: this.#playerPromptService,
      game: this.#gameWorldAccess,
      commandProcessor: this.#commandProcessor,
      commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
      safeEventDispatcher: this.#safeEventDispatcher,
      subscriptionManager: this.#subscriptionManager, // This will now be a valid instance
      turnEndPort: this.#turnEndPort,
    };

    const newTurnContext = new TurnContext({
      actor: actor,
      logger: this._logger,
      services: servicesForContext,
      strategy: humanPlayerStrategy,
      onEndTurnCallback: (errorOrNull) =>
        this._handleTurnEnd(actor.id, errorOrNull),
      isAwaitingExternalEventProvider:
        this._getIsAwaitingExternalTurnEndFlag.bind(this),
      onSetAwaitingExternalEventCallback: (isAwaiting, anActorId) =>
        this._markAwaitingTurnEnd(isAwaiting, anActorId),
      handlerInstance: this,
    });
    this._setCurrentTurnContextInternal(newTurnContext);

    this._logger.debug(
      `PlayerTurnHandler.startTurn: TurnContext created for actor ${actor.id} with HumanPlayerStrategy.`
    );

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
            'PlayerTurnHandler: _currentState is null, and recovery failed.'
          );
      } else {
        throw new Error(
          'PlayerTurnHandler: _currentState is null, and turnStateFactory failed to provide a state.'
        );
      }
    }
    await this._currentState.startTurn(this, actor);
  }

  _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
    const logCtx =
      actorIdContextForLog || (this.getCurrentActor()?.id ?? 'PTH-reset');
    this._logger.debug(
      `${this.constructor.name}._resetTurnStateAndResources specific cleanup for '${logCtx}'.`
    );
    super._resetTurnStateAndResources(logCtx);
    this._clearTurnEndWaitingMechanismsInternal();
    try {
      if (
        this.#subscriptionManager &&
        typeof this.#subscriptionManager.unsubscribeAll === 'function'
      ) {
        this.#subscriptionManager.unsubscribeAll();
        this._logger.debug(
          `${this.constructor.name}: All subscriptions managed by SubscriptionLifecycleManager unsubscribed for '${logCtx}'.`
        );
      } else {
        this._logger.warn(
          `${this.constructor.name}: SubscriptionManager not available or unsubscribeAll not a function during reset for '${logCtx}'.`
        );
      }
    } catch (err) {
      this._logger.warn(
        `${this.constructor.name}: unsubscribeAll failed during reset for '${logCtx}' – ${err.message}`,
        err
      );
    }
    this.#isTerminatingNormally = false;
    this._logger.debug(
      `${this.constructor.name}: Player-specific state reset complete for '${logCtx}'.`
    );
  }

  async destroy() {
    if (this._isDestroyed) {
      this._logger.debug(
        `${this.constructor.name}.destroy() called but already destroyed.`
      );
      return;
    }
    this._logger.info(
      `${this.constructor.name}.destroy() invoked (Player specific part). Current state: ${this._currentState?.getStateName()}`
    );
    await super.destroy();
    this._logger.debug(
      `${this.constructor.name}.destroy() player-specific handling complete (delegated most to base).`
    );
  }

  _markAwaitingTurnEnd(isAwaiting, actorId = null) {
    const prevFlag = this.#isAwaitingTurnEndEvent;
    const prevActor = this.#awaitingTurnEndForActorId;
    this.#isAwaitingTurnEndEvent = Boolean(isAwaiting);
    this.#awaitingTurnEndForActorId = this.#isAwaitingTurnEndEvent
      ? (actorId ?? null)
      : null;
    this._logger.debug(
      `${this.constructor.name}._markAwaitingTurnEnd: ${prevFlag}/${prevActor} \u2192 ${this.#isAwaitingTurnEndEvent}/${this.#awaitingTurnEndForActorId}`
    );
  }

  _getIsAwaitingExternalTurnEndFlag() {
    return this.#isAwaitingTurnEndEvent;
  }

  _clearTurnEndWaitingMechanismsInternal() {
    if (this.#isAwaitingTurnEndEvent || this.#awaitingTurnEndForActorId) {
      this._logger.debug(
        `${this.constructor.name}: Clearing turn-end waiting flags (was ${this.#isAwaitingTurnEndEvent} for ${this.#awaitingTurnEndForActorId}).`
      );
    }
    this._markAwaitingTurnEnd(false);
  }

  signalNormalApparentTermination() {
    this.#isTerminatingNormally = true;
    this._logger.debug(
      `${this.constructor.name}: Normal apparent termination signaled.`
    );
  }

  async onEnterState(currentState, previousState) {
    await super.onEnterState(currentState, previousState);
  }

  async onExitState(currentState, nextState) {
    await super.onExitState(currentState, nextState);
  }

  async handleSubmittedCommand(commandString, actorEntity) {
    this._assertHandlerActive();
    const currentContext = this.getTurnContext();
    if (!currentContext || currentContext.getActor()?.id !== actorEntity.id) {
      const errMsg = `${this.constructor.name}: handleSubmittedCommand actor mismatch or no context. Command for ${actorEntity.id}, context actor: ${currentContext?.getActor()?.id}.`;
      this._logger.error(errMsg);
      if (currentContext && typeof currentContext.endTurn === 'function') {
        currentContext.endTurn(
          new Error('Actor mismatch in handleSubmittedCommand')
        );
      } else {
        this._handleTurnEnd(
          actorEntity.id,
          new Error('No context in handleSubmittedCommand')
        );
      }
      return;
    }

    if (
      !this._currentState ||
      typeof this._currentState.handleSubmittedCommand !== 'function'
    ) {
      const errMsg = `${this.constructor.name}: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`;
      this._logger.error(errMsg);
      currentContext.endTurn(new Error(errMsg));
      return;
    }
    await this._currentState.handleSubmittedCommand(
      this,
      commandString,
      actorEntity
    );
  }

  async handleTurnEndedEvent(payload) {
    this._assertHandlerActive();
    const currentContext = this.getTurnContext();
    const eventPayload = payload?.payload;

    if (!currentContext) {
      this._logger.error(
        `${this.constructor.name}: handleTurnEndedEvent called but no ITurnContext is active. Payload actor: ${eventPayload?.entityId}`
      );
      if (
        this._currentState &&
        typeof this._currentState.handleTurnEndedEvent === 'function'
      ) {
        await this._currentState.handleTurnEndedEvent(this, payload);
      } else {
        this._logger.error(
          `${this.constructor.name}: No current state or state cannot handle turn ended event during no-context scenario.`
        );
      }
      return;
    }

    if (
      !this._currentState ||
      typeof this._currentState.handleTurnEndedEvent !== 'function'
    ) {
      this._logger.error(
        `${this.constructor.name}: handleTurnEndedEvent called, but current state ${this._currentState?.getStateName()} cannot handle it.`
      );
      currentContext.endTurn(
        new Error(
          `Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`
        )
      );
      return;
    }
    await this._currentState.handleTurnEndedEvent(this, payload);
  }
}

export default PlayerTurnHandler;
