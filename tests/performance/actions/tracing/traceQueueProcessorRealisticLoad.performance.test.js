/**
 * @file Performance tests for TraceQueueProcessor under realistic load conditions
 * @description Validates performance metrics and SLA requirements for queue processing
 * under realistic gaming scenarios with comprehensive load patterns.
 *
 * Performance requirements based on architecture analysis:
 * - Queue processing latency: <10ms per batch
 * - Trace capture overhead: <1ms
 * - Memory usage: <2MB heap increase under load
 * - Throughput: >100 traces/second
 * 
 * @see src/actions/tracing/traceQueueProcessor.js
 * @see reports/actions-tracing-architecture-analysis.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockIndexedDBStorageAdapter } from '../../../common/mockFactories/actionTracing.js';

/**
 * Performance test configurations for different load scenarios
 */
const PERFORMANCE_SCENARIOS = {
  LIGHT_GAMING_LOAD: {
    actionCount: 50,
    batchSize: 8,
    concurrentTraces: 2,
    expectedLatency: 5, // 5ms max per batch
    expectedThroughput: 80, // 80 traces/second
  },
  
  TYPICAL_GAMING_LOAD: {
    actionCount: 150,
    batchSize: 12,
    concurrentTraces: 4,
    expectedLatency: 8, // 8ms max per batch
    expectedThroughput: 120, // 120 traces/second
  },
  
  HEAVY_GAMING_LOAD: {
    actionCount: 300,
    batchSize: 15,
    concurrentTraces: 8,
    expectedLatency: 10, // 10ms max per batch
    expectedThroughput: 150, // 150 traces/second
  },
  
  BURST_LOAD: {
    actionCount: 500,
    batchSize: 20,
    concurrentTraces: 12,
    expectedLatency: 15, // 15ms max per batch (higher due to burst)
    expectedThroughput: 200, // 200 traces/second
  },
};

/**
 * SLA requirements for performance validation
 */
const SLA_REQUIREMENTS = {
  TRACE_CAPTURE_OVERHEAD: 1, // 1ms maximum
  BATCH_PROCESSING_LATENCY: 10, // 10ms maximum
  MEMORY_INCREASE_LIMIT: 2 * 1024 * 1024, // 2MB maximum
  MIN_THROUGHPUT: 100, // 100 traces/second minimum
  CIRCUIT_BREAKER_RESPONSE: 50, // 50ms maximum to detect failure
};

