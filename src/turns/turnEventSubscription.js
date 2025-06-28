import { TURN_ENDED_ID } from '../constants/eventIds.js';

/**
 * @class TurnEventSubscription
 * @classdesc Manages subscription to the {@link TURN_ENDED_ID} event and
 * ensures callbacks run via a scheduler.
 */
export default class TurnEventSubscription {
  /** @type {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} */
  #bus;
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../scheduling').IScheduler} */
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
    if (!logger || typeof logger.debug !== 'function') {
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
   * Subscribes to {@link TURN_ENDED_ID} and schedules the provided callback
   * using the configured scheduler.
   *
   * @param {(ev: { type: string; payload: any }) => void} cb - Handler invoked when the event fires.
   * @returns {void}
   */
  subscribe(cb) {
    if (this.#unsub) return;
    const wrapped = (ev) => {
      this.#logger.debug(
        `TurnEventSubscription: received ${TURN_ENDED_ID} event`
      );
      this.#scheduler.setTimeout(() => cb(ev), 0);
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
