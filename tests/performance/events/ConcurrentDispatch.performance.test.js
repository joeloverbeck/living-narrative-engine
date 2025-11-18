/**
 * @file Concurrent Event Dispatch Performance Test
 * @description Performance benchmarks for concurrent event dispatch scenarios in the Living Narrative Engine.
 * Tests throughput, latency, and scalability under concurrent load.
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import {
  ENTITY_CREATED_ID,
  COMPONENT_ADDED_ID,
  ACTION_DECIDED_ID,
} from '../../../src/constants/eventIds.js';

/**
 * Performance profiler for concurrent operations
 */
class ConcurrencyPerformanceProfiler {
  constructor() {
    this.metrics = {
      dispatchLatencies: [],
      handlerLatencies: [],
      memorySnapshots: [],
      cpuSnapshots: [],
    };
  }

  recordDispatchLatency(startTime, endTime) {
    const latency = endTime - startTime;
    this.metrics.dispatchLatencies.push(latency);
  }

  recordHandlerLatency(duration) {
    this.metrics.handlerLatencies.push(duration);
  }

  takeMemorySnapshot() {
    // Browser-compatible memory snapshot (limited information)
    // Note: Browsers don't expose detailed memory usage
    this.metrics.memorySnapshots.push({
      timestamp: Date.now(),
      // Browser performance timing (limited memory information)
      performance: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null,
    });
  }

  calculateStatistics() {
    const stats = {
      dispatch: this.calculateLatencyStats(this.metrics.dispatchLatencies),
      handler: this.calculateLatencyStats(this.metrics.handlerLatencies),
      memory: this.calculateMemoryStats(),
    };
    return stats;
  }

