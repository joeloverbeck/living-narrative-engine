// src/turns/states/turnEndingState.js
// -----------------------------------------------------------------------------
//  TurnEndingState – wraps-up a turn and returns the handler to Idle *only
//  through ITurnContext* (never via handler._transitionToState).
// -----------------------------------------------------------------------------

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnState.js').ITurnState}         ITurnState
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext}     ITurnContext
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { UNKNOWN_ACTOR_ID } from '../../constants/unknownIds.js';

export class TurnEndingState extends AbstractTurnState {
  /** @type {string}     */ #actorToEndId;
  /** @type {Error|null} */ #turnError;

  /* ────────────────────────────────────────────────────────────────── */
  constructor(handler, actorToEndId, turnError = null) {
    super(handler);

    const log = this._resolveLogger(null, handler);

    const dispatcher = this._getSafeEventDispatcher(
      handler.getTurnContext?.(),
      handler
    );

    if (!actorToEndId) {
      const message =
        'TurnEndingState Constructor: actorToEndId must be provided.';
      if (dispatcher) {
        safeDispatchError(dispatcher, message, {
          providedActorId: actorToEndId ?? null,
        });
      }
      this.#actorToEndId = handler.getCurrentActor()?.id ?? UNKNOWN_ACTOR_ID;
      log.warn(
        `TurnEndingState Constructor: actorToEndId was missing, fell back to '${this.#actorToEndId}'.`
      );
    } else {
      this.#actorToEndId = actorToEndId;
    }

    this.#turnError = turnError ?? null;
    log.debug(
      `TurnEndingState constructed for target actor ${this.#actorToEndId}. ` +
        `Error: ${this.#turnError ? `"${this.#turnError.message}"` : 'null'}.`
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /** @override */
  async enterState(handler, previousState) {
    const ctx = this._getTurnContext();
    const logger = this._resolveLogger(ctx, handler);
    const sameActor = ctx?.getActor()?.id === this.#actorToEndId;
    const success = this.#turnError === null;

    await super.enterState(handler, previousState);

    /* 1️⃣  Notify TurnEndPort ------------------------------------------------ */
    if (ctx && sameActor) {
      try {
        await ctx.getTurnEndPort().notifyTurnEnded(this.#actorToEndId, success);
      } catch (err) {
        const dispatcher = this._getSafeEventDispatcher(ctx, handler);
        if (dispatcher) {
          safeDispatchError(
            dispatcher,
            `TurnEndingState: Failed notifying TurnEndPort for actor ${this.#actorToEndId}: ${err.message}`,
            {
              actorId: this.#actorToEndId,
              stack: err.stack,
              error: err.message,
            }
          );
        }
      }
    } else {
      const reason = !ctx
        ? 'ITurnContext not available'
        : `ITurnContext actor mismatch (context: ${ctx.getActor()?.id}, target: ${this.#actorToEndId})`;
      logger.warn(
        `TurnEndingState: TurnEndPort not notified for actor ${this.#actorToEndId}. Reason: ${reason}.`
      );
    }

    /* 2️⃣  Normal-apparent-termination signal -------------------------------- */
    if (
      sameActor &&
      typeof handler.signalNormalApparentTermination === 'function'
    ) {
      handler.signalNormalApparentTermination();
    } else if (typeof handler.signalNormalApparentTermination === 'function') {
      logger.debug(
        `TurnEndingState: Normal apparent termination not signaled. Context actor ('${ctx?.getActor()?.id ?? 'None'}') vs target actor ('${this.#actorToEndId}') mismatch or no context actor.`
      );
    }

    /* 3️⃣  Cleanup ----------------------------------------------------------- */
    handler.resetStateAndResources(
      `enterState-TurnEndingState-actor-${this.#actorToEndId}`
    );

    /* 4️⃣  Transition back to Idle – strictly via ITurnContext -------------- */
    if (ctx?.requestIdleStateTransition) {
      await ctx.requestIdleStateTransition();
    } else {
      logger.debug(
        'TurnEndingState: No ITurnContext available – Idle transition skipped.'
      );
    }

    logger.debug(
      `TurnEndingState: Completed. Handler now in Idle (actor ${this.#actorToEndId}).`
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /** @override */
  async exitState(handler, nextState) {
    this._resolveLogger(null, handler).debug(
      `TurnEndingState: Exiting for (intended) actor ${this.#actorToEndId}. ` +
        `Transitioning to ${nextState?.getStateName() ?? 'None'}. ITurnContext should be null.`
    );
    await super.exitState(handler, nextState);
  }

  /* ────────────────────────────────────────────────────────────────── */
  /** @override */
  async destroy(handler) {
    const logger = this._resolveLogger(this._getTurnContext(), handler);

    logger.warn(
      `TurnEndingState: Handler destroyed while in TurnEndingState for actor ${this.#actorToEndId}.`
    );

    // Capture context *before* we clear resources so we can still use it
    const ctx = handler.getTurnContext?.();

    handler.resetStateAndResources(
      `destroy-TurnEndingState-actor-${this.#actorToEndId}`
    );

    if (
      ctx?.requestIdleStateTransition &&
      !handler._currentState?.isIdle?.() &&
      handler._currentState !== this
    ) {
      try {
        await ctx.requestIdleStateTransition();
      } catch (err) {
        const dispatcher = this._getSafeEventDispatcher(ctx, handler);
        if (dispatcher) {
          safeDispatchError(
            dispatcher,
            `TurnEndingState: Failed forced transition to TurnIdleState during destroy for actor ${this.#actorToEndId}: ${err.message}`,
            {
              actorId: this.#actorToEndId,
              stack: err.stack,
              error: err.message,
            }
          );
        }
      }
    }

    await super.destroy(handler);
  }

  /* ────────────────────────────────────────────────────────────────── */
  isEnding() {
    return true;
  }
}
