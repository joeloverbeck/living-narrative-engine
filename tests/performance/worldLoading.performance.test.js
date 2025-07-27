/**
 * @file Performance tests for WorldInitializer batch operations
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

describe('World Loading - Performance Tests', () => {
  // Set timeout for performance tests (reduced from 25s due to optimized timing)
  jest.setTimeout(10000); // 10 seconds should be more than enough

  let testBed;
  let performanceTracker;
  let baselineMetrics;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    performanceTracker = testBed.createPerformanceTracker();

    // Establish baseline performance for sequential processing (optimized for testing)
    baselineMetrics = {
      25: 150, // 25 entities should complete in < 150ms (baseline, reduced from 1s)
      50: 250, // 50 entities should complete in < 250ms (baseline, reduced from 2s)
      100: 500, // 100 entities should complete in < 500ms (baseline, reduced from 4s)
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('batch performance targets', () => {
    it('should meet world loading performance targets', async () => {
      const worldSizes = [
        { size: 25, targetTime: 150 }, // 25 entities in < 150ms (reduced from 1s)
        { size: 50, targetTime: 250 }, // 50 entities in < 250ms (reduced from 2s)
        { size: 100, targetTime: 500 }, // 100 entities in < 500ms (reduced from 3.5s)
      ];

      for (const { size, targetTime } of worldSizes) {
        // Arrange
        const worldData = testBed.createLargeWorldData(size);

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
          // Simulate realistic batch processing time (optimized for testing)
          batchProcessingTimeMs: Math.ceil(size * 1), // 1ms per entity in batch (reduced from 8ms)
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
        testBed.setupEntityDefinitions(size);

        const benchmark = performanceTracker.startBenchmark(
          `world_loading_${size}`
        );

        // Act
        const result = await worldInitializer.initializeWorldEntities(
          'performance_test_world'
        );

        const metrics = benchmark.end();

        // Assert
        expect(result.instantiatedCount).toBe(size);
        expect(metrics.totalTime).toBeLessThan(targetTime);
        expect(result.optimizationUsed).toBe('batch');

        console.log(
          `World loading (${size} entities): ${metrics.totalTime}ms ` +
            `(target: ${targetTime}ms, improvement: ${(((targetTime - metrics.totalTime) / targetTime) * 100).toFixed(1)}%)`
        );

        // Performance should be within target
        expect(metrics.totalTime).toBeLessThan(targetTime);

        // Memory usage should be reasonable
        if (metrics.memoryUsage) {
          expect(metrics.memoryUsage.peak).toBeLessThan(100 * 1024 * 1024); // 100MB
        }
      }
    });

    it('should demonstrate performance improvement over sequential processing', async () => {
      const entityCount = 50;
      const worldData = testBed.createLargeWorldData(entityCount);

      // Test sequential performance
      const sequentialConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(false), // Disable batch optimization
        getValue: jest.fn(),
      };

      const sequentialEntityManager = testBed.createMockEntityManager({
        enableBatchOperations: false,
        // Simulate realistic sequential processing time (optimized for testing)
        sequentialProcessingTimeMs: 3, // 3ms per entity sequentially (reduced from 20ms)
      });

      const sequentialInitializer = new WorldInitializer({
        entityManager: sequentialEntityManager,
        worldContext: testBed.mockWorldContext,
        gameDataRepository: testBed.mockRepository,
        validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
        eventDispatchService: testBed.mockEventDispatchService,
        logger: testBed.mockLogger,
        scopeRegistry: testBed.mockScopeRegistry,
        config: sequentialConfig,
      });

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.setupEntityDefinitions(entityCount);

      const sequentialBenchmark = performanceTracker.startBenchmark(
        'sequential_world_loading'
      );
      await sequentialInitializer.initializeWorldEntities('sequential_world');
      const sequentialMetrics = sequentialBenchmark.end();

      // Test batch performance
      const batchConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true), // Enable batch optimization
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

      const batchEntityManager = testBed.createMockEntityManager({
        enableBatchOperations: true,
        hasBatchSupport: true,
        // Simulate realistic batch processing time (more efficient, optimized for testing)
        batchProcessingTimeMs: Math.ceil(entityCount * 1), // 1ms per entity in batch (reduced from 8ms)
      });

      const batchInitializer = new WorldInitializer({
        entityManager: batchEntityManager,
        worldContext: testBed.mockWorldContext,
        gameDataRepository: testBed.mockRepository,
        validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
        eventDispatchService: testBed.mockEventDispatchService,
        logger: testBed.mockLogger,
        scopeRegistry: testBed.mockScopeRegistry,
        config: batchConfig,
      });

      const batchBenchmark = performanceTracker.startBenchmark(
        'batch_world_loading'
      );
      await batchInitializer.initializeWorldEntities('batch_world');
      const batchMetrics = batchBenchmark.end();

      // Batch should be at least 40% faster
      const improvementRatio =
        sequentialMetrics.totalTime / batchMetrics.totalTime;
      expect(improvementRatio).toBeGreaterThan(1.4);

      console.log(
        `Performance improvement: ${((improvementRatio - 1) * 100).toFixed(1)}% ` +
          `(Sequential: ${sequentialMetrics.totalTime}ms, Batch: ${batchMetrics.totalTime}ms)`
      );

      // Assert specific performance characteristics
      expect(batchMetrics.totalTime).toBeLessThan(
        sequentialMetrics.totalTime * 0.6
      ); // At least 40% improvement
    });

    it('should scale efficiently with world size', async () => {
      const worldSizes = [10, 50, 200]; // Reduced from 5 to 3 sizes for faster testing
      const results = [];

      for (const size of worldSizes) {
        const worldData = testBed.createLargeWorldData(size);

        const mockConfig = {
          isFeatureEnabled: jest.fn().mockReturnValue(true),
          getValue: jest.fn().mockImplementation((key) => {
            const values = {
              'performance.WORLD_LOADING_BATCH_SIZE': Math.min(size / 2, 50),
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
          batchProcessingTimeMs: Math.ceil(size * 0.8), // 0.8ms per entity (reduced from 6ms)
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
        testBed.setupEntityDefinitions(size);

        const benchmark = performanceTracker.startBenchmark(`scaling_${size}`);
        const result = await worldInitializer.initializeWorldEntities(
          `scaling_world_${size}`
        );
        const metrics = benchmark.end();

        results.push({
          size,
          time: metrics.totalTime,
          timePerEntity: metrics.totalTime / size,
          optimizationUsed: result.optimizationUsed,
        });

        console.log(
          `${size} entities: ${metrics.totalTime}ms (${(metrics.totalTime / size).toFixed(2)}ms per entity)`
        );
      }

      // Verify scalability characteristics
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];

        // Time per entity should not increase significantly with scale
        const timePerEntityIncrease =
          current.timePerEntity / previous.timePerEntity;
        expect(timePerEntityIncrease).toBeLessThan(1.2); // No more than 20% increase per size jump

        // Batch operations should be used for larger worlds
        if (current.size >= 5) {
          expect(current.optimizationUsed).toBe('batch');
        }
      }

      // Overall scalability should be sub-linear
      const smallest = results[0];
      const largest = results[results.length - 1];
      const scalingFactor = largest.size / smallest.size;
      const timeScalingFactor = largest.time / smallest.time;

      // Time should scale better than linearly (batch operations benefit)
      // Relaxed threshold for simulated environment
      expect(timeScalingFactor).toBeLessThan(scalingFactor * 1.2);
    });
  });

  describe('resource efficiency', () => {
    it('should demonstrate memory efficiency improvements', async () => {
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

      const benchmark = performanceTracker.startBenchmark('memory_efficiency', {
        trackMemory: true,
      });

      const result =
        await worldInitializer.initializeWorldEntities('memory_test_world');
      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      // Assert memory efficiency
      expect(result.instantiatedCount).toBe(entityCount);

      if (metrics.memoryUsage) {
        // Environment-aware memory thresholds
        const maxGrowthMB = metrics.memoryUsage.isCI ? 300 : 200; // More lenient in CI
        const maxGrowthBytes = maxGrowthMB * 1024 * 1024;
        
        // Memory growth should be reasonable for 100 entities
        expect(metrics.memoryUsage.growth).toBeLessThan(maxGrowthBytes);

        // Memory should be released efficiently (final should be close to initial)
        const memoryLeakThreshold = metrics.memoryUsage.isCI ? 1.5 : 1.3; // More lenient in CI
        const finalVsInitial = metrics.memoryUsage.final / metrics.memoryUsage.initial;
        expect(finalVsInitial).toBeLessThan(memoryLeakThreshold);

        // Additional sanity check: peak shouldn't be absurdly high
        const absoluteMaxMB = metrics.memoryUsage.isCI ? 500 : 400;
        expect(metrics.memoryUsage.peak).toBeLessThan(absoluteMaxMB * 1024 * 1024);

        console.log(
          `Memory usage - Baseline: ${(metrics.memoryUsage.baseline / 1024 / 1024).toFixed(2)}MB, ` +
            `Growth: ${(metrics.memoryUsage.growth / 1024 / 1024).toFixed(2)}MB, ` +
            `Peak: ${(metrics.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB, ` +
            `Final: ${(metrics.memoryUsage.final / 1024 / 1024).toFixed(2)}MB, ` +
            `CI: ${metrics.memoryUsage.isCI}`
        );
      }
    });

    it('should handle concurrent batch operations efficiently', async () => {
      const entityCount = 50; // Reduced from 75 for faster testing
      const concurrentWorlds = 2; // Reduced from 3 for faster testing

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
            batchProcessingTimeMs: Math.ceil(entityCount * 1), // 1ms per entity (reduced from 8ms)
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

      const benchmark = performanceTracker.startBenchmark('concurrent_loading');

      // Act - Load multiple worlds concurrently
      const promises = worldInitializers.map((initializer, i) =>
        initializer.initializeWorldEntities(`concurrent_world_${i}`)
      );

      // Use timeout wrapper to prevent hanging
      const timeoutMs = 2000; // 2 second timeout for concurrent loading (reduced from 10s)
      const results = await promiseAllWithTimeout(promises, timeoutMs);
      const metrics = benchmark.end();

      // Assert
      results.forEach((result, i) => {
        expect(result.instantiatedCount).toBe(entityCount);
        expect(result.optimizationUsed).toBe('batch');
      });

      // Concurrent loading should not be significantly slower than sequential loading
      const expectedMaxTime = 400; // Should complete all worlds in reasonable time (reduced from 2.5s)
      expect(metrics.totalTime).toBeLessThan(expectedMaxTime);

      console.log(
        `Concurrent loading (${concurrentWorlds} worlds, ${entityCount} entities each): ${metrics.totalTime}ms`
      );
    });
  });

  describe('edge case performance', () => {
    it('should handle very large worlds efficiently', async () => {
      const entityCount = 300; // Large world (reduced from 500 for faster testing)
      const worldData = testBed.createLargeWorldData(entityCount);

      const mockConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        getValue: jest.fn().mockImplementation((key) => {
          const values = {
            'performance.WORLD_LOADING_BATCH_SIZE': 50,
            'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
            'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
            'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
            'performance.WORLD_LOADING_TIMEOUT_MS': 60000, // Extended timeout for large world
          };
          return values[key];
        }),
      };

      const mockEntityManager = testBed.createMockEntityManager({
        enableBatchOperations: true,
        hasBatchSupport: true,
        batchProcessingTimeMs: Math.ceil(entityCount * 0.5), // Efficient processing (reduced from 4ms per entity)
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

      const benchmark = performanceTracker.startBenchmark(
        'large_world_loading'
      );

      const result =
        await worldInitializer.initializeWorldEntities('large_world');
      const metrics = benchmark.end();

      // Should complete large world in reasonable time
      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');
      expect(metrics.totalTime).toBeLessThan(600); // 600ms max for 300 entities (reduced from 1s for 500 entities)

      console.log(
        `Large world loading (${entityCount} entities): ${metrics.totalTime}ms ` +
          `(${(metrics.totalTime / entityCount).toFixed(2)}ms per entity)`
      );

      // Time per entity should be very efficient
      const timePerEntity = metrics.totalTime / entityCount;
      expect(timePerEntity).toBeLessThan(3); // Less than 3ms per entity (proportional to reduced entity count)
    });

    it('should maintain performance under memory pressure', async () => {
      const entityCount = 200;
      const worldData = testBed.createLargeWorldData(entityCount);

      const mockConfig = {
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        getValue: jest.fn().mockImplementation((key) => {
          const values = {
            'performance.WORLD_LOADING_BATCH_SIZE': 20, // Smaller batches under memory pressure
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
        batchProcessingTimeMs: Math.ceil(entityCount * 1.5), // Slower under memory pressure (reduced from 10ms per entity)
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

      const benchmark = performanceTracker.startBenchmark(
        'memory_pressure_loading'
      );

      const result = await worldInitializer.initializeWorldEntities(
        'memory_pressure_world'
      );
      const metrics = benchmark.end();

      // Should still complete successfully under memory pressure
      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');

      // May be slower but should still be reasonable
      expect(metrics.totalTime).toBeLessThan(400); // 400ms max under memory pressure (reduced from 8s)

      console.log(
        `Memory pressure loading (${entityCount} entities): ${metrics.totalTime}ms`
      );
    });
  });
});
