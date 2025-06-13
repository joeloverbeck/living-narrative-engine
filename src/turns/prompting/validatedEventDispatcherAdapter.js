/**
 * @file Defines an adapter to expose only the subscription part of the event dispatcher.
 * @see src/turns/prompting/validatedEventDispatcherAdapter.js
 */

/** @typedef {import('../../interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/IPlayerTurnEvents.js').IPlayerTurnEvents} IPlayerTurnEvents_Interface */
/** @typedef {import('../../events/eventBus.js').EventListener} EventListener */
/** @typedef {() => void} UnsubscribeFn */

import { IPlayerTurnEvents } from '../interfaces/IPlayerTurnEvents.js';

/**
 * @class ValidatedEventDispatcherAdapter
 * @implements {IPlayerTurnEvents_Interface}
 * @description Adapts the full IValidatedEventDispatcher to the simpler IPlayerTurnEvents interface,
 * exposing only the `subscribe` method. This is used to provide a restricted event API
 * to services that should only listen for events, not dispatch them.
 */
export class ValidatedEventDispatcherAdapter extends IPlayerTurnEvents {
  /**
   * The underlying event dispatcher instance.
   *
   * @type {IValidatedEventDispatcher}
   * @private
   */
  #validatedEventDispatcher;

  /**
   * Creates an instance of ValidatedEventDispatcherAdapter.
   *
   * @param {object} dependencies
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher to adapt.
   */
  constructor({ validatedEventDispatcher }) {
    super();
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.subscribe !== 'function'
    ) {
      throw new Error(
        'ValidatedEventDispatcherAdapter: Missing or invalid validatedEventDispatcher dependency.'
      );
    }
    this.#validatedEventDispatcher = validatedEventDispatcher;
  }

  /**
   * Subscribes a listener function to a specific event.
   * Delegates the call to the underlying event dispatcher.
   *
   * @param {string} eventId - The identifier of the event to subscribe to.
   * @param {EventListener} handler - The function to call when the event is dispatched.
   * @returns {UnsubscribeFn} A function that, when called, unregisters the provided listener.
   */
  subscribe(eventId, handler) {
    return this.#validatedEventDispatcher.subscribe(eventId, handler);
  }
}

export default ValidatedEventDispatcherAdapter;
