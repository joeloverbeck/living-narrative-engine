// src/turns/states/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import { AbstractTurnState } from './abstractTurnState.js';

/**
 * @class TurnIdleState
 * @augments AbstractTurnState_Base
 */
export class TurnIdleState extends AbstractTurnState {
  /**
   * Creates an instance of TurnIdleState.
   *
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance that manages this state.
   */
  constructor(handler) {
    super(handler);
  }

  /** @override */
  getStateName() {
    return 'TurnIdleState';
  }

  /** @override */
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);

    const logger = handler.getLogger();
    logger.debug(
      `${this.getStateName()}: Ensuring clean state by calling handler._resetTurnStateAndResources().`
    );
    handler._resetTurnStateAndResources(`enterState-${this.getStateName()}`);
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
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

    const actorIdForLog = actorEntity?.id ?? 'UNKNOWN_ENTITY';
    logger.debug(
      `${this.getStateName()}: Received startTurn for actor ${actorIdForLog}.`
    );

    // Validate actorEntity
    if (!actorEntity || typeof actorEntity.id === 'undefined') {
      const errorMsg = `${this.getStateName()}: startTurn called with invalid actorEntity.`;
      logger.error(errorMsg);
      handler._resetTurnStateAndResources(
        `invalid-actor-${this.getStateName()}`
      );
      await handler._transitionToState(
        handler._turnStateFactory.createIdleState(handler)
      );
      throw new Error(errorMsg);
    }

    // Validate ITurnContext
    if (!turnCtx) {
      const errorMsg = `${this.getStateName()}: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${actorIdForLog}.`;
      logger.error(errorMsg);
      handler._resetTurnStateAndResources(
        `missing-context-${this.getStateName()}`
      );
      await handler._transitionToState(
        handler._turnStateFactory.createIdleState(handler)
      );
      throw new Error(errorMsg);
    }

    const contextActor = turnCtx.getActor();
    if (!contextActor || contextActor.id !== actorEntity.id) {
      const errorMsg = `${this.getStateName()}: Actor in ITurnContext ('${contextActor?.id}') does not match actor provided to state's startTurn ('${actorEntity.id}').`;
      logger.error(errorMsg);
      handler._resetTurnStateAndResources(
        `actor-mismatch-${this.getStateName()}`
      );
      await handler._transitionToState(
        handler._turnStateFactory.createIdleState(handler)
      );
      throw new Error(errorMsg);
    }

    logger.debug(
      `${this.getStateName()}: ITurnContext confirmed for actor ${contextActor.id}. Transitioning to AwaitingActorDecisionState.`
    );

    try {
      // Use ITurnContext to request the transition
      await turnCtx.requestAwaitingInputStateTransition();

      logger.debug(
        `${this.getStateName()}: Successfully transitioned to AwaitingActorDecisionState for actor ${contextActor.id}.`
      );
    } catch (error) {
      logger.error(
        `${this.getStateName()}: Failed to transition to AwaitingActorDecisionState for ${contextActor.id}. Error: ${error.message}`,
        error
      );
      handler._resetTurnStateAndResources(
        `transition-fail-${this.getStateName()}`
      );
      await handler._transitionToState(
        handler._turnStateFactory.createIdleState(handler)
      );
      throw error;
    }
  }

  /** @override */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    const turnCtx = this._getTurnContext();
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
    const actorIdForLog = actorEntity?.id ?? 'UNKNOWN_ENTITY';
    const message = `${this.getStateName()}: Command ('${commandString}') submitted by ${actorIdForLog} but no turn is active (handler is Idle).`;
    logger.warn(message);
    return super.handleSubmittedCommand(handler, commandString, actorEntity);
  }

  /** @override */
  async handleTurnEndedEvent(handler, payload) {
    const turnCtx = this._getTurnContext();
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
    const payloadActorId = payload?.entityId ?? 'UNKNOWN_ENTITY';
    const message = `${this.getStateName()}: handleTurnEndedEvent called (for ${payloadActorId}) but no turn is active (handler is Idle).`;
    logger.warn(message);
    return super.handleTurnEndedEvent(handler, payload);
  }

  /** @override */
  async processCommandResult(handler, actor, cmdProcResult, commandString) {
    const turnCtx = this._getTurnContext();
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
    const actorIdForLog = actor?.id ?? 'UNKNOWN_ENTITY';
    const message = `${this.getStateName()}: processCommandResult called (for ${actorIdForLog}) but no turn is active.`;
    logger.warn(message);
    return super.processCommandResult(
      handler,
      actor,
      cmdProcResult,
      commandString
    );
  }

  /** @override */
  async handleDirective(handler, actor, directive, cmdProcResult) {
    const turnCtx = this._getTurnContext();
    const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
    const actorIdForLog = actor?.id ?? 'UNKNOWN_ENTITY';
    const message = `${this.getStateName()}: handleDirective called (for ${actorIdForLog}) but no turn is active.`;
    logger.warn(message);
    return super.handleDirective(handler, actor, directive, cmdProcResult);
  }

  /** @override */
  async destroy(handler) {
    const logger = handler.getLogger();
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
