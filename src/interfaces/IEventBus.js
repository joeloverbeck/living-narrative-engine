// src/interfaces/IEventBus.js

/**
 * @file Defines the IEventBus interface describing the contract
 * for a simple publish/subscribe event bus.
 */

/**
 * Represents the function signature for event listeners used by the event bus.
 *
 * @typedef {(event: {type: string, payload: any}) => (void|Promise<void>)} EventListener
 */

export class IEventBus {
  /**
   * Dispatches an event to all subscribed listeners.
   *
   * @param {string} eventName - The event identifier.
   * @param {object} payload - Arbitrary data associated with the event.
   * @returns {Promise<void>}
   */
  async dispatch(eventName, payload) {
    throw new Error('IEventBus.dispatch method not implemented.');
  }

  /**
   * Subscribes a listener to a specific event.
   *
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {EventListener} listener - Function invoked when the event is dispatched.
   * @returns {() => void} Function that unsubscribes the listener when called.
   */
  subscribe(eventName, listener) {
    throw new Error('IEventBus.subscribe method not implemented.');
  }

  /**
   * Unsubscribes a listener from a specific event.
   *
   * @param {string} eventName - The event identifier.
   * @param {EventListener} listener - The previously subscribed listener.
   * @returns {void}
   */
  unsubscribe(eventName, listener) {
    throw new Error('IEventBus.unsubscribe method not implemented.');
  }

  /**
   * Returns the number of listeners currently subscribed to an event.
   *
   * @param {string} eventName - The event identifier.
   * @returns {number} Number of subscribed listeners.
   */
  listenerCount(eventName) {
    throw new Error('IEventBus.listenerCount method not implemented.');
  }
}

export {};
