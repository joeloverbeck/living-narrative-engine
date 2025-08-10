/**
 * @file Unit tests for EventDispatchTracer and EventDispatchTrace
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventDispatchTracer, EventDispatchTrace } from '../../../../src/events/tracing/eventDispatchTracer.js';

describe('EventDispatchTracer', () => {
  let mockLogger;
  let mockOutputService;
  let tracer;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockOutputService = {
      writeTrace: jest.fn(),
    };

    tracer = new EventDispatchTracer({
      logger: mockLogger,
      outputService: mockOutputService,
    });
  });

  describe('constructor', () => {
    it('should throw error if logger is missing', () => {
      expect(() => {
        new EventDispatchTracer({ outputService: mockOutputService });
      }).toThrow('EventDispatchTracer: logger is required');
    });

    it('should throw error if outputService is missing', () => {
      expect(() => {
        new EventDispatchTracer({ logger: mockLogger });
      }).toThrow('EventDispatchTracer: outputService is required');
    });

    it('should create instance with valid dependencies', () => {
      expect(tracer).toBeDefined();
    });
  });

  describe('createTrace', () => {
    it('should create EventDispatchTrace with provided context', () => {
      const context = {
        eventName: 'TEST_EVENT',
        payload: { data: 'test' },
        context: 'test context',
        timestamp: Date.now(),
      };

      const trace = tracer.createTrace(context);

      expect(trace).toBeInstanceOf(EventDispatchTrace);
    });
  });

  describe('writeTrace', () => {
    it('should write trace successfully', async () => {
      mockOutputService.writeTrace.mockResolvedValue();
      const mockTrace = { toJSON: jest.fn() };

      await tracer.writeTrace(mockTrace);

      expect(mockOutputService.writeTrace).toHaveBeenCalledWith(mockTrace);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Event dispatch trace written successfully'
      );
    });

    it('should handle write error and rethrow', async () => {
      const error = new Error('Write failed');
      mockOutputService.writeTrace.mockRejectedValue(error);
      const mockTrace = { toJSON: jest.fn() };

      await expect(tracer.writeTrace(mockTrace)).rejects.toThrow('Write failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to write event dispatch trace',
        error
      );
    });
  });
});

describe('EventDispatchTrace', () => {
  let trace;
  let context;

  beforeEach(() => {
    context = {
      eventName: 'TEST_EVENT',
      payload: { data: 'test' },
      context: 'test context',
      timestamp: 1234567890,
    };
    trace = new EventDispatchTrace(context);
  });

  describe('constructor', () => {
    it('should initialize trace with provided context', () => {
      expect(trace).toBeDefined();
    });
  });

  describe('captureDispatchStart', () => {
    it('should capture dispatch start time', () => {
      const beforeTime = performance.now();
      trace.captureDispatchStart();
      const afterTime = performance.now();

      const traceData = trace.toJSON();
      expect(traceData.dispatch.startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(traceData.dispatch.startTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('captureDispatchSuccess', () => {
    it('should capture successful dispatch outcome', () => {
      const duration = 100;
      const success = true;

      trace.captureDispatchSuccess({ success, duration });

      const traceData = trace.toJSON();
      expect(traceData.dispatch.duration).toBe(duration);
      expect(traceData.dispatch.success).toBe(success);
      expect(traceData.dispatch.error).toBeNull();
    });
  });

  describe('captureDispatchError', () => {
    it('should capture error dispatch outcome', () => {
      const error = new Error('Test error');
      const duration = 50;
      const context = 'error context';

      trace.captureDispatchError(error, { duration, context });

      const traceData = trace.toJSON();
      expect(traceData.dispatch.duration).toBe(duration);
      expect(traceData.dispatch.success).toBe(false);
      expect(traceData.dispatch.error).toEqual({
        message: 'Test error',
        type: 'Error',
        context: 'error context',
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize trace data correctly', () => {
      const traceData = trace.toJSON();

      expect(traceData).toHaveProperty('metadata');
      expect(traceData).toHaveProperty('dispatch');
      expect(traceData).toHaveProperty('payload');

      expect(traceData.metadata).toEqual({
        traceType: 'event_dispatch',
        eventName: 'TEST_EVENT',
        context: 'test context',
        timestamp: 1234567890,
        createdAt: expect.any(String),
        version: '1.0',
      });

      expect(traceData.payload).toEqual({ data: 'test' });
    });

    it('should include complete dispatch information after success', () => {
      trace.captureDispatchStart();
      trace.captureDispatchSuccess({ success: true, duration: 150 });

      const traceData = trace.toJSON();

      expect(traceData.dispatch.startTime).toBeGreaterThan(0);
      expect(traceData.dispatch.endTime).toBeGreaterThan(0);
      expect(traceData.dispatch.duration).toBe(150);
      expect(traceData.dispatch.success).toBe(true);
      expect(traceData.dispatch.error).toBeNull();
    });

    it('should include complete dispatch information after error', () => {
      const error = new Error('Dispatch failed');
      trace.captureDispatchStart();
      trace.captureDispatchError(error, { duration: 75, context: 'test' });

      const traceData = trace.toJSON();

      expect(traceData.dispatch.startTime).toBeGreaterThan(0);
      expect(traceData.dispatch.endTime).toBeGreaterThan(0);
      expect(traceData.dispatch.duration).toBe(75);
      expect(traceData.dispatch.success).toBe(false);
      expect(traceData.dispatch.error).toEqual({
        message: 'Dispatch failed',
        type: 'Error',
        context: 'test',
      });
    });
  });
});