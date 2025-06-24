/**
 * @file Mixin providing event capture helpers for TurnManager tests.
 */

import { jest } from '@jest/globals';
import { waitForCondition } from '../jestHelpers.js';

/**
 * @description Extends a base test bed with dispatcher event utilities.
 * @param {typeof import('../baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('../baseTestBed.js').default} Extended class with event helpers.
 */
export function EventCaptureMixin(Base) {
  return class EventCapture extends Base {
    /**
     * Retrieves the subscribed callback for the given event id.
     *
     * @param {string} eventId - Event identifier.
     * @returns {(Function|undefined)} Handler subscribed to the event.
     */
    captureHandler(eventId) {
      const call = this.dispatcher.subscribe.mock.calls.find(
        ([id]) => id === eventId
      );
      return call ? call[1] : undefined;
    }

    /**
     * Sets up the dispatcher to capture subscriptions for the specified event.
     *
     * @param {string} eventId - Event identifier to capture.
     * @returns {{ unsubscribe: import('@jest/globals').Mock, handler: (() => void)|null }}
     *   Object exposing the unsubscribe spy and captured handler.
     */
    captureSubscription(eventId) {
      let captured = null;
      const unsubscribe = jest.fn();
      this.dispatcher.subscribe.mockImplementation((id, handler) => {
        if (id === eventId) {
          captured = handler;
        }
        return unsubscribe;
      });

      return {
        get handler() {
          return captured;
        },
        unsubscribe,
      };
    }

    /**
     * Triggers an event on the internal dispatcher.
     *
     * @param {string} eventType - Event name.
     * @param {object} payload - Event payload.
     * @returns {void}
     */
    trigger(eventType, payload) {
      this.dispatcher._triggerEvent(eventType, { type: eventType, payload });
    }

    /**
     * Waits until the current actor matches the given id.
     *
     * @param {string} id - Expected actor id.
     * @param {number} [maxTicks] - Maximum timer flush iterations.
     * @returns {Promise<void>} Resolves when actor found before timeout.
     * @throws {Error} If the actor is not found before timeout.
     */
    async waitForCurrentActor(id, maxTicks = 50) {
      const found = await waitForCondition(
        () => this.turnManager.getCurrentActor()?.id === id,
        maxTicks
      );
      if (!found) {
        throw new Error(`Timed out waiting for actor ${id}`);
      }
    }
  };
}

export default EventCaptureMixin;
