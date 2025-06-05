// src/turns/states/turnEndingState.js
// -----------------------------------------------------------------------------
//  TurnEndingState - Handles the final steps of ending a turn.
// -----------------------------------------------------------------------------

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { TurnIdleState } from './turnIdleState.js';

/**
 * @class TurnEndingState
 * @augments {AbstractTurnState_Base}
 * @implements {ITurnState_Interface}
 * @description
 * This state is entered when a turn concludes (successfully or with an error).
 * It notifies the ITurnEndPort (via ITurnContext), signals normal termination if applicable,
 * resets per-turn resources on the handler, and transitions to TurnIdleState.
 * The actorToEndId and any turnError are passed to its constructor.
 */
export class TurnEndingState extends AbstractTurnState {
  /** @type {string} */
  #actorToEndId;
  /** @type {Error|null} */
  #turnError;

  /**
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
   * @param {string} actorToEndId - ID of the actor whose turn is ending.
   * @param {Error|null} [turnError] - Error if turn ended abnormally.
   */
  constructor(handler, actorToEndId, turnError = null) {
    super(handler); // Calls AbstractTurnState constructor

    // AbstractTurnState constructor already checks if handler is provided.
    // So, this._handler is guaranteed to be set if super() didn't throw.
    const constructorLogger = this._handler.getLogger(); // Use handler's logger directly

    if (!actorToEndId) {
      const errMsg = `${this.constructor.name} Constructor: actorToEndId must be provided.`;
      constructorLogger.error(errMsg);
      // Attempt to use current actor from handler as a fallback, though this indicates an issue.
      this.#actorToEndId =
        this._handler.getCurrentActor()?.id ||
        'UNKNOWN_ACTOR_CONSTRUCTOR_FALLBACK';
      constructorLogger.warn(
        `${this.constructor.name} Constructor: actorToEndId was missing, fell back to '${this.#actorToEndId}'. Stack: ${new Error().stack}`
      );
    } else {
      this.#actorToEndId = actorToEndId;
    }
    this.#turnError = turnError || null;

    constructorLogger.debug(
      `${this.getStateName()} constructed for target actor ${this.#actorToEndId}. Error: ${this.#turnError ? `"${this.#turnError.message}"` : 'null'}.`
    );
  }

