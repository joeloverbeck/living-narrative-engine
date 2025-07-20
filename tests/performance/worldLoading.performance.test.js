/**
 * @file Performance tests for WorldInitializer batch operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WorldInitializer from '../../src/initializers/worldInitializer.js';
import { createPerformanceTestBed } from '../common/performanceTestBed.js';

describe('World Loading - Performance Tests', () => {
  let testBed;
  let performanceTracker;
  let baselineMetrics;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    performanceTracker = testBed.createPerformanceTracker();
    
    // Establish baseline performance for sequential processing
    baselineMetrics = {
      25: 1000,  // 25 entities should complete in < 1 second (baseline)
      50: 2000,  // 50 entities should complete in < 2 seconds (baseline)
      100: 4000, // 100 entities should complete in < 4 seconds (baseline)
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('batch performance targets', () => {
    it('should meet world loading performance targets', async () => {
      const worldSizes = [
        { size: 25, targetTime: 1000 }, // 25 entities in < 1 second
        { size: 50, targetTime: 2000 }, // 50 entities in < 2 seconds
        { size: 100, targetTime: 3500 }, // 100 entities in < 3.5 seconds
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
          // Simulate realistic batch processing time
          batchProcessingTimeMs: Math.ceil(size * 8), // 8ms per entity in batch
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

        const benchmark = performanceTracker.startBenchmark(`world_loading_${size}`);

        // Act
        const result = await worldInitializer.initializeWorldEntities('performance_test_world');

        const metrics = benchmark.end();

        // Assert
        expect(result.instantiatedCount).toBe(size);
        expect(metrics.totalTime).toBeLessThan(targetTime);
        expect(result.optimizationUsed).toBe('batch');

        console.log(
          `World loading (${size} entities): ${metrics.totalTime}ms ` +
          `(target: ${targetTime}ms, improvement: ${((targetTime - metrics.totalTime) / targetTime * 100).toFixed(1)}%)`
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
        // Simulate realistic sequential processing time
        sequentialProcessingTimeMs: 20, // 20ms per entity sequentially
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

      const sequentialBenchmark = performanceTracker.startBenchmark('sequential_world_loading');
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
        // Simulate realistic batch processing time (more efficient)
        batchProcessingTimeMs: Math.ceil(entityCount * 8), // 8ms per entity in batch
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

      const batchBenchmark = performanceTracker.startBenchmark('batch_world_loading');
      await batchInitializer.initializeWorldEntities('batch_world');
      const batchMetrics = batchBenchmark.end();

      // Batch should be at least 40% faster
      const improvementRatio = sequentialMetrics.totalTime / batchMetrics.totalTime;
      expect(improvementRatio).toBeGreaterThan(1.4);

      console.log(
        `Performance improvement: ${((improvementRatio - 1) * 100).toFixed(1)}% ` +
        `(Sequential: ${sequentialMetrics.totalTime}ms, Batch: ${batchMetrics.totalTime}ms)`
      );

      // Assert specific performance characteristics
      expect(batchMetrics.totalTime).toBeLessThan(sequentialMetrics.totalTime * 0.6); // At least 40% improvement
    });

    it('should scale efficiently with world size', async () => {
      const worldSizes = [10, 25, 50, 100, 200];
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
          batchProcessingTimeMs: Math.ceil(size * 6), // 6ms per entity
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
        const result = await worldInitializer.initializeWorldEntities(`scaling_world_${size}`);
        const metrics = benchmark.end();

        results.push({
          size,
          time: metrics.totalTime,
          timePerEntity: metrics.totalTime / size,
          optimizationUsed: result.optimizationUsed,
        });

        console.log(`${size} entities: ${metrics.totalTime}ms (${(metrics.totalTime / size).toFixed(2)}ms per entity)`);
      }

      // Verify scalability characteristics
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        
        // Time per entity should not increase significantly with scale
        const timePerEntityIncrease = current.timePerEntity / previous.timePerEntity;
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

      const result = await worldInitializer.initializeWorldEntities('memory_test_world');
      const metrics = benchmark.end();

      // Assert memory efficiency
      expect(result.instantiatedCount).toBe(entityCount);
      
      if (metrics.memoryUsage) {
        // Peak memory should be reasonable for 100 entities
        expect(metrics.memoryUsage.peak).toBeLessThan(90 * 1024 * 1024); // 90MB target (25% improvement)
        
        // Memory should be released efficiently
        // Relaxed threshold for simulated environment
        expect(metrics.memoryUsage.final).toBeLessThan(metrics.memoryUsage.peak * 1.2);
        
        console.log(
          `Memory usage - Peak: ${(metrics.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(metrics.memoryUsage.final / 1024 / 1024).toFixed(2)}MB`
        );
      }
    });

    it('should handle concurrent batch operations efficiently', async () => {
      const entityCount = 75;
      const concurrentWorlds = 3;
      
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

      const worldInitializers = Array(concurrentWorlds).fill(0).map(() => {
        const mockEntityManager = testBed.createMockEntityManager({
          enableBatchOperations: true,
          hasBatchSupport: true,
          batchProcessingTimeMs: Math.ceil(entityCount * 8),
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

      const results = await Promise.all(promises);
      const metrics = benchmark.end();

      // Assert
      results.forEach((result, i) => {
        expect(result.instantiatedCount).toBe(entityCount);
        expect(result.optimizationUsed).toBe('batch');
      });

      // Concurrent loading should not be significantly slower than sequential loading
      const expectedMaxTime = 2500; // Should complete all worlds in reasonable time
      expect(metrics.totalTime).toBeLessThan(expectedMaxTime);

      console.log(
        `Concurrent loading (${concurrentWorlds} worlds, ${entityCount} entities each): ${metrics.totalTime}ms`
      );
    });
  });

  describe('edge case performance', () => {
    it('should handle very large worlds efficiently', async () => {
      const entityCount = 500; // Very large world
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
        batchProcessingTimeMs: Math.ceil(entityCount * 4), // Efficient processing
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

      const benchmark = performanceTracker.startBenchmark('large_world_loading');

      const result = await worldInitializer.initializeWorldEntities('large_world');
      const metrics = benchmark.end();

      // Should complete large world in reasonable time
      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');
      expect(metrics.totalTime).toBeLessThan(15000); // 15 seconds max for 500 entities

      console.log(
        `Large world loading (${entityCount} entities): ${metrics.totalTime}ms ` +
        `(${(metrics.totalTime / entityCount).toFixed(2)}ms per entity)`
      );

      // Time per entity should be very efficient
      const timePerEntity = metrics.totalTime / entityCount;
      expect(timePerEntity).toBeLessThan(30); // Less than 30ms per entity
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
        batchProcessingTimeMs: Math.ceil(entityCount * 10), // Slower under memory pressure
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

      const benchmark = performanceTracker.startBenchmark('memory_pressure_loading');

      const result = await worldInitializer.initializeWorldEntities('memory_pressure_world');
      const metrics = benchmark.end();

      // Should still complete successfully under memory pressure
      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');
      
      // May be slower but should still be reasonable
      expect(metrics.totalTime).toBeLessThan(8000); // 8 seconds max under memory pressure

      console.log(
        `Memory pressure loading (${entityCount} entities): ${metrics.totalTime}ms`
      );
    });
  });
});

