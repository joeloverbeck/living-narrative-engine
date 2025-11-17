import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { dispatchGoapEventForTest } from '../../../common/goap/goapEventTestUtils.js';
import RefinementTracer from '../../../../src/goap/debug/refinementTracer.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('RefinementTracer', () => {
  let testBed;
  let tracer;
  let mockEventBus;
  let mockGameDataRepository;

  beforeEach(() => {
    testBed = createTestBed();

    // Create simple event bus mock with on/off/dispatch methods
    const listeners = new Map();
    mockEventBus = {
      on: jest.fn((eventType, handler) => {
        if (!listeners.has(eventType)) {
          listeners.set(eventType, []);
        }
        listeners.get(eventType).push(handler);
      }),
      off: jest.fn((eventType, handler) => {
        if (listeners.has(eventType)) {
          const handlers = listeners.get(eventType);
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }),
      dispatch: jest.fn((eventType, payload = {}) => {
        const event = { type: eventType, payload: payload || {} };
        if (listeners.has(eventType)) {
          listeners.get(eventType).forEach((handler) => handler(event));
        }
      }),
    };

    mockGameDataRepository = {
      get: jest.fn(),
    };

    tracer = new RefinementTracer({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      logger: testBed.logger,
    });
  });

  describe('startCapture', () => {
    it('should start capturing events for actor', () => {
      tracer.startCapture('actor-1');

      const trace = tracer.getTrace('actor-1');

      expect(trace).not.toBeNull();
      expect(trace.actorId).toBe('actor-1');
      expect(trace.active).toBe(true);
      expect(trace.events).toEqual([]);
    });

    it('should warn when starting duplicate capture', () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      tracer = new RefinementTracer({
        eventBus: mockEventBus,
        gameDataRepository: mockGameDataRepository,
        logger,
      });

      tracer.startCapture('actor-1');
      tracer.startCapture('actor-1');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Trace already active')
      );
    });

    it('should throw error for blank actorId', () => {
      expect(() => tracer.startCapture('')).toThrow();
    });
  });

  describe('stopCapture', () => {
    it('should stop capturing and return trace', () => {
      tracer.startCapture('actor-1');

      // Dispatch an event
      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 2,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace).not.toBeNull();
      expect(trace.actorId).toBe('actor-1');
      expect(trace.active).toBe(false);
      expect(trace.duration).toBeGreaterThanOrEqual(0);
      expect(trace.events).toHaveLength(1);
    });

    it('should return null when stopping non-existent trace', () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      tracer = new RefinementTracer({
        eventBus: mockEventBus,
        gameDataRepository: mockGameDataRepository,
        logger,
      });

      const trace = tracer.stopCapture('actor-999');

      expect(trace).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No active trace')
      );
    });

    it('should throw error for blank actorId', () => {
      expect(() => tracer.stopCapture('')).toThrow();
    });
  });

  describe('getTrace', () => {
    it('should return current trace without stopping', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 1,
        timestamp: Date.now(),
      });

      const trace = tracer.getTrace('actor-1');

      expect(trace).not.toBeNull();
      expect(trace.active).toBe(true);
      expect(trace.events).toHaveLength(1);

      // Verify trace is still active
      const activeTrace = tracer.getTrace('actor-1');
      expect(activeTrace).not.toBeNull();
    });

    it('should return null for non-existent trace', () => {
      const trace = tracer.getTrace('actor-999');
      expect(trace).toBeNull();
    });

    it('should throw error for blank actorId', () => {
      expect(() => tracer.getTrace('')).toThrow();
    });
  });

  describe('event capture', () => {
    it('should capture events for correct actor only', () => {
      tracer.startCapture('actor-1');

      // Dispatch event for actor-1
      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 0,
        timestamp: Date.now(),
      });

      // Dispatch event for actor-2 (should be ignored)
      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-2',
        taskId: 'gather_resources',
        stepsGenerated: 0,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].payload.actorId).toBe('actor-1');
    });

    it('should record events in order', () => {
      tracer.startCapture('actor-1');

      const baseTime = Date.now();

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        timestamp: baseTime,
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        timestamp: baseTime + 10,
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(2);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_STARTED);
      expect(trace.events[1].type).toBe(
        GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
      );
    });

    it('should include event payload and timestamp', () => {
      tracer.startCapture('actor-1');

      const timestamp = Date.now();

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 2,
        timestamp,
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].payload).toEqual({
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 2,
        timestamp,
      });
      expect(trace.events[0].timestamp).toBe(timestamp);
    });

    it('should not capture events after stopping', () => {
      tracer.startCapture('actor-1');
      tracer.stopCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 1,
        timestamp: Date.now(),
      });

      // Start again and verify no events from before
      tracer.startCapture('actor-1');
      const trace = tracer.getTrace('actor-1');

      expect(trace.events).toHaveLength(0);
    });
  });

  describe('event filtering', () => {
    it('should capture TASK_REFINED events', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 2,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.TASK_REFINED);
    });

    it('should capture REFINEMENT_STEP_* events', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_FAILED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 1,
        error: 'Test error',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(3);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_STARTED);
      expect(trace.events[1].type).toBe(
        GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
      );
      expect(trace.events[2].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_FAILED);
    });

    it('should capture REFINEMENT_STATE_UPDATED events', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STATE_UPDATED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        key: 'pickedItem',
        oldValue: null,
        newValue: 'food-1',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.REFINEMENT_STATE_UPDATED);
    });

    it('should capture REFINEMENT_FAILED events', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_FAILED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        reason: 'No food available',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.REFINEMENT_FAILED);
    });
  });

  describe('format', () => {
    it('should format trace with summary', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        step: { stepType: 'primitive_action' },
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        result: { success: true },
        duration: 10,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('Refinement Trace');
      expect(output).toContain('actor-1');
      expect(output).toContain('REFINEMENT_STEP_STARTED');
      expect(output).toContain('REFINEMENT_STEP_COMPLETED');
      expect(output).toContain('Steps Executed: 1');
      expect(output).toContain('Steps Succeeded: 1');
      expect(output).toContain('Steps Failed: 0');
    });

    it('should handle empty trace', () => {
      tracer.startCapture('actor-1');
      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('Refinement Trace');
      expect(output).toContain('Events Captured: 0');
      expect(output).toContain('No refinement events captured');
    });

    it('should handle null trace', () => {
      const output = tracer.format(null);

      expect(output).toBe('=== No Trace Data ===\n');
    });

    it('should format TASK_REFINED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepsGenerated: 3,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('TASK_REFINED');
      expect(output).toContain('taskId=consume_food');
      expect(output).toContain('stepsGenerated=3');
    });

    it('should format REFINEMENT_STEP_STARTED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 2,
        step: { stepType: 'conditional' },
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('REFINEMENT_STEP_STARTED');
      expect(output).toContain('step=2');
      expect(output).toContain('stepType=conditional');
    });

    it('should format REFINEMENT_STEP_COMPLETED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 1,
        result: { success: true },
        duration: 25,
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('REFINEMENT_STEP_COMPLETED');
      expect(output).toContain('step=1');
      expect(output).toContain('success=true');
      expect(output).toContain('duration=25ms');
    });

    it('should format REFINEMENT_STEP_FAILED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_FAILED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        stepIndex: 0,
        error: 'Item not found',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('REFINEMENT_STEP_FAILED');
      expect(output).toContain('step=0');
      expect(output).toContain('error="Item not found"');
    });

    it('should format REFINEMENT_STATE_UPDATED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STATE_UPDATED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        key: 'selectedItem',
        oldValue: null,
        newValue: 'bread-5',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('REFINEMENT_STATE_UPDATED');
      expect(output).toContain('selectedItem');
      expect(output).toContain('"bread-5"');
    });

    it('should format REFINEMENT_FAILED event', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_FAILED, {
        actorId: 'actor-1',
        taskId: 'consume_food',
        reason: 'No valid method found',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('REFINEMENT_FAILED');
      expect(output).toContain('taskId=consume_food');
      expect(output).toContain('reason="No valid method found"');
    });

    it('should display summary with correct counts', () => {
      tracer.startCapture('actor-1');

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.TASK_REFINED, {
        actorId: 'actor-1',
        taskId: 'task1',
        stepsGenerated: 2,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        stepIndex: 0,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, {
        actorId: 'actor-1',
        stepIndex: 0,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_STARTED, {
        actorId: 'actor-1',
        stepIndex: 1,
        timestamp: Date.now(),
      });

      dispatchGoapEventForTest(mockEventBus, GOAP_EVENTS.REFINEMENT_STEP_FAILED, {
        actorId: 'actor-1',
        stepIndex: 1,
        error: 'Failed',
        timestamp: Date.now(),
      });

      const trace = tracer.stopCapture('actor-1');
      const output = tracer.format(trace);

      expect(output).toContain('Tasks Refined: 1');
      expect(output).toContain('Steps Executed: 2');
      expect(output).toContain('Steps Succeeded: 1');
      expect(output).toContain('Steps Failed: 1');
    });
  });
});
