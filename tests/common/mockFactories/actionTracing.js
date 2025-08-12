/**
 * @file Mock factories for action tracing components
 * @description Provides mock implementations for testing action tracing features
 */

import { jest } from '@jest/globals';

/**
 * Create mock ActionTraceFilter
 *
 * @returns {object} Mock ActionTraceFilter instance
 */
export function createMockActionTraceFilter() {
  return {
    isEnabled: jest.fn().mockReturnValue(true),
    shouldTrace: jest.fn().mockReturnValue(false),
    getVerbosityLevel: jest.fn().mockReturnValue('standard'),
    getInclusionConfig: jest.fn().mockReturnValue({
      componentData: false,
      prerequisites: false,
      targets: false,
    }),
  };
}

/**
 * Create mock JsonTraceFormatter
 *
 * @returns {object} Mock JsonTraceFormatter instance
 */
export function createMockJsonTraceFormatter() {
  return {
    format: jest.fn().mockImplementation((trace) => {
      if (!trace) {
        return '{}';
      }

      const formatted = {
        metadata: {
          version: '1.0.0',
          type: trace.execution ? 'execution' : 'pipeline',
          generated: new Date().toISOString(),
          generator: 'MockFormatter',
        },
        timestamp: new Date().toISOString(),
      };

      if (trace.actionId) {
        formatted.actionId = trace.actionId;
        formatted.actorId = trace.actorId;
      }

      if (trace.execution) {
        formatted.execution = {
          startTime: trace.execution.startTime,
          endTime: trace.execution.endTime,
          duration: trace.execution.duration,
          status: trace.execution.result?.success ? 'success' : 'failed',
        };
      }

      if (trace.getTracedActions) {
        formatted.actions = {};
        const tracedActions = trace.getTracedActions();
        for (const [actionId, data] of tracedActions) {
          formatted.actions[actionId] = data;
        }
      }

      return JSON.stringify(formatted, null, 2);
    }),
  };
}

/**
 * Create mock ActionExecutionTrace
 *
 * @returns {object} Mock ActionExecutionTrace instance
 */
