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
    shouldTrace: jest.fn().mockReturnValue(true), // Fixed: Allow traces through by default
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
  // Stateful mock that tracks changes
  let writeCount = 0;
  let errorCount = 0;
  let queueLength = 0;
  let isProcessing = false;

  return {
    writeTrace: jest.fn().mockImplementation(async (trace) => {
      writeCount++;
      queueLength++;
      isProcessing = true;

      // Simulate async processing
      await new Promise((resolve) => setTimeout(resolve, 1));

      queueLength = Math.max(0, queueLength - 1);
      if (queueLength === 0) {
        isProcessing = false;
      }

      return undefined;
    }),
    waitForPendingWrites: jest.fn().mockResolvedValue(undefined),
    getStatistics: jest.fn().mockImplementation(() => ({
      totalWrites: writeCount,
      totalErrors: errorCount,
      pendingWrites: queueLength,
      errorRate: writeCount > 0 ? errorCount / writeCount : 0,
    })),
    resetStatistics: jest.fn().mockImplementation(() => {
      writeCount = 0;
      errorCount = 0;
      queueLength = 0;
      isProcessing = false;
    }),
    // Enhanced methods for queue processing
    exportTraces: jest.fn().mockResolvedValue(undefined),
    getQueueStats: jest.fn().mockImplementation(() => ({
      queueLength: queueLength,
      isProcessing: isProcessing,
      writeErrors: errorCount,
      maxQueueSize: 1000,
    })),
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
  const asyncDelay = options.asyncDelay !== undefined ? options.asyncDelay : 0; // Default to 0 for performance tests
  let storage = new Map();

  const addAsyncDelay = (result) => {
    if (asyncDelay === 0) {
      return Promise.resolve(result); // Immediate resolution for performance tests
    }
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

/**
 * Create mock StorageAdapter for testing storage operations
 * Matches the IStorageAdapter interface expected by production code
 *
 * @returns {object} Mock StorageAdapter instance
 */
export function createMockStorageAdapter() {
  const storage = new Map();

  return {
    getItem: jest.fn().mockImplementation(async (key) => {
      // No artificial delay - let Jest fake timers control timing
      return storage.get(key) || null;
    }),
    setItem: jest.fn().mockImplementation(async (key, value) => {
      // No artificial delay - let Jest fake timers control timing
      storage.set(key, value);
      return undefined; // setItem returns void/undefined, not true
    }),
    removeItem: jest.fn().mockImplementation(async (key) => {
      // No artificial delay - let Jest fake timers control timing
      storage.delete(key);
      return undefined; // removeItem returns void/undefined, not true
    }),
    getAllKeys: jest.fn().mockImplementation(async () => {
      // No artificial delay - let Jest fake timers control timing
      return Array.from(storage.keys());
    }),
    clear: jest.fn().mockImplementation(async () => {
      // No artificial delay - let Jest fake timers control timing
      storage.clear();
      return undefined; // clear returns void/undefined, not true
    }),
    // Additional methods that may be expected by the interface
    count: jest.fn().mockImplementation(async () => {
      // No artificial delay - let Jest fake timers control timing
      return storage.size;
    }),
    initialize: jest.fn().mockImplementation(async () => undefined),
    close: jest.fn().mockImplementation(() => undefined),
    isAvailable: jest.fn().mockImplementation(async () => true),
    // For testing
    _storage: storage,
  };
}

/**
 * Create mock TraceDirectoryManager for file system operations
 *
 * @returns {object} Mock TraceDirectoryManager instance
 */
export function createMockTraceDirectoryManager() {
  return {
    selectDirectory: jest.fn(() => Promise.resolve({ name: 'test-dir' })),
    ensureSubdirectoryExists: jest.fn(() =>
      Promise.resolve({ name: 'export-dir' })
    ),
    exportTrace: jest.fn(() => Promise.resolve('exported-file-path')),
    getExportPath: jest.fn(() => './traces/exports'),
  };
}

/**
 * Create mock HumanReadableFormatter for trace formatting
 *
 * @returns {object} Mock HumanReadableFormatter instance
 */
export function createMockHumanReadableFormatter() {
  return {
    format: jest.fn().mockImplementation((trace, verbosity = 'standard') => {
      if (!trace) {
        return 'No trace data';
      }

      let output = '=== Action Trace ===\n';

      if (verbosity === 'minimal') {
        output += `Action: ${trace.actionId || 'unknown'}\n`;
        output += `Actor: ${trace.actorId || 'unknown'}\n`;
      } else if (verbosity === 'standard' || verbosity === 'detailed') {
        output += `Action: ${trace.actionId || 'unknown'}\n`;
        output += `Actor: ${trace.actorId || 'unknown'}\n`;
        output += `Timestamp: ${new Date().toISOString()}\n`;

        if (trace.execution) {
          output += `Duration: ${trace.execution.duration || 0}ms\n`;
          output += `Status: ${trace.execution.result?.success ? 'Success' : 'Failed'}\n`;
        }

        if (verbosity === 'detailed' && trace.stages) {
          output += '\nStages:\n';
          Object.entries(trace.stages).forEach(([stage, data]) => {
            output += `  - ${stage}: ${JSON.stringify(data)}\n`;
          });
        }
      } else if (verbosity === 'verbose') {
        output += JSON.stringify(trace, null, 2);
      }

      return output;
    }),
  };
}

/**
 * Create mock FileTraceOutputHandler with batch operation support
 *
 * @returns {object} Mock FileTraceOutputHandler instance
 */
export function createMockFileTraceOutputHandler() {
  return {
    writeBatch: jest.fn().mockImplementation(async (formattedTraces) => {
      // Simulate successful batch write
      return true;
    }),
    writeTrace: jest
      .fn()
      .mockImplementation(async (traceData, originalTrace) => {
        // Simulate successful single trace write
        return true;
      }),
    isReady: jest.fn().mockReturnValue(true),
    getStatistics: jest.fn().mockReturnValue({
      isInitialized: true,
      queuedTraces: 0,
      isProcessingQueue: false,
    }),
    initialize: jest.fn().mockResolvedValue(true),
    setOutputDirectory: jest.fn(),
  };
}

/**
 * Create mock JsonFormatter for dual-format testing
 *
 * @returns {object} Mock JsonFormatter instance
 */
export function createMockJsonFormatter() {
  return {
    format: jest.fn().mockImplementation((trace) => {
      return JSON.stringify(
        {
          mock: 'json',
          actionId: trace?.actionId || 'unknown',
          timestamp: new Date().toISOString(),
        },
        null,
        2
      );
    }),
  };
}

/**
 * Create mock HumanReadableFormatter with configurable options
 *
 * @returns {object} Mock HumanReadableFormatter instance
 */
export function createMockHumanReadableFormatterWithOptions() {
  return {
    format: jest.fn().mockImplementation((trace, options = {}) => {
      const lineWidth = options.lineWidth || 120;
      const enableColors = options.enableColors || false;
      const separator = '='.repeat(Math.min(lineWidth, 80));

      return `${separator}\n=== Mock Trace ===\nAction: ${trace?.actionId || 'unknown'}\n${separator}`;
    }),
  };
}

/**
 * Create mock fetch for server endpoint testing
 *
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.shouldFail] - Whether fetch should fail
 * @param {number} [options.status] - HTTP status code to return
 * @returns {Function} Mock fetch function
 */
export function createMockFetch(options = {}) {
  const { shouldFail = false, status = 200 } = options;

  return jest.fn().mockImplementation(async (url, config) => {
    if (shouldFail) {
      throw new Error('Network error');
    }

    if (status === 404) {
      return {
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      };
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        Promise.resolve({
          success: true,
          path: '/test/path',
          size: 1024,
          fileName: 'test-file.json',
        }),
    };
  });
}

/**
 * Create performance test helpers
 *
 * @returns {object} Performance test utilities
 */
export function createPerformanceTestHelpers() {
  return {
    measureExecutionTime: (fn) => {
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      return { result, duration: end - start };
    },

    expectExecutionTimeUnder: (fn, maxMs) => {
      const { duration } = this.measureExecutionTime(fn);
      expect(duration).toBeLessThan(maxMs);
    },
  };
}

// Note: createMockEventDispatchService, createMockLogger, and createMockSafeEventDispatcher
// are already defined in coreServices.js and should be imported from there
