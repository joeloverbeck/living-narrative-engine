import { jest } from '@jest/globals';

/**
 * Creates a unified event bus mock that can optionally capture events.
 *
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.captureEvents] - Whether to capture dispatched events
 * @returns {object} Mock event bus with subscribe, unsubscribe, dispatch methods
 */
export function createEventBus({ captureEvents = false } = {}) {
  const handlers = {};
  const events = captureEvents ? [] : null;

  const eventBus = {
    dispatch: jest.fn(async (eventType, payload) => {
      if (captureEvents) {
        events.push({ eventType, payload });
      }
      const listeners = [
        ...(handlers[eventType] || []),
        ...(handlers['*'] || []),
      ];
      await Promise.all(
        listeners.map(async (h) => {
          await h({ type: eventType, payload });
        })
      );
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
    _triggerEvent(eventType, payload) {
      (handlers[eventType] || new Set()).forEach((h) => h(payload));
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