  calculateLatencyStats(latencies) {
    if (latencies.length === 0) return null;

    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  calculateMemoryStats() {
    if (this.metrics.memorySnapshots.length < 2) return null;

    // Browser-compatible memory stats (limited information)
    const snapshots = this.metrics.memorySnapshots.filter(s => s.performance);
    if (snapshots.length < 2) return null;

    const first = snapshots[0].performance;
    const last = snapshots[snapshots.length - 1].performance;

    return {
      heapGrowth: last.usedJSHeapSize - first.usedJSHeapSize,
      heapGrowthPercent: ((last.usedJSHeapSize - first.usedJSHeapSize) / first.usedJSHeapSize) * 100,
      peakHeap: Math.max(...snapshots.map(s => s.performance.usedJSHeapSize)),
      avgHeap: snapshots.reduce((sum, s) => sum + s.performance.usedJSHeapSize, 0) / snapshots.length,
    };
  }
}

describe('Concurrent Event Dispatch Performance', () => {
  let eventBus;
  let logger;
  let profiler;
  let performanceTestBed;
  let performanceTracker;

  beforeEach(() => {
    // Create fresh instances for each test
    logger = new ConsoleLogger('ERROR'); // Reduce logging overhead for performance tests

    // For performance testing, we focus on the core EventBus functionality
    eventBus = new EventBus({ logger });

    profiler = new ConcurrencyPerformanceProfiler();
    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
  });

  afterEach(() => {
    // Clean up
    if (profiler) {
      profiler = null;
    }
  });

  describe('Performance Under Concurrent Load', () => {
    it('should maintain acceptable performance with 100 concurrent events', async () => {
      // Arrange
      const eventCount = 100;
      const performanceThresholds = {
        totalDuration: 1000, // ms (more conservative for browser)
        avgLatency: 100, // ms (more conservative for browser)
        p95Latency: 200, // ms (more conservative for browser)
      };

      // Setup lightweight handlers
      let processedCount = 0;
      eventBus.subscribe('*', () => {
        processedCount++;
      });

      const dispatchers = [];
      for (let i = 0; i < eventCount; i++) {
        const eventType = i % 2 === 0 ? ENTITY_CREATED_ID : COMPONENT_ADDED_ID;
        dispatchers.push(() => {
          const start = performance.now();
          return eventBus.dispatch(eventType, { index: i }).then(() => {
            const end = performance.now();
            profiler.recordDispatchLatency(start, end);
          });
        });
      }

      // Act
      const startTime = Date.now();
      await Promise.all(dispatchers.map(d => d()));
      const totalDuration = Date.now() - startTime;

      // Assert
      const stats = profiler.calculateStatistics();

      expect(totalDuration).toBeLessThan(performanceThresholds.totalDuration);
      expect(stats.dispatch.mean).toBeLessThan(performanceThresholds.avgLatency);
      expect(stats.dispatch.p95).toBeLessThan(performanceThresholds.p95Latency);
      expect(processedCount).toBe(eventCount);

      // Log performance metrics for monitoring
      console.log('Performance metrics:', {
        totalDuration,
        eventCount,
        throughput: (eventCount / totalDuration) * 1000, // events per second
        avgLatency: stats.dispatch.mean,
        p95Latency: stats.dispatch.p95,
      });
    });

    it('should scale linearly with event count', async () => {
      // Arrange
      const testCases = [10, 20, 40, 80];
      const timings = [];

      // Act
      for (const count of testCases) {
        const dispatchers = [];
        for (let i = 0; i < count; i++) {
          dispatchers.push(() => eventBus.dispatch(ACTION_DECIDED_ID, { index: i }));
        }

        const startTime = performance.now();
        await Promise.all(dispatchers.map(d => d()));
        const endTime = performance.now();

        const durationMs = endTime - startTime;
        timings.push({ count, duration: durationMs });
      }

      // Assert - check that performance doesn't degrade exponentially
      // Browser environments may have inconsistent timing at small scales
      const EPSILON_MS = 5; // Stabilise ratios when timings are extremely small

      for (let i = 1; i < timings.length; i++) {
        const previous = timings[i - 1];
        const current = timings[i];
        const countRatio = current.count / previous.count;

        const previousDuration = previous.duration + EPSILON_MS;
        const currentDuration = current.duration + EPSILON_MS;
        const durationRatio = currentDuration / previousDuration;

        // Compare normalised per-event cost to detect real non-linear scaling while
        // remaining tolerant of event loop jitter when the absolute timings are tiny.
        const previousPerEvent = previousDuration / previous.count;
        const currentPerEvent = currentDuration / current.count;
        const perEventRatio = currentPerEvent / previousPerEvent;

        // Time should not scale exponentially (within generous bounds for browser timing)
        // Allow for more variance due to browser event loop scheduling
        expect(durationRatio).toBeLessThan(countRatio * 10);
        expect(perEventRatio).toBeLessThan(5);
      }
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve target throughput for simple event dispatch', async () => {
      // Arrange
      const targetThroughput = 500; // events per second (conservative for browser)
      const testDurationMs = 1000;
      const expectedEvents = Math.floor(targetThroughput * (testDurationMs / 1000));

      const benchmark = performanceTracker.startBenchmark('Simple Event Throughput');

      let dispatchedCount = 0;
      const startTime = performance.now();

      // Act - dispatch as many events as possible within time limit
      while (performance.now() - startTime < testDurationMs && dispatchedCount < expectedEvents * 2) {
        await eventBus.dispatch(ENTITY_CREATED_ID, {
          index: dispatchedCount,
          timestamp: Date.now()
        });
        dispatchedCount++;
      }

      const actualDuration = performance.now() - startTime;
      const actualThroughput = (dispatchedCount / actualDuration) * 1000;

      benchmark.end();

      // Assert
      expect(actualThroughput).toBeGreaterThan(targetThroughput * 0.8); // Allow 20% margin

      console.log('Throughput benchmark:', {
        dispatchedCount,
        durationMs: actualDuration,
        throughput: actualThroughput,
        targetThroughput,
        percentOfTarget: (actualThroughput / targetThroughput) * 100,
      });
    });

    it('should handle burst patterns efficiently', async () => {
      // Arrange
      const burstSize = 50;
      const burstCount = 10;
      const interBurstDelayMs = 10;

      const benchmark = performanceTracker.startBenchmark('Burst Pattern Performance');

      const burstTimings = [];

      // Act - simulate burst pattern
      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = performance.now();

        const promises = [];
        for (let i = 0; i < burstSize; i++) {
          promises.push(eventBus.dispatch(COMPONENT_ADDED_ID, {
            burstId: burst,
            eventId: i,
          }));
        }

        await Promise.all(promises);
        const burstDuration = performance.now() - burstStart;
        burstTimings.push(burstDuration);

        // Inter-burst delay
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, interBurstDelayMs));
        }
      }

      benchmark.end();

      // Assert - burst handling should be consistent
      const avgBurstTime = burstTimings.reduce((a, b) => a + b, 0) / burstTimings.length;
      const maxBurstTime = Math.max(...burstTimings);
      const minBurstTime = Math.min(...burstTimings);

      // Variance threshold increased to 15x to account for burst scheduling jitter in CI environments.
      // This aligns with other performance suites that allow wider variance under heavy load.
      expect(maxBurstTime / minBurstTime).toBeLessThan(15);

      // Also ensure absolute performance is acceptable - no burst should be too slow
      expect(maxBurstTime).toBeLessThan(100); // Maximum 100ms for any single burst

      console.log('Burst pattern performance:', {
        avgBurstTime,
        maxBurstTime,
        minBurstTime,
        totalEvents: burstSize * burstCount,
        avgThroughput: (burstSize / avgBurstTime) * 1000,
      });
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during sustained concurrent dispatch', async () => {
      // Arrange
      const iterations = 5;
      const eventsPerIteration = 100;
      const memoryGrowthThreshold = 10; // MB

      profiler.takeMemorySnapshot(); // Initial snapshot

      // Act
      for (let iter = 0; iter < iterations; iter++) {
        const promises = [];
        for (let i = 0; i < eventsPerIteration; i++) {
          promises.push(eventBus.dispatch(ENTITY_CREATED_ID, {
            iteration: iter,
            index: i,
            data: new Array(100).fill(i), // Some payload to stress memory
          }));
        }

        await Promise.all(promises);

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 50));

        profiler.takeMemorySnapshot();
      }

      // Assert
      const memoryStats = profiler.calculateMemoryStats();

      if (memoryStats) {
        // Only check if memory API is available
        const growthMB = memoryStats.heapGrowth / (1024 * 1024);

        // Memory growth should be reasonable
        expect(growthMB).toBeLessThan(memoryGrowthThreshold);

        console.log('Memory usage stats:', {
          heapGrowthMB: growthMB,
          heapGrowthPercent: memoryStats.heapGrowthPercent,
          peakHeapMB: memoryStats.peakHeap / (1024 * 1024),
          avgHeapMB: memoryStats.avgHeap / (1024 * 1024),
        });
      } else {
        console.log('Memory profiling not available in this environment');
      }
    });
  });
});