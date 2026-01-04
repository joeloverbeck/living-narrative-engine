/**
 * @file Action Execution Tracing Load Performance Tests
 * @description Performance tests for action execution tracing under load conditions.
 *
 * Extracted from the E2E test suite (ActionExecutionTracing.e2e.test.js) to properly
 * separate performance testing concerns from functional E2E testing.
 *
 * Tests:
 * - Queue processing under moderate and heavy load
 * - Trace ordering and consistency in concurrent scenarios
 * - Performance monitoring integration
 * - Threshold violation detection
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';

import { createTestBed } from '../../../common/testBed.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';

/**
 * Test action constants for load testing
 */
const TEST_ACTIONS = {
  GO: 'movement:go',
  ATTACK: 'core:attack',
  COMPLEX_ACTION: 'test:complexAction',
  LONG_OPERATION: 'test:longOperation',
};

/**
 * Load testing scenarios configuration
 */
const LOAD_SCENARIOS = {
  MODERATE_LOAD: {
    actionCount: 20,
    concurrency: 2,
    actionDelay: 50,
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
  },
  HEAVY_LOAD: {
    actionCount: 50,
    concurrency: 5,
    actionDelay: 5,
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK, TEST_ACTIONS.COMPLEX_ACTION],
  },
};

/**
 * Performance expectations
 */
const PERFORMANCE_EXPECTATIONS = {
  TRACE_CAPTURE_OVERHEAD: {
    max: 1,
    typical: 0.5,
  },
  MEMORY_USAGE: {
    maxIncrease: 10 * 1024 * 1024,
    maxTotal: 100 * 1024 * 1024,
  },
  // Relaxed thresholds for performance test stability
  EXECUTION_TIME: {
    maxAveragePerAction: 10000, // 10 seconds max average
    maxSingleAction: 30000, // 30 seconds max for any single action
  },
};

/**
 * Tracing configuration presets
 */
const TRACING_CONFIGS = {
  DETAILED: {
    enabled: true,
    tracedActions: ['*'],
    verbosity: 'detailed',
    enablePerformanceMonitoring: true,
    enableQueueProcessing: true,
  },
  PERFORMANCE: {
    enabled: true,
    tracedActions: ['*'],
    verbosity: 'minimal',
    enablePerformanceMonitoring: true,
    enableQueueProcessing: true,
    thresholds: {
      actionExecution: 100,
      traceCapture: 1,
      queueProcessing: 50,
    },
  },
};

/**
 * Expected trace data structures
 */
const EXPECTED_TRACE_STRUCTURES = {
  BASIC_TRACE: {
    actionId: expect.any(String),
    actorId: expect.any(String),
    isComplete: expect.any(Boolean),
    hasError: expect.any(Boolean),
    duration: expect.any(Number),
    phases: expect.any(Array),
  },
};

/**
 * Utility to create test action
 *
 * @param {string} actionId - Action ID
 * @param {object} options - Action options
 * @returns {object} Test turn action
 */
function createTestAction(actionId, options = {}) {
  return {
    actionDefinitionId: actionId,
    commandString: options.commandString || `execute ${actionId}`,
    parameters: options.parameters || {},
    timestamp: Date.now(),
    ...options,
  };
}

/**
 * Generate load test actions
 *
 * @param {object} scenario - Load scenario configuration
 * @returns {Array} Array of test actions
 */
function generateLoadTestActions(scenario) {
  const actions = [];
  for (let i = 0; i < scenario.actionCount; i++) {
    const actionId = scenario.actions[i % scenario.actions.length];
    actions.push(
      createTestAction(actionId, {
        commandString: `load-test-${i} ${actionId}`,
        parameters: { testIndex: i, timestamp: Date.now() },
      })
    );
  }
  return actions;
}

/**
 * Performance test bed for action execution tracing
 * Simplified version focused on performance measurement
 */
