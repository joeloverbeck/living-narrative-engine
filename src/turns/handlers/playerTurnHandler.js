// src/turns/handlers/playerTurnHandler.js
// ****** MODIFIED FILE ******
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – MODIFIED TO EXTEND BaseTurnHandler & USE ITurnContext
// ──────────────────────────────────────────────────────────────────────────────

import { BaseTurnHandler } from './baseTurnHandler.js';
import { TurnContext } from '../context/turnContext.js'; // Adjusted path relative to src/turns/handlers/
import { HumanPlayerStrategy } from '../strategies/humanPlayerStrategy.js'; // Adjusted path

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState */
/** @typedef {import('../interfaces/factories/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */

class PlayerTurnHandler extends BaseTurnHandler {
  /** @type {ICommandProcessor} */
  #commandProcessor;
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {IPromptCoordinator} */
  #playerPromptService;
  /** @type {ICommandOutcomeInterpreter} */
  #commandOutcomeInterpreter;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
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
   * @param {IPromptCoordinator} deps.playerPromptService
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
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

    this.#commandProcessor = commandProcessor;
    this.#turnEndPort = turnEndPort;
    this.#playerPromptService = playerPromptService;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#safeEventDispatcher = safeEventDispatcher;
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
      // REMOVED: subscriptionManager: this.#subscriptionManager,
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

    // REMOVED: The call to subscriptionManager.unsubscribeAll() is no longer needed.
    // Individual states are responsible for cleaning up their own subscriptions via
    // their exitState/destroy methods, which is a more robust pattern.

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
    this._logger.debug(
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
