/**
 * @file Event bus recorder for GOAP integration tests
 * Records all dispatched events for verification
 */

/**
 * Creates a mock event bus that records all dispatched events
 * @returns {object} Event bus with recording capabilities
 */
export function createEventBusRecorder() {
  const events = [];
  const listeners = new Map(); // Map<eventType, Set<handler>>

  const eventBus = {
    dispatch: jest.fn((type, payload) => {
      const event = {
        type,
        payload,
        timestamp: Date.now(),
      };
      events.push(event);

      // Trigger registered listeners
      const handlers = listeners.get(type);
      if (handlers) {
        handlers.forEach((handler) => handler(event));
      }
    }),

    // Event listener registration (for RefinementTracer)
    on: jest.fn((eventType, handler) => {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType).add(handler);
    }),

    off: jest.fn((eventType, handler) => {
      const handlers = listeners.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    }),

    // Helper methods for test assertions
    getAll: () => events,
    getEventTypes: () => events.map((e) => e.type),
    findEvent: (type) => events.find((e) => e.type === type),
    findEvents: (type) => events.filter((e) => e.type === type),
    getEventsInOrder: (...types) => {
      const indices = types.map((type) =>
        events.findIndex((e) => e.type === type)
      );
      return indices;
    },
    clear: () => {
      events.length = 0;
    },
  };

  return eventBus;
}
