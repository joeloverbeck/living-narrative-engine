// src/turns/prompting/promptSession.js

import { PromptError } from '../../errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../constants/eventIds.js';
import { validateDependency } from '../../utils/validationUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/services/actionIndexingService.js').ActionIndexingService} ActionIndexingService */
/**
 * Simplified view of the event bus – only subscribe is needed.
 *
 * @typedef {{subscribe: (eventId: string, fn: Function) => () => void}} IPlayerTurnEvents
 */

/**
 * @typedef {object} PlayerPromptResolution
 * @property {import('../services/humanPlayerPromptService.js').DiscoveredActionInfo} action
 * @property {string|null} speech
 * @property {string|null} thoughts - Optional thoughts from the player.
 * @property {string[]|null} notes - Optional notes from the player.
 */

/**
 * Owns a single, live player prompt.
 * Resolves by integer index via ActionIndexingService.
 */
export class PromptSession {
  #actorId;
  #eventBus;
  #abortSignal;
  #logger;
  #actionIndexingService;
  #resolved = false;
  #promise = null;
  #resolveCb = null;
  #rejectCb = null;
  #unsubscribe = null;
  #onAbort = null;

  /**
   * @param {object} params
   * @param {string} params.actorId
   * @param {IPlayerTurnEvents} params.eventBus
   * @param {ILogger} params.logger
   * @param {ActionIndexingService} params.actionIndexingService
   * @param {AbortSignal} [params.abortSignal]
   */
  constructor({
    actorId,
    eventBus,
    logger,
    actionIndexingService,
    abortSignal,
  }) {
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'error'],
    });
    validateDependency(eventBus, 'eventBus', logger, {
      requiredMethods: ['subscribe'],
    });
    validateDependency(actionIndexingService, 'actionIndexingService', logger, {
      requiredMethods: ['resolve'],
    });

    if (!actorId || typeof actorId !== 'string') {
      throw new Error('PromptSession: actorId must be a non-empty string.');
    }
    this.#actorId = actorId;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#actionIndexingService = actionIndexingService;
    this.#abortSignal = abortSignal;
  }

  /* ─────────────── internal helpers ─────────────── */

  /**
   * Fully cleans up listeners and schedules the final promise settlement.
   *
   * @param kind
   * @param value
   */
  #settle(kind, value) {
    if (this.#resolved) return;
    this.#resolved = true;

    try {
      this.#unsubscribe?.();
    } catch (e) {
      this.#logger.error('PromptSession: unsubscribe failed', e);
    }
    this.#unsubscribe = null;

    if (this.#abortSignal && this.#onAbort) {
      this.#abortSignal.removeEventListener('abort', this.#onAbort);
      this.#onAbort = null;
    }

    // macrotask – gives callers one full turn to add handlers
    const defer =
      typeof setImmediate === 'function'
        ? setImmediate // Node
        : (fn) => setTimeout(fn); // browser / JSDOM fallback

    defer(() => {
      if (kind === 'resolve') this.#resolveCb?.(value);
      else this.#rejectCb?.(value);
    });
  }

  /**
   * Handles PLAYER_TURN_SUBMITTED_ID events.
   * Expects `{ chosenIndex: number, speech?, thoughts?, notes? }` in payload.
   * Resolves the integer to an action composite via ActionIndexingService.
   *
   * @private
   * @param {*} event
   */
  #handleEvent(event) {
    if (this.#resolved) return;

    const {
      chosenIndex,
      speech = null,
      thoughts = null,
      notes = null,
      submittedByActorId = null,
    } = event?.payload ?? {};

    if (!Number.isInteger(chosenIndex)) {
      this.#settle(
        'reject',
        new PromptError(
          'Malformed or missing index in player turn event.',
          { receivedEvent: event },
          'INVALID_EVENT'
        )
      );
      return;
    }

    if (submittedByActorId && submittedByActorId !== this.#actorId) {
      this.#settle(
        'reject',
        new PromptError(
          `Mismatched actor ID. Expected ${this.#actorId} but event was for ${submittedByActorId}.`,
          { submittedByActorId },
          'MISMATCHED_ACTOR'
        )
      );
      return;
    }

    let composite;
    try {
      composite = this.#actionIndexingService.resolve(
        this.#actorId,
        chosenIndex
      );
    } catch (err) {
      this.#settle(
        'reject',
        new PromptError(
          `Submitted index ${chosenIndex} is not valid for actor ${this.#actorId}.`,
          err,
          'INVALID_INDEX'
        )
      );
      return;
    }

    const selectedAction = {
      id: composite.actionId,
      name: composite.description || composite.actionId,
      command: composite.commandString,
      description: composite.description,
      params: composite.params,
    };

    // ****** CORRECTED LINE ******
    // Ensure the original chosenIndex is passed along in the resolved object.
    this.#settle('resolve', {
      chosenIndex, // This was the missing piece of the puzzle
      action: selectedAction,
      speech,
      thoughts,
      notes,
    });
  }

  #handleAbort = () => {
    if (this.#resolved) return;
    this.#settle(
      'reject',
      new PromptError('Prompt aborted by signal', null, 'ABORT_ERROR')
    );
  };

  // ─────────────────── Public API ───────────────────
  /**
   * Starts listening for the submitted-turn event.
   *
   * @returns {Promise<PlayerPromptResolution>}
   */
  run() {
    if (this.#promise) return this.#promise;

    this.#promise = new Promise((resolve, reject) => {
      this.#resolveCb = resolve;
      this.#rejectCb = reject;

      if (this.#abortSignal?.aborted) {
        this.#handleAbort();
        return;
      }
      if (this.#abortSignal) {
        this.#onAbort = this.#handleAbort;
        this.#abortSignal.addEventListener('abort', this.#onAbort, {
          once: true,
        });
      }

      try {
        this.#unsubscribe = this.#eventBus.subscribe(
          PLAYER_TURN_SUBMITTED_ID,
          (e) => this.#handleEvent(e)
        );
      } catch (e) {
        this.#settle(
          'reject',
          new PromptError(
            'Failed to subscribe to player input events.',
            e,
            'SUBSCRIPTION_ERROR'
          )
        );
      }
    });

    return this.#promise;
  }

  /**
   * Imperatively cancels the prompt.
   *
   * @param reason
   */
  cancel(reason) {
    if (this.#resolved) return;
    const err =
      reason ??
      new PromptError(
        'Prompt cancelled externally',
        { actorId: this.#actorId },
        'PROMPT_CANCELLED'
      );
    this.#settle('reject', err);
  }
}
