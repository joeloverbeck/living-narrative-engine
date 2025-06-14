/**
 * @file This module is the main handler of a turn for a human character.
 * @see src/turns/handlers/humanTurnHandler.js
 */

import { BaseTurnHandler } from './baseTurnHandler.js';
import { AwaitTurnEndState } from '../valueObjects/awaitTurnEndState.js';
import { ActorMismatchError } from '../../errors/actorMismatchError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
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
  #hasSignalledNormalEnd = false;

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
    this._assertHandlerActive();
    this._assertValidActor(actor, 'startTurn');

    const strategy = this.#turnStrategyFactory.createForHuman(actor.id);
    this._logger.debug(
      `${this.constructor.name}: Instantiated turn strategy for actor ${actor.id} via factory.`
    );

    const context = this.#turnContextBuilder.build({
      actor,
      strategy,
      onEndTurn: (err) => this._handleTurnEnd(actor.id, err),
      awaitFlagProvider: this._getIsAwaitingExternalTurnEndFlag.bind(this),
      setAwaitFlag: (awaiting, id) => this._markAwaitingTurnEnd(awaiting, id),
    });

    // This single call activates the context and sets the current actor
    this._setCurrentTurnContextInternal(context);
    this._logger.debug(
      `HumanTurnHandler.startTurn: TurnContext created for actor ${actor.id} via builder.`
    );

    if (!this._currentState) {
      // This case should not be hit if constructor logic is sound.
      // The complex recovery logic is removed as per T-007.
      throw new Error(
        'HumanTurnHandler.startTurn: _currentState is unexpectedly null.'
      );
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
    this._resetAwaitTurnEndFlags();

    this.#hasSignalledNormalEnd = false;
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

  /**
   * @private
   * @param {Entity} actor The actor entity to validate.
   * @param {string} operationName The name of the operation performing the check.
   * @throws {Error} If the actor is invalid.
   */
  _assertValidActor(actor, operationName) {
    if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
      const errorMsg = `${this.constructor.name}.${operationName}: actor is required and must have a valid id.`;
      this._logger.error(errorMsg);
      throw new Error(errorMsg);
    }
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
  _resetAwaitTurnEndFlags() {
    const prevState = this.#awaitState;
    if (prevState.isWaiting()) {
      this._logger.debug(
        `${this.constructor.name}: Clearing turn-end waiting state (was ${prevState.toString()}).`
      );
      this._setAwaitState(AwaitTurnEndState.idle());
    }
  }

  signalNormalApparentTermination() {
    this.#hasSignalledNormalEnd = true;
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

  /**
   * @private
   * @param {Entity} actorEntity The actor entity attempting to execute the command.
   * @returns {ITurnContext} The current turn context if validation passes.
   * @throws {ActorMismatchError} If the actor is invalid or doesn't match the active turn context.
   */
  _ensureActorAndContextMatch(actorEntity) {
    try {
      this._assertValidActor(actorEntity, 'handleSubmittedCommand');
    } catch (err) {
      throw new ActorMismatchError(
        'A valid actor must be provided to handle a command.',
        {
          expectedActorId: this.getTurnContext()?.getActor()?.id ?? 'Unknown',
          actualActorId: null,
          operation: 'handleSubmittedCommand',
        }
      );
    }

    const currentContext = this.getTurnContext();
    const actualId = actorEntity.id;
    const expectedId = currentContext?.getActor()?.id;

    if (!currentContext) {
      throw new ActorMismatchError(
        `Cannot handle command for actor '${actualId}'; no active turn context.`,
        {
          expectedActorId: 'Unknown (no context)',
          actualActorId: actualId,
          operation: 'handleSubmittedCommand',
        }
      );
    }

    if (expectedId !== actualId) {
      throw new ActorMismatchError(
        `Actor mismatch: command for '${actualId}' but current context is for '${expectedId}'.`,
        {
          expectedActorId: expectedId,
          actualActorId: actualId,
          operation: 'handleSubmittedCommand',
        }
      );
    }

    return currentContext;
  }

  async handleSubmittedCommand(commandString, actorEntity) {
    this._assertHandlerActive();
    let currentContext;

    try {
      currentContext = this._ensureActorAndContextMatch(actorEntity);
    } catch (error) {
      this._logger.error(`${this.constructor.name}: ${error.message}`, {
        expectedId: error.expectedActorId,
        actualId: error.actualActorId,
        name: error.name,
      });

      const contextToEnd = this.getTurnContext();
      if (contextToEnd) {
        await contextToEnd.endTurn(error);
      } else {
        await this._handleTurnEnd(actorEntity?.id, error);
      }
      return;
    }

    if (typeof this._currentState?.handleSubmittedCommand !== 'function') {
      const err = `${
        this.constructor.name
      }: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`;
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

  /**
   * @private
   * @throws {Error} If the current state is null or cannot handle a turn ended event.
   */
  _ensureStateCanHandleTurnEndEvent() {
    if (
      !this._currentState ||
      typeof this._currentState.handleTurnEndedEvent !== 'function'
    ) {
      throw new Error(
        `Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`
      );
    }
  }

  async handleTurnEndedEvent(payload) {
    this._assertHandlerActive();
    const currentContext = this.getTurnContext();
    const eventPayload = payload?.payload;

    // Path A: No active turn. This is a recoverable state, often due to a late-arriving event
    // after a turn has already concluded for other reasons.
    if (!currentContext) {
      this._logger.warn(
        `${this.constructor.name}: handleTurnEndedEvent received without an active turn context. This is usually a safe, recoverable condition. Event for entity: ${
          eventPayload?.entityId ?? 'N/A'
        }`
      );
      // The await flag must be reset. This event might be what we were waiting for,
      // even if the turn ended via another mechanism in the meantime.
      this._resetAwaitTurnEndFlags();

      // Even without a context, the current state (e.g., Idle) might need to react.
      if (
        this._currentState &&
        typeof this._currentState.handleTurnEndedEvent === 'function'
      ) {
        await this._currentState.handleTurnEndedEvent(this, eventPayload);
      }
      return;
    }

    // Path B: An active turn exists. Delegate handling to the current state.
    try {
      this._ensureStateCanHandleTurnEndEvent();
      await this._currentState.handleTurnEndedEvent(this, eventPayload);
    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Error while delegating 'handleTurnEndedEvent' to state '${this._currentState?.getStateName()}': ${
          error.message
        }`,
        { error }
      );
      // A failure at this stage is a fatal error for the turn.
      await currentContext.endTurn(error);
    }
  }
}

export default HumanTurnHandler;
