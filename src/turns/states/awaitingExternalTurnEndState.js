// src/turns/states/awaitingExternalTurnEndState.js
// ****** MODIFIED FILE ******
/**
 * Waits for a `core:turn_ended` that some rule should emit after an
 * action attempt. If nothing arrives within TIMEOUT_MS we:
 * 1. Fire `core:display_error` with details about the stalled action.
 * 2. End the turn with `success:false`, keeping the game loop alive.
 *
 * This guarantees the engine never hard-locks because of a missing rule.
 */

import { AbstractTurnState } from './abstractTurnState.js';

import {
  TURN_ENDED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';

/** @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

/* global process */

// ─── Config ────────────────────────────────────────────────────────────────────
/**
 * Dev / prod switch without `import.meta`.
 * • In a Jest run NODE_ENV defaults to 'test'.
 * • In Vite/webpack `process.env.NODE_ENV` is defined, too.
 */
const IS_DEV = (process?.env?.NODE_ENV ?? 'production') !== 'production';
const TIMEOUT_MS = IS_DEV ? 3_000 : 30_000;

// ─── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Builds the timeout error message and Error object.
 *
 * @param {string} actorId - ID of the actor awaiting the turn end.
 * @param {string} actionId - The action definition id.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {{msg: string, err: Error}}
 */
function buildTimeoutObjects(actorId, actionId, timeoutMs = TIMEOUT_MS) {
  const msg =
    `No rule ended the turn for actor ${actorId} after action ` +
    `'${actionId}'. The engine timed out after ${timeoutMs} ms.`;
  const err = new Error(msg);
  err.code = 'TURN_END_TIMEOUT';
  return { msg, err };
}

// ─── AwaitingExternalTurnEndState ──────────────────────────────────────────────
export class AwaitingExternalTurnEndState extends AbstractTurnState {
  #timeoutId = null;
  #unsubscribeFn = undefined;
  #awaitingActionId = 'unknown-action';
  #timeoutMs = TIMEOUT_MS;
  #setTimeoutFn = setTimeout;
  #clearTimeoutFn = clearTimeout;

  /**
   * Creates an instance of AwaitingExternalTurnEndState.
   *
   * @param {BaseTurnHandler} handler - The handler managing the turn state.
   * @param {number} [timeoutMs] - Timeout duration for waiting.
   * @param {Function} [setTimeoutFn] - Optional custom setTimeout.
   * @param {Function} [clearTimeoutFn] - Optional custom clearTimeout.
   */
  constructor(
    handler,
    timeoutMs = TIMEOUT_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  ) {
    super(handler);
    this.#timeoutMs = timeoutMs;
    this.#setTimeoutFn = setTimeoutFn;
    this.#clearTimeoutFn = clearTimeoutFn;
  }

  //─────────────────────────────────────────────────────────────────────────────

  //─────────────────────────────────────────────────────────────────────────────
  async enterState(handler, prev) {
    await super.enterState(handler, prev);
    const ctx = await this._ensureContext('enter-no-context');
    if (!ctx) return;

    // remember actionId purely for clearer error text
    this.#awaitingActionId =
      ctx.getChosenActionId?.() ??
      ctx.getChosenAction?.()?.actionDefinitionId ??
      'unknown-action';

    // --- REFACTORED: Use SafeEventDispatcher directly ---
    // The context now provides the dispatcher directly, bypassing the problematic manager.
    // The returned unsubscribe function is stored and used identically to before.
    const dispatcher = getSafeEventDispatcher(ctx, this._handler);
    this.#unsubscribeFn = dispatcher?.subscribe(TURN_ENDED_ID, (event) =>
      this.handleTurnEndedEvent(handler, event)
    );

    // mark context
    ctx.setAwaitingExternalEvent(true, ctx.getActor().id);

    // set guard-rail
    this.#timeoutId = this.#setTimeoutFn(
      () => this.#onTimeout(),
      this.#timeoutMs
    );
  }

  //─────────────────────────────────────────────────────────────────────────────
  async handleTurnEndedEvent(handler, event) {
    const ctx = this._getTurnContext();
    if (!ctx) return;

    // --- FIX: Correctly access the event payload ---
    // The listener receives the full event object: { type, payload }.
    // The data we need is inside the 'payload' property.
    const eventPayload = event.payload;

    if (eventPayload.entityId !== ctx.getActor().id) return; // not for us

    this.#clearGuards(ctx);

    // The error, if any, is also on the event's payload property.
    await ctx.endTurn(eventPayload.error ?? null);
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
      this.#clearTimeoutFn(this.#timeoutId);
      this.#timeoutId = null;
    }
    if (this.#unsubscribeFn) {
      this.#unsubscribeFn();
      this.#unsubscribeFn = undefined;
    }
    if (ctx?.isAwaitingExternalEvent()) {
      try {
        ctx.setAwaitingExternalEvent(false, ctx.getActor().id);
      } catch (err) {
        getLogger(ctx, this._handler).warn(
          `${this.getStateName()}: failed to clear awaitingExternalEvent flag – ${err.message}`,
          err
        );
      }
    }
  }

  #onTimeout() {
    const ctx = this._getTurnContext();
    if (!ctx || !ctx.isAwaitingExternalEvent()) return; // already handled

    const { msg, err } = buildTimeoutObjects(
      ctx.getActor().id,
      this.#awaitingActionId,
      this.#timeoutMs
    );

    // 1) tell the UI / console
    const dispatcher = getSafeEventDispatcher(ctx, this._handler);
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        msg,
        {
          code: err.code,
          actorId: ctx.getActor().id,
          actionId: this.#awaitingActionId,
        },
        getLogger(ctx, this._handler)
      );
    }

    // 2) close the turn
    try {
      ctx.endTurn(err);
    } catch (e) {
      getLogger(ctx, this._handler).error(
        `${this.getStateName()}: failed to end turn after timeout – ${e.message}`,
        e
      );
      this._resetToIdle('timeout-recovery');
    }
  }
}
