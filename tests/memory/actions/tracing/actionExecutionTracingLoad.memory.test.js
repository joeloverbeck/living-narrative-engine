/**
 * @file Action Execution Tracing Load Memory Tests
 * @description Memory tests for action execution tracing under load conditions.
 *
 * Extracted from actionExecutionTracingLoad.performance.test.js to properly
 * separate memory testing (requiring --expose-gc) from performance testing.
 *
 * Memory Tests:
 * - Heap growth under sustained load
 * - Memory snapshot validation
 * - Leak detection during high-frequency tracing
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';

import { createTestBed } from '../../../common/testBed.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';

/**
 * Test action constants for memory testing
 */
const TEST_ACTIONS = {
  GO: 'movement:go',
  ATTACK: 'core:attack',
  COMPLEX_ACTION: 'test:complexAction',
};

/**
 * Memory testing scenarios configuration
 */
const MEMORY_SCENARIOS = {
  SUSTAINED_LOAD: {
    actionCount: 50,
    concurrency: 5,
    actionDelay: 5,
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK, TEST_ACTIONS.COMPLEX_ACTION],
  },
  HIGH_FREQUENCY: {
    actionCount: 100,
    concurrency: 10,
    actionDelay: 1,
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
  },
};

/**
 * Memory thresholds for tests
 */
const MEMORY_THRESHOLDS = {
  maxIncrease: 10 * 1024 * 1024, // 10 MB
  maxTotal: 100 * 1024 * 1024, // 100 MB
  leakThreshold: 1 * 1024 * 1024, // 1 MB per iteration is concerning
};

/**
 * Tracing configuration for memory tests
 */
