/**
 * @file Integration tests for WorldInitializer batch operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { createTestBed } from '../../common/testBed.js';
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../../../src/constants/eventIds.js';

describe('WorldInitializer - Batch Operations Integration', () => {
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

  describe('end-to-end batch world loading', () => {
    it('should load medium-sized world using batch operations', async () => {
      // Arrange
      const entityInstances = Array(15)
        .fill(0)
        .map((_, i) => ({
          instanceId: `world_entity_${i}`,
        }));

      const worldData = {
        instances: entityInstances,
      };

      // Set up repository to return world data
      testBed.mockRepository.getWorld.mockReturnValue(worldData);

      // Set up entity instance definitions
      testBed.mockRepository.getEntityInstanceDefinition.mockImplementation(
        (instanceId) => ({
          definitionId: 'core:test_actor',
          componentOverrides: {
            'core:location': { locationId: 'test_location' },
          },
        })
      );

      // Set up batch entity creation
      const createdEntities = entityInstances.map((instance, i) => ({
        id: `entity_${i}`,
        instanceId: instance.instanceId,
        definitionId: 'core:test_actor',
      }));

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: createdEntities,
        failures: [],
        successCount: createdEntities.length,
        failureCount: 0,
        totalProcessed: createdEntities.length,
        processingTime: 120,
      });

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(entityInstances.length);
      expect(result.failedCount).toBe(0);
      expect(result.totalProcessed).toBe(entityInstances.length);
      expect(result.optimizationUsed).toBe('batch');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify batch operations were used
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();

      // Verify correct batch configuration
      const batchCall = mockEntityManager.batchCreateEntities.mock.calls[0];
      const [entitySpecs, batchOptions] = batchCall;

      expect(entitySpecs).toHaveLength(entityInstances.length);
      expect(batchOptions).toMatchObject({
        batchSize: expect.any(Number),
        enableParallel: true,
        stopOnError: false,
      });

      // Verify entity specifications are correct
      entitySpecs.forEach((spec, i) => {
        expect(spec).toMatchObject({
          definitionId: 'core:test_actor',
          opts: {
            instanceId: `world_entity_${i}`,
            componentOverrides: {
              'core:location': { locationId: 'test_location' },
            },
          },
        });
      });

      // Verify events were dispatched for each entity
      expect(
        testBed.mockEventDispatchService.dispatchWithLogging
      ).toHaveBeenCalledTimes(entityInstances.length);

      // Check that all success events were dispatched
      createdEntities.forEach((entity) => {
        expect(
          testBed.mockEventDispatchService.dispatchWithLogging
        ).toHaveBeenCalledWith(
          WORLDINIT_ENTITY_INSTANTIATED_ID,
          expect.objectContaining({
            entityId: entity.id,
            instanceId: entity.instanceId,
            definitionId: entity.definitionId,
            worldName: 'test_world',
            reason: 'Initial World Load (Batch)',
          }),
          expect.any(String),
          { allowSchemaNotFound: true }
        );
      });
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Arrange
      const entityInstances = Array(8)
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

      // Simulate partial failures
      const successfulEntities = [
        {
          id: 'entity_0',
          instanceId: 'world_entity_0',
          definitionId: 'core:test_actor',
        },
        {
          id: 'entity_1',
          instanceId: 'world_entity_1',
          definitionId: 'core:test_actor',
        },
        {
          id: 'entity_3',
          instanceId: 'world_entity_3',
          definitionId: 'core:test_actor',
        },
      ];

      const failedEntities = [
        {
          item: {
            definitionId: 'core:test_actor',
            opts: { instanceId: 'world_entity_2' },
          },
          error: new Error('Entity creation failed'),
        },
        {
          item: {
            definitionId: 'core:test_actor',
            opts: { instanceId: 'world_entity_4' },
          },
          error: new Error('Validation error'),
        },
      ];

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: successfulEntities,
        failures: failedEntities,
        successCount: successfulEntities.length,
        failureCount: failedEntities.length,
        totalProcessed: successfulEntities.length + failedEntities.length,
        processingTime: 180,
      });

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(3);
      expect(result.failedCount).toBe(2);
      expect(result.totalProcessed).toBe(entityInstances.length);
      expect(result.optimizationUsed).toBe('batch');

      // Verify success events
      successfulEntities.forEach((entity) => {
        expect(
          testBed.mockEventDispatchService.dispatchWithLogging
        ).toHaveBeenCalledWith(
          WORLDINIT_ENTITY_INSTANTIATED_ID,
          expect.objectContaining({
            entityId: entity.id,
            instanceId: entity.instanceId,
            reason: 'Initial World Load (Batch)',
          }),
          expect.any(String),
          { allowSchemaNotFound: true }
        );
      });

      // Verify failure events
      failedEntities.forEach((failure) => {
        expect(
          testBed.mockEventDispatchService.dispatchWithLogging
        ).toHaveBeenCalledWith(
          WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
          expect.objectContaining({
            instanceId: failure.item.opts.instanceId,
            error: failure.error.message,
            reason: 'Initial World Load (Batch)',
          }),
          expect.any(String),
          { allowSchemaNotFound: true }
        );
      });
    });

    it('should automatically fallback to sequential processing when batch operations fail', async () => {
      // Arrange
      const entityInstances = Array(10)
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

      // First attempt (batch) fails
      mockEntityManager.batchCreateEntities.mockRejectedValue(
        new Error('Batch operation timeout')
      );

      // Sequential fallback succeeds
      mockEntityManager.createEntityInstance.mockImplementation(
        (definitionId, opts) => ({
          id: `entity_${opts.instanceId}`,
          instanceId: opts.instanceId,
          definitionId,
        })
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(entityInstances.length);
      expect(result.failedCount).toBe(0);
      expect(result.optimizationUsed).toBe('sequential_fallback');
      expect(result.fallbackReason).toContain('Batch operation error');

      // Verify both batch and sequential operations were attempted
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(
        entityInstances.length
      );

      // Verify error was logged
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Batch operation failed'),
        expect.any(Error)
      );

      // Verify fallback was logged
      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to sequential processing')
      );
    });

    it('should respect configuration-driven optimization selection', async () => {
      // Arrange - Small world that should use sequential processing
      const entityInstances = Array(3)
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

      mockEntityManager.createEntityInstance.mockImplementation(
        (definitionId, opts) => ({
          id: `entity_${opts.instanceId}`,
          instanceId: opts.instanceId,
          definitionId,
        })
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(entityInstances.length);
      expect(result.optimizationUsed).toBe('sequential');

      // Should use sequential processing due to small size
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(
        entityInstances.length
      );
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
    });

    it('should handle critical batch failures with automatic fallback', async () => {
      // Arrange
      const entityInstances = Array(12)
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

      // Batch operation returns critical failures
      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'world_entity_0' } },
            error: {
              name: 'RepositoryConsistencyError',
              message: 'Critical consistency error',
            },
          },
        ],
        successCount: 0,
        failureCount: 1,
        totalProcessed: 1,
        processingTime: 50,
      });

      // Sequential fallback
      mockEntityManager.createEntityInstance.mockImplementation(
        (definitionId, opts) => ({
          id: `entity_${opts.instanceId}`,
          instanceId: opts.instanceId,
          definitionId,
        })
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(entityInstances.length);
      expect(result.optimizationUsed).toBe('sequential_fallback');
      expect(result.fallbackReason).toBe('Critical batch failures detected');

      // Verify both operations were attempted
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(
        entityInstances.length
      );

      // Verify critical failure was logged
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Critical failures detected in batch operation')
      );
    });
  });

  describe('configuration integration', () => {
    it('should respect disabled optimization setting', async () => {
      // Arrange
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return false;
        return false;
      });

      const entityInstances = Array(20)
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

      mockEntityManager.createEntityInstance.mockImplementation(
        (definitionId, opts) => ({
          id: `entity_${opts.instanceId}`,
          instanceId: opts.instanceId,
          definitionId,
        })
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.optimizationUsed).toBe('sequential');
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(
        entityInstances.length
      );
    });

    it('should use custom batch size configuration', async () => {
      // Arrange
      mockConfig.getValue.mockImplementation((key) => {
        const values = {
          'performance.WORLD_LOADING_BATCH_SIZE': 50, // Custom batch size
          'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
          'performance.WORLD_LOADING_ENABLE_PARALLEL': false, // Disable parallel
          'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
          'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
        };
        return values[key];
      });

      const entityInstances = Array(25)
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

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [],
        successCount: 0,
        failureCount: 0,
        totalProcessed: 0,
        processingTime: 0,
      });

      // Act
      await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          batchSize: expect.any(Number),
          enableParallel: false, // Custom setting respected
        })
      );
    });
  });

});
