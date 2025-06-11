/**
 * @file Implements the PromptSession class for managing a single player prompt.
 * @module src/turns/prompting/promptSession.js
 */

// ──────────── Imports ────────────
import { PromptError } from '../../errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../constants/eventIds.js';
import { validateDependency } from '../../utils/validationUtils.js';

// ──────────── JSDoc Typedefs ────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/**
 * Interface for the event bus, specifying only the methods needed by this class.
 * This avoids a direct dependency on the full IValidatedEventDispatcher interface in the constructor type.
 * @typedef {{subscribe: IValidatedEventDispatcher['subscribe']}} IPlayerTurnEvents
 */
/** @typedef {import('../services/humanPlayerPromptService.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../services/humanPlayerPromptService.js').PlayerPromptResolution} PlayerPromptResolution */
/** @typedef {import('../services/humanPlayerPromptService.js').CorePlayerTurnSubmittedEvent} CorePlayerTurnSubmittedEvent */

/**
 * @description Owns a single, live player prompt, managing its lifecycle including event
 * subscription, abortion, and cleanup. A PromptSession is designed for one-time use.
 * @class
 */
export class PromptSession {
  /** @type {string} */
  #actorId;
  /** @type {DiscoveredActionInfo[]} */
  #actions;
  /** @type {IPlayerTurnEvents} */
  #eventBus;
  /** @type {AbortSignal|undefined} */
  #abortSignal;
  /** @type {ILogger} */
  #logger;

  /** @type {boolean} */
  #resolved = false;
  /** @type {Promise<PlayerPromptResolution>|null} */
  #promise = null;
  /** @type {((value: PlayerPromptResolution) => void)|null} */
  #resolveCallback = null;
  /** @type {((reason?: any) => void)|null} */
  #rejectCallback = null;
  /** @type {(() => void)|null} */
  #unsubscribe = null;
  /** @type {(() => void)|null} */
  #onAbort = null;

  /**
   * Creates an instance of PromptSession.
   * @param {object} params - The constructor parameters.
   * @param {string} params.actorId - The ID of the actor being prompted.
   * @param {DiscoveredActionInfo[]} params.actions - The list of available actions.
   * @param {IPlayerTurnEvents} params.eventBus - The event bus for subscribing to player input.
   * @param {ILogger} params.logger - The logger instance.
   * @param {AbortSignal} [params.abortSignal] - An optional signal to abort the prompt.
   */
  constructor({ actorId, actions, eventBus, logger, abortSignal }) {
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['error', 'debug'],
    });
    validateDependency(eventBus, 'eventBus', logger, {
      requiredMethods: ['subscribe'],
    });

    if (!actorId || typeof actorId !== 'string') {
      throw new Error('PromptSession: actorId must be a non-empty string.');
    }
    if (!Array.isArray(actions)) {
      throw new Error('PromptSession: actions must be an array.');
    }

    this.#actorId = actorId;
    this.#actions = actions;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#abortSignal = abortSignal;
  }

  /**
   * Cleans up all resources used by the prompt session, ensuring idempotency.
   * @private
   */
  #cleanup() {
    if (this.#resolved) {
      return;
    }
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
   * Handles the PLAYER_TURN_SUBMITTED_ID event.
   * @private
   * @param {CorePlayerTurnSubmittedEvent} event
   */
  #handleEvent(event) {
    if (this.#resolved) return;

    if (
      !event ||
      !event.payload ||
      typeof event.payload.actionId !== 'string'
    ) {
      this.#cleanup();
      this.#rejectCallback?.(
        new PromptError(
          'Malformed player turn event received.',
          { receivedEvent: event },
          'INVALID_EVENT'
        )
      );
      return;
    }

    const { submittedByActorId, actionId, speech = null } = event.payload;

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

    const selectedAction = this.#actions.find((a) => a.id === actionId);
    if (!selectedAction) {
      this.#cleanup();
      this.#rejectCallback?.(
        new PromptError(
          `Submitted actionId "${actionId}" is not a valid choice for actor ${this.#actorId}.`,
          { submittedActionId: actionId },
          'INVALID_ACTION_ID'
        )
      );
      return;
    }

    this.#cleanup();
    this.#resolveCallback?.({ action: selectedAction, speech });
  }

  /**
   * Handles the abort signal firing by rejecting the promise.
   * @private
   */
  #handleAbort() {
    if (this.#resolved) return;
    this.#cleanup();
    this.#rejectCallback?.(
      new PromptError('Prompt aborted by signal', null, 'ABORT_ERROR')
    );
  }

  /**
   * Initiates the prompt session.
   * @returns {Promise<PlayerPromptResolution>}
   */
  run() {
    if (this.#promise) {
      return this.#promise;
    }

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
          (event) => this.#handleEvent(event)
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

  /**
   * Imperatively cancels the prompt from an external caller.
   * @param {any} [reason]
   */
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
    // Reverting to the original microtask-based deferral.
    // The updated test syntax `await expect().rejects` is designed to handle
    // this timing correctly.
    Promise.resolve().then(() => {
      this.#rejectCallback?.(cancellationError);
    });
  }
}
