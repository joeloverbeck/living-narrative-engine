/**
 * @file Memory leak detection tests for ClothingAccessibilityService
 * @description Tests memory usage patterns and leak detection for cache management
 * and large-scale operations.
 *
 * Run with: NODE_ENV=test node --expose-gc ./node_modules/.bin/jest tests/memory/clothing/clothingAccessibilityService.memory.test.js --no-coverage --verbose
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';

/**
 * Memory leak detection tests for ClothingAccessibilityService
 * Tests compliance with memory requirements from CLOREMLOG-005-07
 */
/**
 * Create fresh mock instances for proper test isolation
 *
 * @returns {object} Fresh mock objects for testing
 */
function createFreshMocks() {
  return {
    mockLogger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    mockEntityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    },
    mockEntitiesGateway: {
      getComponentData: jest.fn(),
    },
  };
}

describe('ClothingAccessibilityService Memory Usage', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    const mocks = createFreshMocks();
    mockLogger = mocks.mockLogger;
    mockEntityManager = mocks.mockEntityManager;
    mockEntitiesGateway = mocks.mockEntitiesGateway;

    // Standard equipment setup for memory tests
    mockEntityManager.getComponentData.mockReturnValue({
      equipped: {
        torso: { base: 'shirt', outer: 'jacket' },
        legs: { base: 'pants', underwear: 'underwear' },
      },
    });

    mockEntitiesGateway.getComponentData.mockReturnValue({
      covers: ['body_area'],
      coveragePriority: 'base',
    });

    service = new ClothingAccessibilityService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway,
      maxCacheSize: 100, // Limit cache size for memory tests
    });
  });

  describe('Memory leak detection', () => {
    it('should not leak memory with repeated cache operations', async () => {
      const initialMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2); // Reduced samples
      const iterations = 200; // Reduced from 1000 - leaks show up quickly
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 10,
      });

      // Perform many operations that could potentially leak memory
      for (let i = 0; i < iterations; i++) {
        // Use different entity IDs to create many cache entries
        const entityId = `entity_${i % 100}`; // Cycle through 100 entities

        service.getAccessibleItems(entityId, {
          mode: 'topmost',
          uniqueOption: i, // Force different cache keys
        });

        // Occasionally clear cache to test cleanup
        if (i % 50 === 0) {
          // More frequent cleanup (was 250)
          service.clearCache(entityId);
        }
      }

      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(2); // Reduced samples
      const memoryIncrease = finalMemory - initialMemory;
      const increaseInMB = memoryIncrease / (1024 * 1024);

      console.log(
        `Memory test - Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, Increase: ${increaseInMB.toFixed(2)}MB`
      );

      // Use adaptive memory assertion with reduced retry logic
      await expect(
        global.memoryTestUtils.assertMemoryWithRetry(
          () =>
            global.memoryTestUtils
              .getStableMemoryUsage(2)
              .then((m) => m - initialMemory),
          thresholds.MAX_MEMORY_MB,
          3 // Reduced retries from 6 to 3
        )
      ).resolves.toBeUndefined();
    });

    it('should clean up priority cache properly', async () => {
      const initialMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2); // Reduced samples from 5

      // Generate equipment to stress priority cache (optimized size)
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: (() => {
          const equipment = {};
          // Reduced from 20 to 8 slots for faster testing
          for (let slot = 0; slot < 8; slot++) {
            equipment[`slot_${slot}`] = {
              outer: `outer_${slot}`,
              base: `base_${slot}`,
              underwear: `underwear_${slot}`,
            };
          }
          return equipment;
        })(),
      });

      // Perform operations that build up priority cache (reduced iterations)
      const iterations = 100; // Reduced from 500
      for (let i = 0; i < iterations; i++) {
        service.getAccessibleItems(`priority_entity_${i}`, {
          mode: 'all',
          sortByPriority: true,
        });
      }

      const afterCacheMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);

      // Clear all caches
      for (let i = 0; i < iterations; i++) {
        service.clearCache(`priority_entity_${i}`);
      }

      await global.memoryTestUtils.forceGCAndWait();
      const afterClearMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);

      const cacheGrowth = afterCacheMemory - initialMemory;
      const postClearGrowth = afterClearMemory - initialMemory;

      console.log(
        `Priority cache memory - Cache built: +${(cacheGrowth / 1024 / 1024).toFixed(2)}MB, After clear: +${(postClearGrowth / 1024 / 1024).toFixed(2)}MB`
      );

      // Cache should be cleaned up significantly (more lenient threshold for CI)
      const cleanupRatio = global.memoryTestUtils.isCI() ? 0.85 : 0.6;
      const cleanupTargetMB = Math.max(
        (cacheGrowth / (1024 * 1024)) * cleanupRatio,
        global.memoryTestUtils.isCI() ? 7.5 : 5
      );

      await expect(
        global.memoryTestUtils.assertMemoryWithRetry(
          () =>
            global.memoryTestUtils
              .getStableMemoryUsage(2)
              .then((m) => m - initialMemory),
          cleanupTargetMB,
          3 // Reduced retries from 6-8 to 3
        )
      ).resolves.toBeUndefined();

      const toleranceBytes =
        (global.memoryTestUtils.isCI() ? 8 : 5) * 1024 * 1024;
      expect(postClearGrowth).toBeLessThan(cacheGrowth + toleranceBytes);
    });

    it('should handle cache size limits without excessive memory growth', async () => {
      const initialMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 20,
      });

      // Force many unique cache entries to test cache size management
      const iterations = 400; // Reduced from 2000
      for (let i = 0; i < iterations; i++) {
        service.getAccessibleItems(`cache_limit_entity_${i}`, {
          mode: 'all',
          uniqueParam: Math.random(), // Force unique cache keys
        });
      }

      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(2);
      const memoryIncrease = finalMemory - initialMemory;
      const increaseInMB = memoryIncrease / (1024 * 1024);

      console.log(
        `Cache limit test - Memory increase: ${increaseInMB.toFixed(2)}MB for ${iterations} unique operations`
      );

      // Use adaptive memory assertion
      await expect(
        global.memoryTestUtils.assertMemoryWithRetry(
          () =>
            global.memoryTestUtils
              .getStableMemoryUsage(2)
              .then((m) => m - initialMemory),
          thresholds.MAX_MEMORY_MB,
          3 // Reduced retries
        )
      ).resolves.toBeUndefined();
    });

    it('should not accumulate memory over multiple service instances', async () => {
      const initialMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);
      const serviceInstances = [];

      // Create service instances to test for static/global memory leaks
      const instanceCount = 20; // Reduced from 50
      for (let i = 0; i < instanceCount; i++) {
        // Create fresh mocks for each instance to prevent shared references
        const freshMocks = createFreshMocks();
        freshMocks.mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso: { base: 'shirt', outer: 'jacket' },
            legs: { base: 'pants', underwear: 'underwear' },
          },
        });
        freshMocks.mockEntitiesGateway.getComponentData.mockReturnValue({
          covers: ['body_area'],
          coveragePriority: 'base',
        });

        const newService = new ClothingAccessibilityService({
          logger: freshMocks.mockLogger,
          entityManager: freshMocks.mockEntityManager,
          entitiesGateway: freshMocks.mockEntitiesGateway,
          maxCacheSize: 50, // Smaller cache for multi-instance test
        });

        // Use each service
        newService.getAccessibleItems(`instance_test_${i}`, {
          mode: 'topmost',
        });
        serviceInstances.push(newService);
      }

      const afterCreationMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);

      // Clear references to allow garbage collection
      serviceInstances.length = 0;

      // Force garbage collection and stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const afterClearMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);

      const creationIncrease = afterCreationMemory - initialMemory;
      const finalIncrease = afterClearMemory - initialMemory;

      console.log(
        `Instance memory test - After creation: +${(creationIncrease / 1024 / 1024).toFixed(2)}MB, After clear: +${(finalIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Memory should be mostly reclaimed after clearing references (more lenient for mocks)
      const cleanupRatio = global.memoryTestUtils.isCI() ? 0.8 : 0.6;
      expect(finalIncrease).toBeLessThan(creationIncrease * cleanupRatio);
    });

    it('should handle memory pressure during concurrent operations', async () => {
      const initialMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 15,
      });

      // Simulate memory pressure with concurrent-like operations
      const concurrentCount = 80; // Reduced from 200
      const promises = [];
      for (let i = 0; i < concurrentCount; i++) {
        const promise = Promise.resolve().then(() => {
          return service.getAccessibleItems(`concurrent_${i}`, {
            mode: 'all',
            context: 'removal',
            sortByPriority: true,
          });
        });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const afterConcurrentMemory =
        await global.memoryTestUtils.getStableMemoryUsage(2);
      const memoryIncrease = afterConcurrentMemory - initialMemory;

      expect(results).toHaveLength(concurrentCount);

      console.log(
        `Concurrent memory test - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${concurrentCount} concurrent operations`
      );

      // Use adaptive memory assertion
      await expect(
        global.memoryTestUtils.assertMemoryWithRetry(
          () =>
            global.memoryTestUtils
              .getStableMemoryUsage(2)
              .then((m) => m - initialMemory),
          thresholds.MAX_MEMORY_MB,
          3 // Reduced retries
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('Memory usage profiling', () => {
    /**
     * Measure memory usage of a specific operation using stable measurements
     *
     * @param {Function} operation - Operation to measure
     * @returns {Promise<object>} Memory usage statistics
     */
    async function measureOperation(operation) {
      const beforeMemory = await global.memoryTestUtils.getStableMemoryUsage();
      await operation();
      const afterMemory = await global.memoryTestUtils.getStableMemoryUsage();

      return {
        before: beforeMemory,
        after: afterMemory,
        increase: afterMemory - beforeMemory,
        increaseKB: (afterMemory - beforeMemory) / 1024,
      };
    }

    it('should measure memory usage of basic operations', async () => {
      const operationCount = 50; // Reduced from 100
      const stats = await measureOperation(async () => {
        for (let i = 0; i < operationCount; i++) {
          service.getAccessibleItems(`basic_op_${i}`, { mode: 'topmost' });
        }
      });

      console.log(`Basic operations memory stats:`, {
        increaseKB: stats.increaseKB.toFixed(2),
        perOperation: (stats.increaseKB / operationCount).toFixed(2),
      });

      // Each operation should use minimal memory (more lenient for CI)
      const perOpLimit = global.memoryTestUtils.isCI() ? 150 : 50; // KB per operation
      expect(stats.increaseKB / operationCount).toBeLessThan(perOpLimit);
    });

    it('should measure memory usage of cache operations', async () => {
      const cacheOpCount = 25; // Reduced from 50
      const stats = await measureOperation(async () => {
        // Fill cache
        for (let i = 0; i < cacheOpCount; i++) {
          service.getAccessibleItems(`cache_op_${i}`, { mode: 'all' });
        }

        // Use cached data
        for (let i = 0; i < cacheOpCount; i++) {
          service.getAccessibleItems(`cache_op_${i}`, { mode: 'all' });
        }

        // Clear cache
        for (let i = 0; i < cacheOpCount; i++) {
          service.clearCache(`cache_op_${i}`);
        }
      });

      console.log(`Cache operations memory stats:`, {
        increaseKB: stats.increaseKB.toFixed(2),
        perCycleKB: (stats.increaseKB / cacheOpCount).toFixed(2),
      });

      // Cache cycle should have minimal net memory increase (more lenient for CI)
      const cycleLimit = global.memoryTestUtils.isCI() ? 3000 : 1000; // KB
      expect(stats.increaseKB).toBeLessThan(cycleLimit);
    });

    it('should measure memory usage of priority calculations', async () => {
      // Setup equipment for priority testing (optimized size)
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: (() => {
          const equipment = {};
          // Reduced from 15 to 6 slots for faster testing
          for (let slot = 0; slot < 6; slot++) {
            equipment[`slot_${slot}`] = {
              outer: `outer_${slot}`,
              base: `base_${slot}`,
              underwear: `underwear_${slot}`,
            };
          }
          return equipment;
        })(),
      });

      const priorityOpCount = 10; // Reduced from 20
      const stats = await measureOperation(async () => {
        for (let i = 0; i < priorityOpCount; i++) {
          service.getAccessibleItems(`priority_${i}`, {
            mode: 'all',
            sortByPriority: true,
          });
        }
      });

      console.log(`Priority calculation memory stats:`, {
        increaseKB: stats.increaseKB.toFixed(2),
        perOperationKB: (stats.increaseKB / priorityOpCount).toFixed(2),
      });

      // Priority calculations should have reasonable memory overhead (more lenient for CI)
      // Adjusted for 6 slots × 3 layers = 18 items
      const perOpLimit = global.memoryTestUtils.isCI() ? 400 : 200; // KB per priority operation
      expect(stats.increaseKB / priorityOpCount).toBeLessThan(perOpLimit);
    });
  });

  describe('Long-running memory stability', () => {
    it('should maintain stable memory usage over extended operations', async () => {
      const measurements = [];
      const baseMemory = await global.memoryTestUtils.getStableMemoryUsage(2);
      const thresholds = global.memoryTestUtils.getAdaptiveThresholds({
        MAX_MEMORY_MB: 25,
      });

      // Simulate long-running service usage (reduced scale)
      const cycles = 6; // Reduced from 10
      const opsPerCycle = 50; // Reduced from 100
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Each cycle represents sustained usage
        for (let op = 0; op < opsPerCycle; op++) {
          const entityId = `long_run_${cycle}_${op % 20}`; // Reuse some entities

          service.getAccessibleItems(entityId, { mode: 'topmost' });

          if (op % 25 === 0) {
            // More frequent cleanup (was 50)
            // Periodic cleanup
            service.clearCache(entityId);
          }
        }

        // Measure memory after each cycle (less frequent sampling)
        const currentMemory =
          await global.memoryTestUtils.getStableMemoryUsage(1); // Reduced samples
        const memoryIncrease = currentMemory - baseMemory;
        measurements.push(memoryIncrease);
      }

      // Verify growth rate stabilization after initial cycles
      const maxGrowthRate = global.memoryTestUtils.isCI() ? 2.0 : 1.6;
      for (let i = 2; i < measurements.length; i++) {
        // Start from cycle 2 instead of 3
        const previousIncrease = measurements[i - 1];
        const currentIncrease = measurements[i];
        const growthRate = currentIncrease / previousIncrease;

        expect(growthRate).toBeLessThan(maxGrowthRate);
      }

      console.log(`Long-running memory stability:`, {
        cycles: measurements.length,
        finalIncreaseMB: (
          measurements[measurements.length - 1] /
          1024 /
          1024
        ).toFixed(2),
        avgGrowthRate:
          measurements
            .slice(1)
            .reduce((sum, curr, i) => sum + curr / measurements[i], 0) /
          (measurements.length - 1),
      });

      // Use adaptive memory assertion for total increase
      await expect(
        global.memoryTestUtils.assertMemoryWithRetry(
          () =>
            global.memoryTestUtils
              .getStableMemoryUsage(2)
              .then((m) => m - baseMemory),
          thresholds.MAX_MEMORY_MB,
          3 // Reduced retries
        )
      ).resolves.toBeUndefined();
    });
  });
});
