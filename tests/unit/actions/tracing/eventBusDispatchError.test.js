/**
 * @file Focused test to reproduce and fix eventBus.dispatch error
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EventBus from '../../../../src/events/eventBus.js';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { QUEUE_EVENTS } from '../../../../src/actions/tracing/actionTraceTypes.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('EventBus dispatch error reproduction', () => {
  let eventBus;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    eventBus = new EventBus({ logger: mockLogger });
  });

  describe('Correct EventBus usage', () => {
    it('should accept string eventName and optional payload', async () => {
      const listener = jest.fn();
      eventBus.subscribe('TEST_EVENT', listener);

      // Correct usage - event name as string, payload as second parameter
      await eventBus.dispatch('TEST_EVENT', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({
        type: 'TEST_EVENT',
        payload: { data: 'test' },
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should reject object as eventName', async () => {
      const listener = jest.fn();
      eventBus.subscribe('TEST_EVENT', listener);

      // Incorrect usage - passing object instead of string
      await eventBus.dispatch({
        type: 'TEST_EVENT',
        payload: { data: 'test' },
      });

      expect(listener).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EventBus: Invalid event name provided.',
        expect.objectContaining({ type: 'TEST_EVENT' })
      );
    });
  });

  describe('TraceQueueProcessor EventBus integration', () => {
    it('should dispatch events with correct format', async () => {
      const mockStorageAdapter = {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
        getAllKeys: jest.fn().mockResolvedValue([]),
      };

      const mockEventBus = {
        dispatch: jest.fn(),
      };

      const processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
        config: {
          batchSize: 1,
          batchTimeout: 10,
          maxQueueSize: 100,
        },
      });

      // Enqueue a trace to trigger batch processing
      const trace = {
        id: 'test-trace',
        timestamp: Date.now(),
        data: { actionId: 'test-action' },
      };

      processor.enqueue(trace);

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that dispatch was called with correct format
      const dispatchCalls = mockEventBus.dispatch.mock.calls;

      // Find the BATCH_PROCESSED event
      const batchProcessedCall = dispatchCalls.find((call) => {
        // After fix, this should be: call[0] === QUEUE_EVENTS.BATCH_PROCESSED
        // Currently broken: call[0].type === QUEUE_EVENTS.BATCH_PROCESSED
        const firstArg = call[0];
        return (
          firstArg === QUEUE_EVENTS.BATCH_PROCESSED ||
          (typeof firstArg === 'object' &&
            firstArg.type === QUEUE_EVENTS.BATCH_PROCESSED)
        );
      });

      if (batchProcessedCall) {
        const [firstArg, secondArg] = batchProcessedCall;

        // This test will fail with current implementation
        // because firstArg is an object, not a string
        expect(typeof firstArg).toBe('string');
        expect(firstArg).toBe(QUEUE_EVENTS.BATCH_PROCESSED);
        expect(typeof secondArg).toBe('object');
        expect(secondArg).toHaveProperty('batchSize');
      }
    });
  });
});
