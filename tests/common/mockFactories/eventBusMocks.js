import { jest } from '@jest/globals';
import { createSimpleMock } from './coreServices.js';

export const createMockSafeEventDispatcher = () =>
  createSimpleMock(['dispatch']);

export const createMockValidatedEventDispatcher = () =>
  createSimpleMock(['dispatch'], {
    dispatch: jest.fn().mockResolvedValue(undefined),
  });

export const createEventBusMock = ({ captureEvents = false } = {}) => {
  const handlers = {};
  const events = [];

  const bus = {
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
    },
  };

  if (captureEvents) {
    bus.events = events;
  }

  return bus;
};

export const createMockValidatedEventBus = () => createEventBusMock();

export const createCapturingEventBus = () =>
  createEventBusMock({ captureEvents: true });

export const createMockValidatedEventDispatcherForIntegration = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn().mockReturnValue(() => {}),
  unsubscribe: jest.fn(),
});
