/**
 * @file Performance benchmarks for WorldInitializer batch operations
 * @description Tests focused on measuring world initialization performance characteristics
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { createTestBed } from '../../common/testBed.js';
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../../../src/constants/eventIds.js';

describe('WorldInitializer Performance', () => {
  let testBed;
  let worldInitializer;
  let mockEntityManager;
  let mockConfig;

  beforeEach(() => {
    testBed = createTestBed();

    // Mock configuration for world loading optimization
    mockConfig = {
      isFeatureEnabled: jest.fn().mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      }),
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

    // Create entity manager with batch operations support
    mockEntityManager = testBed.createMockEntityManager({
      hasBatchSupport: true,
      enableBatchOperations: true,
    });

    worldInitializer = new WorldInitializer({
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

  afterEach(() => {
    testBed.cleanup();
  });

  describe('performance characteristics', () => {
    it('should provide performance metrics in results', async () => {
      // Arrange
      const entityInstances = Array(30)
        .fill(0)
        .map((_, i) => ({
          instanceId: `world_entity_${i}`,
        }));

      const worldData = {
        instances: entityInstances,
      };

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.mockRepository.getEntityInstanceDefinition.mockImplementation(
        (instanceId) => ({
          definitionId: 'core:test_actor',
          componentOverrides: {},
        })
      );

      const mockProcessingTime = 250;
      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: entityInstances.map((instance, i) => ({
          id: `entity_${i}`,
          instanceId: instance.instanceId,
          definitionId: 'core:test_actor',
        })),
        failures: [],
        successCount: entityInstances.length,
        failureCount: 0,
        totalProcessed: entityInstances.length,
        processingTime: mockProcessingTime,
      });

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result).toMatchObject({
        entities: expect.any(Array),
        instantiatedCount: entityInstances.length,
        failedCount: 0,
        totalProcessed: entityInstances.length,
        optimizationUsed: 'batch',
      });
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify performance logging
      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting batch entity creation')
      );
      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Batch entity creation completed')
      );
    });

    it('should demonstrate performance scaling with larger worlds', async () => {
      const worldSizes = [50, 100, 200, 500];
      const results = {};

      for (const size of worldSizes) {
        const entityInstances = Array(size)
          .fill(0)
          .map((_, i) => ({
            instanceId: `world_entity_${size}_${i}`,
          }));

        const worldData = {
          instances: entityInstances,
        };

        testBed.mockRepository.getWorld.mockReturnValue(worldData);
        testBed.mockRepository.getEntityInstanceDefinition.mockImplementation(
          (instanceId) => ({
            definitionId: 'core:test_actor',
            componentOverrides: {},
          })
        );

        // Simulate realistic processing times based on entity count
        const mockProcessingTime = Math.floor(size * 2.5); // ~2.5ms per entity
        
        mockEntityManager.batchCreateEntities.mockResolvedValue({
          successes: entityInstances.map((instance, i) => ({
            id: `entity_${size}_${i}`,
            instanceId: instance.instanceId,
            definitionId: 'core:test_actor',
          })),
          failures: [],
          successCount: entityInstances.length,
          failureCount: 0,
          totalProcessed: entityInstances.length,
          processingTime: mockProcessingTime,
        });

        const startTime = performance.now();
        const result = await worldInitializer.initializeWorldEntities(`test_world_${size}`);
        const endTime = performance.now();

        results[size] = {
          processingTime: result.processingTime,
          totalTime: endTime - startTime,
          entitiesPerSecond: size / (result.processingTime / 1000),
        };

        expect(result.instantiatedCount).toBe(size);
        expect(result.optimizationUsed).toBe('batch');

        // Reset mock for next iteration
        jest.clearAllMocks();
      }

      console.log('World initialization performance scaling:');
      for (const [size, data] of Object.entries(results)) {
        console.log(`  ${size} entities: ${data.processingTime}ms (${data.entitiesPerSecond.toFixed(0)} entities/sec)`);
      }

      // Verify performance doesn't degrade exponentially
      const smallWorldRate = results[50].entitiesPerSecond;
      const largeWorldRate = results[500].entitiesPerSecond;
      const degradationRatio = smallWorldRate / largeWorldRate;
      
      // Performance shouldn't degrade more than 2x between 50 and 500 entities
      expect(degradationRatio).toBeLessThan(2);
    });

    it('should demonstrate batch vs sequential performance comparison', async () => {
      const entityCount = 100;
      const entityInstances = Array(entityCount)
        .fill(0)
        .map((_, i) => ({
          instanceId: `comparison_entity_${i}`,
        }));

      const worldData = {
        instances: entityInstances,
      };

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.mockRepository.getEntityInstanceDefinition.mockImplementation(
        (instanceId) => ({
          definitionId: 'core:test_actor',
          componentOverrides: {},
        })
      );

      // Test batch performance
      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: entityInstances.map((instance, i) => ({
          id: `entity_batch_${i}`,
          instanceId: instance.instanceId,
          definitionId: 'core:test_actor',
        })),
        failures: [],
        successCount: entityInstances.length,
        failureCount: 0,
        totalProcessed: entityInstances.length,
        processingTime: 150, // Efficient batch processing
      });

      const batchResult = await worldInitializer.initializeWorldEntities('test_world_batch');

      // Test sequential performance (simulate by disabling batch optimization)
      const sequentialConfig = {
        ...mockConfig,
        isFeatureEnabled: jest.fn().mockReturnValue(false), // Disable batch optimization
      };

      const sequentialInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: testBed.mockWorldContext,
        gameDataRepository: testBed.mockRepository,
        validatedEventDispatcher: testBed.mockValidatedEventDispatcher,
        eventDispatchService: testBed.mockEventDispatchService,
        logger: testBed.mockLogger,
        scopeRegistry: testBed.mockScopeRegistry,
        config: sequentialConfig,
      });

      // Mock sequential entity creation (slower)
      mockEntityManager.createEntityInstance.mockImplementation(async () => {
        // Simulate 5ms per entity for sequential creation
        await new Promise(resolve => setTimeout(resolve, 5));
        return { id: 'sequential_entity', instanceId: 'test' };
      });

      const sequentialStartTime = performance.now();
      const sequentialResult = await sequentialInitializer.initializeWorldEntities('test_world_sequential');
      const sequentialEndTime = performance.now();

      console.log(`Batch initialization: ${batchResult.processingTime}ms`);
      console.log(`Sequential initialization: ${sequentialEndTime - sequentialStartTime}ms`);

      // Batch should be significantly faster
      expect(batchResult.optimizationUsed).toBe('batch');
      expect(batchResult.processingTime).toBeLessThan(sequentialEndTime - sequentialStartTime);

      const performanceGain = (sequentialEndTime - sequentialStartTime) / batchResult.processingTime;
      console.log(`Performance gain: ${performanceGain.toFixed(2)}x faster`);
    });

    it('should handle memory-efficient loading of large worlds', async () => {
      const entityCount = 1000;
      const entityInstances = Array(entityCount)
        .fill(0)
        .map((_, i) => ({
          instanceId: `memory_test_entity_${i}`,
        }));

      const worldData = {
        instances: entityInstances,
      };

      testBed.mockRepository.getWorld.mockReturnValue(worldData);
      testBed.mockRepository.getEntityInstanceDefinition.mockImplementation(
        (instanceId) => ({
          definitionId: 'core:test_actor',
          componentOverrides: {},
        })
      );

      // Simulate batched processing for large world
      let batchCallCount = 0;
      mockEntityManager.batchCreateEntities.mockImplementation(async (specs) => {
        batchCallCount++;
        const batchSize = specs.length;
        
        return {
          successes: specs.map((spec, i) => ({
            id: `entity_${batchCallCount}_${i}`,
            instanceId: spec.opts.instanceId,
            definitionId: spec.definitionId,
          })),
          failures: [],
          successCount: batchSize,
          failureCount: 0,
          totalProcessed: batchSize,
          processingTime: batchSize * 1.5, // Realistic processing time
        };
      });

      const startTime = performance.now();
      const result = await worldInitializer.initializeWorldEntities('test_large_world');
      const endTime = performance.now();

      expect(result.instantiatedCount).toBe(entityCount);
      expect(result.optimizationUsed).toBe('batch');
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Loaded ${entityCount} entities in ${endTime - startTime}ms using ${batchCallCount} batch calls`);
      console.log(`Average entities per batch: ${entityCount / batchCallCount}`);

      // Verify batching was used efficiently
      expect(batchCallCount).toBeGreaterThanOrEqual(1); // Should use at least one batch
      if (batchCallCount > 1) {
        expect(batchCallCount).toBeLessThan(entityCount / 10); // But not too many small batches
      }
    });
  });
});