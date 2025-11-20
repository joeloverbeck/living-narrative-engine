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
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

import { TURN_ENDED_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { createTimeoutError } from '../../utils/timeoutUtils.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';
import { getEnvironmentMode } from '../../utils/environmentUtils.js';

/** @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler */

/**
 * Default timeout for production environment (30 seconds).
 *
 * @private
 */
export const DEFAULT_TIMEOUT_PRODUCTION = 30_000;

/**
 * Default timeout for development environment (3 seconds).
 *
 * @private
 */
export const DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

// ─── Helpers ───────────────────────────────────────────────────────────────────
// Timeout utilities moved to src/utils/timeoutUtils.js

// ─── AwaitingExternalTurnEndState ──────────────────────────────────────────────
export class AwaitingExternalTurnEndState extends AbstractTurnState {
  #timeoutId = null;
  #unsubscribeFn = undefined;
  #awaitingActionId = 'unknown-action';
  #configuredTimeout;
  #setTimeoutFn = (...args) => setTimeout(...args);
  #clearTimeoutFn = (...args) => clearTimeout(...args);

  /**
   * Creates an instance of AwaitingExternalTurnEndState.
   *
   * @param {BaseTurnHandler} handler - The handler managing the turn state.
   * @param {object} [options] - Optional configuration overrides.
   * @param {number} [options.timeoutMs] - Timeout duration for waiting.
   * @param {Function} [options.setTimeoutFn] - Optional custom setTimeout.
   * @param {Function} [options.clearTimeoutFn] - Optional custom clearTimeout.
   */
  constructor(
    handler,
    {
      timeoutMs,
      setTimeoutFn = (...args) => setTimeout(...args),
      clearTimeoutFn = (...args) => clearTimeout(...args),
    } = {}
  ) {
    super(handler);
    this.#configuredTimeout = timeoutMs ?? this.#resolveDefaultTimeout();

    // Validate timeout is positive finite number
    if (!Number.isFinite(this.#configuredTimeout) || this.#configuredTimeout <= 0) {
      throw new InvalidArgumentError(
        `timeoutMs must be a positive finite number, got: ${this.#configuredTimeout} (type: ${typeof this.#configuredTimeout})`
      );
    }

    this.#setTimeoutFn = setTimeoutFn;
    this.#clearTimeoutFn = clearTimeoutFn;
  }

  /**
   * Resolves the default timeout based on the current environment.
   * Falls back to production timeout if environment detection fails.
   *
   * @returns {number} Timeout duration in milliseconds
   * @private
   */
  #resolveDefaultTimeout() {
    try {
      const env = getEnvironmentMode();
      const isProduction = env === 'production';
      return isProduction
        ? DEFAULT_TIMEOUT_PRODUCTION
        : DEFAULT_TIMEOUT_DEVELOPMENT;
    } catch {
      // If environment detection fails, use production timeout as safe default
      // Note: Logger not available during construction, silent fallback
      return DEFAULT_TIMEOUT_PRODUCTION;
    }
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
    this.#timeoutId = this.#setTimeoutFn(async () => {
      await this.#onTimeout();
    }, this.#configuredTimeout);
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
    this.#resetInternalState();
    await super.exitState(handler, next);
  }

  async destroy(handler) {
    this.#clearGuards(this._getTurnContext());
    this.#resetInternalState();
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

  /**
   * Resets mutable internal fields to a neutral state.
   *
   * @private
   * @returns {void}
   */
  #resetInternalState() {
    this.#timeoutId = null;
    this.#unsubscribeFn = undefined;
    this.#awaitingActionId = 'unknown-action';
  }

  /**
   * Returns key internal values for unit tests.
   *
   * @public
   * @returns {{timeoutId: any, unsubscribeFn: Function|undefined, awaitingActionId: string}}
   */
  getInternalStateForTest() {
    return {
      timeoutId: this.#timeoutId,
      unsubscribeFn: this.#unsubscribeFn,
      awaitingActionId: this.#awaitingActionId,
    };
  }

  async #onTimeout() {
    const ctx = this._getTurnContext();
    if (!ctx || !ctx.isAwaitingExternalEvent()) return; // already handled

    const { message, error } = createTimeoutError(
      ctx.getActor().id,
      this.#awaitingActionId,
      this.#configuredTimeout
    );

    // 1) tell the UI / console
    const dispatcher = getSafeEventDispatcher(ctx, this._handler);
    if (dispatcher) {
      safeDispatchError(
        dispatcher,
        message,
        {
          actionId: this.#awaitingActionId,
          actorId: ctx.getActor().id,
          code: error.code,
        },
        getLogger(ctx, this._handler)
      );
    }

    // 2) close the turn
    await ctx.endTurn(error);
  }
}
