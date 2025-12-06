// tests/unit/events/componentAddedCascade.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

describe('EventBus - Component Added Event Cascades', () => {
  let eventBus;
  let mockLogger;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventBus = new EventBus({ logger: mockLogger });

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should handle legitimate cascading component additions without warnings', () => {
    let eventCount = 0;
    const cascadeDepth = 5; // Legitimate cascade of 5 component additions

    // Create a cascade where each component triggers the next
    eventBus.subscribe('core:component_added', (payload) => {
      eventCount++;
      if (
        eventCount < cascadeDepth &&
        payload.componentTypeId !== `test:comp${cascadeDepth}`
      ) {
        // Simulate adding the next component in the cascade
        eventBus.dispatch('core:component_added', {
          entity: 'test-entity',
          componentTypeId: `test:comp${eventCount + 1}`,
          componentData: { index: eventCount + 1 },
        });
      }
    });

    // Start the cascade
    eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:comp1',
      componentData: { index: 1 },
    });

    // Should complete without warnings for a small cascade
    expect(eventCount).toBe(cascadeDepth);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should warn at 50% recursion depth for component_added events', () => {
    let eventCount = 0;
    const targetDepth = 51; // Just over 50% of the 100 limit

    // Create a deep cascade
    const recursiveHandler = (payload) => {
      eventCount++;
      if (eventCount < targetDepth) {
        eventBus.dispatch('core:component_added', {
          entity: 'test-entity',
          componentTypeId: `test:comp${eventCount + 1}`,
          componentData: { depth: eventCount + 1 },
        });
      }
    };

    eventBus.subscribe('core:component_added', recursiveHandler);

    // Start the cascade
    eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:comp1',
      componentData: { depth: 1 },
    });

    // Should have warned at 50% (depth 50)
    const warningCalls = consoleWarnSpy.mock.calls.filter((call) =>
      call[0].includes('50% of limit reached')
    );
    expect(warningCalls.length).toBeGreaterThan(0);
  });

  it('should block at exactly 100 recursion depth and log enhanced error', () => {
    let eventCount = 0;
    const attemptedDepth = 150; // Try to exceed the limit

    const recursiveHandler = (payload) => {
      eventCount++;
      if (eventCount < attemptedDepth) {
        eventBus.dispatch('core:component_added', {
          entity: 'test-entity',
          componentTypeId: `test:recursive${eventCount}`,
          componentData: {
            depth: eventCount,
            trigger: 'cascade_test',
          },
        });
      }
    };

    eventBus.subscribe('core:component_added', recursiveHandler);

    // Start the cascade
    eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:trigger',
      componentData: {
        depth: 0,
        trigger: 'initial',
      },
    });

    // Should stop at 100
    expect(eventCount).toBe(100);

    // Should have logged an error with enhanced details
    const errorCalls = consoleErrorSpy.mock.calls.filter((call) =>
      call[0].includes('Maximum recursion depth (100) exceeded')
    );
    expect(errorCalls.length).toBe(1);

    // Verify enhanced error includes event details
    const errorCall = errorCalls[0];
    expect(errorCall.length).toBeGreaterThanOrEqual(3);
    expect(errorCall[1]).toContain('Last event details');

    // The third argument should be the JSON stringified event details
    const eventDetailsJson = errorCall[2];
    expect(eventDetailsJson).toBeDefined();

    // Parse and verify the event details structure
    const eventDetails = JSON.parse(eventDetailsJson);
    expect(eventDetails).toHaveProperty('eventName', 'core:component_added');
    expect(eventDetails).toHaveProperty('payload');
    expect(eventDetails).toHaveProperty('currentDepth', 100);
    expect(eventDetails).toHaveProperty('maxDepth', 100);
    expect(eventDetails.payload).toHaveProperty('entity', 'test-entity');
    expect(eventDetails.payload).toHaveProperty('componentTypeId');
    expect(eventDetails.payload.componentData).toHaveProperty(
      'trigger',
      'cascade_test'
    );
  });

  it('should handle batch mode with higher limits for component lifecycle events', () => {
    // Enable batch mode for game initialization
    eventBus.setBatchMode(true, {
      maxRecursionDepth: 200,
      maxGlobalRecursion: 500,
      context: 'game-initialization',
    });

    let eventCount = 0;
    const targetDepth = 150; // Between normal limit (100) and batch limit (200)

    const recursiveHandler = (payload) => {
      eventCount++;
      if (eventCount < targetDepth) {
        eventBus.dispatch('core:component_added', {
          entity: 'test-entity',
          componentTypeId: `test:batch${eventCount}`,
          componentData: { depth: eventCount },
        });
      }
    };

    eventBus.subscribe('core:component_added', recursiveHandler);

    // Start the cascade
    eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:batch_trigger',
      componentData: { depth: 0 },
    });

    // Should allow up to 150 in batch mode (limit is 200)
    expect(eventCount).toBe(targetDepth);

    // Should not have errored yet
    const errorCalls = consoleErrorSpy.mock.calls.filter((call) =>
      call[0].includes('Maximum recursion depth')
    );
    expect(errorCalls.length).toBe(0);

    eventBus.setBatchMode(false);
  });

  it('should track component_added events separately from other event recursion', () => {
    let componentEventCount = 0;
    let otherEventCount = 0;

    // Handler for component_added that triggers other events
    eventBus.subscribe('core:component_added', (payload) => {
      componentEventCount++;
      if (componentEventCount < 5) {
        // Trigger a different event type
        eventBus.dispatch('test:other_event', {
          triggered_by: 'component_added',
          count: componentEventCount,
        });
      }
    });

    // Handler for other events
    eventBus.subscribe('test:other_event', (payload) => {
      otherEventCount++;
      if (otherEventCount < 5) {
        // This might trigger more component additions
        eventBus.dispatch('core:component_added', {
          entity: 'test-entity',
          componentTypeId: `test:from_other${otherEventCount}`,
          componentData: { source: 'other_event' },
        });
      }
    });

    // Start with a component addition
    eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:initial',
      componentData: { source: 'test' },
    });

    // Both event types should have been dispatched
    expect(componentEventCount).toBeGreaterThan(0);
    expect(otherEventCount).toBeGreaterThan(0);

    // Neither should have hit recursion limits since they're different event types
    const errorCalls = consoleErrorSpy.mock.calls.filter((call) =>
      call[0].includes('Maximum recursion depth')
    );
    expect(errorCalls.length).toBe(0);
  });
});
