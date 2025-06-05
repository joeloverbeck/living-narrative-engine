// src/turns/states/awaitingPlayerInputState.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @file Defines the AwaitingPlayerInputState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ProcessingCommandState } from './processingCommandState.js';
import { TurnIdleState } from './turnIdleState.js';

/**
 * State in which the engine waits for the current actor’s turn-strategy to
 * decide an ITurnAction.  When a valid action is obtained it is recorded in the
 * TurnContext and we transition to `ProcessingCommandState`.
 *
 * ● `AbortError` from the strategy is treated as a graceful cancel.
 * ● All other errors cause the turn to end with an error.
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
  constructor(handler) {
    super(handler);
  }

  /* --------------------------------------------------------------------- */
  getStateName() {
    return 'AwaitingPlayerInputState';
  }

  /* alias required by some tests */
  get name() {
    return this.getStateName();
  }

  /* --------------------------------------------------------------------- */
  /**
   * @override
   * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handler - The handler managing states.
   * @param {AbstractTurnState | null} previousState - The state being exited.
   */
  async enterState(handler, previousState) {
    // <-- Signature updated
    // Call super.enterState first, passing along the received handler and previousState
    // This allows the abstract class to perform its entry logging correctly.
    // Note: The 'handler' parameter here is the one passed by the state machine.
    // this._handler is the one stored during construction. They are typically the same.
    // For consistency with how AbstractTurnState is designed, we pass the 'handler' parameter.
    await super.enterState(handler, previousState);

    const turnContext = this._getTurnContext();
    if (!turnContext) {
      const logger = this._handler?.getLogger?.() ?? console;
      logger.error(
        `${this.name}: Critical error - TurnContext is not available. Attempting to reset and idle.`
      );
      if (
        this._handler?._resetTurnStateAndResources &&
        this._handler?._transitionToState
      ) {
        this._handler._resetTurnStateAndResources(
          `critical-no-context-${this.name}`
        );
        this._handler._transitionToState(new TurnIdleState(this._handler));
      }
      return;
    }

    // The original call was: await super.enterState(this._handler, null);
    // Now the super call is at the top with actual parameters.

    const logger = turnContext.getLogger();
    const actor = turnContext.getActor();

    if (!actor) {
      logger.error(`${this.name}: No actor found in TurnContext. Ending turn.`);
      turnContext.endTurn(
        new Error('No actor in context during AwaitingPlayerInputState.')
      );
      return;
    }

    logger.info(
      `${this.name}: Actor ${actor.id}. Attempting to retrieve turn strategy.`
    ); // This log might be redundant if super.enterState logs similar info

    /* ---------- obtain strategy ------------------------------------------------ */
    let strategy;

    /* getStrategy must be a function */
    if (typeof turnContext.getStrategy !== 'function') {
      const msg = `${this.name}: turnContext.getStrategy() is not a function for actor ${actor.id}.`;
      logger.error(msg);
      turnContext.endTurn(new Error(msg));
      return;
    }

    strategy = turnContext.getStrategy();

    if (!strategy || typeof strategy.decideAction !== 'function') {
      const msg = `${this.name}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
      logger.error(msg, { strategyReceived: strategy });
      turnContext.endTurn(new Error(msg));
      return;
    }

    /* log the strategy name */
    const strategyName = strategy.constructor?.name ?? 'Object';
    logger.info(
      `${this.name}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`
    );

    /* ---------- decide action -------------------------------------------------- */
    try {
      const action = await strategy.decideAction(turnContext);

      /* validate ITurnAction */
      if (!action || typeof action.actionDefinitionId !== 'string') {
        const warnMsg = `${this.name}: Strategy for actor ${actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
        logger.warn(warnMsg, { receivedAction: action });
        turnContext.endTurn(new Error(warnMsg));
        return;
      }

      logger.info(
        `${this.name}: Actor ${actor.id} decided action: ${action.actionDefinitionId}. Storing action.`
      );

      /* store chosen action if possible */
      if (typeof turnContext.setChosenAction === 'function') {
        turnContext.setChosenAction(action);
      } else {
        logger.warn(
          `${this.name}: ITurnContext.setChosenAction() not found. Cannot store action in context.`
        );
      }

      /* pick the command string we will feed into ProcessingCommandState */
      const cmdStr =
        action.commandString && action.commandString.trim().length > 0
          ? action.commandString
          : action.actionDefinitionId;

      logger.info(
        `${this.name}: Transitioning to ProcessingCommandState for actor ${actor.id}.`
      );
      await turnContext.requestTransition(ProcessingCommandState, [
        cmdStr,
        action,
      ]);
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.info(
          `${this.name}: Action decision for actor ${actor.id} was cancelled (aborted). Ending turn gracefully.`
        );
        turnContext.endTurn(null);
      } else {
        const errMsg = `${this.name}: Error during action decision, storage, or transition for actor ${actor.id}: ${error.message}`;
        logger.error(errMsg, { originalError: error });
        turnContext.endTurn(new Error(errMsg, { cause: error }));
      }
    }
  }

  /* --------------------------------------------------------------------- */
  /**
   * @override
   * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handler - The handler managing states.
   * @param {AbstractTurnState | null} nextState - The state being transitioned to.
   */
  async exitState(handler, nextState) {
    // <-- Signature updated
    // Call super.exitState, passing along the received handler and nextState
    // This allows the abstract class to perform its exit logging correctly.
    await super.exitState(handler, nextState);

    // The original call was: await super.exitState(this._handler, null);
    // Now the super call uses the actual parameters.

    // The following specific logging might be redundant if super.exitState covers it,
    // but can be kept if more detail is needed from this specific state.
    const l =
      this._getTurnContext()?.getLogger?.() ??
      this._handler?.getLogger?.() ??
      console;
    l.debug(
      `${this.name}: ExitState cleanup (if any) specific to AwaitingPlayerInputState complete.`
    );
  }

  /* --------------------------------------------------------------------- */
  async handleSubmittedCommand(handlerInstance, commandString, actorEntity) {
    const turnContext = this._getTurnContext();

    /* ----- no context: reset to Idle ----------------------------------- */
    if (!turnContext) {
      const logger = this._handler?.getLogger?.() ?? console;
      const actorIdForLog = actorEntity?.id ?? 'unknown actor';
      logger.error(
        `${this.name}: handleSubmittedCommand (for actor ${actorIdForLog}, cmd: "${commandString}") called, but no ITurnContext. Forcing handler reset.`
      );
      if (
        this._handler?._resetTurnStateAndResources &&
        this._handler?._transitionToState
      ) {
        this._handler._resetTurnStateAndResources(
          `no-context-submission-${this.name}`
        );
        this._handler._transitionToState(new TurnIdleState(this._handler));
      } else {
        logger.error(
          `${this.name}: CRITICAL - No ITurnContext or handler methods to process unexpected command submission or to reset.`
        );
      }
      return;
    }

    /* ---- warn + end turn ---------------------------------------------- */
    const logger = turnContext.getLogger();
    const actorInCtx = turnContext.getActor();
    const actorId = actorInCtx ? actorInCtx.id : 'unknown actor in context';

    logger.warn(
      `${this.name}: handleSubmittedCommand was called directly for actor ${actorId} with command "${commandString}". This is unexpected in the new strategy-driven workflow. Ending turn.`
    );
    turnContext.endTurn(
      new Error(
        `Unexpected direct command submission to ${this.name} for actor ${actorId}. Input should be strategy-driven.`
      )
    );
  }

  /* --------------------------------------------------------------------- */
  async handleTurnEndedEvent(handlerInstance, payload) {
    const handler = handlerInstance || this._handler; // Use passed handlerInstance if available
    const turnContext = this._getTurnContext();
    const logger =
      turnContext?.getLogger?.() ?? handler?.getLogger?.() ?? console;

    if (!turnContext) {
      logger.warn(
        `${this.name}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(payload)}. Deferring to superclass.`
      );
      // Pass the handlerInstance (or this._handler) to the super call
      return super.handleTurnEndedEvent(handler, payload);
    }

    const ctxActor = turnContext.getActor();
    const evtId = payload?.entityId;

    if (ctxActor && ctxActor.id === evtId) {
      logger.info(
        `${this.name}: core:turn_ended event received for current actor ${ctxActor.id}. Ending turn.`
      );
      turnContext.endTurn(payload.error || null);
    } else {
      logger.debug(
        `${this.name}: core:turn_ended event for actor ${evtId} is not for current context actor ${ctxActor?.id}. Deferring to superclass.`
      );
      await super.handleTurnEndedEvent(handler, payload); // Pass the handler
    }
  }

  /* --------------------------------------------------------------------- */
  async destroy(handlerInstance) {
    const handler = handlerInstance || this._handler; // Use passed handlerInstance if available
    const logger = handler?.getLogger?.() ?? console;
    const turnContext = handler?.getTurnContext?.(); // Use the potentially passed handler
    const actorInCtx = turnContext?.getActor();

    if (turnContext) {
      if (!actorInCtx) {
        logger.warn(
          `${this.name}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
        );
      } else if (handler._isDestroying || handler._isDestroyed) {
        logger.info(
          `${this.name}: Handler (actor ${actorInCtx.id}) is already being destroyed. Skipping turnContext.endTurn().`
        );
      } else {
        logger.info(
          `${this.name}: Handler destroyed while state was active for actor ${actorInCtx.id}. Ending turn via turnContext (may trigger AbortError if prompt was active).`
        );
        turnContext.endTurn(
          new Error(
            `Turn handler destroyed while actor ${actorInCtx.id} was in ${this.name}.`
          )
        );
      }
    } else {
      logger.warn(
        `${this.name}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`
      );
    }

    await super.destroy(handler); // Pass the handler
  }
}

// ──────────────────────────────────────────────────────────────────────────────
