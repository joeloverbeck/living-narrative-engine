// src/turns/states/awaitingExternalTurnEndState.js
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Waits for a `core:turn_ended` that some rule should emit after an
 * action attempt. If nothing arrives within TIMEOUT_MS we:
 *   1. Fire `core:display_error` with details about the stalled action.
 *   2. End the turn with `success:false`, keeping the game loop alive.
 *
 * This guarantees the engine never hard-locks because of a missing rule.
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { TurnIdleState } from './turnIdleState.js';

import { TURN_ENDED_ID, DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

// ─── Config ────────────────────────────────────────────────────────────────────
/**
 * Dev / prod switch without `import.meta`.
 *   • In a Jest run NODE_ENV defaults to 'test'.
 *   • In Vite/webpack `process.env.NODE_ENV` is defined, too.
 */
const IS_DEV = (process?.env?.NODE_ENV ?? 'production') !== 'production';
const TIMEOUT_MS = IS_DEV ? 3_000 : 30_000;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function buildTimeoutObjects(actorId, actionId) {
  const msg =
    `No rule ended the turn for actor ${actorId} after action ` +
    `'${actionId}'. The engine timed out after ${TIMEOUT_MS} ms.`;
  const err = new Error(msg);
  err.code = 'TURN_END_TIMEOUT';
  return { msg, err };
}

// ─── AwaitingExternalTurnEndState ──────────────────────────────────────────────
export class AwaitingExternalTurnEndState extends AbstractTurnState {
  #timeoutId = null;
  #unsubscribeFn = undefined;
  #awaitingActionId = 'unknown-action';

  //─────────────────────────────────────────────────────────────────────────────
  getStateName() {
    return 'AwaitingExternalTurnEndState';
  }

  //─────────────────────────────────────────────────────────────────────────────
  async enterState(handler, prev) {
    const ctx = this._getTurnContext();
    await super.enterState(handler, prev);

    if (!ctx) {
      handler
        .getLogger()
        .error(
          `${this.getStateName()}: entered with no ITurnContext; aborting`
        );
      await handler._transitionToState(new TurnIdleState(handler));
      return;
    }

    // remember actionId purely for clearer error text
    this.#awaitingActionId = ctx.getChosenActionId?.() ?? 'unknown-action';

    // subscribe for the normal path
    this.#unsubscribeFn = ctx
      .getSubscriptionManager()
      .subscribeToTurnEnded((p) => this.handleTurnEndedEvent(handler, p));

    // mark context
    ctx.setAwaitingExternalEvent(true, ctx.getActor().id);

    // set guard-rail
    this.#timeoutId = setTimeout(() => this.#onTimeout(handler), TIMEOUT_MS);
  }

  //─────────────────────────────────────────────────────────────────────────────
  async handleTurnEndedEvent(handler, payload) {
    const ctx = this._getTurnContext();
    if (!ctx) return;

    if (payload.entityId !== ctx.getActor().id) return; // not for us

    this.#clearGuards(ctx);
    await ctx.endTurn(payload.error ?? null);
  }

  //─────────────────────────────────────────────────────────────────────────────
  async handleSubmittedCommand() {
    /* ignored while waiting; the UI should be disabled anyway */
  }

  //─────────────────────────────────────────────────────────────────────────────
  async exitState(handler, next) {
    this.#clearGuards(this._getTurnContext());
    await super.exitState(handler, next);
  }

  async destroy(handler) {
    this.#clearGuards(this._getTurnContext());
    await super.destroy(handler);
  }

  //─────────────────────────────────────────────────────────────────────────────
  // Private utilities
  //─────────────────────────────────────────────────────────────────────────────
  #clearGuards(ctx) {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    if (this.#unsubscribeFn) {
      this.#unsubscribeFn();
      this.#unsubscribeFn = undefined;
    }
    if (ctx?.isAwaitingExternalEvent()) {
      try {
        ctx.setAwaitingExternalEvent(false, ctx.getActor().id);
      } catch {
        /* ignore */
      }
    }
  }

  #onTimeout(handler) {
    const ctx = this._getTurnContext();
    if (!ctx || !ctx.isAwaitingExternalEvent()) return; // already handled

    const { msg, err } = buildTimeoutObjects(
      ctx.getActor().id,
      this.#awaitingActionId
    );

    // 1) tell the UI / console
    ctx.getSafeEventDispatcher?.().dispatch(DISPLAY_ERROR_ID, {
      message: msg,
      details: {
        code: err.code,
        actorId: ctx.getActor().id,
        actionId: this.#awaitingActionId,
      },
    });

    // 2) close the turn
    try {
      ctx.endTurn(err);
    } catch (e) {
      handler
        .getLogger()
        .error(
          `${this.getStateName()}: failed to end turn after timeout – ${e.message}`,
          e
        );
      handler._resetTurnStateAndResources('timeout-recovery');
      handler._transitionToState(new TurnIdleState(handler));
    }
  }
}
