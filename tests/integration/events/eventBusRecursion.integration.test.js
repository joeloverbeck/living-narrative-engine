// tests/integration/events/eventBusRecursion.integration.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

describe('EventBus - Recursion During Turn Transitions', () => {
  let eventBus;
  let mockLogger;
  let consoleErrorSpy;
  let eventCounter;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventBus = new EventBus({ logger: mockLogger });

    // Spy on console.error to capture recursion warnings
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Track event dispatches
    eventCounter = {};
    eventBus.subscribe('core:component_added', (payload) => {
      const key = `${payload.entity}_${payload.componentTypeId}`;
      eventCounter[key] = (eventCounter[key] || 0) + 1;
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should not exceed recursion depth when simulating turn transitions', async () => {
    // Simulate a rule that adds a component when turn_started is fired
    let componentAddedCount = 0;

    eventBus.subscribe('core:turn_started', async (payload) => {
      // Simulate adding current_actor component (like the rule does)
      await eventBus.dispatch('core:component_added', {
        entity: payload.entityId,
        componentTypeId: 'core:current_actor',
        componentData: {},
      });
    });

    eventBus.subscribe('core:component_added', (payload) => {
      componentAddedCount++;
    });

    // Simulate turn_started events for two actors
    await eventBus.dispatch('core:turn_started', {
      entityId: 'actor1',
      entityType: 'actor',
      entity: { id: 'actor1', name: 'Test Actor 1' },
    });

    await eventBus.dispatch('core:turn_ended', {
      entityId: 'actor1',
      entityType: 'actor',
      entity: { id: 'actor1', name: 'Test Actor 1' },
    });

    await eventBus.dispatch('core:turn_started', {
      entityId: 'actor2',
      entityType: 'actor',
      entity: { id: 'actor2', name: 'Test Actor 2' },
    });

    // Check that recursion error was not triggered
    const recursionErrors = consoleErrorSpy.mock.calls.filter(
      (call) => call[0] && call[0].includes('Maximum recursion depth')
    );

    expect(recursionErrors.length).toBe(0);

    // Component_added should be called once per turn_started
    expect(componentAddedCount).toBe(2);
  });

  it('should handle rapid component additions without triggering infinite loop', async () => {
    // Simulate rapid component additions
    const componentTypes = ['test:comp1', 'test:comp2', 'test:comp3'];

    for (const compType of componentTypes) {
      await eventBus.dispatch('core:component_added', {
        entity: 'test-entity',
        componentTypeId: compType,
        componentData: { value: 'test' },
      });
    }

    // Check for recursion warnings
    const recursionWarnings = consoleErrorSpy.mock.calls.filter(
      (call) =>
        call[0] &&
        (call[0].includes('recursion depth warning') ||
          call[0].includes('Maximum recursion depth'))
    );

    expect(recursionWarnings.length).toBe(0);
  });

  it('should detect and block actual infinite recursion scenarios', async () => {
    // Create a pathological case: a listener that adds a component when a component is added
    let recursionCount = 0;

    const recursiveListener = async (payload) => {
      recursionCount++;
      if (recursionCount < 200) {
        // Try to create infinite loop
        // This simulates a rule that adds a component in response to component_added
        await eventBus.dispatch('core:component_added', {
          entity: payload.entity,
          componentTypeId: `test:recursive_${recursionCount}`,
          componentData: { count: recursionCount },
        });
      }
    };

    eventBus.subscribe('core:component_added', recursiveListener);

    // Start the cascade
    await eventBus.dispatch('core:component_added', {
      entity: 'test-entity',
      componentTypeId: 'test:trigger',
      componentData: { value: 'start' },
    });

    // EventBus should have blocked the recursion
    expect(recursionCount).toBeLessThan(150); // Should be stopped by recursion limit (100)

    // Should have logged an error about recursion
    const recursionErrors = consoleErrorSpy.mock.calls.filter(
      (call) => call[0] && call[0].includes('Maximum recursion depth')
    );

    expect(recursionErrors.length).toBeGreaterThan(0);

    // Check that the error includes event details
    if (recursionErrors.length > 0) {
      const errorArgs = recursionErrors[0];
      expect(errorArgs.length).toBeGreaterThan(1);
      expect(errorArgs[1]).toContain('Last event details');
    }

    // Clean up the recursive listener
    eventBus.unsubscribe('core:component_added', recursiveListener);
  });
});
