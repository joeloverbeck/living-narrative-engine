/**
 * @file Memory tests for CentralErrorHandler
 * @description Tests memory management and registry cleanup of the CentralErrorHandler class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';

describe('CentralErrorHandler - Memory Tests', () => {
  // Extended timeout for memory stabilization
  jest.setTimeout(120000); // 2 minutes

  let testBed;
  let mockLogger;
  let mockEventBus;
  let monitoringCoordinator;
  let centralErrorHandler;

  beforeEach(async () => {
    testBed = createTestBed();

    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', [
      'dispatch',
      'subscribe',
    ]);

    // Create real MonitoringCoordinator instance
    monitoringCoordinator = new MonitoringCoordinator({
      logger: mockLogger,
      enabled: true,
      checkInterval: 1000,
    });

    centralErrorHandler = new CentralErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      monitoringCoordinator,
    });

    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    if (monitoringCoordinator) {
      monitoringCoordinator.close();
      monitoringCoordinator = null;
    }
    if (centralErrorHandler) {
      centralErrorHandler = null;
    }
    mockLogger = null;
    mockEventBus = null;
    testBed.cleanup();

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Memory Management', () => {
    it('should properly manage memory with registry cleanup', async () => {
      // Add pre-test stabilization
      await global.memoryTestUtils.addPreTestStabilization();

      // Get initial memory baseline
      const initialMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Create more errors than registry limit to test cleanup
      const errorCount = 1200;
      for (let i = 0; i < errorCount; i++) {
        try {
          await centralErrorHandler.handle(new Error(`Memory test error ${i}`));
        } catch {
          // Expected to throw, ignore
        }
      }

      // Force GC and wait for memory stabilization
      await global.memoryTestUtils.forceGCAndWait();

      // Verify metrics
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(errorCount);
      expect(metrics.registrySize).toBeLessThanOrEqual(1000); // Registry should be capped

      // Clear metrics to test cleanup
      centralErrorHandler.clearMetrics();

      const clearedMetrics = centralErrorHandler.getMetrics();
      expect(clearedMetrics.totalErrors).toBe(0);
      expect(clearedMetrics.registrySize).toBe(0);

      // Get final memory after cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Memory growth should be minimal (less than 10MB)
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      // Use adaptive thresholds for CI environments
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 10,
        MEMORY_GROWTH_LIMIT_PERCENT: 50,
      });

      // Assert memory growth is within acceptable limits
      await global.memoryTestUtils.assertMemoryWithRetry(
        async () => finalMemory - initialMemory,
        thresholds.MAX_MEMORY_MB,
        6
      );

      console.log(
        `Memory growth after ${errorCount} errors: ${memoryGrowthMB.toFixed(2)}MB`
      );
    });

    it('should not leak memory when handling recoverable errors', async () => {
      // Add pre-test stabilization
      await global.memoryTestUtils.addPreTestStabilization();

      // Register a simple recovery strategy
      centralErrorHandler.registerRecoveryStrategy(
        'RecoverableError',
        async () => {
          return 'recovered';
        }
      );

      class RecoverableError extends Error {
        constructor(message) {
          super(message);
          this.name = 'RecoverableError';
        }
        isRecoverable() {
          return true;
        }
      }

      // Get initial memory baseline
      const initialMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Process many recoverable errors
      const errorCount = 500;
      for (let i = 0; i < errorCount; i++) {
        const error = new RecoverableError(`Recoverable error ${i}`);
        try {
          await centralErrorHandler.handle(error);
        } catch {
          // May throw enhanced error, ignore
        }
      }

      // Force GC and get final memory
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Assert memory growth percentage is acceptable
      global.memoryTestUtils.assertMemoryGrowthPercentage(
        initialMemory,
        finalMemory,
        30, // 30% max growth
        'Recoverable error handling'
      );

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.recoveredErrors).toBeLessThanOrEqual(errorCount);
    });

    it('should manage memory efficiently with monitoring integration', async () => {
      // Add pre-test stabilization
      await global.memoryTestUtils.addPreTestStabilization();

      // Get initial memory baseline
      const initialMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Simulate mixed error handling with monitoring
      const iterations = 200;
      for (let i = 0; i < iterations; i++) {
        // Use monitoring for some operations
        await monitoringCoordinator.executeMonitored(
          'testOperation',
          async () => {
            try {
              await centralErrorHandler.handle(
                new Error(`Monitored error ${i}`)
              );
            } catch {
              // Expected, ignore
            }
          }
        );
      }

      // Force GC and get final memory
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Get adaptive thresholds
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 5,
        MEMORY_GROWTH_LIMIT_PERCENT: 25,
      });

      // Assert memory is within limits
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(thresholds.MAX_MEMORY_MB);

      // Verify monitoring is still functioning
      const monitoringStats = monitoringCoordinator.getStats();
      expect(monitoringStats.enabled).toBe(true);
      expect(monitoringStats.performance.totalOperations).toBeGreaterThan(0);
    });
  });
});
