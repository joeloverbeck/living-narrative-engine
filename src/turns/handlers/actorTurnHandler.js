/**
 * @file Defines the ActorTurnHandler which unifies turn handling for any actor type.
 */

import { GenericTurnHandler } from './genericTurnHandler.js';
import { ActorMismatchError } from '../../errors/actorMismatchError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} ITurnStrategyFactory */
/** @typedef {import('../builders/turnContextBuilder.js').TurnContextBuilder} TurnContextBuilder */
/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @class ActorTurnHandler
 * @augments GenericTurnHandler
 * @description Generic handler for any actor's turn.
 */
class ActorTurnHandler extends GenericTurnHandler {
  /** @type {boolean} */
  #hasSignalledNormalEnd = false;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory
   * @param {ITurnEndPort} deps.turnEndPort
   * @param {ITurnStrategyFactory} [deps.turnStrategyFactory]
   * @param {ITurnStrategyFactory} [deps.strategyFactory]
   * @param {TurnContextBuilder} deps.turnContextBuilder
   */
  constructor({
    logger,
    turnStateFactory,
    turnEndPort,
    turnStrategyFactory,
    strategyFactory,
    turnContextBuilder,
  }) {
    const factory = turnStrategyFactory || strategyFactory;
    super({
      logger,
      turnStateFactory,
      turnEndPort,
      strategyFactory: factory,
      turnContextBuilder,
    });

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
    await super.startTurn(actor);
  }

  _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
    const logCtx =
      actorIdContextForLog || (this.getCurrentActor()?.id ?? 'ATH-reset');
    this._logger.debug(
      `${this.constructor.name}._resetTurnStateAndResources specific cleanup for '${logCtx}'.`
    );
    super._resetTurnStateAndResources(logCtx);

    this.#hasSignalledNormalEnd = false;
    this._logger.debug(
      `${this.constructor.name}: Actor-specific state reset complete for '${logCtx}'.`
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
      `${this.constructor.name}.destroy() invoked. Current state: ${this._currentState?.getStateName()}`
    );

    await super.destroy();

    this._logger.debug(`${this.constructor.name}.destroy() cleanup complete.`);
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

    if (!currentContext) {
      this._logger.warn(
        `${this.constructor.name}: handleTurnEndedEvent received without an active turn context. This is usually a safe, recoverable condition. Event for entity: ${eventPayload?.entityId ?? 'N/A'}`
      );
      this._resetAwaitTurnEndFlags();

      if (
        this._currentState &&
        typeof this._currentState.handleTurnEndedEvent === 'function'
      ) {
        await this._currentState.handleTurnEndedEvent(this, eventPayload);
      }
      return;
    }

    try {
      this._ensureStateCanHandleTurnEndEvent();
      await this._currentState.handleTurnEndedEvent(this, eventPayload);
    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Error while delegating 'handleTurnEndedEvent' to state '${this._currentState?.getStateName()}': ${error.message}`,
        { error }
      );
      await currentContext.endTurn(error);
    }
  }
}

export { ActorTurnHandler };
export default ActorTurnHandler;
