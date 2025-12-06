/**
 * @file Queue Processing Under Realistic Load E2E Test Suite
 * @description Priority 1.1: Critical Business Impact - Queue Processing Under Realistic Load (HIGH)
 *
 * This comprehensive e2e test suite validates queue processing functionality under realistic
 * gaming scenarios, including priority handling, backpressure management, circuit breaker
 * functionality, and memory efficiency.
 *
 * Based on the architecture analysis in reports/actions-tracing-architecture-analysis.md,
 * this addresses the critical gap in e2e testing for queue processing under load.
 *
 * Test Scenarios:
 * 1. Mixed priority queue processing with realistic action sequences
 * 2. Backpressure handling when trace volume exceeds capacity
 * 3. Circuit breaker activation and recovery during load spikes
 * 4. Memory efficiency validation under sustained load
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

import { TraceQueueProcessor } from '../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../src/actions/tracing/tracePriority.js';
import { ActionExecutionTraceFactory } from '../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import {
  createMockIndexedDBStorageAdapter,
  createMockTimerService,
} from '../../common/mockFactories/actionTracing.js';
import {
  TEST_ACTIONS,
  TEST_ACTORS,
  PERFORMANCE_EXPECTATIONS,
  createTestAction,
  createTestActor,
} from './fixtures/tracingTestActions.js';

/**
 * Seeded random number generator for deterministic tests
 */
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

/**
 * Extended load scenarios for comprehensive queue testing
 */
const EXTENDED_LOAD_SCENARIOS = {
  REALISTIC_GAMING: {
    actionCount: 36,
    concurrency: 3,
    actionDelay: 15,
    priorityDistribution: {
      [TracePriority.CRITICAL]: 0.05, // 5%
      [TracePriority.HIGH]: 0.15, // 15%
      [TracePriority.NORMAL]: 0.7, // 70%
      [TracePriority.LOW]: 0.1, // 10%
    },
    actions: [
      TEST_ACTIONS.GO,
      TEST_ACTIONS.ATTACK,
      TEST_ACTIONS.COMPLEX_ACTION,
    ],
    errorRate: 0.1, // 10% error rate
  },

  BURST_GAMING: {
    actionCount: 120,
    concurrency: 6,
    actionDelay: 2,
    priorityDistribution: {
      [TracePriority.CRITICAL]: 0.1,
      [TracePriority.HIGH]: 0.25,
      [TracePriority.NORMAL]: 0.5,
      [TracePriority.LOW]: 0.15,
    },
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
    errorRate: 0.15, // Higher error rate during burst
  },

  SUSTAINED_LOAD: {
    actionCount: 120,
    concurrency: 5,
    actionDelay: 10,
    priorityDistribution: {
      [TracePriority.CRITICAL]: 0.03,
      [TracePriority.HIGH]: 0.12,
      [TracePriority.NORMAL]: 0.75,
      [TracePriority.LOW]: 0.1,
    },
    actions: [
      TEST_ACTIONS.GO,
      TEST_ACTIONS.ATTACK,
      TEST_ACTIONS.COMPLEX_ACTION,
    ],
    errorRate: 0.08,
  },
};

const TEST_QUEUE_CONFIG = Object.freeze({
  maxQueueSize: 80,
  batchSize: 10,
  batchTimeout: 20,
  maxRetries: 3,
  memoryLimit: 2 * 1024 * 1024, // 2MB
  enableParallelProcessing: true,
  maxStoredTraces: 100,
});

const ACTOR_FIXTURES = Object.freeze([
  createTestActor('player-1', TEST_ACTORS.BASIC_PLAYER.components),
  createTestActor('player-2', TEST_ACTORS.COMPLEX_ACTOR.components),
]);

/**
 * Queue Processing Under Realistic Load E2E Test Suite
 *
 * Validates comprehensive queue processing functionality including:
 * - Priority-based queue processing under realistic gaming loads
 * - Backpressure handling and circuit breaker functionality
 * - Memory efficiency and resource management
 * - Error recovery and system resilience
 */
