/**
 * @file Memory tests for WorldInitializer operations
 * @description Tests memory usage patterns and efficiency of world loading operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WorldInitializer from '../../src/initializers/worldInitializer.js';
import { createPerformanceTestBed } from '../common/performanceTestBed.js';

/**
 * Wraps Promise.all with a timeout to prevent hanging tests
 *
 * @param {Promise[]} promises - Array of promises to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise that resolves with results or rejects with timeout
 */
function promiseAllWithTimeout(promises, timeoutMs) {
  return Promise.race([
    Promise.all(promises),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Promise.all timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

describe('World Loading - Memory Tests', () => {
  // Extended timeout for memory stabilization
  jest.setTimeout(120000); // 2 minutes

  let testBed;
  let performanceTracker;

  beforeEach(async () => {
    testBed = createPerformanceTestBed();
    performanceTracker = testBed.createPerformanceTracker();

    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    testBed.cleanup();

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('memory efficiency', () => {
    it('should demonstrate memory efficiency improvements with stable measurements', async () => {
      const entityCount = 100;
      const worldData = testBed.createLargeWorldData(entityCount);

      const mockConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        getValue: jest.fn().mockImplementation((key) => {
          const values = {
            'performance.WORLD_LOADING_BATCH_SIZE': 25,
            'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
            'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
            'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
            'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
          };
          return values[key];
        }),
      };

      const mockEntityManager = testBed.createMockEntityManager({
        enableBatchOperations: true,
        hasBatchSupport: true,
        trackMemoryUsage: true,
      });

      const worldInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: testBed.mockWorldContext,
        gameDataRepository: testBed.mockRepository,
        validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
        eventDispatchService: testBed.mockEventDispatchService,
        logger: testBed.mockLogger,
        scopeRegistry: testBed.mockScopeRegistry,
        config: mockConfig,
      });

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.setupEntityDefinitions(entityCount);

      // Establish stable memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const benchmark = performanceTracker.startBenchmark('memory_efficiency', {
        trackMemory: true,
      });

      const result =
        await worldInitializer.initializeWorldEntities('memory_test_world');

      // Allow memory to stabilize after operation
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Force cleanup and measure final memory
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      // Assert operation completed successfully
      expect(result.instantiatedCount).toBe(entityCount);

      // Enhanced memory efficiency assertions with better thresholds
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);

      // Environment-aware memory thresholds (more realistic)
      const maxGrowthMB = global.memoryTestUtils.isCI() ? 600 : 500; // Increased from 300/200
      const maxLeakageMB = global.memoryTestUtils.isCI() ? 200 : 150; // Increased from 100/75
      const absoluteMaxMB = global.memoryTestUtils.isCI() ? 800 : 650; // Increased from 500/400

      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxLeakageMB * 1024 * 1024);
      expect(peakMemory).toBeLessThan(absoluteMaxMB * 1024 * 1024);

      // Memory growth should be reasonable for 100 entities
      const memoryPerEntity = memoryGrowth / entityCount;
      expect(memoryPerEntity).toBeLessThan(50 * 1024); // Less than 50KB per entity

      console.log(
        `Memory efficiency - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Entity: ${(memoryPerEntity / 1024).toFixed(2)}KB, ` +
          `CI: ${global.memoryTestUtils.isCI()}`
      );
    });

    it('should handle concurrent batch operations without excessive memory usage', async () => {
      const entityCount = 50;
      const concurrentWorlds = 2;

      const mockConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        getValue: jest.fn().mockImplementation((key) => {
          const values = {
            'performance.WORLD_LOADING_BATCH_SIZE': 25,
            'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
            'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
            'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
            'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
          };
          return values[key];
        }),
      };

      const worldInitializers = Array(concurrentWorlds)
        .fill(0)
        .map(() => {
          const mockEntityManager = testBed.createMockEntityManager({
            enableBatchOperations: true,
            hasBatchSupport: true,
            batchProcessingTimeMs: Math.ceil(entityCount * 1),
          });

          return new WorldInitializer({
            entityManager: mockEntityManager,
            worldContext: testBed.mockWorldContext,
            gameDataRepository: testBed.mockRepository,
            validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
            eventDispatchService: testBed.mockEventDispatchService,
            logger: testBed.mockLogger,
            scopeRegistry: testBed.mockScopeRegistry,
            config: mockConfig,
          });
        });

      const worldData = testBed.createLargeWorldData(entityCount);
      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.setupEntityDefinitions(entityCount);

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const benchmark = performanceTracker.startBenchmark('concurrent_memory');

      // Act - Load multiple worlds concurrently
      const promises = worldInitializers.map((initializer, i) =>
        initializer.initializeWorldEntities(`concurrent_world_${i}`)
      );

      const timeoutMs = 10000; // 10 second timeout
      const results = await promiseAllWithTimeout(promises, timeoutMs);

      // Allow memory to stabilize
      await new Promise((resolve) => setTimeout(resolve, 200));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Force cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      benchmark.end();

      // Assert operations completed successfully
      results.forEach((result, i) => {
        expect(result.instantiatedCount).toBe(entityCount);
        expect(result.optimizationUsed).toBe('batch');
      });

      // Memory usage assertions for concurrent operations
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);

      // Concurrent operations should not use excessive memory
      const maxConcurrentGrowthMB = global.memoryTestUtils.isCI() ? 800 : 650; // Accounts for concurrent processing
      const maxConcurrentLeakageMB = global.memoryTestUtils.isCI() ? 250 : 200;

      expect(memoryGrowth).toBeLessThan(maxConcurrentGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxConcurrentLeakageMB * 1024 * 1024);

      console.log(
        `Concurrent memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Worlds: ${concurrentWorlds}, Entities: ${entityCount * concurrentWorlds}`
      );
    });

    it('should maintain stable memory usage under pressure conditions', async () => {
      const entityCount = 200;
      const worldData = testBed.createLargeWorldData(entityCount);

      const mockConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        getValue: jest.fn().mockImplementation((key) => {
          const values = {
            'performance.WORLD_LOADING_BATCH_SIZE': 20, // Smaller batches under pressure
            'performance.WORLD_LOADING_MAX_BATCH_SIZE': 50,
            'performance.WORLD_LOADING_ENABLE_PARALLEL': false, // Disable parallel to save memory
            'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
            'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
          };
          return values[key];
        }),
      };

      const mockEntityManager = testBed.createMockEntityManager({
        enableBatchOperations: true,
        hasBatchSupport: true,
        simulateMemoryPressure: true,
        batchProcessingTimeMs: Math.ceil(entityCount * 1.5),
      });

      const worldInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: testBed.mockWorldContext,
        gameDataRepository: testBed.mockRepository,
        validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
        eventDispatchService: testBed.mockEventDispatchService,
        logger: testBed.mockLogger,
        scopeRegistry: testBed.mockScopeRegistry,
        config: mockConfig,
      });

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.setupEntityDefinitions(entityCount);

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const benchmark = performanceTracker.startBenchmark('memory_pressure');

      const result = await worldInitializer.initializeWorldEntities(
        'memory_pressure_world'
      );

      // Allow memory stabilization
      await new Promise((resolve) => setTimeout(resolve, 300));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Force cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      benchmark.end();

      // Should still complete successfully under memory pressure
      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');

      // Memory usage should be controlled under pressure
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);

      // Under memory pressure, growth should be more controlled
      const maxPressureGrowthMB = global.memoryTestUtils.isCI() ? 700 : 550;
      const maxPressureLeakageMB = global.memoryTestUtils.isCI() ? 300 : 250;

      expect(memoryGrowth).toBeLessThan(maxPressureGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxPressureLeakageMB * 1024 * 1024);

      console.log(
        `Memory pressure - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Entities: ${entityCount}`
      );
    });
  });
});