export function createMockActionExecutionTrace() {
  const mock = {
    actionId: 'test:action',
    actorId: 'test-actor',
    isComplete: false,
    hasError: false,
    duration: null,
    captureDispatchStart: jest.fn(),
    captureEventPayload: jest.fn(),
    captureDispatchResult: jest.fn(),
    captureError: jest.fn(),
    getExecutionPhases: jest.fn().mockReturnValue([]),
    toJSON: jest.fn().mockReturnValue({
      metadata: {
        actionId: 'test:action',
        actorId: 'test-actor',
        traceType: 'execution',
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      turnAction: {
        actionDefinitionId: 'test:action',
        commandString: 'test command',
        parameters: {},
      },
      execution: {
        startTime: null,
        endTime: null,
        duration: null,
        eventPayload: null,
        dispatchResult: null,
        error: null,
        phases: [],
      },
    }),
  };

  // Update isComplete when captureDispatchResult or captureError is called
  mock.captureDispatchResult.mockImplementation((result) => {
    mock.isComplete = true;
    mock.duration = 100; // Mock duration
  });

  mock.captureError.mockImplementation((error) => {
    mock.isComplete = true;
    mock.hasError = true;
    mock.duration = 100; // Mock duration
  });

  return mock;
}

/**
 * Create mock ActionExecutionTraceFactory
 *
 * @returns {object} Mock ActionExecutionTraceFactory instance
 */
export function createMockActionExecutionTraceFactory() {
  return {
    createTrace: jest
      .fn()
      .mockImplementation(({ actionId, actorId, turnAction }) => {
        const trace = createMockActionExecutionTrace();
        trace.actionId = actionId;
        trace.actorId = actorId;
        return trace;
      }),
    createFromTurnAction: jest
      .fn()
      .mockImplementation((turnAction, actorId) => {
        const trace = createMockActionExecutionTrace();
        trace.actionId = turnAction.actionDefinitionId;
        trace.actorId = actorId;
        return trace;
      }),
  };
}

/**
 * Create mock ActionTraceOutputService
 *
 * @returns {object} Mock ActionTraceOutputService instance
 */
export function createMockActionTraceOutputService() {
  return {
    writeTrace: jest.fn().mockResolvedValue(undefined),
    waitForPendingWrites: jest.fn().mockResolvedValue(undefined),
    getStatistics: jest.fn().mockReturnValue({
      totalWrites: 0,
      totalErrors: 0,
      pendingWrites: 0,
      errorRate: 0,
    }),
    resetStatistics: jest.fn(),
    // Enhanced methods for queue processing
    exportTraces: jest.fn().mockResolvedValue(undefined),
    getQueueStats: jest.fn().mockReturnValue({
      queueLength: 0,
      isProcessing: false,
      writeErrors: 0,
      maxQueueSize: 1000,
    }),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create mock IndexedDBStorageAdapter with realistic async behavior
 *
 * @param {object} [options] - Configuration options
 * @param {number} [options.asyncDelay] - Async operation delay in ms
 * @returns {object} Mock IndexedDBStorageAdapter instance
 */
export function createMockIndexedDBStorageAdapter(options = {}) {
  const asyncDelay = options.asyncDelay || 5;
  let storage = new Map();

  const addAsyncDelay = (result) => {
    return new Promise((resolve) =>
      setTimeout(() => resolve(result), asyncDelay)
    );
  };

  return {
    initialize: jest.fn().mockImplementation(() => addAsyncDelay(undefined)),
    getItem: jest.fn().mockImplementation((key) => {
      const result = storage.get(key) || null;
      return addAsyncDelay(result);
    }),
    setItem: jest.fn().mockImplementation((key, value) => {
      storage.set(key, value);
      return addAsyncDelay(undefined);
    }),
    removeItem: jest.fn().mockImplementation((key) => {
      storage.delete(key);
      return addAsyncDelay(undefined);
    }),
    getAllKeys: jest.fn().mockImplementation(() => {
      return addAsyncDelay([...storage.keys()]);
    }),
    clear: jest.fn().mockImplementation(() => {
      storage.clear();
      return addAsyncDelay(undefined);
    }),
    count: jest.fn().mockImplementation(() => {
      return addAsyncDelay(storage.size);
    }),
    close: jest.fn(),
    isAvailable: jest.fn().mockImplementation(() => addAsyncDelay(true)),
  };
}

/**
 * Create mock TraceQueueProcessor
 *
 * @returns {object} Mock TraceQueueProcessor instance
 */
export function createMockTraceQueueProcessor() {
  return {
    enqueue: jest.fn().mockReturnValue(true),
    getMetrics: jest.fn().mockReturnValue({
      totalEnqueued: 0,
      totalProcessed: 0,
      totalErrors: 0,
      totalDropped: 0,
      totalBatches: 0,
      fullBatches: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      avgLatency: 0,
      throughput: 0,
      batchEfficiency: 0,
      dropRate: 0,
      memoryUsage: 0,
      queueSize: 0,
      priorityDistribution: {
        3: 0, // CRITICAL
        2: 0, // HIGH
        1: 0, // NORMAL
        0: 0, // LOW
      },
    }),
    getQueueStats: jest.fn().mockReturnValue({
      totalSize: 0,
      isProcessing: false,
      memoryUsage: 0,
      circuitBreakerOpen: false,
      priorities: {
        3: { size: 0, oldestTimestamp: null }, // CRITICAL
        2: { size: 0, oldestTimestamp: null }, // HIGH
        1: { size: 0, oldestTimestamp: null }, // NORMAL
        0: { size: 0, oldestTimestamp: null }, // LOW
      },
    }),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create mock TimerService for Jest compatibility
 * This integrates directly with Jest's fake timers
 *
 * @returns {object} Mock TimerService instance
 */
export function createMockTimerService() {
  let callCount = 0;

  return {
    setTimeout: jest.fn().mockImplementation((callback, delay) => {
      callCount++;
      // Directly use global setTimeout which will be controlled by Jest fake timers
      return setTimeout(callback, delay);
    }),

    clearTimeout: jest.fn().mockImplementation((timerId) => {
      if (timerId) {
        // Directly use global clearTimeout which will be controlled by Jest
        clearTimeout(timerId);
      }
    }),

    // Test utility methods
    getCallCount: () => callCount,

    // Async completion support for shutdown - this is key for the shutdown process
    waitForCompletion: jest.fn().mockImplementation(async () => {
      // In tests, we can resolve immediately since Jest controls the timers
      return Promise.resolve();
    }),
  };
}

// Note: createMockEventDispatchService, createMockLogger, and createMockSafeEventDispatcher
// are already defined in coreServices.js and should be imported from there
