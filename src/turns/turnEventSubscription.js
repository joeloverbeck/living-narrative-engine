import { TURN_ENDED_ID } from '../constants/eventIds.js';

/**
 * @class TurnEventSubscription
 * @classdesc Manages subscription to the {@link TURN_ENDED_ID} event and
 * invokes callbacks immediately when events are received.
 *
 * Note: Prior to Phase 10 fix, this class used setTimeout(..., 0) to defer
 * callback invocation. This was removed to fix a race condition where the
 * TurnManager's handler destruction would race with state machine transitions.
 */
export default class TurnEventSubscription {
  /** @type {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} */
  #bus;
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /**
   * Scheduler retained for backward compatibility with constructor signature.
   * No longer used after Phase 10 fix removed setTimeout deferral.
   *
   * @type {import('../scheduling').IScheduler}
   */
  // eslint-disable-next-line no-unused-private-class-members
  #scheduler;
  /** @type {(() => void) | null} */
  #unsub = null;

  /**
   * Creates a new TurnEventSubscription instance.
   *
   * @param {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} bus - Event bus.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
   * @param {import('../scheduling').IScheduler} scheduler - Scheduler used to invoke callbacks.
   */
  constructor(bus, logger, scheduler) {
    if (!bus || typeof bus.subscribe !== 'function') {
      throw new Error('TurnEventSubscription: bus must support subscribe');
    }
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error('TurnEventSubscription: logger is required');
    }
    if (
      !scheduler ||
      typeof scheduler.setTimeout !== 'function' ||
      typeof scheduler.clearTimeout !== 'function'
    ) {
      throw new Error('TurnEventSubscription: invalid scheduler');
    }
    this.#bus = bus;
    this.#logger = logger;
    this.#scheduler = scheduler;
  }

  /**
   * Subscribes to {@link TURN_ENDED_ID} and invokes the provided callback
   * immediately when the event fires.
   *
   * Note: The callback can be async. When async, the callback is awaited to ensure
   * proper error handling. The callback is invoked synchronously (no deferral)
   * to avoid race conditions with state machine transitions.
   *
   * @param {(ev: { type: string; payload: any }) => void | Promise<void>} cb - Handler invoked when the event fires.
   * @returns {void}
   */
  subscribe(cb) {
    if (typeof cb !== 'function') {
      throw new TypeError(
        'TurnEventSubscription: callback must be a function'
      );
    }
    if (this.#unsub) return;
    const wrapped = (ev) => {
      this.#logger.debug(
        `TurnEventSubscription: received ${TURN_ENDED_ID} event`
      );
      // PHASE 10 FIX: Call callback immediately instead of deferring via setTimeout.
      // The setTimeout(..., 0) deferral caused a race condition where the state machine
      // would receive the turn_ended event immediately (via Promise.race), transition
      // to TurnEndingState, but then TurnManager's deferred callback would fire and
      // destroy the handler mid-transition.
      // The early listener pattern (Phase 7) and awaited dispatch (Phase 3) handle
      // timing coordination, so deferral is no longer needed.
      //
      // Async wrapper to properly handle async callbacks with error catching
      const invokeCallback = async () => {
        try {
          // Await the callback to ensure async handlers complete
          await cb(ev);
        } catch (callbackError) {
          this.#logger.error(
            `TurnEventSubscription: callback threw while handling ${TURN_ENDED_ID}.`,
            callbackError
          );
        }
      };
      invokeCallback();
    };
    const unsub = this.#bus.subscribe(TURN_ENDED_ID, wrapped);
    if (typeof unsub !== 'function') {
      this.#unsub = null;
      throw new Error(
        'Subscription function did not return an unsubscribe callback.'
      );
    }
    this.#unsub = unsub;
    this.#logger.debug('TurnEventSubscription: subscribed');
  }

  /**
   * Unsubscribes from the event if subscribed.
   *
   * @returns {void}
   */
  unsubscribe() {
    if (this.#unsub) {
      this.#unsub();
      this.#unsub = null;
      this.#logger.debug('TurnEventSubscription: unsubscribed');
    }
  }
}
