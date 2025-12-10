import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import RefinementTracer from '../../../../src/goap/debug/refinementTracer.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('RefinementTracer - Integration', () => {
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
      dispatch: jest.fn((event) => {
        if (listeners.has(event.type)) {
          listeners.get(event.type).forEach((handler) => handler(event));
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

  describe('full refinement workflow', () => {
    it('should capture complete refinement trace', () => {
      tracer.startCapture('actor-123');

      // Simulate refinement workflow
      const baseTime = Date.now();

      // Step 1: Task refined
      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepsGenerated: 2,
          timestamp: baseTime,
        },
      });

      // Step 2: First refinement step starts
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          methodId: 'eating_nearby_food',
          stepIndex: 0,
          step: {
            stepType: 'primitive_action',
            actionId: 'item-handling:pick_up_item',
          },
          timestamp: baseTime + 5,
        },
      });

      // Step 3: State update during execution
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STATE_UPDATED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          key: 'pickedItem',
          oldValue: null,
          newValue: 'food-1',
          timestamp: baseTime + 8,
        },
      });

      // Step 4: First step completes
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 0,
          result: { success: true },
          duration: 10,
          timestamp: baseTime + 15,
        },
      });

      // Step 5: Second refinement step starts
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 1,
          step: {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
          },
          timestamp: baseTime + 20,
        },
      });

      // Step 6: Second step completes
      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 1,
          result: { success: true },
          duration: 8,
          timestamp: baseTime + 28,
        },
      });

      const trace = tracer.stopCapture('actor-123');

      expect(trace).not.toBeNull();
      expect(trace.events).toHaveLength(6);
      expect(trace.actorId).toBe('actor-123');
      expect(trace.duration).toBeGreaterThanOrEqual(0);

      // Verify event sequence
      expect(trace.events[0].type).toBe(GOAP_EVENTS.TASK_REFINED);
      expect(trace.events[1].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_STARTED);
      expect(trace.events[2].type).toBe(GOAP_EVENTS.REFINEMENT_STATE_UPDATED);
      expect(trace.events[3].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED);
      expect(trace.events[4].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_STARTED);
      expect(trace.events[5].type).toBe(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED);
    });

    it('should format complete trace correctly', () => {
      tracer.startCapture('actor-123');

      const baseTime = Date.now();

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepsGenerated: 2,
          timestamp: baseTime,
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 0,
          step: { stepType: 'primitive_action' },
          timestamp: baseTime + 5,
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 0,
          result: { success: true },
          duration: 10,
          timestamp: baseTime + 15,
        },
      });

      const trace = tracer.stopCapture('actor-123');
      const output = tracer.format(trace);

      expect(output).toContain('=== Refinement Trace: actor-123 ===');
      expect(output).toContain('Events Captured: 3');
      expect(output).toContain('TASK_REFINED');
      expect(output).toContain('consume_nourishing_item');
      expect(output).toContain('stepsGenerated=2');
      expect(output).toContain('REFINEMENT_STEP_STARTED');
      expect(output).toContain('REFINEMENT_STEP_COMPLETED');
      expect(output).toContain('Tasks Refined: 1');
      expect(output).toContain('Steps Executed: 1');
      expect(output).toContain('Steps Succeeded: 1');
      expect(output).toContain('Steps Failed: 0');
      expect(output).toContain('=== End Trace ===');
    });
  });

  describe('failure scenarios', () => {
    it('should capture refinement failure', () => {
      tracer.startCapture('actor-123');

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_FAILED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          reason: 'No valid method found',
          timestamp: Date.now(),
        },
      });

      const trace = tracer.stopCapture('actor-123');

      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].type).toBe(GOAP_EVENTS.REFINEMENT_FAILED);
      expect(trace.events[0].payload.reason).toBe('No valid method found');

      const output = tracer.format(trace);
      expect(output).toContain('REFINEMENT_FAILED');
      expect(output).toContain('No valid method found');
    });

    it('should capture step failure in workflow', () => {
      tracer.startCapture('actor-123');

      const baseTime = Date.now();

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepsGenerated: 1,
          timestamp: baseTime,
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_STARTED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 0,
          step: { stepType: 'primitive_action' },
          timestamp: baseTime + 5,
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STEP_FAILED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          stepIndex: 0,
          error: 'Target entity not found',
          timestamp: baseTime + 10,
        },
      });

      const trace = tracer.stopCapture('actor-123');

      expect(trace.events).toHaveLength(3);

      const output = tracer.format(trace);
      expect(output).toContain('Steps Failed: 1');
      expect(output).toContain('Target entity not found');
    });
  });

  describe('multiple actors', () => {
    it('should isolate traces for different actors', () => {
      tracer.startCapture('actor-1');
      tracer.startCapture('actor-2');

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-1',
          taskId: 'task-a',
          stepsGenerated: 1,
          timestamp: Date.now(),
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-2',
          taskId: 'task-b',
          stepsGenerated: 2,
          timestamp: Date.now(),
        },
      });

      const trace1 = tracer.stopCapture('actor-1');
      const trace2 = tracer.stopCapture('actor-2');

      expect(trace1.events).toHaveLength(1);
      expect(trace1.events[0].payload.taskId).toBe('task-a');

      expect(trace2.events).toHaveLength(1);
      expect(trace2.events[0].payload.taskId).toBe('task-b');
    });
  });

  describe('state updates', () => {
    it('should capture multiple state updates', () => {
      tracer.startCapture('actor-123');

      const baseTime = Date.now();

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STATE_UPDATED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          key: 'selectedItem',
          oldValue: null,
          newValue: 'bread-1',
          timestamp: baseTime,
        },
      });

      mockEventBus.dispatch({
        type: GOAP_EVENTS.REFINEMENT_STATE_UPDATED,
        payload: {
          actorId: 'actor-123',
          taskId: 'consume_nourishing_item',
          key: 'targetLocation',
          oldValue: null,
          newValue: 'kitchen',
          timestamp: baseTime + 5,
        },
      });

      const trace = tracer.stopCapture('actor-123');

      expect(trace.events).toHaveLength(2);
      expect(trace.events[0].payload.key).toBe('selectedItem');
      expect(trace.events[1].payload.key).toBe('targetLocation');

      const output = tracer.format(trace);
      expect(output).toContain('selectedItem');
      expect(output).toContain('"bread-1"');
      expect(output).toContain('targetLocation');
      expect(output).toContain('"kitchen"');
    });
  });

  describe('event timestamp handling', () => {
    it('should use payload timestamp when available', () => {
      tracer.startCapture('actor-123');

      const customTimestamp = 1234567890000;

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'test_task',
          stepsGenerated: 1,
          timestamp: customTimestamp,
        },
      });

      const trace = tracer.stopCapture('actor-123');

      expect(trace.events[0].timestamp).toBe(customTimestamp);
    });

    it('should generate timestamp when not provided', () => {
      tracer.startCapture('actor-123');

      const beforeTime = Date.now();

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'test_task',
          stepsGenerated: 1,
          // No timestamp provided
        },
      });

      const afterTime = Date.now();
      const trace = tracer.stopCapture('actor-123');

      expect(trace.events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(trace.events[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('trace lifecycle', () => {
    it('should allow restarting capture after stop', () => {
      tracer.startCapture('actor-123');

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'task-1',
          stepsGenerated: 1,
          timestamp: Date.now(),
        },
      });

      const trace1 = tracer.stopCapture('actor-123');
      expect(trace1.events).toHaveLength(1);

      // Restart capture
      tracer.startCapture('actor-123');

      mockEventBus.dispatch({
        type: GOAP_EVENTS.TASK_REFINED,
        payload: {
          actorId: 'actor-123',
          taskId: 'task-2',
          stepsGenerated: 2,
          timestamp: Date.now(),
        },
      });

      const trace2 = tracer.stopCapture('actor-123');
      expect(trace2.events).toHaveLength(1);
      expect(trace2.events[0].payload.taskId).toBe('task-2');
    });

    it('should maintain active state correctly', () => {
      tracer.startCapture('actor-123');

      let trace = tracer.getTrace('actor-123');
      expect(trace.active).toBe(true);

      tracer.stopCapture('actor-123');

      trace = tracer.getTrace('actor-123');
      expect(trace).toBeNull();
    });
  });
});
