/**
 * @file This module contains the generic base class for turn handlers,
 * consolidating common logic for starting turns and managing turn-end state.
 * @see src/turns/handlers/genericTurnHandler.js
 */

import { BaseTurnHandler } from './baseTurnHandler.js';
import { AwaitTurnEndState } from '../valueObjects/awaitTurnEndState.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} ITurnStrategyFactory */

/** @typedef {import('../builders/turnContextBuilder.js').TurnContextBuilder} TurnContextBuilder */

/**
 * @abstract
 * @class GenericTurnHandler
 * @extends BaseTurnHandler
 */
class GenericTurnHandler extends BaseTurnHandler {
  /** @type {ITurnEndPort} */
  #turnEndPort;
  /** @type {ITurnStrategyFactory} */
  #strategyFactory;
  /** @type {TurnContextBuilder} */
  #turnContextBuilder;

  /**
   * @private
   * @type {AwaitTurnEndState}
   */
  #awaitState = AwaitTurnEndState.idle();

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory
   * @param {ITurnEndPort} deps.turnEndPort
   * @param {ITurnStrategyFactory} deps.strategyFactory
   * @param {TurnContextBuilder} deps.turnContextBuilder
   */
  constructor({
    logger,
    turnStateFactory,
    turnEndPort,
    strategyFactory,
    turnContextBuilder,
  }) {
    super({ logger, turnStateFactory });

    if (!turnEndPort)
      throw new Error('GenericTurnHandler: turnEndPort is required');
    if (!strategyFactory)
      throw new Error('GenericTurnHandler: strategyFactory is required');
    if (!turnContextBuilder)
      throw new Error('GenericTurnHandler: turnContextBuilder is required');

    this.#turnEndPort = turnEndPort;
    this.#strategyFactory = strategyFactory;
    this.#turnContextBuilder = turnContextBuilder;
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

    // Consolidated logic block
    const strategy = this.#strategyFactory.createForHuman(actor.id);
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

    this._setCurrentTurnContextInternal(context);
    this._logger.debug(
      `${
        this.constructor.name
      }.startTurn: TurnContext created for actor ${actor.id} via builder.`
    );

    if (!this._currentState) {
      throw new Error(
        `${this.constructor.name}.startTurn: _currentState is unexpectedly null.`
      );
    }

    await this._currentState.startTurn(this, actor);
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
      `${
        this.constructor.name
      }._markAwaitingTurnEnd: ${prevState.toString()} → ${newState.toString()}`
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
        `${
          this.constructor.name
        }: Clearing turn-end waiting state (was ${prevState.toString()}).`
      );
      this._setAwaitState(AwaitTurnEndState.idle());
    }
  }

  _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
    super._resetTurnStateAndResources(actorIdContextForLog);
    this._resetAwaitTurnEndFlags();
  }
}

export { GenericTurnHandler };