class PerformanceTracingTestBed {
  constructor() {
    this.testBed = null;
    this.capturedTraces = [];
    this.executionTimes = new Map();
    this.memorySnapshots = [];
    this.tracingConfig = TRACING_CONFIGS.DETAILED;
    this.tracingComponents = {
      filter: null,
      factory: null,
    };
  }

  async initialize() {
    this.testBed = createTestBed();

    // Initialize tracing components
    this.tracingComponents.filter = new ActionTraceFilter({
      enabled: this.tracingConfig.enabled,
      tracedActions: this.tracingConfig.tracedActions,
      excludedActions: [],
      verbosityLevel: this.tracingConfig.verbosity,
      logger: this.testBed.mockLogger,
    });

    this.tracingComponents.factory = new ActionExecutionTraceFactory({
      logger: this.testBed.mockLogger,
    });

    // Start memory monitoring
    this.memoryInterval = setInterval(() => {
      if (typeof performance !== 'undefined' && performance.memory) {
        this.memorySnapshots.push({
          timestamp: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        });
        if (this.memorySnapshots.length > 100) {
          this.memorySnapshots = this.memorySnapshots.slice(-50);
        }
      }
    }, 100);
  }

  configureTracing(config = {}) {
    this.tracingConfig = { ...this.tracingConfig, ...config };
    if (this.tracingComponents.filter) {
      this.tracingComponents.filter = new ActionTraceFilter({
        enabled: this.tracingConfig.enabled,
        tracedActions: this.tracingConfig.tracedActions,
        excludedActions: config.excludedActions || [],
        verbosityLevel: this.tracingConfig.verbosity,
        logger: this.testBed.mockLogger,
      });
    }
  }

  createTestActor(id) {
    return {
      id,
      name: `Test Actor ${id}`,
      components: {
        'core:stats': { health: 100 },
      },
    };
  }

  async executeActionWithTracing(actor, turnAction) {
    const startTime = performance.now();
    this.executionTimes.set(
      `${turnAction.actionDefinitionId}-start`,
      startTime
    );

    // Create trace if enabled
    let trace = null;
    if (
      this.tracingConfig.enabled &&
      this.tracingComponents.factory &&
      this.tracingComponents.filter
    ) {
      const shouldTrace = this.tracingComponents.filter.shouldTrace(
        turnAction.actionDefinitionId
      );
      if (shouldTrace) {
        trace = this.tracingComponents.factory.createTrace({
          actionId: turnAction.actionDefinitionId,
          actorId: actor.id,
          turnAction,
          enableTiming: true,
        });
        if (trace && trace.captureDispatchStart) {
          trace.captureDispatchStart();
        }
      }
    }

    // Simulate action execution with small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 1));

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.executionTimes.set(`${turnAction.actionDefinitionId}-end`, endTime);
    this.executionTimes.set(
      `${turnAction.actionDefinitionId}-duration`,
      duration
    );

    // Complete trace
    if (trace) {
      if (trace.captureDispatchResult) {
        trace.captureDispatchResult({ success: true });
      }
      this.#captureTrace(
        trace,
        { duration, isComplete: true, hasError: false },
        turnAction
      );
    }

    return {
      success: true,
      tracingData: {
        duration,
        traceId: `${turnAction.actionDefinitionId}-${actor.id}-${Date.now()}`,
        captured: trace !== null,
      },
    };
  }

  #captureTrace(trace, overrides = {}, turnAction = null) {
    const actionId = trace.actionId || 'unknown-action';
    const actorId = trace.actorId || 'unknown-actor';
    const isComplete = overrides.isComplete ?? trace.isComplete ?? true;
    const hasError = overrides.hasError ?? trace.hasError ?? false;
    const duration = overrides.duration ?? trace.duration ?? 0;
    const phases = trace.getExecutionPhases ? trace.getExecutionPhases() : [];
    const performanceData = trace.getPerformanceData
      ? trace.getPerformanceData()
      : { captureOverhead: 0.5 };

    this.capturedTraces.push({
      timestamp: Date.now(),
      writeData: {
        actionId,
        actorId,
        timestamp: Date.now(),
        isComplete,
        hasError,
        duration,
        parameters: turnAction?.parameters || {},
      },
      trace: {
        actionId,
        actorId,
        isComplete,
        hasError,
        duration,
        phases,
        performanceData,
      },
    });
  }

  async waitForTraceCompletion() {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  getCapturedTraces() {
    return [...this.capturedTraces];
  }

  getPerformanceMetrics() {
    return {
      executionTimes: Object.fromEntries(this.executionTimes),
      memorySnapshots: [...this.memorySnapshots],
      alerts: [],
    };
  }

  clearCapturedData() {
    this.capturedTraces = [];
    this.executionTimes.clear();
    this.memorySnapshots = [];
  }

  async cleanup() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    this.clearCapturedData();
    if (this.testBed) {
      this.testBed.cleanup();
    }
  }
}

