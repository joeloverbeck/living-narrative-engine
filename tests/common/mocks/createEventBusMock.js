import { jest } from '@jest/globals';

const LEGACY_SIGNATURE_ERROR =
  'createEventBusMock only supports dispatch(eventType, payload). Received legacy single-object signature. See specs/goap-system-specs.md and docs/goap/debugging-tools.md#Planner Contract Checklist.';

/**
 * Creates a contract-enforcing event bus mock for GOAP tests.
 * The mock records dispatches (bounded by maxEvents), exposes helpers for assertions,
 * and rejects the legacy signature.
 */
export function createEventBusMock({ captureLegacyCalls = false, maxEvents = 500 } = {}) {
  const listeners = new Map();
  const wildcardKey = '*';
  const globalListeners = new Set();
  const events = [];
  const legacyViolations = [];

  const appendListener = (eventType, handler) => {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set());
    }
    listeners.get(eventType).add(handler);
  };

  const removeListener = (eventType, handler) => {
    listeners.get(eventType)?.delete(handler);
  };

  const notifyListeners = async (event) => {
    const targets = [
      ...(listeners.get(event.type) || []),
      ...(listeners.get(wildcardKey) || []),
    ];

    for (const handler of targets) {
      await handler(event);
    }

    for (const handler of globalListeners) {
      await handler(event);
    }
  };

  const eventBus = {
    dispatch: jest.fn(async (eventType, payload) => {
      if (typeof eventType !== 'string') {
        if (captureLegacyCalls) {
          legacyViolations.push({ eventType, payload });
        }
        throw new Error(LEGACY_SIGNATURE_ERROR);
      }

      const normalizedType = eventType.trim();
      if (!normalizedType) {
        throw new Error('Event type must be a non-empty string.');
      }

      if (payload != null && typeof payload !== 'object') {
        throw new Error('Event payload must be an object when provided.');
      }

      const normalizedPayload = payload ?? {};
      const record = {
        type: normalizedType,
        payload: { ...normalizedPayload },
        timestamp: Date.now(),
      };

      events.push(record);
      if (events.length > maxEvents) {
        events.shift();
      }
      await notifyListeners(record);
      return true;
    }),
    subscribe: jest.fn((eventType, handler) => {
      appendListener(eventType, handler);
      return () => removeListener(eventType, handler);
    }),
    unsubscribe: jest.fn((eventType, handler) => {
      removeListener(eventType, handler);
    }),
    listenerCount: jest.fn((eventType) => listeners.get(eventType)?.size || 0),
    on: jest.fn((eventType, handler) => {
      appendListener(eventType, handler);
    }),
    off: jest.fn((eventType, handler) => {
      removeListener(eventType, handler);
    }),
    onDispatch(listener) {
      globalListeners.add(listener);
      return () => globalListeners.delete(listener);
    },
    getEvents(type) {
      if (!type) {
        return [...events];
      }
      return events.filter((event) => event.type === type);
    },
    getEventTypes() {
      return [...new Set(events.map((event) => event.type))];
    },
    findEvent(type) {
      if (!type || typeof type !== 'string') {
        throw new Error('findEvent requires a non-empty event type');
      }
      return events.find((event) => event.type === type) || null;
    },
    findEvents(type) {
      if (!type || typeof type !== 'string') {
        throw new Error('findEvents requires a non-empty event type');
      }
      return events.filter((event) => event.type === type);
    },
    clear() {
      events.length = 0;
    },
    getLegacyViolations() {
      return [...legacyViolations];
    },
  };

  return eventBus;
}
