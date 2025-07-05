// src/turns/states/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import("../interfaces/ICommandHandlingState.js").ICommandHandlingState} ICommandHandlingState
 * @typedef {import("../interfaces/ITurnLifecycleState.js").ITurnLifecycleState} ITurnLifecycleState_Interface
 * @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { UNKNOWN_ENTITY_ID } from '../../constants/unknownIds.js';
import { getLogger } from './helpers/contextUtils.js';
import {
  assertValidActor,
  validateActorInContext,
} from './helpers/validationUtils.js';
import { warnNoActiveTurn } from '../../utils/warnUtils.js';

/**
 * @class TurnIdleState
 * @augments AbstractTurnState_Base
 * @implements {ICommandHandlingState}
 * @implements {ITurnLifecycleState_Interface}
 */
export class TurnIdleState extends AbstractTurnState {
  /** @override */
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);

    const logger = getLogger(null, handler);
    logger.debug(
      `${this.getStateName()}: Ensuring clean state by calling handler.resetStateAndResources().`
    );
    handler.resetStateAndResources(`enterState-${this.getStateName()}`);
    logger.debug(
      `${this.getStateName()}: Entry complete. Handler is now idle.`
    );
  }

  /** @override */
  async exitState(handler, nextState) {
    await super.exitState(handler, nextState);
  }

  /** @override */
  async startTurn(handler, actorEntity) {
    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);

    const actorIdForLog = actorEntity?.id ?? UNKNOWN_ENTITY_ID;
    logger.debug(
      `${this.getStateName()}: Received startTurn for actor ${actorIdForLog}.`
    );

    this._validateActorEntity(handler, actorEntity, logger);
    this._validateTurnContext(handler, turnCtx, actorIdForLog, logger);
    const contextActor = this._validateActorMatch(
      handler,
      turnCtx,
      actorEntity,
      logger
    );

    logger.debug(
      `${this.getStateName()}: ITurnContext confirmed for actor ${contextActor.id}. Transitioning to AwaitingActorDecisionState.`
    );

    await this._requestAwaitingInput(turnCtx, contextActor, handler, logger);
  }

  /**
   * @description Validates the provided actor entity.
   * @param {BaseTurnHandler} handler - Owning handler.
   * @param {Entity} actorEntity - Actor entity provided.
   * @param {import('../../utils/loggerUtils.js').Logger} logger - Logger instance.
   */
  _validateActorEntity(handler, actorEntity, logger) {
    const errorMsg = assertValidActor(actorEntity, this.getStateName());
    if (errorMsg) {
      logger.error(errorMsg);
      handler.resetStateAndResources(`invalid-actor-${this.getStateName()}`);
      handler.requestIdleStateTransition();
      throw new Error(errorMsg);
    }
  }

  /**
   * @description Ensures a valid ITurnContext is present.
   * @param {BaseTurnHandler} handler - Owning handler.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {string} actorIdForLog - Actor ID for logging.
   * @param {import('../../utils/loggerUtils.js').Logger} logger - Logger instance.
   */
  _validateTurnContext(handler, turnCtx, actorIdForLog, logger) {
    try {
      validateActorInContext(turnCtx, null, this.getStateName());
    } catch {
      const errorMsg = `${this.getStateName()}: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${actorIdForLog}.`;
      logger.error(errorMsg);
      handler.resetStateAndResources(`missing-context-${this.getStateName()}`);
      handler.requestIdleStateTransition();
      throw new Error(errorMsg);
    }
  }

  /**
   * @description Validates that the context actor matches the provided actor.
   * @param {BaseTurnHandler} handler - Owning handler.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actorEntity - Actor entity provided.
   * @param {import('../../utils/loggerUtils.js').Logger} logger - Logger instance.
   * @returns {Entity} The actor from context.
   */
  _validateActorMatch(handler, turnCtx, actorEntity, logger) {
    try {
      return validateActorInContext(turnCtx, actorEntity, this.getStateName());
    } catch (err) {
      const errorMsg = err.message;
      logger.error(errorMsg);
      handler.resetStateAndResources(`actor-mismatch-${this.getStateName()}`);
      handler.requestIdleStateTransition();
      throw err;
    }
  }

  /**
   * @description Requests transition to AwaitingActorDecisionState via the context.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor whose turn has started.
   * @param {BaseTurnHandler} handler - Owning handler.
   * @param {import('../../utils/loggerUtils.js').Logger} logger - Logger instance.
   * @returns {Promise<void>} Resolves when the transition is complete.
   */
  async _requestAwaitingInput(turnCtx, actor, handler, logger) {
    try {
      await turnCtx.requestAwaitingInputStateTransition();
      logger.debug(
        `${this.getStateName()}: Successfully transitioned to AwaitingActorDecisionState for actor ${actor.id}.`
      );
    } catch (error) {
      logger.error(
        `${this.getStateName()}: Failed to transition to AwaitingActorDecisionState for ${actor.id}. Error: ${error.message}`,
        error
      );
      handler.resetStateAndResources(`transition-fail-${this.getStateName()}`);
      await handler.requestIdleStateTransition();
      throw error;
    }
  }

  /** @override */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    const actorIdForLog = actorEntity?.id ?? UNKNOWN_ENTITY_ID;
    warnNoActiveTurn(
      getLogger(this._getTurnContext(), this._handler),
      this.getStateName(),
      `Command ('${commandString}') submitted by `,
      actorIdForLog
    );
    return super.handleSubmittedCommand(handler, commandString, actorEntity);
  }

  /** @override */
  async handleTurnEndedEvent(handler, payload) {
    const payloadActorId = payload?.entityId ?? UNKNOWN_ENTITY_ID;
    warnNoActiveTurn(
      getLogger(this._getTurnContext(), this._handler),
      this.getStateName(),
      'handleTurnEndedEvent called (for ',
      `${payloadActorId})`
    );
    return super.handleTurnEndedEvent(handler, payload);
  }

  /** @override */
  async processCommandResult(handler, actor, commandResult, commandString) {
    const actorIdForLog = actor?.id ?? UNKNOWN_ENTITY_ID;
    warnNoActiveTurn(
      getLogger(this._getTurnContext(), this._handler),
      this.getStateName(),
      'processCommandResult called (for ',
      `${actorIdForLog})`
    );
    return super.processCommandResult(
      handler,
      actor,
      commandResult,
      commandString
    );
  }

  /** @override */
  async handleDirective(handler, actor, directive, commandResult) {
    const actorIdForLog = actor?.id ?? UNKNOWN_ENTITY_ID;
    warnNoActiveTurn(
      getLogger(this._getTurnContext(), this._handler),
      this.getStateName(),
      'handleDirective called (for ',
      `${actorIdForLog})`
    );
    return super.handleDirective(handler, actor, directive, commandResult);
  }

  /** @override */
  async destroy(handler) {
    const logger = getLogger(this._getTurnContext(), handler);
    logger.debug(
      `${this.getStateName()}: BaseTurnHandler is being destroyed while in idle state.`
    );
    await super.destroy(handler);
    logger.debug(`${this.getStateName()}: Destroy handling complete.`);
  }

  /** @override */
  isIdle() {
    return true;
  }
}

// --- FILE END ---
