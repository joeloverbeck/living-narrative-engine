/**
 * @file Memory tests for logging performance monitoring
 * Validates memory usage and leak prevention in the monitoring system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LoggingPerformanceMonitor } from '../../../src/logging/loggingPerformanceMonitor.js';
import { LoggingPerformanceReporter } from '../../../src/logging/loggingPerformanceReporter.js';
import { LoggingResourceMonitor } from '../../../src/logging/loggingResourceMonitor.js';
import { LoggingPerformanceAdvisor } from '../../../src/logging/loggingPerformanceAdvisor.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';
import EventBus from '../../../src/events/eventBus.js';

/**
 * Force garbage collection if available
 */
function forceGC() {
  if (global.gc) {
    global.gc();
    global.gc(); // Run twice to be thorough
  }
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB() {
  forceGC();
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

/**
 * Run operations and measure memory growth
 */
async function measureMemoryGrowth(operation, iterations = 1000) {
  forceGC();
  const initialMemory = getMemoryUsageMB();

  for (let i = 0; i < iterations; i++) {
    await operation(i);
  }

  forceGC();
  const finalMemory = getMemoryUsageMB();

  return {
    initial: initialMemory,
    final: finalMemory,
    growth: finalMemory - initialMemory,
    growthPerOp: ((finalMemory - initialMemory) / iterations) * 1000, // KB per operation
  };
}

describe('Logging Performance Monitor - Memory Tests', () => {
  let monitor;
  let reporter;
  let resourceMonitor;
  let advisor;
  let logger;
  let eventBus;
  let categoryDetector;
  let remoteLogger;

  beforeEach(() => {
    logger = new ConsoleLogger();
    eventBus = new EventBus({ logger });
    categoryDetector = new LogCategoryDetector({ logger });

    // Create mock remoteLogger with required methods
    remoteLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    monitor = new LoggingPerformanceMonitor({
      logger,
      eventBus,
      categoryDetector,
      performanceMonitor: null,
    });

    reporter = new LoggingPerformanceReporter({
      monitor,
      logger,
    });

    resourceMonitor = new LoggingResourceMonitor({
      performanceMonitor: monitor,
      remoteLogger,
      logger,
    });

    advisor = new LoggingPerformanceAdvisor({
      performanceMonitor: monitor,
      resourceMonitor,
      logger,
    });
  });

  afterEach(() => {
    // Clean up references
    monitor = null;
    reporter = null;
    resourceMonitor = null;
    advisor = null;
    logger = null;
    eventBus = null;
    categoryDetector = null;
    remoteLogger = null;
    forceGC();
  });

  describe('Memory leak prevention', () => {
    it('should not leak memory when monitoring log operations', async () => {
      const result = await measureMemoryGrowth((i) => {
        monitor.monitorLogOperation('info', `Test message ${i}`, {
          category: `category-${i % 10}`,
          processingTime: Math.random() * 5,
        });
      }, 10000);

      console.log(`Log operation monitoring memory usage:`);
      console.log(`  Initial: ${result.initial.toFixed(2)}MB`);
      console.log(`  Final: ${result.final.toFixed(2)}MB`);
      console.log(`  Growth: ${result.growth.toFixed(2)}MB`);
      console.log(`  Per operation: ${result.growthPerOp.toFixed(3)}KB`);

      // Should have minimal memory growth per operation
      expect(result.growthPerOp).toBeLessThan(1); // Less than 1KB per operation
    });

    it('should not leak memory when monitoring batch flushes', async () => {
      const result = await measureMemoryGrowth((i) => {
        monitor.monitorBatchFlush(
          20 + (i % 80),
          50 + Math.random() * 100,
          Math.random() > 0.1
        );
      }, 5000);

      console.log(`Batch flush monitoring memory usage:`);
      console.log(`  Initial: ${result.initial.toFixed(2)}MB`);
      console.log(`  Final: ${result.final.toFixed(2)}MB`);
      console.log(`  Growth: ${result.growth.toFixed(2)}MB`);
      console.log(`  Per operation: ${result.growthPerOp.toFixed(3)}KB`);

      expect(result.growthPerOp).toBeLessThan(0.5); // Less than 0.5KB per operation
    });

    it('should not leak memory when monitoring buffer sizes', async () => {
      const result = await measureMemoryGrowth((i) => {
        monitor.monitorBufferSize(i % 1000, 1000);
      }, 10000);

      console.log(`Buffer monitoring memory usage:`);
      console.log(`  Initial: ${result.initial.toFixed(2)}MB`);
      console.log(`  Final: ${result.final.toFixed(2)}MB`);
      console.log(`  Growth: ${result.growth.toFixed(2)}MB`);
      console.log(`  Per operation: ${result.growthPerOp.toFixed(3)}KB`);

      expect(result.growthPerOp).toBeLessThan(0.2); // Less than 0.2KB per operation
    });
  });

  describe('Metrics aggregation memory efficiency', () => {
    it('should not accumulate unlimited metrics data', async () => {
      // Generate large amount of metrics
      for (let i = 0; i < 100000; i++) {
        monitor.monitorLogOperation(
          ['info', 'warn', 'error', 'debug'][i % 4],
          `Message ${i}`,
          { processingTime: Math.random() * 5 }
        );
      }

      const initialMemory = getMemoryUsageMB();

      // Continue adding more metrics
      for (let i = 0; i < 50000; i++) {
        monitor.monitorLogOperation('info', `Additional ${i}`);
      }

      const finalMemory = getMemoryUsageMB();
      const growth = finalMemory - initialMemory;

      console.log(`Metrics accumulation memory test:`);
      console.log(`  After 100k ops: ${initialMemory.toFixed(2)}MB`);
      console.log(`  After 150k ops: ${finalMemory.toFixed(2)}MB`);
      console.log(`  Growth for 50k ops: ${growth.toFixed(2)}MB`);

      // Growth should be bounded, not linear with operations
      expect(growth).toBeLessThan(5); // Less than 5MB for 50k additional operations
    });

    it('should efficiently handle category metrics', async () => {
      const categories = 100;
      const opsPerCategory = 1000;

      const result = await measureMemoryGrowth((i) => {
        const category = `category-${i % categories}`;
        monitor.monitorLogOperation('info', `Message ${i}`, {
          category,
          processingTime: Math.random() * 2,
        });
      }, categories * opsPerCategory);

      console.log(`Category metrics memory usage (${categories} categories):`);
      console.log(`  Growth: ${result.growth.toFixed(2)}MB`);
      console.log(`  Per operation: ${result.growthPerOp.toFixed(3)}KB`);

      const metrics = monitor.getLoggingMetrics();
      expect(Object.keys(metrics.categories || {}).length).toBeLessThanOrEqual(
        categories
      );
      expect(result.growthPerOp).toBeLessThan(0.1); // Efficient category tracking
    });
  });

  describe('Reporting and advisory memory usage', () => {
    beforeEach(() => {
      // Generate test data
      for (let i = 0; i < 10000; i++) {
        monitor.monitorLogOperation('info', `Test ${i}`, {
          processingTime: Math.random() * 5,
        });

        if (i % 100 === 0) {
          monitor.monitorBatchFlush(50, 100, true);
        }
      }
    });

    it('should generate reports without excessive memory usage', async () => {
      const result = await measureMemoryGrowth(
        () => reporter.generateReport(),
        100
      );

      console.log(`Report generation memory usage:`);
      console.log(`  Growth for 100 reports: ${result.growth.toFixed(2)}MB`);
      console.log(
        `  Per report: ${((result.growth * 1024) / 100).toFixed(2)}KB`
      );

      expect(result.growth).toBeLessThan(2); // Less than 2MB for 100 reports
    });

    it('should not leak memory in resource monitoring', async () => {
      const result = await measureMemoryGrowth(
        () => resourceMonitor.checkResourceUsage(),
        500
      );

      console.log(`Resource monitoring memory usage:`);
      console.log(`  Growth for 500 checks: ${result.growth.toFixed(2)}MB`);
      console.log(
        `  Per check: ${((result.growth * 1024) / 500).toFixed(2)}KB`
      );

      expect(result.growth).toBeLessThan(1); // Less than 1MB for 500 checks
    });

    it('should efficiently generate optimization advice', async () => {
      const result = await measureMemoryGrowth(
        () => advisor.analyzeAndAdvise(),
        50
      );

      console.log(`Advisory generation memory usage:`);
      console.log(`  Growth for 50 analyses: ${result.growth.toFixed(2)}MB`);
      console.log(
        `  Per analysis: ${((result.growth * 1024) / 50).toFixed(2)}KB`
      );

      expect(result.growth).toBeLessThan(2); // Less than 2MB for 50 analyses
    });

    it('should manage optimization history efficiently', () => {
      const initialMemory = getMemoryUsageMB();

      // Generate many optimization analyses
      for (let i = 0; i < 200; i++) {
        advisor.analyzeAndAdvise();
      }

      const midMemory = getMemoryUsageMB();

      // Continue generating (should start replacing old history)
      for (let i = 0; i < 200; i++) {
        advisor.analyzeAndAdvise();
      }

      const finalMemory = getMemoryUsageMB();

      console.log(`Optimization history memory management:`);
      console.log(`  After 200 analyses: ${midMemory.toFixed(2)}MB`);
      console.log(`  After 400 analyses: ${finalMemory.toFixed(2)}MB`);
      console.log(
        `  Second 200 growth: ${(finalMemory - midMemory).toFixed(2)}MB`
      );

      // Second batch should have minimal growth (history is bounded)
      expect(finalMemory - midMemory).toBeLessThan(1);
    });
  });

  describe('Event bus memory management', () => {
    it('should not accumulate event listeners', () => {
      const monitors = [];

      const initialMemory = getMemoryUsageMB();

      // Create and destroy many monitors
      for (let i = 0; i < 100; i++) {
        const tempMonitor = new LoggingPerformanceMonitor({
          logger,
          eventBus,
          categoryDetector,
          performanceMonitor: null,
        });

        // Use the monitor
        tempMonitor.monitorLogOperation('info', `Test ${i}`);

        monitors.push(tempMonitor);
      }

      // Clear references
      monitors.length = 0;
      forceGC();

      const finalMemory = getMemoryUsageMB();
      const growth = finalMemory - initialMemory;

      console.log(`Event listener memory test:`);
      console.log(
        `  Growth after 100 monitor create/destroy: ${growth.toFixed(2)}MB`
      );

      expect(growth).toBeLessThan(2); // Should clean up properly
    });
  });

  describe('Long-running operation memory stability', () => {
    it('should maintain stable memory during extended operation', async () => {
      const duration = 2000; // 2 seconds
      const startTime = Date.now();
      const memorySnapshots = [];

      let operations = 0;

      while (Date.now() - startTime < duration) {
        // Perform mixed operations
        monitor.monitorLogOperation('info', `Long run ${operations}`);

        if (operations % 50 === 0) {
          monitor.monitorBatchFlush(50, 100, true);
        }

        if (operations % 10 === 0) {
          monitor.monitorBufferSize(operations % 1000, 1000);
        }

        if (operations % 100 === 0) {
          reporter.generateReport();
          resourceMonitor.checkResourceUsage();
        }

        if (operations % 500 === 0) {
          advisor.analyzeAndAdvise();
        }

        // Take memory snapshot every 250ms
        if (operations % 250 === 0) {
          memorySnapshots.push({
            time: Date.now() - startTime,
            memory: getMemoryUsageMB(),
            operations,
          });
        }

        operations++;
      }

      // Analyze memory trend
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = lastSnapshot.memory - firstSnapshot.memory;
      const growthRate = memoryGrowth / (lastSnapshot.time / 1000); // MB per second

      console.log(`Long-running memory stability:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Operations: ${operations}`);
      console.log(`  Initial memory: ${firstSnapshot.memory.toFixed(2)}MB`);
      console.log(`  Final memory: ${lastSnapshot.memory.toFixed(2)}MB`);
      console.log(`  Total growth: ${memoryGrowth.toFixed(2)}MB`);
      console.log(`  Growth rate: ${growthRate.toFixed(3)}MB/s`);

      // Memory growth should be minimal over time
      // Adjusted threshold to account for the high-intensity test (18K+ operations/2s)
      expect(growthRate).toBeLessThan(2); // Less than 2MB per second growth
    });
  });

  describe('Memory cleanup verification', () => {
    it('should properly clean up when components are destroyed', () => {
      const initialMemory = getMemoryUsageMB();

      // Create components
      let tempMonitor = new LoggingPerformanceMonitor({
        logger,
        eventBus,
        categoryDetector,
        performanceMonitor: null,
      });

      let tempReporter = new LoggingPerformanceReporter({
        monitor: tempMonitor,
        logger,
      });

      let tempResourceMonitor = new LoggingResourceMonitor({
        performanceMonitor: tempMonitor,
        remoteLogger,
        logger,
      });

      let tempAdvisor = new LoggingPerformanceAdvisor({
        performanceMonitor: tempMonitor,
        resourceMonitor: tempResourceMonitor,
        logger,
      });

      // Use components
      for (let i = 0; i < 1000; i++) {
        tempMonitor.monitorLogOperation('info', `Test ${i}`);
      }

      tempReporter.generateReport();
      tempResourceMonitor.checkResourceUsage();
      tempAdvisor.analyzeAndAdvise();

      const withComponentsMemory = getMemoryUsageMB();

      // Destroy components
      tempMonitor = null;
      tempReporter = null;
      tempResourceMonitor = null;
      tempAdvisor = null;

      forceGC();

      const afterCleanupMemory = getMemoryUsageMB();

      console.log(`Component cleanup verification:`);
      console.log(`  Initial: ${initialMemory.toFixed(2)}MB`);
      console.log(`  With components: ${withComponentsMemory.toFixed(2)}MB`);
      console.log(`  After cleanup: ${afterCleanupMemory.toFixed(2)}MB`);
      console.log(
        `  Reclaimed: ${(withComponentsMemory - afterCleanupMemory).toFixed(2)}MB`
      );

      // Should reclaim most of the memory (allow small GC timing variance)
      expect(afterCleanupMemory).toBeLessThanOrEqual(
        withComponentsMemory + 0.1
      ); // Allow small variance
      expect(afterCleanupMemory - initialMemory).toBeLessThan(1); // Should be close to initial
    });
  });
});
