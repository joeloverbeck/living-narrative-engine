// src/turns/handlers/humanTurnHandler.js
/**
 * @file This module is the main handler of a turn for a human character.
 * @see src/turns/handlers/humanTurnHandler.js
 */

import { BaseTurnHandler } from './baseTurnHandler.js';
import { AwaitTurnEndState } from '../valueObjects/awaitTurnEndState.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */
/** @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState */
/** @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../../interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */

/** @typedef {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} ITurnStrategyFactory */
/** @typedef {import('../builders/turnContextBuilder.js').TurnContextBuilder} TurnContextBuilder */

class HumanTurnHandler extends BaseTurnHandler {
  /** @type {ICommandProcessor} */
  #commandProcessor;
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {IPromptCoordinator} */
  #promptCoordinator;
  /** @type {ICommandOutcomeInterpreter}*/
  #commandOutcomeInterpreter;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ITurnStrategyFactory} */
  #turnStrategyFactory;
  /** @type {TurnContextBuilder} */
  #turnContextBuilder;
  /** @type {object} */
  #gameWorldAccess;
  #entityManager;

  /**
   * @private
   * @type {AwaitTurnEndState}
   */
  #awaitState = AwaitTurnEndState.idle();
  /** @type {boolean} */
  #isTerminatingNormally = false;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory
   * @param {ICommandProcessor} deps.commandProcessor
   * @param {ITurnEndPort} deps.turnEndPort
   * @param {IPromptCoordinator} deps.promptCoordinator
   * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {ITurnStrategyFactory} deps.turnStrategyFactory
   * @param {TurnContextBuilder} deps.turnContextBuilder
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} [deps.entityManager]  Optional – improves scope helpers
   * @param {object} [deps.gameWorldAccess]
   */
  constructor({
    logger,
    turnStateFactory,
    commandProcessor,
    turnEndPort,
    promptCoordinator,
    commandOutcomeInterpreter,
    safeEventDispatcher,
    turnStrategyFactory,
    turnContextBuilder,
    entityManager,
    gameWorldAccess = {},
  }) {
    super({ logger, turnStateFactory });

    if (!commandProcessor)
      throw new Error('HumanTurnHandler: commandProcessor is required');
    if (!turnEndPort)
      throw new Error('HumanTurnHandler: turnEndPort is required');
    if (!promptCoordinator)
      throw new Error('HumanTurnHandler: promptCoordinator is required');
    if (!commandOutcomeInterpreter)
      throw new Error(
        'HumanTurnHandler: commandOutcomeInterpreter is required'
      );
    if (!safeEventDispatcher)
      throw new Error('HumanTurnHandler: safeEventDispatcher is required');
    if (!turnStrategyFactory)
      throw new Error('HumanTurnHandler: turnStrategyFactory is required');
    if (!turnContextBuilder)
      throw new Error('HumanTurnHandler: turnContextBuilder is required');

    this.#commandProcessor = commandProcessor;
    this.#turnEndPort = turnEndPort;
    this.#promptCoordinator = promptCoordinator;
    this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#turnStrategyFactory = turnStrategyFactory;
    this.#turnContextBuilder = turnContextBuilder;
    this.#gameWorldAccess = gameWorldAccess;
    this.#entityManager = entityManager ?? null; // store reference (may be null)

    const initialState = this._turnStateFactory.createInitialState(this);
    this._setInitialState(initialState);

    this._logger.debug(
      `${this.constructor.name} initialised. Dependencies assigned. Initial state set.`
    );
  }

  /**
   * @override
   * @returns {ITurnEndPort}
   */
  getTurnEndPort() {
    return this.#turnEndPort;
  }

  /**
   * @override
   * @param {Entity} actor
   */
  async startTurn(actor) {
    this._logger.debug(
      `${this.constructor.name}.startTurn called for actor ${actor?.id}.`
    );
    super._assertHandlerActive();
    if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
      const errorMsg = `${this.constructor.name}.startTurn: actor is required and must have a valid id.`;
      this._logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this._setCurrentActorInternal(actor);

    const humanStrategy = this.#turnStrategyFactory.createForHuman(actor.id);
    this._logger.debug(
      `${this.constructor.name}: Instantiated turn strategy for actor ${actor.id} via factory.`
    );

    const newTurnContext = this.#turnContextBuilder.build({
      actor,
      strategy: humanStrategy,
      onEndTurn: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
      handlerInstance: this,
      awaitFlagProvider: this._getIsAwaitingExternalTurnEndFlag.bind(this),
      setAwaitFlag: (isAwaiting, anActorId) =>
        this._markAwaitingTurnEnd(isAwaiting, anActorId),
    });

    this._setCurrentTurnContextInternal(newTurnContext);

    this._logger.debug(
      `HumanTurnHandler.startTurn: TurnContext created for actor ${actor.id} via builder.`
    );

    if (!this._currentState) {
      this._logger.error(
        `${this.constructor.name}.startTurn: _currentState is null for actor ${actor.id}.`
      );
      const fallbackInitialState =
        this._turnStateFactory.createInitialState(this);
      if (fallbackInitialState) {
        this._logger.warn(
          `${this.constructor.name}.startTurn: Attempting to set initial state again.`
        );
        this._setInitialState(fallbackInitialState);
        if (!this._currentState) {
          throw new Error(
            'HumanTurnHandler: _currentState is null, and recovery failed.'
          );
        }
      } else {
        throw new Error(
          'HumanTurnHandler: _currentState is null, and turnStateFactory failed to provide a state.'
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

  /** @private */
  _setAwaitState(newState) {
    this.#awaitState = newState;
  }

  /** @private */
  _markAwaitingTurnEnd(isAwaiting, actorId = null) {
    const prevState = this.#awaitState;
    const newState = isAwaiting
      ? AwaitTurnEndState.waitingFor(actorId)
      : AwaitTurnEndState.idle();
    this._setAwaitState(newState);
    this._logger.debug(
      `${this.constructor.name}._markAwaitingTurnEnd: ${prevState.toString()} → ${newState.toString()}`
    );
  }

  /** @private */
  _getIsAwaitingExternalTurnEndFlag() {
    return this.#awaitState.isWaiting();
  }

  /** @private */
  _clearTurnEndWaitingMechanismsInternal() {
    const prevState = this.#awaitState;
    if (prevState.isWaiting()) {
      this._logger.debug(
        `${this.constructor.name}: Clearing turn-end waiting state (was ${prevState.toString()}).`
      );
      this._setAwaitState(AwaitTurnEndState.idle());
    }
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

    if (
      !actorEntity ||
      typeof actorEntity.id !== 'string' ||
      actorEntity.id.trim() === ''
    ) {
      const errMsg = `${this.constructor.name}: handleSubmittedCommand called without valid actorEntity.`;
      this._logger.error(errMsg);
      if (currentContext && typeof currentContext.endTurn === 'function') {
        await currentContext.endTurn(
          new Error('Actor missing in handleSubmittedCommand')
        );
      } else {
        await this._handleTurnEnd(
          null,
          new Error('Actor missing in handleSubmittedCommand')
        );
      }
      return;
    }

    if (!currentContext || currentContext.getActor()?.id !== actorEntity.id) {
      const errMsg = `${this.constructor.name}: handleSubmittedCommand actor mismatch or no context. Command for ${actorEntity.id}, context actor: ${currentContext?.getActor()?.id}.`;
      this._logger.error(errMsg);
      if (currentContext && typeof currentContext.endTurn === 'function') {
        await currentContext.endTurn(
          new Error('Actor mismatch in handleSubmittedCommand')
        );
      } else {
        await this._handleTurnEnd(
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
      const err = `${this.constructor.name}: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`;
      this._logger.error(err);
      await currentContext.endTurn(new Error(err));
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
        await this._currentState.handleTurnEndedEvent(this, eventPayload);
      } else {
        this._logger.error(
          `${this.constructor.name}: No current state or state cannot handle turn ended event during no-context scenario.`
        );
      }
      // Ensure any lingering awaiting flags are cleared when no context exists
      this._clearTurnEndWaitingMechanismsInternal();
      return;
    }

    if (
      !this._currentState ||
      typeof this._currentState.handleTurnEndedEvent !== 'function'
    ) {
      this._logger.error(
        `${this.constructor.name}: handleTurnEndedEvent called, but current state ${this._currentState?.getStateName()} cannot handle it.`
      );
      await currentContext.endTurn(
        new Error(
          `Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`
        )
      );
      return;
    }

    await this._currentState.handleTurnEndedEvent(this, eventPayload);
  }
}

export default HumanTurnHandler;