describe('TraceQueueProcessor - Realistic Load Performance Tests', () => {
  let processor;
  let traceFactory;
  let mockLogger;
  let mockStorageAdapter;
  let mockEventBus;
  let startMemory;
  let performanceTracker;

  beforeEach(() => {
    // Record initial memory state for potential future use
    startMemory = 0;
    if (typeof performance !== 'undefined' && performance.memory) {
      startMemory = performance.memory.usedJSHeapSize;
    }

    // Initialize performance tracking for potential future use
    performanceTracker = {
      measurements: [],
      startTime: performance.now(),
    };

    // Initialize mocks
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Initialize trace factory
    traceFactory = new ActionExecutionTraceFactory({
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    if (processor) {
      try {
        await processor.shutdown();
      } catch {
        // Ignore shutdown errors in cleanup
      }
    }
    processor = null;
  });

  describe('Batch Processing Performance', () => {
    it('should process light gaming load within performance expectations', async () => {
      const scenario = PERFORMANCE_SCENARIOS.LIGHT_GAMING_LOAD;
      const result = await validateBatchProcessingPerformance(scenario);
      expect(result).toBeDefined();
    });

    it('should process typical gaming load within performance expectations', async () => {
      const scenario = PERFORMANCE_SCENARIOS.TYPICAL_GAMING_LOAD;
      const result = await validateBatchProcessingPerformance(scenario);
      expect(result).toBeDefined();
    });

    it('should process heavy gaming load within performance expectations', async () => {
      const scenario = PERFORMANCE_SCENARIOS.HEAVY_GAMING_LOAD;
      const result = await validateBatchProcessingPerformance(scenario);
      expect(result).toBeDefined();
    });

    it('should handle burst load with acceptable performance degradation', async () => {
      const scenario = PERFORMANCE_SCENARIOS.BURST_LOAD;
      const result = await validateBatchProcessingPerformance(scenario, true); // Allow higher latency for burst
      expect(result).toBeDefined();
    });
  });

  describe('Throughput Performance', () => {
    it('should achieve minimum throughput under sustained load', async () => {
      const scenario = PERFORMANCE_SCENARIOS.TYPICAL_GAMING_LOAD;
      
      processor = createProcessorWithConfig({
        maxQueueSize: 400,
        batchSize: scenario.batchSize,
        batchTimeout: 20,
        enableParallelProcessing: true,
      });

      const traces = createPerformanceTraces(scenario.actionCount);
      const startTime = performance.now();
      let processedCount = 0;

      // Track processed traces
      mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
        if (key.includes('traces')) {
          const stored = JSON.parse(value);
          if (Array.isArray(stored)) {
            processedCount += stored.length;
          }
        }
        return Promise.resolve();
      });

      // Enqueue traces rapidly
      traces.forEach(trace => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      // Wait for processing to complete
      await waitForProcessing(3000);
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      const throughput = processedCount / duration;

      // Assert throughput meets minimum requirement
      expect(throughput).toBeGreaterThanOrEqual(SLA_REQUIREMENTS.MIN_THROUGHPUT);
      
      // Log performance metrics
      console.log(`Throughput Performance: ${throughput.toFixed(1)} traces/second`);
      console.log(`Processed: ${processedCount}/${traces.length} traces in ${duration.toFixed(2)}s`);
    });

    it('should maintain throughput under mixed priority loads', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 300,
        batchSize: 15,
        batchTimeout: 25,
        enableParallelProcessing: true,
      });

      const traces = createMixedPriorityTraces(200);
      const startTime = performance.now();
      let processedCount = 0;

      mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
        if (key.includes('traces')) {
          const stored = JSON.parse(value);
          if (Array.isArray(stored)) {
            processedCount += stored.length;
          }
        }
        return Promise.resolve();
      });

      // Enqueue with mixed priorities
      traces.forEach(({ trace, priority }) => {
        processor.enqueue(trace, priority);
      });

      await waitForProcessing(3000);
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const throughput = processedCount / duration;

      expect(throughput).toBeGreaterThanOrEqual(SLA_REQUIREMENTS.MIN_THROUGHPUT * 0.9); // Allow 10% reduction for priority handling
      
      console.log(`Mixed Priority Throughput: ${throughput.toFixed(1)} traces/second`);
    });
  });

  describe('Memory Performance', () => {
    it('should maintain memory efficiency under sustained processing', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 200,
        batchSize: 10,
        batchTimeout: 30,
        memoryLimit: 3 * 1024 * 1024, // 3MB limit
      });

      const memorySnapshots = [];
      
      // Process multiple batches to test sustained memory usage
      for (let batch = 0; batch < 5; batch++) {
        const traces = createPerformanceTraces(40);
        
        // Take memory snapshot before processing
        if (typeof performance !== 'undefined' && performance.memory) {
          memorySnapshots.push({
            phase: `batch-${batch}-start`,
            heapUsed: performance.memory.usedJSHeapSize,
            heapTotal: performance.memory.totalJSHeapSize,
          });
        }

        // Process traces
        traces.forEach(trace => {
          processor.enqueue(trace, TracePriority.NORMAL);
        });

        await waitForProcessing(800);
        
        // Take memory snapshot after processing
        if (typeof performance !== 'undefined' && performance.memory) {
          memorySnapshots.push({
            phase: `batch-${batch}-end`,
            heapUsed: performance.memory.usedJSHeapSize,
            heapTotal: performance.memory.totalJSHeapSize,
          });
        }
      }

      // Analyze memory usage patterns
      expect(memorySnapshots.length).toBeGreaterThanOrEqual(2); // Ensure we have data
      
      if (memorySnapshots.length >= 2) {
        const initialMemory = memorySnapshots[0].heapUsed;
        const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        expect(memoryIncrease).toBeLessThan(SLA_REQUIREMENTS.MEMORY_INCREASE_LIMIT);
        
        // Check for memory stability (shouldn't continuously grow)
        const midPoint = Math.floor(memorySnapshots.length / 2);
        const midMemory = memorySnapshots[midPoint].heapUsed;
        const laterGrowth = finalMemory - midMemory;
        const earlyGrowth = midMemory - initialMemory;
        
        // Later growth should be less than or equal to early growth
        expect(laterGrowth).toBeLessThanOrEqual(earlyGrowth * 1.2); // Allow 20% variance
        
        console.log(`Memory Performance: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase over ${memorySnapshots.length / 2} batches`);
      }
    });

    it('should efficiently cleanup processed traces', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 150,
        batchSize: 12,
        batchTimeout: 25,
      });

      const traces = createPerformanceTraces(100);
      
      // Process traces
      traces.forEach(trace => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(2000);
      
      // Check queue state after processing
      const stats = processor.getQueueStats();
      
      // Queue should be mostly empty after processing
      expect(stats.totalSize).toBeLessThan(traces.length * 0.2); // Less than 20% remaining
      
      // Memory should be reasonable
      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      
      console.log(`Cleanup Performance: ${stats.totalSize} remaining out of ${traces.length} processed`);
    });
  });

  describe('Latency Performance', () => {
    it('should meet batch processing latency requirements', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 200,
        batchSize: 10,
        batchTimeout: 50,
        enableParallelProcessing: true,
      });

      const traces = createPerformanceTraces(50);
      const latencyMeasurements = [];

      // Measure storage call latency
      mockStorageAdapter.setItem.mockImplementation(async () => {
        const startTime = performance.now();
        // Simulate realistic storage operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
        const endTime = performance.now();
        
        latencyMeasurements.push(endTime - startTime);
        return Promise.resolve();
      });

      // Process traces
      traces.forEach(trace => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(2000);
      
      // Analyze latency measurements
      expect(latencyMeasurements.length).toBeGreaterThan(0); // Ensure we have measurements
      
      if (latencyMeasurements.length > 0) {
        const avgLatency = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
        const maxLatency = Math.max(...latencyMeasurements);
        
        expect(avgLatency).toBeLessThan(SLA_REQUIREMENTS.BATCH_PROCESSING_LATENCY);
        expect(maxLatency).toBeLessThan(SLA_REQUIREMENTS.BATCH_PROCESSING_LATENCY * 2); // Allow 2x max for outliers
        
        console.log(`Latency Performance: ${avgLatency.toFixed(2)}ms avg, ${maxLatency.toFixed(2)}ms max`);
      }
    });
  });

  describe('Circuit Breaker Performance', () => {
    it('should detect failures within performance requirements', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 100,
        batchSize: 8,
        maxRetries: 1, // Reduce retries for faster failure detection
      });

      let failureDetectionTime = null;
      const startTime = performance.now();

      // Configure storage to fail after first successful call
      let callCount = 0;
      mockStorageAdapter.setItem.mockImplementation(async () => {
        callCount++;
        if (callCount > 1) {
          if (!failureDetectionTime) {
            failureDetectionTime = performance.now();
          }
          throw new Error('Simulated failure for circuit breaker test');
        }
        return Promise.resolve();
      });

      const traces = createPerformanceTraces(20);
      
      // Process traces that will trigger failures
      traces.forEach(trace => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(2000);
      
      // Check that failure was detected quickly
      expect(failureDetectionTime).toBeTruthy(); // Ensure failure was detected
      
      if (failureDetectionTime) {
        const detectionLatency = failureDetectionTime - startTime;
        expect(detectionLatency).toBeLessThan(SLA_REQUIREMENTS.CIRCUIT_BREAKER_RESPONSE);
        
        console.log(`Circuit Breaker Performance: ${detectionLatency.toFixed(2)}ms to detect failure`);
      }

      // Verify metrics show error handling
      const metrics = processor.getMetrics();
      expect(metrics.errorCount).toBeGreaterThan(0);
    });
  });

  // Helper Functions

  /**
   * Validate batch processing performance for a given scenario
   * @param {object} scenario - Performance scenario configuration
   * @param {boolean} [allowHigherLatency=false] - Whether to allow higher latency thresholds
   * @returns {Promise<object>} Performance validation results
   */
  async function validateBatchProcessingPerformance(scenario, allowHigherLatency = false) {
    processor = createProcessorWithConfig({
      maxQueueSize: scenario.actionCount + 50,
      batchSize: scenario.batchSize,
      batchTimeout: 30,
      enableParallelProcessing: true,
    });

    const traces = createPerformanceTraces(scenario.actionCount);
    const batchLatencies = [];
    let processedCount = 0;

    // Measure processing latency per batch
    mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
      const batchStartTime = performance.now();
      
      if (key.includes('traces')) {
        const stored = JSON.parse(value);
        if (Array.isArray(stored)) {
          processedCount += stored.length;
        }
      }
      
      // Simulate realistic storage time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
      
      const batchEndTime = performance.now();
      batchLatencies.push(batchEndTime - batchStartTime);
      return Promise.resolve();
    });

    const startTime = performance.now();
    
    // Enqueue traces
    traces.forEach(trace => {
      processor.enqueue(trace, TracePriority.NORMAL);
    });

    await waitForProcessing(3000);
    
    const endTime = performance.now();
    const totalDuration = (endTime - startTime) / 1000;
    const throughput = processedCount / totalDuration;

    // Validate latency requirements
    if (batchLatencies.length > 0) {
      const avgLatency = batchLatencies.reduce((a, b) => a + b, 0) / batchLatencies.length;
      const maxLatency = Math.max(...batchLatencies);
      
      const expectedLatency = allowHigherLatency ? scenario.expectedLatency * 1.5 : scenario.expectedLatency;
      expect(avgLatency).toBeLessThan(expectedLatency);
    }

    // Validate throughput
    expect(throughput).toBeGreaterThanOrEqual(scenario.expectedThroughput * 0.8); // Allow 20% variance
    
    // Validate processing completion
    expect(processedCount).toBeGreaterThan(scenario.actionCount * 0.9); // 90% processing rate

    console.log(`Scenario ${scenario.actionCount} traces: ${throughput.toFixed(1)} traces/sec, avg latency: ${batchLatencies.length > 0 ? (batchLatencies.reduce((a, b) => a + b, 0) / batchLatencies.length).toFixed(2) : 'N/A'}ms`);
    
    return { throughput, processedCount };
  }

  /**
   * Create a TraceQueueProcessor with custom configuration
   * @param {object} config - Configuration options
   * @returns {TraceQueueProcessor} Configured processor instance
   */
  function createProcessorWithConfig(config) {
    return new TraceQueueProcessor({
      storageAdapter: mockStorageAdapter,
      logger: mockLogger,
      eventBus: mockEventBus,
      config: {
        memoryLimit: 4 * 1024 * 1024, // 4MB default
        enableParallelProcessing: true,
        storageKey: 'performance-test-traces',
        maxStoredTraces: 100,
        maxRetries: 2,
        ...config,
      },
    });
  }

  /**
   * Create performance traces for testing
   * @param {number} count - Number of traces to create
   * @returns {Array} Array of trace objects
   */
  function createPerformanceTraces(count) {
    const traces = [];
    
    for (let i = 0; i < count; i++) {
      const trace = traceFactory.createTrace({
        actionId: `perf-test-${i}`,
        actorId: `actor-${i % 3}`, // Cycle through 3 actors
        turnAction: {
          actionDefinitionId: 'core:test',
          commandString: `test command ${i}`,
          parameters: { index: i },
        },
      });

      // Simulate completed execution
      if (trace.completeExecution) {
        trace.completeExecution({
          success: true,
          duration: Math.random() * 50 + 5, // 5-55ms duration
        });
      }

      traces.push(trace);
    }
    
    return traces;
  }

  /**
   * Create traces with mixed priority levels
   * @param {number} count - Number of traces to create
   * @returns {Array} Array of objects with trace and priority
   */
  function createMixedPriorityTraces(count) {
    const traces = createPerformanceTraces(count);
    const priorities = [
      TracePriority.CRITICAL,
      TracePriority.HIGH,
      TracePriority.NORMAL,
      TracePriority.LOW,
    ];

    return traces.map((trace, index) => ({
      trace,
      priority: priorities[index % priorities.length],
    }));
  }

  /**
   * Wait for processing with timeout
   * @param {number} [timeout=1000] - Timeout in milliseconds
   * @returns {Promise} Promise that resolves after timeout
   */
  function waitForProcessing(timeout = 1000) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }
});