// src/turns/states/awaitingExternalTurnEndState.js
/**
 * @file Waits for a `core:turn_ended` that some rule should emit after an
 * action attempt. Uses Promise.race with AbortController for deterministic
 * "first wins" behavior between event reception and timeout.
 *
 * If nothing arrives within the configured timeout we:
 * 1. Fire `core:display_error` with details about the stalled action.
 * 2. End the turn with `success:false`, keeping the game loop alive.
 *
 * This guarantees the engine never hard-locks because of a missing rule.
 * @see src/turns/utils/cancellablePrimitives.js - Cancellable timeout/event helpers
 */

import { AbstractTurnState } from './abstractTurnState.js';
import TimeoutConfiguration from '../config/timeoutConfiguration.js';

import { TURN_ENDED_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { createTimeoutError } from '../../utils/timeoutUtils.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';
import {
  createCancellableTimeout,
  createEventPromise,
  TIMEOUT_SENTINEL,
} from '../utils/cancellablePrimitives.js';

/** @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler */

// ─── AwaitingExternalTurnEndState ──────────────────────────────────────────────
export class AwaitingExternalTurnEndState extends AbstractTurnState {
  /** @type {AbortController|null} */
  #abortController = null;
  #awaitingActionId = 'unknown-action';
  #configuredTimeout;

  /**
   * Creates an instance of AwaitingExternalTurnEndState.
   *
   * @param {BaseTurnHandler} handler - The handler managing the turn state.
   * @param {object} [options] - Optional configuration overrides.
   * @param {number} [options.timeoutMs] - Timeout duration for waiting.
   * @param {import('../../interfaces/IEnvironmentProvider.js').IEnvironmentProvider} [options.environmentProvider] - Optional environment provider for DI.
   */
  constructor(handler, { timeoutMs, environmentProvider } = {}) {
    super(handler);

    // Use TimeoutConfiguration for timeout resolution
    const timeoutConfig = new TimeoutConfiguration({
      timeoutMs,
      environmentProvider,
      logger: handler?.getLogger?.(),
    });
    this.#configuredTimeout = timeoutConfig.getTimeoutMs();
  }

  //─────────────────────────────────────────────────────────────────────────────
  async enterState(handler, prev) {
    await super.enterState(handler, prev);

    const ctx = await this._ensureContext('enter-no-context');
    if (!ctx) return;

    const actorId = ctx.getActor().id;
    const logger = getLogger(ctx, this._handler);

    // Check for pre-captured event (handles race condition where event fired
    // during action dispatch BEFORE this listener was set up)
    const pendingEvent = ctx.consumePendingTurnEndEvent?.();

    // Clean up the early listener that was set up in CommandProcessingWorkflow.
    // Now that we're in AwaitingExternalTurnEndState, we have our own listener
    // or we have a pending event to process. Either way, the early listener
    // has served its purpose and must be unsubscribed.
    const earlyUnsubscribe = ctx.consumeEarlyListenerUnsubscribe?.();
    if (earlyUnsubscribe && typeof earlyUnsubscribe === 'function') {
      try {
        earlyUnsubscribe();
        logger.debug(
          `${this.getStateName()}: Unsubscribed early listener for ${actorId}`
        );
      } catch (unsubErr) {
        logger.warn(
          `${this.getStateName()}: Error unsubscribing early listener: ${unsubErr.message}`
        );
      }
    }

    if (pendingEvent) {
      logger.debug(
        `${this.getStateName()}: Found pre-captured turn_ended event for ${actorId}, handling immediately`
      );
      // Mark context as awaiting then immediately handle
      ctx.setAwaitingExternalEvent(true, actorId);
      await this.#handleTurnEndedEvent(ctx, pendingEvent);
      this.#cleanup(ctx);
      return;
    }

    // Create new abort controller for this state entry
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    // Remember actionId purely for clearer error text
    this.#awaitingActionId =
      ctx.getChosenActionId?.() ??
      ctx.getChosenAction?.()?.actionDefinitionId ??
      'unknown-action';

    // Mark context as awaiting external event
    ctx.setAwaitingExternalEvent(true, actorId);

    const dispatcher = getSafeEventDispatcher(ctx, this._handler);
    if (!dispatcher) {
      getLogger(ctx, this._handler).error(
        `${this.getStateName()}: No dispatcher available, cannot await turn_ended event`
      );
      return;
    }

    // Create racing promises
    const eventPromise = createEventPromise(
      dispatcher,
      TURN_ENDED_ID,
      (event) => event.payload?.entityId === actorId,
      signal
    );

    const timeoutPromise = createCancellableTimeout(
      this.#configuredTimeout,
      signal
    );

    try {
      // Race: first one to resolve wins, loser is aborted
      const result = await Promise.race([eventPromise, timeoutPromise]);

      if (result === TIMEOUT_SENTINEL) {
        // Timeout won the race
        await this.#handleTimeout(ctx);
      } else {
        // Event won the race
        await this.#handleTurnEndedEvent(ctx, result);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Re-throw non-abort errors
        throw err;
      }
      // AbortError means state was exited/destroyed externally, ignore
    } finally {
      this.#cleanup(ctx);
    }
  }

  //─────────────────────────────────────────────────────────────────────────────
  /**
   * Handles a turn_ended event that won the race.
   *
   * @param {object} ctx - Turn context
   * @param {object} event - The turn_ended event
   * @private
   */
  async #handleTurnEndedEvent(ctx, event) {
    const eventPayload = event.payload;
    await ctx.endTurn(eventPayload.error ?? null);
  }

  //─────────────────────────────────────────────────────────────────────────────
  /**
   * Handles a timeout that won the race.
   *
   * @param {object} ctx - Turn context
   * @private
   */
  async #handleTimeout(ctx) {
    const { message, error } = createTimeoutError(
      ctx.getActor().id,
      this.#awaitingActionId,
      this.#configuredTimeout
    );

    // Dispatch error to UI/console
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

    // End the turn with the timeout error
    await ctx.endTurn(error);
  }

  //─────────────────────────────────────────────────────────────────────────────
  async handleSubmittedCommand() {
    /* ignored while waiting; the UI should be disabled anyway */
  }

  //─────────────────────────────────────────────────────────────────────────────
  async exitState(handler, next) {
    this.#cleanup(this._getTurnContext());
    this.#resetInternalState();
    await super.exitState(handler, next);
  }

  async destroy(handler) {
    this.#cleanup(this._getTurnContext());
    this.#resetInternalState();
    await super.destroy(handler);
  }

  //─────────────────────────────────────────────────────────────────────────────
  // Private utilities
  //─────────────────────────────────────────────────────────────────────────────
  /**
   * Aborts pending promises and clears the awaiting flag.
   *
   * @param {object|null} ctx - Turn context
   * @private
   */
  #cleanup(ctx) {
    // Abort any pending promises (timeout or event listener)
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    // Clear the awaiting flag on context
    if (ctx?.isAwaitingExternalEvent?.()) {
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
    this.#abortController = null;
    this.#awaitingActionId = 'unknown-action';
  }

  /**
   * Returns key internal values for unit tests.
   *
   * @public
   * @returns {{abortController: AbortController|null, awaitingActionId: string}}
   */
  getInternalStateForTest() {
    return {
      abortController: this.#abortController,
      awaitingActionId: this.#awaitingActionId,
    };
  }
}
