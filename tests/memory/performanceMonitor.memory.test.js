/**
 * @file Memory tests for PerformanceMonitor operations
 * @description Tests memory usage functionality of the PerformanceMonitor class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import PerformanceMonitor from '../../src/entities/monitoring/PerformanceMonitor.js';
import { createMockLogger } from '../common/mockFactories/loggerMocks.js';

describe('PerformanceMonitor - Memory Tests', () => {
  // Extended timeout for memory stabilization
  jest.setTimeout(120000); // 2 minutes

  let logger;
  let monitor;

  beforeEach(async () => {
    logger = createMockLogger();

    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    if (monitor) {
      monitor = null;
    }
    logger = null;

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('checkMemoryUsage', () => {
    beforeEach(() => {
      monitor = new PerformanceMonitor({
        logger,
        memoryWarningThreshold: 0.8,
      });
    });

    it('should check memory usage', async () => {
      // Force GC and wait for stabilization
      await global.memoryTestUtils.forceGCAndWait();

      // checkMemoryUsage doesn't return a value, it just logs warnings
      monitor.checkMemoryUsage();

      // If no warning logged, memory is OK
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when memory usage is high', async () => {
      // Force GC and wait for stabilization
      await global.memoryTestUtils.forceGCAndWait();

      // Mock process.memoryUsage to simulate high memory
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 0,
        rss: 1000 * 1024 * 1024,
      });

      monitor.checkMemoryUsage();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('High memory usage detected'),
        expect.any(Object)
      );

      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });

    it('should track memory usage trends over multiple checks', async () => {
      // Force GC and wait for stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Perform multiple memory checks
      const checkCount = 10;
      for (let i = 0; i < checkCount; i++) {
        monitor.checkMemoryUsage();
        // Small delay between checks
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Force GC and measure final memory
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Memory growth should be minimal for checking operations
      const memoryGrowthMB = (finalMemory - baselineMemory) / 1024 / 1024;
      console.log(
        `Memory growth from ${checkCount} checks: ${memoryGrowthMB.toFixed(2)}MB`
      );

      // Should not grow more than 5MB from just checking memory
      expect(memoryGrowthMB).toBeLessThan(5);
    });
  });
});
