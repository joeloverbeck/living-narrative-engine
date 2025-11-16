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

  const eventBus = {
    dispatch: jest.fn((type, payload) => {
      events.push({
        type,
        payload,
        timestamp: Date.now(),
      });
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
