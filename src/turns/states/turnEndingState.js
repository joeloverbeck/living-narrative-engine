// src/turns/states/turnEndingState.js
// -----------------------------------------------------------------------------
//  TurnEndingState – Terminal state that signals turn completion.
//
//  This is now a TERMINAL STATE - it does not dispatch events or request
//  transitions. Instead, it performs cleanup and signals normal termination.
//  BaseTurnHandler.destroy() handles the turn-ended notification and the
//  transition back to Idle state.
//
//  This design eliminates the race condition where the notification triggered
//  handler destruction mid-state-entry.
// -----------------------------------------------------------------------------

/**
 * @typedef {import('../interfaces/ITurnStateHost.js').ITurnStateHost} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnState.js').ITurnState}         ITurnState
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext}     ITurnContext
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { reportMissingActorId } from '../../utils/errorReportingUtils.js';
import { UNKNOWN_ACTOR_ID } from '../../constants/unknownIds.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';

export class TurnEndingState extends AbstractTurnState {
  /** @type {string}     */ #actorToEndId;
  /** @type {Error|null} */ #turnError;

  /* ────────────────────────────────────────────────────────────────── */
  constructor(handler, actorToEndId, turnError = null) {
    super(handler);

    const log = getLogger(null, handler);

    const dispatcher = getSafeEventDispatcher(
      handler.getTurnContext?.(),
      handler
    );

    this.#actorToEndId = this._resolveActorId(actorToEndId);
    if (!actorToEndId) {
      this._notifyMissingActorId(dispatcher, log, actorToEndId);
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
    const logger = getLogger(ctx, handler);
    const sameActor = ctx?.getActor()?.id === this.#actorToEndId;

    await super.enterState(handler, previousState);

    // NOTE: notifyTurnEnded() has been moved to BaseTurnHandler.destroy()
    // to eliminate the race condition where the notification triggers
    // handler destruction while this enterState() is still executing.

    /* 1️⃣  Normal-apparent-termination signal -------------------------------- */
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

    /* 2️⃣  Cleanup ----------------------------------------------------------- */
    handler.resetStateAndResources(
      `enterState-TurnEndingState-actor-${this.#actorToEndId}`
    );

    // NOTE: requestIdleStateTransition() has been removed.
    // TurnEndingState is now a terminal state - the transition to Idle
    // is handled by BaseTurnHandler.destroy() after this state completes.

    logger.debug(
      `TurnEndingState: Completed cleanup, awaiting destruction (actor ${this.#actorToEndId}).`
    );
  }

  /* ────────────────────────────────────────────────────────────────── */
  /** @override */
  async exitState(handler, nextState) {
    getLogger(null, handler).debug(
      `TurnEndingState: Exiting for (intended) actor ${this.#actorToEndId}. ` +
        `Transitioning to ${nextState?.getStateName() ?? 'None'}. ITurnContext should be null.`
    );
    await super.exitState(handler, nextState);
  }

  /* ────────────────────────────────────────────────────────────────── */
  /** @override */
  async destroy(handler) {
    const logger = getLogger(this._getTurnContext(), handler);

    // NOTE: Being destroyed while in TurnEndingState is now the expected flow.
    // TurnEndingState is a terminal state - BaseTurnHandler.destroy() handles
    // the notification and transition to Idle.
    logger.debug(
      `TurnEndingState.destroy() called for actor ${this.#actorToEndId}.`
    );

    await super.destroy(handler);
  }

  /* ────────────────────────────────────────────────────────────────── */
  isEnding() {
    return true;
  }

  //───────────────────────────────────────────────────────────────────────────
  // Private utilities
  //───────────────────────────────────────────────────────────────────────────

  /**
   * Resolves the actor ID to end the turn for.
   *
   * @param {string | null | undefined} actorToEndId - Actor id passed to the
   *   constructor.
   * @returns {string} The resolved actor id.
   */
  _resolveActorId(actorToEndId) {
    return (
      actorToEndId || this._handler?.getCurrentActor?.()?.id || UNKNOWN_ACTOR_ID
    );
  }

  /**
   * Dispatches and logs a warning when no actor id was provided.
   *
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher|null} dispatcher
   * @param {import('../../logging/consoleLogger.js').default | Console} log
   * @param {string | null | undefined} providedId - The originally supplied id.
   * @returns {void}
   */
  _notifyMissingActorId(dispatcher, log, providedId) {
    reportMissingActorId(dispatcher, log, providedId, this.#actorToEndId);
  }
}