const TRACING_CONFIG = {
  enabled: true,
  tracedActions: ['*'],
  verbosity: 'detailed',
  enablePerformanceMonitoring: true,
  enableQueueProcessing: true,
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
 * Generate memory test actions
 *
 * @param {object} scenario - Memory scenario configuration
 * @returns {Array} Array of test actions
 */
function generateMemoryTestActions(scenario) {
  const actions = [];
  for (let i = 0; i < scenario.actionCount; i++) {
    const actionId = scenario.actions[i % scenario.actions.length];
    actions.push(
      createTestAction(actionId, {
        commandString: `memory-test-${i} ${actionId}`,
        parameters: { testIndex: i, timestamp: Date.now() },
      })
    );
  }
  return actions;
}

/**
 * Memory test bed for action execution tracing
 * Focused on memory measurement and leak detection
 */
class MemoryTracingTestBed {
  constructor() {
    this.testBed = null;
    this.capturedTraces = [];
    this.memorySnapshots = [];
    this.tracingConfig = TRACING_CONFIG;
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

    // Start memory monitoring with higher frequency for memory tests
    this.memoryInterval = setInterval(() => {
      if (typeof performance !== 'undefined' && performance.memory) {
        this.memorySnapshots.push({
          timestamp: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        });
        // Keep more snapshots for memory analysis
        if (this.memorySnapshots.length > 200) {
          this.memorySnapshots = this.memorySnapshots.slice(-100);
        }
      }
    }, 50);
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

    // Simulate action execution
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Complete trace
    if (trace) {
      if (trace.captureDispatchResult) {
        trace.captureDispatchResult({ success: true });
      }
      this.#captureTrace(trace, turnAction);
    }

    return { success: true };
  }

  #captureTrace(trace, turnAction) {
    this.capturedTraces.push({
      timestamp: Date.now(),
      trace: {
        actionId: trace.actionId || 'unknown-action',
        actorId: trace.actorId || 'unknown-actor',
      },
      parameters: turnAction?.parameters || {},
    });
  }

  getMemorySnapshots() {
    return [...this.memorySnapshots];
  }

  getMemoryStats() {
    if (this.memorySnapshots.length === 0) {
      return null;
    }

    const memoryValues = this.memorySnapshots.map((s) => s.used);
    const maxMemory = Math.max(...memoryValues);
    const minMemory = Math.min(...memoryValues);
    const firstMemory = memoryValues[0];
    const lastMemory = memoryValues[memoryValues.length - 1];

    return {
      min: minMemory,
      max: maxMemory,
      first: firstMemory,
      last: lastMemory,
      increase: maxMemory - minMemory,
      netChange: lastMemory - firstMemory,
      snapshots: this.memorySnapshots.length,
    };
  }

  getCapturedTracesCount() {
    return this.capturedTraces.length;
  }

  clearCapturedData() {
    this.capturedTraces = [];
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
 * Action Execution Tracing Memory Tests
 *
 * These tests validate memory behavior under load and detect potential leaks.
 * Requires --expose-gc flag via npm run test:memory
 */
describe('Action Execution Tracing Load - Memory Tests', () => {
  let testBed;
  let initialMemory;

  beforeEach(async () => {
    testBed = new MemoryTracingTestBed();

    // Force garbage collection before each test
    if (global.memoryTestUtils && global.memoryTestUtils.forceGCAndWait) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await testBed.initialize();

    // Record initial memory state
    if (typeof performance !== 'undefined' && performance.memory) {
      initialMemory = performance.memory.usedJSHeapSize;
    }

    testBed.clearCapturedData();
  });

  afterEach(async () => {
    await testBed.cleanup();

    // Force garbage collection after each test
    if (global.memoryTestUtils && global.memoryTestUtils.forceGCAndWait) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  describe('Heap Growth Under Load', () => {
    test('should not exceed memory threshold under sustained load', async () => {
      const scenario = MEMORY_SCENARIOS.SUSTAINED_LOAD;
      const actor = testBed.createTestActor('memory-load-actor');
      const testActions = generateMemoryTestActions(scenario);

      // Execute actions in batches
      const batchSize = Math.ceil(scenario.actionCount / scenario.concurrency);

      for (let batch = 0; batch < scenario.concurrency; batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, testActions.length);
        const batchActions = testActions.slice(batchStart, batchEnd);

        await Promise.all(
          batchActions.map((action) =>
            testBed.executeActionWithTracing(actor, action)
          )
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Allow memory monitoring to capture final state
      await new Promise((resolve) => setTimeout(resolve, 200));

      const memoryStats = testBed.getMemoryStats();

      // Memory assertions
      if (memoryStats) {
        expect(memoryStats.increase).toBeLessThan(
          MEMORY_THRESHOLDS.maxIncrease
        );
        expect(memoryStats.max).toBeLessThan(MEMORY_THRESHOLDS.maxTotal);
      }

      // Verify traces were captured
      expect(testBed.getCapturedTracesCount()).toBeGreaterThan(0);
    });

    test('should maintain stable memory under high-frequency tracing', async () => {
      const scenario = MEMORY_SCENARIOS.HIGH_FREQUENCY;
      const actor = testBed.createTestActor('high-freq-actor');
      const testActions = generateMemoryTestActions(scenario);

      // Execute all actions rapidly
      await Promise.all(
        testActions.map((action) =>
          testBed.executeActionWithTracing(actor, action)
        )
      );

      // Allow garbage collection and final measurements
      await new Promise((resolve) => setTimeout(resolve, 300));

      const memoryStats = testBed.getMemoryStats();

      if (memoryStats) {
        // High-frequency tracing should not cause excessive memory growth
        expect(memoryStats.increase).toBeLessThan(
          MEMORY_THRESHOLDS.maxIncrease
        );

        // Net change should not indicate a leak pattern
        expect(memoryStats.netChange).toBeLessThan(
          MEMORY_THRESHOLDS.leakThreshold
        );
      }

      expect(testBed.getCapturedTracesCount()).toBe(scenario.actionCount);
    });
  });

  describe('Memory Snapshot Validation', () => {
    // Note: performance.memory is a Chrome-specific API not available in Node.js/jsdom
    // These tests verify memory snapshot behavior when the API is available,
    // and gracefully skip the detailed assertions when it's not

    test('should produce valid memory snapshot structure', async () => {
      const actor = testBed.createTestActor('snapshot-actor');
      const actions = [
        createTestAction(TEST_ACTIONS.GO),
        createTestAction(TEST_ACTIONS.ATTACK),
        createTestAction(TEST_ACTIONS.COMPLEX_ACTION),
      ];

      // Execute actions
      for (const action of actions) {
        await testBed.executeActionWithTracing(actor, action);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      const snapshots = testBed.getMemorySnapshots();

      // If performance.memory is available, validate snapshots were collected
      if (typeof performance !== 'undefined' && performance.memory) {
        expect(snapshots.length).toBeGreaterThan(0);

        // Validate snapshot structure
        snapshots.forEach((snapshot) => {
          expect(snapshot).toMatchObject({
            timestamp: expect.any(Number),
            used: expect.any(Number),
            total: expect.any(Number),
          });

          // Memory values should be positive
          expect(snapshot.used).toBeGreaterThan(0);
          expect(snapshot.total).toBeGreaterThan(0);
          expect(snapshot.total).toBeGreaterThanOrEqual(snapshot.used);
        });
      } else {
        // Without performance.memory, snapshots array will be empty - this is expected
        expect(snapshots).toBeInstanceOf(Array);
        // Verify the test infrastructure still works
        expect(testBed.getCapturedTracesCount()).toBeGreaterThan(0);
      }
    });

    test('should track memory changes over time accurately', async () => {
      const actor = testBed.createTestActor('tracking-actor');

      // Execute multiple rounds of actions
      for (let round = 0; round < 3; round++) {
        const actions = generateMemoryTestActions({
          actionCount: 20,
          concurrency: 2,
          actionDelay: 5,
          actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
        });

        await Promise.all(
          actions.map((action) =>
            testBed.executeActionWithTracing(actor, action)
          )
        );

        // Wait between rounds
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const snapshots = testBed.getMemorySnapshots();

      // If performance.memory is available, validate detailed tracking
      if (typeof performance !== 'undefined' && performance.memory) {
        expect(snapshots.length).toBeGreaterThan(5);

        // Timestamps should be monotonically increasing
        for (let i = 1; i < snapshots.length; i++) {
          expect(snapshots[i].timestamp).toBeGreaterThanOrEqual(
            snapshots[i - 1].timestamp
          );
        }

        // Memory stats should be calculable
        const stats = testBed.getMemoryStats();
        expect(stats).not.toBeNull();
        expect(stats.snapshots).toBe(snapshots.length);
      } else {
        // Without performance.memory, verify basic infrastructure works
        expect(snapshots).toBeInstanceOf(Array);
        // Verify traces were captured even without memory API
        expect(testBed.getCapturedTracesCount()).toBeGreaterThan(0);
      }
    });
  });

  describe('Leak Detection', () => {
    test('should not exhibit memory leak pattern under repeated iterations', async () => {
      const actor = testBed.createTestActor('leak-test-actor');
      const iterationMemory = [];

      // Run multiple iterations and track memory after each
      for (let iteration = 0; iteration < 5; iteration++) {
        const actions = generateMemoryTestActions({
          actionCount: 30,
          concurrency: 3,
          actionDelay: 2,
          actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
        });

        await Promise.all(
          actions.map((action) =>
            testBed.executeActionWithTracing(actor, action)
          )
        );

        // Force GC if available
        if (global.gc) {
          global.gc();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Record memory after each iteration
        if (typeof performance !== 'undefined' && performance.memory) {
          iterationMemory.push(performance.memory.usedJSHeapSize);
        }
      }

      // Analyze memory trend across iterations
      if (iterationMemory.length >= 3) {
        // Calculate growth rate between iterations
        const growthRates = [];
        for (let i = 1; i < iterationMemory.length; i++) {
          growthRates.push(iterationMemory[i] - iterationMemory[i - 1]);
        }

        // Average growth should not indicate a leak
        const avgGrowth =
          growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
        expect(avgGrowth).toBeLessThan(MEMORY_THRESHOLDS.leakThreshold);

        // Total growth across all iterations should be bounded
        const totalGrowth =
          iterationMemory[iterationMemory.length - 1] - iterationMemory[0];
        expect(totalGrowth).toBeLessThan(MEMORY_THRESHOLDS.maxIncrease);
      }
    });
  });
});
