/**
 * @file Defines the IPlayerTurnEvents interface for subscribing to player turn events.
 * @see src/turns/interfaces/IPlayerTurnEvents.js
 */

/**
 * @file Defines the IPlayerTurnEvents interface for subscribing to player turn events.
 * @module src/turns/interfaces/IPlayerTurnEvents
 */

/** @typedef {import('../../events/eventBus.js').EventListener} EventListener */
/** @typedef {() => void} UnsubscribeFn */

/**
 * @interface IPlayerTurnEvents
 * @description Defines a simplified contract for subscribing to events related to player turns.
 * This is typically used by services that only need to listen for player input events,
 * without needing the full dispatch capabilities of IValidatedEventDispatcher.
 */
export class IPlayerTurnEvents {
  /**
   * Subscribes a listener function to a specific event.
   *
   * @param {string} eventId - The identifier of the event to subscribe to.
   * @param {EventListener} handler - The function to call when the event is dispatched.
   * @returns {UnsubscribeFn} A function that, when called, unregisters the provided listener.
   */
  subscribe(eventId, handler) {
    throw new Error('IPlayerTurnEvents.subscribe method not implemented.');
  }
}
