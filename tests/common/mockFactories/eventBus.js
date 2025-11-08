import { jest } from '@jest/globals';

/**
 * Creates a unified event bus mock that can optionally capture events.
 *
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.captureEvents] - Whether to capture dispatched events
 * @returns {object} Mock event bus with subscribe, unsubscribe, dispatch, listenerCount methods
 */
export function createEventBus({ captureEvents = false } = {}) {
  const handlers = {};
  const events = captureEvents ? [] : null;

  const eventBus = {
    dispatch: jest.fn(async (eventTypeOrObject, payload) => {
      // Handle both old format (object) and new format (string, payload)
      let eventType;
      let eventPayload;

      if (typeof eventTypeOrObject === 'object' && eventTypeOrObject !== null) {
        // Old format: dispatch({ type: 'EVENT', payload: {...} })
        eventType = eventTypeOrObject.type;
        eventPayload = eventTypeOrObject.payload || {};
      } else {
        // New format: dispatch('EVENT', {...})
        eventType = eventTypeOrObject;
        eventPayload = payload || {};
      }

      if (captureEvents) {
        events.push({ eventType, payload: eventPayload });
      }
      const listeners = [
        ...(handlers[eventType] || []),
        ...(handlers['*'] || []),
      ];

      // Process listeners asynchronously to handle async event handlers
      let validationPassed = true;
      const listenerPromises = listeners.map(async (h, index) => {
        try {
          // Pass full event object to match real EventBus behavior
          // Await the handler in case it's async (like SystemLogicInterpreter)
          await h({ type: eventType, payload: eventPayload });
        } catch (error) {
          validationPassed = false;
          console.error(`Event handler error for ${eventType}:`, error);
        }
      });

      // Wait for all listeners to complete
      await Promise.all(listenerPromises);

      // Return boolean for validation tests that expect it
      return validationPassed;
    }),
    subscribe: jest.fn((eventType, handler) => {
      if (!handlers[eventType]) {
        handlers[eventType] = new Set();
      }
      handlers[eventType].add(handler);
      return jest.fn(() => {
        handlers[eventType]?.delete(handler);
      });
    }),
    unsubscribe: jest.fn((eventType, handler) => {
      handlers[eventType]?.delete(handler);
    }),
    listenerCount: jest.fn((eventType) => handlers[eventType]?.size || 0),
    async _triggerEvent(eventType, payload) {
      const promises = [];
      (handlers[eventType] || new Set()).forEach((h) =>
        promises.push(h({ type: eventType, payload }))
      );
      await Promise.all(promises);
    },
    _clearHandlers() {
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      if (events) {
        events.length = 0;
      }
    },
  };

  if (events) {
    eventBus.events = events;
  }

  return eventBus;
}

/**
 * Creates a mock validated event bus (without event capture).
 *
 * @returns {object} Mock event bus
 */
export const createMockValidatedEventBus = () => createEventBus();

/**
 * Creates a capturing event bus (with event capture enabled).
 *
 * @returns {object} Mock event bus with events array
 */
export const createCapturingEventBus = () =>
  createEventBus({ captureEvents: true });