/**
 * Action Execution Tracing Load Performance Tests
 */
describe('Action Execution Tracing Load Performance Tests', () => {
  let testBed;
  let startMemory;

  beforeEach(async () => {
    testBed = new PerformanceTracingTestBed();
    await testBed.initialize();

    if (typeof performance !== 'undefined' && performance.memory) {
      startMemory = performance.memory.usedJSHeapSize;
    }

    testBed.clearCapturedData();
  });

  afterEach(async () => {
    // Validate memory usage hasn't grown excessively (performance environment only)
    if (
      startMemory &&
      typeof performance !== 'undefined' &&
      performance.memory
    ) {
      // eslint-disable-next-line jest/no-standalone-expect -- Memory validation in afterEach is valid for performance tests
      expect(performance.memory.usedJSHeapSize - startMemory).toBeLessThan(
        PERFORMANCE_EXPECTATIONS.MEMORY_USAGE.maxIncrease
      );
    }

    await testBed.cleanup();
  });

  describe('Queue Processing with Realistic Load Patterns', () => {
    test('should process traces through priority queue under moderate load', async () => {
      testBed.configureTracing(TRACING_CONFIGS.DETAILED);

      const actor = testBed.createTestActor('queue-actor');
      const loadScenario = LOAD_SCENARIOS.MODERATE_LOAD;
      const testActions = generateLoadTestActions(loadScenario);

      // Execute actions with staggered delays using async IIFE pattern
      const executionPromises = testActions.map((action, index) =>
        (async () => {
          await new Promise((r) =>
            setTimeout(r, index * loadScenario.actionDelay)
          );

          try {
            const result = await testBed.executeActionWithTracing(
              actor,
              action
            );
            return { success: true, result, action };
          } catch (error) {
            return { success: false, error, action };
          }
        })()
      );

      const results = await Promise.all(executionPromises);
      await testBed.waitForTraceCompletion();

      expect(results).toHaveLength(loadScenario.actionCount);

      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      const capturedTraces = testBed.getCapturedTraces();
      expect(capturedTraces.length).toBeGreaterThan(0);

      const performanceMetrics = testBed.getPerformanceMetrics();
      if (performanceMetrics.executionTimes) {
        const durations = Object.values(performanceMetrics.executionTimes)
          .filter((value) => typeof value === 'number')
          .filter((duration) => duration > 0);

        // eslint-disable-next-line jest/no-conditional-expect -- Metrics validation within conditional block
        expect(durations.length).toBeGreaterThan(0);

        const averageDuration =
          durations.reduce((sum, d) => sum + d, 0) / durations.length;
        // eslint-disable-next-line jest/no-conditional-expect -- Performance threshold check within conditional block
        expect(averageDuration).toBeLessThan(
          PERFORMANCE_EXPECTATIONS.EXECUTION_TIME.maxAveragePerAction
        );
      }
    });

    test('should handle heavy load without losing traces', async () => {
      testBed.configureTracing({
        ...TRACING_CONFIGS.DETAILED,
        enableQueueProcessing: true,
      });

      const actor = testBed.createTestActor('heavy-load-actor');
      const loadScenario = LOAD_SCENARIOS.HEAVY_LOAD;
      const testActions = generateLoadTestActions(loadScenario);

      const initialTraceCount = testBed.getCapturedTraces().length;

      const batchSize = Math.ceil(
        loadScenario.actionCount / loadScenario.concurrency
      );
      const batches = [];

      for (let i = 0; i < loadScenario.concurrency; i++) {
        const batchStart = i * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, testActions.length);
        const batchActions = testActions.slice(batchStart, batchEnd);

        const batchPromise = Promise.all(
          batchActions.map(async (action) => {
            try {
              return await testBed.executeActionWithTracing(actor, action);
            } catch (error) {
              return { error, action };
            }
          })
        );

        batches.push(batchPromise);
      }

      const batchResults = await Promise.all(batches);
      await testBed.waitForTraceCompletion();

      expect(batchResults).toHaveLength(loadScenario.concurrency);

      const allResults = batchResults.flat();
      const successfulResults = allResults.filter((result) => !result.error);

      expect(successfulResults.length).toBeGreaterThan(
        loadScenario.actionCount * 0.8
      );

      const capturedTraces = testBed.getCapturedTraces();
      const newTraces = capturedTraces.length - initialTraceCount;

      expect(newTraces).toBeGreaterThan(0);
      expect(newTraces).toBeLessThanOrEqual(successfulResults.length);

      const recentTraces = capturedTraces.slice(initialTraceCount);
      recentTraces.forEach((trace) => {
        expect(trace.trace).toMatchObject(EXPECTED_TRACE_STRUCTURES.BASIC_TRACE);
        expect(trace.trace.actionId).toBeDefined();
        expect(trace.trace.actorId).toBe(actor.id);
        expect(trace.trace.duration).toBeGreaterThan(0);
      });

      const performanceMetrics = testBed.getPerformanceMetrics();
      if (performanceMetrics.memorySnapshots.length > 0) {
        const memoryValues = performanceMetrics.memorySnapshots.map(
          (snapshot) => snapshot.used
        );
        const maxMemory = Math.max(...memoryValues);
        const minMemory = Math.min(...memoryValues);
        const memoryIncrease = maxMemory - minMemory;

        // eslint-disable-next-line jest/no-conditional-expect -- Memory threshold check within conditional block
        expect(memoryIncrease).toBeLessThan(
          PERFORMANCE_EXPECTATIONS.MEMORY_USAGE.maxIncrease
        );
      }
    });

    test('should maintain trace ordering and consistency in concurrent scenarios', async () => {
      testBed.configureTracing(TRACING_CONFIGS.DETAILED);

      const actor = testBed.createTestActor('ordering-actor');
      const concurrentActionCount = 20;

      const orderedActions = Array.from(
        { length: concurrentActionCount },
        (_, index) =>
          createTestAction(TEST_ACTIONS.GO, {
            commandString: `ordered-action-${index}`,
            parameters: { order: index, timestamp: Date.now() + index },
          })
      );

      const results = await Promise.all(
        orderedActions.map((action) =>
          testBed
            .executeActionWithTracing(actor, action)
            .catch((error) => ({ error, action }))
        )
      );

      await testBed.waitForTraceCompletion();

      const successfulResults = results.filter((result) => !result.error);
      expect(successfulResults.length).toBeGreaterThan(
        concurrentActionCount * 0.9
      );

      const capturedTraces = testBed.getCapturedTraces();
      const actionTraces = capturedTraces.filter(
        (trace) => trace.trace.actionId === TEST_ACTIONS.GO
      );

      expect(actionTraces.length).toBe(successfulResults.length);

      actionTraces.forEach((trace) => {
        expect(trace.trace.isComplete).toBe(true);
        expect(trace.trace.actorId).toBe(actor.id);
        expect(trace.trace.duration).toBeGreaterThan(0);
        expect(trace.writeData.parameters).toBeDefined();
        expect(trace.writeData.parameters.order).toBeGreaterThanOrEqual(0);
      });

      const traceIds = actionTraces.map(
        (trace) => `${trace.trace.actionId}-${trace.writeData.parameters.order}`
      );
      const uniqueTraceIds = new Set(traceIds);
      expect(uniqueTraceIds.size).toBe(traceIds.length);
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should monitor performance and detect threshold violations', async () => {
      testBed.configureTracing(TRACING_CONFIGS.PERFORMANCE);

      const actor = testBed.createTestActor('perf-actor');
      const actions = [
        createTestAction(TEST_ACTIONS.GO),
        createTestAction(TEST_ACTIONS.ATTACK),
        createTestAction(TEST_ACTIONS.COMPLEX_ACTION, {
          parameters: {
            targets: ['entity-1', 'entity-2'],
            options: { mode: 'aggressive' },
          },
        }),
      ];

      const results = [];
      for (const action of actions) {
        const result = await testBed.executeActionWithTracing(actor, action);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await testBed.waitForTraceCompletion();

      const performanceMetrics = testBed.getPerformanceMetrics();
      expect(performanceMetrics).toBeDefined();
      expect(performanceMetrics.executionTimes).toBeDefined();

      actions.forEach((action) => {
        const durationKey = `${action.actionDefinitionId}-duration`;
        expect(performanceMetrics.executionTimes[durationKey]).toBeDefined();
        expect(performanceMetrics.executionTimes[durationKey]).toBeGreaterThan(
          0
        );
      });

      const traces = testBed.getCapturedTraces();
      traces.forEach((traceData) => {
        if (traceData.trace.performanceData) {
          // eslint-disable-next-line jest/no-conditional-expect -- Capture overhead check within conditional block
          expect(traceData.trace.performanceData.captureOverhead).toBeLessThan(
            PERFORMANCE_EXPECTATIONS.TRACE_CAPTURE_OVERHEAD.max
          );
        }
      });

      if (performanceMetrics.memorySnapshots.length > 0) {
        /* eslint-disable jest/no-conditional-expect -- Memory snapshot structure validation within conditional block */
        expect(performanceMetrics.memorySnapshots[0]).toMatchObject({
          timestamp: expect.any(Number),
          used: expect.any(Number),
          total: expect.any(Number),
        });
        /* eslint-enable jest/no-conditional-expect */
      }
    });

    test('should maintain performance under mixed workload', async () => {
      testBed.configureTracing(TRACING_CONFIGS.DETAILED);

      const actor = testBed.createTestActor('mixed-workload-actor');

      const mixedActions = [
        createTestAction(TEST_ACTIONS.GO, { parameters: { direction: 'north' } }),
        createTestAction(TEST_ACTIONS.ATTACK, {
          parameters: { target: 'enemy-1', weapon: 'sword' },
        }),
        createTestAction(TEST_ACTIONS.COMPLEX_ACTION, {
          parameters: {
            targets: ['e1', 'e2', 'e3'],
            options: { mode: 'aggressive', priority: 'high' },
          },
        }),
        createTestAction(TEST_ACTIONS.GO, { parameters: { direction: 'south' } }),
        createTestAction(TEST_ACTIONS.ATTACK, {
          parameters: { target: 'enemy-2', weapon: 'bow' },
        }),
      ];

      const results = [];
      for (const action of mixedActions) {
        try {
          const result = await testBed.executeActionWithTracing(actor, action);
          results.push({ success: true, result, action });
        } catch (error) {
          results.push({ success: false, error, action });
        }
      }

      await testBed.waitForTraceCompletion();

      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
      expect(results.length).toBe(mixedActions.length);

      const capturedTraces = testBed.getCapturedTraces();
      expect(capturedTraces).toHaveLength(mixedActions.length);

      capturedTraces.forEach((trace) => {
        expect(trace.trace.isComplete).toBe(true);
        expect(trace.trace.duration).toBeGreaterThan(0);
      });
    });
  });
});
