/**
 * @file Manages a single player prompt lifecycle (human flow).
 * @module src/turns/prompting/promptSession.js
 */

import { PromptError } from '../../errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../constants/eventIds.js';
import { validateDependency } from '../../utils/validationUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/services/actionIndexingService.js').ActionIndexingService} ActionIndexingService */
/**
 * Simplified view of the event bus – only subscribe is needed.
 * @typedef {{subscribe: (eventId: string, fn: Function) => () => void}} IPlayerTurnEvents
 */

/**
 * @typedef {object} PlayerPromptResolution
 * @property {import('../services/humanPlayerPromptService.js').DiscoveredActionInfo} action
 * @property {string|null} speech
 */

/**
 * @description Owns a single, live player prompt.
 * **Updated:** now resolves by integer `index` via ActionIndexingService.
 */
export class PromptSession {
  /** @type {string} */ #actorId;
  /** @type {IPlayerTurnEvents} */ #eventBus;
  /** @type {AbortSignal|undefined} */ #abortSignal;
  /** @type {ILogger} */ #logger;
  /** @type {ActionIndexingService} */ #actionIndexingService;

  /** @type {boolean} */ #resolved = false;
  /** @type {Promise<PlayerPromptResolution>|null} */ #promise = null;
  /** @type {Function|null} */ #resolveCallback = null;
  /** @type {Function|null} */ #rejectCallback = null;
  /** @type {Function|null} */ #unsubscribe = null;
  /** @type {Function|null} */ #onAbort = null;

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
      requiredMethods: ['error', 'debug'],
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

  // ─────────────────── Internal helpers ───────────────────
  #cleanup() {
    if (this.#resolved) return;
    this.#resolved = true;

    if (this.#unsubscribe) {
      try {
        this.#unsubscribe();
      } catch (e) {
        this.#logger.error('PromptSession: Error during event unsubscribe.', e);
      }
      this.#unsubscribe = null;
    }

    if (this.#abortSignal && this.#onAbort) {
      this.#abortSignal.removeEventListener('abort', this.#onAbort);
      this.#onAbort = null;
    }
  }

  /**
   * Handles `core:player_turn_submitted` events.
   * Expects `{ index: number, speech? }` in payload.
   * Resolves the integer to an action composite via ActionIndexingService.
   * @private
   * @param {*} event
   */
  #handleEvent(event) {
    if (this.#resolved) return;

    const payload = event?.payload;
    const index = payload?.index;
    const speech = payload?.speech ?? null;

    if (!Number.isInteger(index)) {
      this.#cleanup();
      this.#rejectCallback?.(
        new PromptError(
          'Malformed or missing index in player turn event.',
          { receivedEvent: event },
          'INVALID_EVENT'
        )
      );
      return;
    }

    const submittedByActorId = payload?.submittedByActorId ?? null;
    if (submittedByActorId && submittedByActorId !== this.#actorId) {
      this.#cleanup();
      this.#rejectCallback?.(
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
      composite = this.#actionIndexingService.resolve(this.#actorId, index);
    } catch (err) {
      this.#cleanup();
      this.#rejectCallback?.(
        new PromptError(
          `Submitted index ${index} is not valid for actor ${this.#actorId}.`,
          err,
          'INVALID_INDEX'
        )
      );
      return;
    }

    // Adapt composite back to the legacy DiscoveredActionInfo shape.
    const selectedAction = {
      id: composite.actionId,
      name: composite.description || composite.actionId,
      command: composite.commandString,
      description: composite.description,
      params: composite.params,
    };

    this.#cleanup();
    this.#resolveCallback?.({ action: selectedAction, speech });
  }

  #handleAbort() {
    if (this.#resolved) return;
    this.#cleanup();
    this.#rejectCallback?.(
      new PromptError('Prompt aborted by signal', null, 'ABORT_ERROR')
    );
  }

  // ─────────────────── Public API ───────────────────
  /**
   * Starts listening for the submitted-turn event.
   * @returns {Promise<PlayerPromptResolution>}
   */
  run() {
    if (this.#promise) return this.#promise;

    this.#promise = new Promise((resolve, reject) => {
      this.#resolveCallback = resolve;
      this.#rejectCallback = reject;

      if (this.#abortSignal?.aborted) {
        this.#handleAbort();
        return;
      }

      if (this.#abortSignal) {
        this.#onAbort = this.#handleAbort.bind(this);
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
        const error = new PromptError(
          'Failed to subscribe to player input events.',
          e,
          'SUBSCRIPTION_ERROR'
        );
        this.#cleanup();
        this.#rejectCallback?.(error);
      }
    });

    return this.#promise;
  }

  /** Imperatively cancels the prompt. */
  cancel(reason) {
    if (this.#resolved) return;

    const cancellationError =
      reason ??
      new PromptError(
        'Prompt cancelled externally',
        { actorId: this.#actorId },
        'PROMPT_CANCELLED'
      );

    this.#cleanup();
    Promise.resolve().then(() => {
      this.#rejectCallback?.(cancellationError);
    });
  }
}
