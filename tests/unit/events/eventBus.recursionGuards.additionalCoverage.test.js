import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

describe('EventBus recursion and loop safeguards', () => {
  let bus;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    bus = new EventBus({ logger });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('respects elevated workflow recursion limits during batch processing', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    bus.setBatchMode(true, {
      context: 'stress-test',
      maxRecursionDepth: 2,
      maxGlobalRecursion: 100,
      timeoutMs: 0,
    });

    let invocations = 0;
    bus.subscribe('core:turn_started', async () => {
      invocations += 1;
      if (invocations < 4) {
        await bus.dispatch('core:turn_started');
      }
    });

    await bus.dispatch('core:turn_started');

    expect(invocations).toBe(4);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('detects extreme workflow recursion cascades', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const dateSpy = jest.spyOn(Date, 'now');
    let workflowClock = 0;
    dateSpy.mockImplementation(() => {
      workflowClock += 20;
      return workflowClock;
    });

    const workflowSequence = [
      'core:turn_started',
      'core:turn_processing_started',
      'core:turn_processing_ended',
      'core:turn_ended',
      'core:player_turn_prompt',
      'core:action_decided',
      'core:attempt_action',
    ];

    let remaining = workflowSequence.length * 16; // Ensures workflowEventRecursion surpasses 100

    workflowSequence.forEach((eventName, index) => {
      const nextEvent = workflowSequence[(index + 1) % workflowSequence.length];
      bus.subscribe(eventName, async () => {
        if (remaining <= 0) {
          return;
        }
        remaining -= 1;
        await bus.dispatch(nextEvent);
      });
    });

    await bus.dispatch(workflowSequence[0]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Extreme workflow event recursion')
    );
  });

  it('detects extreme component recursion cascades during initialization batch mode', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    bus.setBatchMode(true, {
      context: 'game-initialization',
      maxRecursionDepth: 999,
      maxGlobalRecursion: 2000,
      timeoutMs: 0,
    });

    const componentEvents = [
      'core:component_added',
      'core:component_removed',
      'core:entity_created',
    ];

    let remaining = componentEvents.length * 100; // Push componentEventRecursion to >= 300
    const dateSpy = jest.spyOn(Date, 'now');
    let tick = 0;
    dateSpy.mockImplementation(() => {
      tick += 20;
      return tick;
    });

    componentEvents.forEach((eventName, index) => {
      const nextEvent = componentEvents[(index + 1) % componentEvents.length];
      bus.subscribe(eventName, async () => {
        if (remaining <= 0) {
          return;
        }
        remaining -= 1;
        await bus.dispatch(nextEvent);
      });
    });

    await bus.dispatch(componentEvents[0]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Extreme component event recursion')
    );
  });

  it('blocks potential infinite event loops based on timing heuristics', async () => {
    bus = new EventBus({ logger, chainHistoryLimit: 60 });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const dateSpy = jest.spyOn(Date, 'now');
    let tick = 0;
    // Use smaller increments (0.5ms per call) so 20 events span less than 50ms
    // With 3 Date.now() calls per dispatch, timestamps will be: 0.5, 2, 3.5, 5, ...
    // After 20 dispatches, timeSpan ≈ 29ms which is < 50ms threshold
    dateSpy.mockImplementation(() => {
      const result = tick;
      tick += 0.5;
      return result;
    });

    for (let i = 0; i < 25; i += 1) {
      await bus.dispatch('loop:test');
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Potential infinite loop detected')
    );
  });

  it('falls back to console logging when recursion pressure is high during listener failures', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const dateSpy = jest.spyOn(Date, 'now');
    let errorClock = 0;
    dateSpy.mockImplementation(() => {
      errorClock += 20;
      return errorClock;
    });

    const eventNames = Array.from(
      { length: 12 },
      (_, index) => `custom:event_${index}`
    );

    eventNames.forEach((eventName, index) => {
      if (index === eventNames.length - 1) {
        bus.subscribe(eventName, async () => {
          throw new Error('listener boom');
        });
        return;
      }

      const nextEvent = eventNames[index + 1];
      bus.subscribe(eventName, async () => {
        await bus.dispatch(nextEvent);
      });
    });

    await bus.dispatch(eventNames[0]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Error in "custom:event_11" listener'),
      expect.any(Error)
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