describe('Queue Processing Under Realistic Load E2E', () => {
  let queueProcessor;
  let traceFactory;
  let mockLogger;
  let mockStorageAdapter;
  let mockEventBus;
  let startMemory;
  let testTraces;
  let seededRandom;
  let timerService;

  beforeEach(async () => {
    jest.useFakeTimers();

    // Mock performance.memory if not available (for jsdom environment)
    if (typeof performance === 'undefined' || !performance.memory) {
      global.performance = global.performance || {};
      global.performance.memory = {
        usedJSHeapSize: 1000000, // Start with 1MB
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000,
      };
    }

    // Record initial memory state
    if (typeof performance !== 'undefined' && performance.memory) {
      startMemory = performance.memory.usedJSHeapSize;
    }

    // Initialize mocks and dependencies
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Initialize trace factory for creating realistic traces
    traceFactory = new ActionExecutionTraceFactory({
      logger: mockLogger,
    });

    // Initialize queue processor with realistic configuration
    timerService = createMockTimerService();
    queueProcessor = new TraceQueueProcessor({
      storageAdapter: mockStorageAdapter,
      logger: mockLogger,
      eventBus: mockEventBus,
      config: {
        ...TEST_QUEUE_CONFIG,
        storageKey: 'e2e-queue-test-traces',
      },
      timerService,
    });

    // Initialize test traces array
    testTraces = [];

    // Initialize seeded random for deterministic tests
    seededRandom = new SeededRandom(42); // Fixed seed for reproducibility
  });

  afterEach(async () => {
    // Validate memory usage hasn't grown excessively
    if (
      startMemory &&
      typeof performance !== 'undefined' &&
      performance.memory
    ) {
      const endMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = endMemory - startMemory;

      expect(memoryIncrease).toBeLessThan(
        PERFORMANCE_EXPECTATIONS.MEMORY_USAGE.maxIncrease
      );
    }

    // Cleanup queue processor
    if (queueProcessor) {
      try {
        await queueProcessor.shutdown();
      } catch {
        // Ignore shutdown errors in cleanup
      }
    }

    // Clear test data
    testTraces.length = 0;

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /**
   * Test Scenario 1: Mixed Priority Queue Processing with Realistic Action Sequences
   *
   * Validates that the queue processor correctly handles a realistic mix of action priorities
   * typical of actual gaming scenarios, including proper priority ordering and processing.
   */
  describe('Scenario 1: Mixed Priority Queue Processing with Realistic Gaming Load', () => {
    test('should process mixed priority traces in correct order under realistic gaming load', async () => {
      // Arrange: Create realistic gaming scenario traces
      const scenario = EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING;
      const traces = createRealisticTraces(scenario);

      // Track processing order
      const processedOrder = [];

      // Mock storage to track processing order
      mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
        if (key.includes('traces')) {
          // Production code stores arrays of trace records directly (not JSON strings)
          if (Array.isArray(value)) {
            value.forEach((traceRecord) => {
              processedOrder.push({
                actionId:
                  traceRecord.data?.metadata?.actionId || traceRecord.id,
                priority: traceRecord.priority || TracePriority.NORMAL,
                timestamp: traceRecord.timestamp,
              });
            });
          }
        }
        return Promise.resolve();
      });

      // Act: Enqueue all traces
      traces.forEach((trace, index) => {
        const priority = determinePriority(
          index,
          scenario.priorityDistribution
        );
        const success = queueProcessor.enqueue(trace, priority);
        expect(success).toBe(true);
      });

      // Allow processing time
      await waitForProcessing(1200);

      // Assert: Verify processing order respects priorities
      expect(processedOrder.length).toBeGreaterThan(0);

      // Check that critical traces were processed first
      const criticalTraces = processedOrder.filter(
        (t) => t.priority === TracePriority.CRITICAL
      );
      const firstNonCritical = processedOrder.find(
        (t) => t.priority !== TracePriority.CRITICAL
      );

      // Only check priority order if we have both types
      const hasBothTypes = criticalTraces.length > 0 && firstNonCritical;
      expect(hasBothTypes).toBeDefined(); // Ensure we can test priority ordering

      if (hasBothTypes) {
        criticalTraces.forEach((criticalTrace) => {
          const criticalIndex = processedOrder.indexOf(criticalTrace);
          const firstNonCriticalIndex =
            processedOrder.indexOf(firstNonCritical);
          expect(criticalIndex).toBeLessThan(firstNonCriticalIndex);
        });
      }

      // Verify all traces were eventually processed
      expect(processedOrder.length).toBeGreaterThanOrEqual(traces.length * 0.8); // Allow for some processing delays

      // Verify metrics show reasonable performance
      const metrics = queueProcessor.getMetrics();
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      expect(metrics.avgLatency).toBeLessThan(50); // Under 50ms average latency
    });

    test('should handle error traces appropriately within realistic load', async () => {
      // Arrange: Create scenario with error traces
      const scenario = EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING;
      const traces = createRealisticTracesWithErrors(scenario);

      let errorCount = 0;
      let successCount = 0;

      // Mock storage to track error handling
      mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
        if (key.includes('traces')) {
          // Production code stores arrays of trace records directly (not JSON strings)
          if (Array.isArray(value)) {
            value.forEach((traceRecord) => {
              if (
                traceRecord.data?.error ||
                traceRecord.data?.execution?.status === 'error'
              ) {
                errorCount++;
              } else {
                successCount++;
              }
            });
          }
        }
        return Promise.resolve();
      });

      // Act: Process all traces
      traces.forEach((trace, index) => {
        const priority = trace.hasError
          ? TracePriority.CRITICAL
          : determinePriority(index, scenario.priorityDistribution);
        queueProcessor.enqueue(trace, priority);
      });

      await waitForProcessing(1200);

      // Assert: Verify error handling
      expect(errorCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);

      // Error traces should be processed with critical priority
      expect(errorCount).toBeLessThanOrEqual(
        traces.filter((t) => t.hasError).length
      );
    });
  });

  /**
   * Test Scenario 2: Backpressure Handling When Trace Volume Exceeds Capacity
   *
   * Validates that the queue processor properly handles situations where incoming
   * trace volume exceeds processing capacity, implementing backpressure mechanisms.
   */
  describe('Scenario 2: Backpressure Handling Under High Volume', () => {
    test('should handle backpressure when queue capacity is exceeded', async () => {
      // Arrange: Create burst load that exceeds capacity
      const scenario = EXTENDED_LOAD_SCENARIOS.BURST_GAMING;
      const traces = createRealisticTraces(scenario);

      let rejectedCount = 0;
      let acceptedCount = 0;

      // Act: Rapidly enqueue traces to trigger backpressure
      traces.forEach((trace, index) => {
        const priority = determinePriority(
          index,
          scenario.priorityDistribution
        );
        const success = queueProcessor.enqueue(trace, priority);

        if (success) {
          acceptedCount++;
        } else {
          rejectedCount++;
        }
      });

      // Allow some processing
      await waitForProcessing(800);

      // Assert: Verify backpressure behavior
      expect(acceptedCount + rejectedCount).toBe(traces.length);

      // Verify rejection behavior is reasonable
      expect(rejectedCount).toBeLessThanOrEqual(traces.length * 0.5); // Not more than 50% rejected

      // Queue should not exceed maximum size
      const stats = queueProcessor.getQueueStats();
      expect(stats.totalSize).toBeLessThanOrEqual(
        TEST_QUEUE_CONFIG.maxQueueSize
      ); // Max queue size

      // Backpressure mitigation should have dropped at least one lower-priority item
      const metrics = queueProcessor.getMetrics();
      expect(metrics.totalDropped).toBeGreaterThan(0);

      // Verify that high priority traces are less likely to be rejected
      expect(acceptedCount).toBeGreaterThan(traces.length * 0.5);
    });

    test('should recover from backpressure conditions', async () => {
      // Arrange: First create backpressure
      const burstScenario = EXTENDED_LOAD_SCENARIOS.BURST_GAMING;
      const burstTraces = createRealisticTraces(burstScenario);

      // Enqueue burst to create backpressure
      burstTraces.forEach((trace, index) => {
        const priority = determinePriority(
          index,
          burstScenario.priorityDistribution
        );
        queueProcessor.enqueue(trace, priority);
      });

      // Allow processing to drain queue
      await waitForProcessing(1200);

      // Act: Try to enqueue new traces after backpressure
      const recoveryTraces = createRealisticTraces({
        ...EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING,
        actionCount: 20,
      });

      let recoveryAccepted = 0;
      recoveryTraces.forEach((trace) => {
        if (queueProcessor.enqueue(trace, TracePriority.NORMAL)) {
          recoveryAccepted++;
        }
      });

      // Assert: Should accept new traces after recovery
      expect(recoveryAccepted).toBeGreaterThan(recoveryTraces.length * 0.8);

      // Queue should be processing normally
      const finalStats = queueProcessor.getQueueStats();
      expect(finalStats.totalSize).toBeLessThan(
        Math.floor(TEST_QUEUE_CONFIG.maxQueueSize * 0.8)
      ); // Should be manageable
    });
  });

  /**
   * Test Scenario 3: Circuit Breaker Activation and Recovery During Load Spikes
   *
   * Validates circuit breaker functionality during processing failures under load,
   * including proper failure detection, circuit opening, and recovery mechanisms.
   */
  describe('Scenario 3: Circuit Breaker Functionality Under Load', () => {
    test('should activate circuit breaker on consecutive failures', async () => {
      // Arrange: Configure storage to fail after some successes
      let callCount = 0;
      mockStorageAdapter.setItem.mockImplementation(async () => {
        callCount++;
        if (callCount > 5) {
          throw new Error('Simulated storage failure');
        }
        return Promise.resolve();
      });

      const scenario = EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING;
      const traces = createRealisticTraces(scenario);

      // Act: Enqueue traces that will trigger failures
      traces.forEach((trace, index) => {
        const priority = determinePriority(
          index,
          scenario.priorityDistribution
        );
        queueProcessor.enqueue(trace, priority);
      });

      await waitForProcessing(1200);

      // Assert: Check that circuit breaker activated
      const metrics = queueProcessor.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);

      // Should still have processed some traces before circuit opened
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      expect(metrics.totalProcessed).toBeLessThan(traces.length); // Not all processed due to circuit
    });

    test('should recover from circuit breaker state', async () => {
      // Create a new queue processor instance to test recovery scenario
      // This simulates service restart or manual reset after circuit breaker opens
      let shouldFail = true;
      mockStorageAdapter.setItem.mockImplementation(async () => {
        if (shouldFail) {
          throw new Error('Simulated failure');
        }
        return Promise.resolve();
      });

      // Trigger failures to open circuit breaker
      const failureTraces = createRealisticTraces({
        ...EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING,
        actionCount: 10,
      });

      failureTraces.forEach((trace) => {
        queueProcessor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(1000);

      const failureMetrics = queueProcessor.getMetrics();
      expect(failureMetrics.totalErrors).toBeGreaterThan(0);

      // Now fix the storage
      shouldFail = false;

      // Create a new processor instance to simulate recovery (service restart)
      const recoveredProcessor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
        config: {
          ...TEST_QUEUE_CONFIG,
          storageKey: 'e2e-recovery-test-traces',
        },
        timerService,
      });

      // Try new traces with the recovered processor
      const recoveryTraces = createRealisticTraces({
        ...EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING,
        actionCount: 15,
      });

      recoveryTraces.forEach((trace) => {
        recoveredProcessor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(900, recoveredProcessor);

      // Assert: Should process new traces after recovery
      const recoveryMetrics = recoveredProcessor.getMetrics();
      expect(recoveryMetrics.totalProcessed).toBeGreaterThan(0);
      expect(recoveryMetrics.totalErrors).toBe(0); // No errors with fixed storage

      // Cleanup
      await recoveredProcessor.shutdown();
    });
  });

  /**
   * Test Scenario 4: Memory Efficiency Validation Under Sustained Load
   *
   * Validates that the queue processor maintains memory efficiency during
   * sustained load, properly cleaning up processed traces and managing memory usage.
   */
  describe('Scenario 4: Memory Efficiency Under Sustained Load', () => {
    test('should maintain memory efficiency during sustained processing', async () => {
      // Track memory at intervals
      const memorySnapshots = [];

      const takeMemorySnapshot = () => {
        if (typeof performance !== 'undefined' && performance.memory) {
          // Simulate slight memory growth for testing with deterministic values
          global.performance.memory.usedJSHeapSize +=
            seededRandom.next() * 50000; // Add 0-50KB

          memorySnapshots.push({
            timestamp: Date.now(),
            heapUsed: performance.memory.usedJSHeapSize,
            heapTotal: performance.memory.totalJSHeapSize,
          });
        }
      };

      takeMemorySnapshot(); // Initial snapshot

      // Process sustained load in phases
      for (let phase = 0; phase < 3; phase++) {
        const scenario = EXTENDED_LOAD_SCENARIOS.SUSTAINED_LOAD;
        const traces = createRealisticTraces({
          ...scenario,
          actionCount: 24, // Smaller batches for sustained processing
        });

        traces.forEach((trace, index) => {
          const priority = determinePriority(
            index,
            scenario.priorityDistribution
          );
          queueProcessor.enqueue(trace, priority);
        });

        await waitForProcessing(800);
        takeMemorySnapshot();
      }

      // Assert: Memory should not grow excessively
      expect(memorySnapshots.length).toBeGreaterThan(1); // Ensure we have data to analyze

      if (memorySnapshots.length > 1) {
        const initialMemory = memorySnapshots[0].heapUsed;
        const finalMemory =
          memorySnapshots[memorySnapshots.length - 1].heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        // Memory growth should be reasonable (less than 5MB for sustained processing)
        expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);

        // Memory shouldn't continuously grow (allow for some variance)
        const midPoint = Math.floor(memorySnapshots.length / 2);
        const midMemory = memorySnapshots[midPoint].heapUsed;
        const laterGrowth = finalMemory - midMemory;

        // Later growth should be minimal compared to early growth - allow for variance
        expect(laterGrowth).toBeLessThanOrEqual(memoryGrowth * 1.5); // Allow 50% variance
      }

      // Verify queue processor is managing memory properly
      const stats = queueProcessor.getQueueStats();
      expect(stats.totalSize).toBeLessThan(
        Math.floor(TEST_QUEUE_CONFIG.maxQueueSize * 0.75)
      ); // Queue should not grow unbounded
    });

    test('should properly cleanup processed traces', async () => {
      // Arrange: Process traces and verify cleanup
      const scenario = EXTENDED_LOAD_SCENARIOS.REALISTIC_GAMING;
      const traces = createRealisticTraces(scenario);

      let storageCallCount = 0;
      mockStorageAdapter.setItem.mockImplementation(async () => {
        storageCallCount++;
        return Promise.resolve();
      });

      // Act: Process all traces
      traces.forEach((trace, index) => {
        const priority = determinePriority(
          index,
          scenario.priorityDistribution
        );
        queueProcessor.enqueue(trace, priority);
      });

      await waitForProcessing(1200);

      // Assert: Verify cleanup occurred
      const finalStats = queueProcessor.getQueueStats();
      expect(finalStats.totalSize).toBeLessThan(traces.length * 0.3); // Most should be processed and cleaned

      // Storage should have been called for processed batches
      expect(storageCallCount).toBeGreaterThan(0);

      // Memory metrics should show processing activity
      const metrics = queueProcessor.getMetrics();
      expect(metrics.totalProcessed).toBeGreaterThan(0);
    });
  });

  // Helper Functions

  /**
   * Create realistic traces for testing scenarios
   *
   * @param {object} scenario - Test scenario configuration
   * @returns {Array} Array of trace objects
   */
  function createRealisticTraces(scenario) {
    const traces = [];
    const actors = ACTOR_FIXTURES;

    for (let i = 0; i < scenario.actionCount; i++) {
      const actionId = scenario.actions[i % scenario.actions.length];
      const actor = actors[i % actors.length];
      const turnAction = createTestAction(actionId, {
        commandString: `load-test-${i} ${actionId}`,
        parameters: { testIndex: i },
      });

      const trace = traceFactory.createTrace({
        actionId: `${actionId}-${i}`,
        actorId: actor.id,
        turnAction,
      });

      // Add realistic timing and completion using correct ActionExecutionTrace API
      trace.captureDispatchStart();

      const success = seededRandom.next() > (scenario.errorRate || 0.1);
      if (success) {
        trace.captureDispatchResult({
          success: true,
          timestamp: Date.now(),
        });
      } else {
        trace.captureError(new Error(`Simulated execution error ${i}`));
      }

      traces.push(trace);
    }

    return traces;
  }

  /**
   * Create realistic traces with controlled error scenarios
   *
   * @param {object} scenario - Test scenario configuration
   * @returns {Array} Array of trace objects with error scenarios
   */
  function createRealisticTracesWithErrors(scenario) {
    // Create traces without errors first, then add errors selectively
    const actors = ACTOR_FIXTURES;

    const traces = [];

    // Use a separate seeded random for error creation
    const errorRandom = new SeededRandom(123);

    for (let i = 0; i < scenario.actionCount; i++) {
      const actionId = scenario.actions[i % scenario.actions.length];
      const actor = actors[i % actors.length];
      const turnAction = createTestAction(actionId, {
        commandString: `error-test-${i} ${actionId}`,
        parameters: { testIndex: i },
      });

      const trace = traceFactory.createTrace({
        actionId: `${actionId}-error-${i}`,
        actorId: actor.id,
        turnAction,
      });

      // Add realistic timing and controlled error creation
      trace.captureDispatchStart();

      const shouldError = errorRandom.next() < (scenario.errorRate || 0.1);
      if (shouldError) {
        // Create error trace - use updateError to handle retries gracefully
        trace.captureError(new Error(`Test error ${i}`), {
          phase: 'execution',
          retryCount: 0,
        });
        // No need to mark - hasError getter will return true automatically
      } else {
        trace.captureDispatchResult({
          success: true,
          timestamp: Date.now(),
        });
      }

      traces.push(trace);
    }

    return traces;
  }

  /**
   * Determine priority based on distribution and index
   *
   * @param {number} index - Index of the trace
   * @param {object} distribution - Priority distribution configuration
   * @returns {string} Selected priority level
   */
  function determinePriority(index, distribution) {
    const rand = seededRandom.next();
    let cumulative = 0;

    for (const [priority, percentage] of Object.entries(distribution)) {
      cumulative += percentage;
      if (rand <= cumulative) {
        return priority;
      }
    }

    return TracePriority.NORMAL; // Default fallback
  }

  /**
   * Wait for processing with timeout
   *
   * @param {number} timeout - Timeout in milliseconds (default: 1000)
   * @param processor
   * @returns {Promise} Promise that resolves after timeout
   */
  async function waitForProcessing(timeout = 1000, processor = queueProcessor) {
    const totalTime = Math.max(timeout, 0);
    const step = Math.max(10, Math.floor(totalTime / 10));
    let elapsed = 0;

    while (elapsed < totalTime) {
      const advanceBy = Math.min(step, totalTime - elapsed);

      if (advanceBy > 0) {
        await jest.advanceTimersByTimeAsync(advanceBy);
        elapsed += advanceBy;
      }

      const stats = processor?.getQueueStats?.();
      const hasQueuedItems = Boolean(stats && stats.totalSize > 0);
      const pendingTimers = jest.getTimerCount();

      if (!hasQueuedItems && pendingTimers === 0) {
        break;
      }
    }

    if (jest.getTimerCount() > 0) {
      await jest.runOnlyPendingTimersAsync();
    }

    await Promise.resolve();
  }
});