  /** @override */
  getStateName() {
    return 'TurnEndingState';
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance (same as this._handler).
   * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
   */
  async enterState(handler, previousState) {
    // **** ADD DIAGNOSTIC LOGS AT THE VERY BEGINNING ****
    let initialLogger = console; // Fallback logger
    try {
      // Use the handler passed to this method, which is the one from _transitionToState
      initialLogger = handler.getLogger();
      initialLogger.debug(
        `ENTERING TurnEndingState.enterState. Handler: ${handler?.constructor?.name}, PrevState: ${previousState?.getStateName()}`
      );
    } catch (e) {
      console.error(
        'TurnEndingState.enterState: Error getting initial logger or initial log: ' +
          e.message
      );
    }

    // this._getTurnContext() uses this._handler, which was set in the constructor.
    // The handler parameter here is the same instance.
    const turnCtxForEndingTurn = this._getTurnContext();
    // **** ADD DIAGNOSTIC FOR CONTEXT ****
    initialLogger.debug(
      `TurnEndingState.enterState: turnCtxForEndingTurn is ${turnCtxForEndingTurn ? 'defined' : 'null/undefined'}. Actor in context: ${turnCtxForEndingTurn?.getActor()?.id ?? 'N/A'}`
    );

    // Use the logger derived from the context if available, or the handler's logger
    const logger = turnCtxForEndingTurn
      ? turnCtxForEndingTurn.getLogger()
      : handler.getLogger();

    try {
      // Calls AbstractTurnState.enterState, which logs an INFO message
      await super.enterState(handler, previousState);
    } catch (e) {
      // Log if super.enterState itself throws
      logger.error(
        `TurnEndingState.enterState: ERROR during super.enterState: ${e.message}`,
        e
      );
      throw e; // Re-throw to see if this is the unhandled point, or handle gracefully
    }

    const isSuccess = this.#turnError === null; // Determine boolean success
    const statusTxt = isSuccess ? 'SUCCESS' : 'FAILURE';
    const contextActorIdFromCtx = turnCtxForEndingTurn?.getActor()?.id; // Renamed to avoid conflict

    // This is an INFO log, will not appear in mockLogger.debug.mock.calls unless logger level is debug
    logger.info(
      `${this.getStateName()}: Entered for target actor ${this.#actorToEndId} (turn result: ${statusTxt}). ` +
        `Context actor: ${contextActorIdFromCtx ?? 'None'}. Error: ${this.#turnError ? `"${this.#turnError.message}"` : 'null'}.`
    );

    // 1. Notify ITurnEndPort via ITurnContext
    //    Check if context is available and for the correct actor.
    if (
      turnCtxForEndingTurn &&
      turnCtxForEndingTurn.getActor()?.id === this.#actorToEndId
    ) {
      try {
        logger.debug(
          `${this.getStateName()}: Attempting to get TurnEndPort for actor ${this.#actorToEndId}.`
        ); // DIAGNOSTIC
        const turnEndPort = turnCtxForEndingTurn.getTurnEndPort();
        logger.debug(
          `${this.getStateName()}: Notifying TurnEndPort for actor ${this.#actorToEndId} (success: ${isSuccess}).`
        );
        // --- FIXED LINE BELOW---
        await turnEndPort.notifyTurnEnded(this.#actorToEndId, isSuccess); // Pass the boolean 'isSuccess'
        // --- END FIX ---
        logger.debug(
          `${this.getStateName()}: TurnEndPort notification for ${this.#actorToEndId} complete.`
        );
      } catch (notifyErr) {
        logger.error(
          `${this.getStateName()}: CRITICAL - TurnEndPort.notifyTurnEnded failed for actor ${this.#actorToEndId}: ${notifyErr.message}`,
          notifyErr
        );
        // Continue with cleanup despite this error.
      }
    } else {
      const reason = !turnCtxForEndingTurn
        ? 'ITurnContext not available'
        : `ITurnContext actor mismatch (context: ${contextActorIdFromCtx ?? 'None'}, target: ${this.#actorToEndId})`;
      // This is a WARN log
      logger.warn(
        `${this.getStateName()}: TurnEndPort not notified for actor ${this.#actorToEndId}. Reason: ${reason}.`
      );
    }

    // 2. Signal normal apparent termination if applicable
    //    This check is primarily for a concrete handler's (e.g., one managing player turns) destroy() logic.
    //    It should be called if the ending turn's actor matches the context actor.
    if (
      contextActorIdFromCtx === this.#actorToEndId &&
      typeof handler.signalNormalApparentTermination === 'function'
    ) {
      logger.debug(
        `${this.getStateName()}: Signaling normal apparent termination for handler (actor ${this.#actorToEndId}).`
      );
      handler.signalNormalApparentTermination();
    } else if (typeof handler.signalNormalApparentTermination === 'function') {
      // Method exists but conditions not met
      logger.debug(
        `${this.getStateName()}: Normal apparent termination not signaled. ` +
          `Context actor ('${contextActorIdFromCtx ?? 'None'}') vs target actor ('${this.#actorToEndId}') mismatch or no context actor.`
      );
    }

    // Diagnostic before reset and transition
    logger.debug(
      `${this.getStateName()}: Proceeding to reset resources and transition to Idle.`
    );

    // 3. Reset handler's per-turn state and resources.
    logger.debug(
      `${this.getStateName()}: Calling _resetTurnStateAndResources for actor ${this.#actorToEndId}.`
    );
    handler._resetTurnStateAndResources(
      `enterState-${this.getStateName()}-actor-${this.#actorToEndId}`
    );

    // 4. Transition to TurnIdleState.
    logger.debug(`${this.getStateName()}: Transitioning to TurnIdleState.`);
    await handler._transitionToState(new TurnIdleState(handler)); // TurnIdleState constructor takes the handler instance.

    // This is an INFO log
    logger.info(
      `${this.getStateName()}: Processing for actor ${this.#actorToEndId} complete. Handler now in Idle state.`
    );
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {ITurnState_Interface} [nextState]
   */
  async exitState(handler, nextState) {
    // By the time this is called, the context should have been cleared by _resetTurnStateAndResources
    // in enterState(). The logger from super.exitState will likely fallback to handler.getLogger().
    const logger = handler.getLogger(); // Use handler's logger as context is (expected to be) gone
    logger.debug(
      `${this.getStateName()}: Exiting for (intended) actor ${this.#actorToEndId}. ` +
        `Transitioning to ${nextState?.getStateName() ?? 'None'}. ITurnContext should be null.`
    );
    await super.exitState(handler, nextState);
    // Log from super.exitState might say "Actor: N/A" if context was cleared, which is expected.
  }

  /** @override */
  async destroy(handler) {
    // Use handler's logger as context is expected to be gone or irrelevant during handler destruction.
    const logger = handler.getLogger();
    logger.warn(
      `${this.getStateName()}: Handler destroyed while in TurnEndingState for actor ${this.#actorToEndId}. ` +
        `This state is transient; resources should ideally be reset. Current handler state: ${handler._currentState?.getStateName()}`
    );

    // Ensure resources are reset if somehow not done during enterState (e.g., if enterState errored out).
    // This is a safeguard.
    handler._resetTurnStateAndResources(
      `destroy-${this.getStateName()}-actor-${this.#actorToEndId}`
    );

    // Attempt to force to Idle if not already there or transitioning there.
    // BaseTurnHandler's destroy method also tries to ensure transition to Idle.
    if (
      !(handler._currentState instanceof TurnIdleState) &&
      handler._currentState !== this
    ) {
      // Avoid self-transition if destroy is re-entrant or error in transition
      logger.warn(
        `${this.getStateName()} (destroy): Handler not in TurnIdleState. Forcing transition.`
      );
      try {
        await handler._transitionToState(new TurnIdleState(handler));
      } catch (err) {
        logger.error(
          `${this.getStateName()}: Failed forced transition to TurnIdleState during destroy for actor ${this.#actorToEndId}: ${err.message}`,
          err
        );
      }
    }
    // Call super.destroy() for any generic cleanup in AbstractTurnState.
    await super.destroy(handler); // Ensures logging from AbstractTurnState
    logger.debug(
      `${this.getStateName()}: Destroy handling for actor ${this.#actorToEndId} finished.`
    );
  }

  // All other ITurnState API methods (startTurn, handleSubmittedCommand, etc.)
  // are invalid for TurnEndingState. They will use AbstractTurnState's default
  // implementations, which log an error and throw, indicating they are not applicable.
}
