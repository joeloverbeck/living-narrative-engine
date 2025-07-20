/**
 * @file Unit tests for WorldInitializer batch operations functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { WORLDINIT_ENTITY_INSTANTIATED_ID, WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID } from '../../../src/constants/eventIds.js';
import { WorldInitializationError } from '../../../src/errors/InitializationError.js';

describe('WorldInitializer - Batch Operations', () => {
  let worldInitializer;
  let mockEntityManager;
  let mockWorldContext;
  let mockRepository;
  let mockValidatedEventDispatcher;
  let mockEventDispatchService;
  let mockLogger;
  let mockScopeRegistry;
  let mockConfig;

  beforeEach(() => {
    // Mock entity manager with batch support
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      batchCreateEntities: jest.fn(),
      hasBatchSupport: jest.fn().mockReturnValue(true),
    };

    mockWorldContext = {};

    mockRepository = {
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      get: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockEventDispatchService = {
      dispatchWithLogging: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockScopeRegistry = {
      initialize: jest.fn(),
    };

    mockConfig = {
      isFeatureEnabled: jest.fn(),
      getValue: jest.fn(),
    };

    // Set up default config values
    mockConfig.isFeatureEnabled.mockImplementation((key) => {
      if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION') return true;
      return false;
    });

    mockConfig.getValue.mockImplementation((key) => {
      const values = {
        'performance.WORLD_LOADING_BATCH_SIZE': 25,
        'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
        'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
        'performance.WORLD_LOADING_BATCH_THRESHOLD': 5,
        'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
      };
      return values[key];
    });

    worldInitializer = new WorldInitializer({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      logger: mockLogger,
      scopeRegistry: mockScopeRegistry,
      config: mockConfig,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('batch entity creation', () => {
    it('should use batch operations for large worlds', async () => {
      // Arrange
      const worldInstances = Array(25).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      const batchResult = {
        successes: worldInstances.map((instance, i) => ({
          id: `entity_id_${i}`,
          instanceId: instance.instanceId,
          definitionId: 'test:definition',
        })),
        failures: [],
        successCount: worldInstances.length,
        failureCount: 0,
        totalProcessed: worldInstances.length,
        processingTime: 150,
      };

      mockEntityManager.batchCreateEntities.mockResolvedValue(batchResult);

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            definitionId: 'test:definition',
            opts: expect.objectContaining({
              instanceId: expect.any(String),
            }),
          }),
        ]),
        expect.objectContaining({
          batchSize: expect.any(Number),
          enableParallel: true,
          stopOnError: false,
        })
      );

      expect(result.instantiatedCount).toBe(worldInstances.length);
      expect(result.optimizationUsed).toBe('batch');
      expect(mockEventDispatchService.dispatchWithLogging).toHaveBeenCalledTimes(worldInstances.length);
    });

    it('should fall back to sequential processing for small worlds', async () => {
      // Arrange
      const worldInstances = [
        { instanceId: 'entity_1' },
        { instanceId: 'entity_2' },
      ];

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(result.instantiatedCount).toBe(2);
      expect(result.optimizationUsed).toBe('sequential');
    });

    it('should handle batch operation failures gracefully', async () => {
      // Arrange
      const worldInstances = Array(10).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      const batchResult = {
        successes: [
          { id: 'entity_id_0', instanceId: 'entity_0', definitionId: 'test:definition' },
          { id: 'entity_id_1', instanceId: 'entity_1', definitionId: 'test:definition' },
        ],
        failures: [
          { 
            item: { 
              definitionId: 'test:definition',
              opts: { instanceId: 'entity_2' } 
            }, 
            error: new Error('Creation failed') 
          },
        ],
        successCount: 2,
        failureCount: 1,
        totalProcessed: 3,
        processingTime: 200,
      };

      mockEntityManager.batchCreateEntities.mockResolvedValue(batchResult);

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.optimizationUsed).toBe('batch');
      
      // Verify success events were dispatched
      expect(mockEventDispatchService.dispatchWithLogging).toHaveBeenCalledWith(
        WORLDINIT_ENTITY_INSTANTIATED_ID,
        expect.objectContaining({
          entityId: 'entity_id_0',
          instanceId: 'entity_0',
          reason: 'Initial World Load (Batch)',
        }),
        expect.any(String),
        { allowSchemaNotFound: true }
      );

      // Verify failure events were dispatched
      expect(mockEventDispatchService.dispatchWithLogging).toHaveBeenCalledWith(
        WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
        expect.objectContaining({
          instanceId: 'entity_2',
          error: 'Creation failed',
          reason: 'Initial World Load (Batch)',
        }),
        expect.any(String),
        { allowSchemaNotFound: true }
      );
    });

    it('should use correct batch size for different world sizes', async () => {
      const testCases = [
        { entityCount: 10, expectedMinBatch: 10 }, // Small world, single batch
        { entityCount: 50, expectedMinBatch: 25 }, // Medium world, multiple batches
        { entityCount: 200, expectedMinBatch: 50 }, // Large world, capped batch size
      ];

      for (const { entityCount, expectedMinBatch } of testCases) {
        // Arrange
        const worldInstances = Array(entityCount).fill(0).map((_, i) => ({
          instanceId: `entity_${i}`,
        }));

        const worldData = {
          instances: worldInstances,
        };

        mockRepository.getWorld.mockReturnValue(worldData);
        mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
          definitionId: 'test:definition',
          componentOverrides: {},
        }));

        mockEntityManager.batchCreateEntities.mockResolvedValue({
          successes: [],
          failures: [],
          successCount: 0,
          failureCount: 0,
          totalProcessed: 0,
          processingTime: 0,
        });

        // Act
        await worldInitializer.initializeWorldEntities(`test_world_${entityCount}`);

        // Assert
        expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            batchSize: expect.any(Number),
          })
        );

        const lastCall = mockEntityManager.batchCreateEntities.mock.calls[mockEntityManager.batchCreateEntities.mock.calls.length - 1];
        const batchSize = lastCall[1].batchSize;
        expect(batchSize).toBeGreaterThanOrEqual(expectedMinBatch);

        mockEntityManager.batchCreateEntities.mockClear();
      }
    });

    it('should fall back to sequential processing on critical batch failures', async () => {
      // Arrange
      const worldInstances = Array(10).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      // First call (batch) returns critical failure
      const batchResult = {
        successes: [],
        failures: [
          { 
            item: { opts: { instanceId: 'entity_0' } }, 
            error: { name: 'RepositoryConsistencyError', message: 'Critical failure' } 
          },
        ],
        successCount: 0,
        failureCount: 1,
        totalProcessed: 1,
        processingTime: 50,
      };

      mockEntityManager.batchCreateEntities.mockResolvedValue(batchResult);

      // Sequential fallback
      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(worldInstances.length);
      expect(result.optimizationUsed).toBe('sequential_fallback');
      expect(result.fallbackReason).toBe('Critical batch failures detected');
    });

    it('should handle batch operation exceptions with fallback', async () => {
      // Arrange
      const worldInstances = Array(10).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      // Batch operation throws exception
      mockEntityManager.batchCreateEntities.mockRejectedValue(new Error('Batch operation failed'));

      // Sequential fallback should work
      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(worldInstances.length);
      expect(result.optimizationUsed).toBe('sequential_fallback');
      expect(result.fallbackReason).toContain('Batch operation error');
    });
  });

  describe('configuration handling', () => {
    it('should respect batch operations disabled setting', async () => {
      // Arrange
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION') return false;
        return false;
      });

      const worldInstances = Array(25).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(25);
      expect(result.optimizationUsed).toBe('sequential');
    });

    it('should respect batch threshold configuration', async () => {
      // Arrange
      mockConfig.getValue.mockImplementation((key) => {
        const values = {
          'performance.WORLD_LOADING_BATCH_SIZE': 25,
          'performance.WORLD_LOADING_MAX_BATCH_SIZE': 100,
          'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
          'performance.WORLD_LOADING_BATCH_THRESHOLD': 10, // Higher threshold
          'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
        };
        return values[key];
      });

      const worldInstances = Array(8).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(8);
      expect(result.optimizationUsed).toBe('sequential');
    });

    it('should handle missing batch support gracefully', async () => {
      // Arrange
      mockEntityManager.hasBatchSupport.mockReturnValue(false);

      const worldInstances = Array(25).fill(0).map((_, i) => ({
        instanceId: `entity_${i}`,
      }));

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'test:definition',
        componentOverrides: {},
      }));

      mockEntityManager.createEntityInstance.mockImplementation((definitionId, opts) => ({
        id: `entity_id_${opts.instanceId}`,
        instanceId: opts.instanceId,
        definitionId,
      }));

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(25);
      expect(result.optimizationUsed).toBe('sequential');
    });
  });

  describe('error handling', () => {
    it('should handle invalid world instances gracefully in batch mode', async () => {
      // Arrange - Need enough entities to trigger batch mode (threshold is 5)
      const worldInstances = [
        { instanceId: 'valid_entity_1' },
        { /* missing instanceId */ },
        { instanceId: 'valid_entity_2' },
        { instanceId: 'valid_entity_1' }, // Duplicate
        { instanceId: 'valid_entity_3' },
        { instanceId: 'valid_entity_4' },
        { instanceId: 'valid_entity_5' },
      ];

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => {
        if (instanceId.startsWith('valid_')) {
          return {
            definitionId: 'test:definition',
            componentOverrides: {},
          };
        }
        return null;
      });

      const batchResult = {
        successes: [
          { id: 'entity_id_1', instanceId: 'valid_entity_1', definitionId: 'test:definition' },
          { id: 'entity_id_2', instanceId: 'valid_entity_2', definitionId: 'test:definition' },
          { id: 'entity_id_3', instanceId: 'valid_entity_3', definitionId: 'test:definition' },
          { id: 'entity_id_4', instanceId: 'valid_entity_4', definitionId: 'test:definition' },
          { id: 'entity_id_5', instanceId: 'valid_entity_5', definitionId: 'test:definition' },
        ],
        failures: [],
        successCount: 5,
        failureCount: 0,
        totalProcessed: 5,
        processingTime: 100,
      };

      mockEntityManager.batchCreateEntities.mockResolvedValue(batchResult);

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(5);
      expect(result.optimizationUsed).toBe('batch');
      
      // Should only have processed valid, non-duplicate entities (5 out of 7)
      expect(mockEntityManager.batchCreateEntities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            opts: expect.objectContaining({
              instanceId: 'valid_entity_1',
            }),
          }),
          expect.objectContaining({
            opts: expect.objectContaining({
              instanceId: 'valid_entity_2',
            }),
          }),
          expect.objectContaining({
            opts: expect.objectContaining({
              instanceId: 'valid_entity_3',
            }),
          }),
          expect.objectContaining({
            opts: expect.objectContaining({
              instanceId: 'valid_entity_4',
            }),
          }),
          expect.objectContaining({
            opts: expect.objectContaining({
              instanceId: 'valid_entity_5',
            }),
          }),
        ]),
        expect.any(Object)
      );

      // Should have logged warnings for invalid instances
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid world instance (missing instanceId)'),
        expect.any(Object)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate instanceId')
      );
    });

    it('should handle all invalid entity definitions as failures', async () => {
      // Arrange - Small number of invalid instances (below batch threshold)
      const worldInstances = [
        { instanceId: 'invalid_entity_1' },
        { instanceId: 'invalid_entity_2' },
      ];

      const worldData = {
        instances: worldInstances,
      };

      mockRepository.getWorld.mockReturnValue(worldData);
      mockRepository.getEntityInstanceDefinition.mockReturnValue(null); // All invalid - should fail

      // Act
      const result = await worldInitializer.initializeWorldEntities('test_world');

      // Assert
      expect(result.instantiatedCount).toBe(0);
      expect(result.failedCount).toBe(2); // Both count as failures
      expect(result.totalProcessed).toBe(worldInstances.length);
      expect(result.optimizationUsed).toBe('sequential');
      
      // Should have used sequential processing (below threshold) but no entities actually created
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
      expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled(); // None processed due to validation failure
    });
  });
});