/**
 * @file Unit tests for WorldInitializer uncovered methods to improve test coverage
 * @description Tests targeting specific uncovered lines: 274, 329, 547, 550, 553
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';

describe('WorldInitializer - Uncovered Methods Coverage', () => {
  let worldInitializer;
  let mockEntityManager;
  let mockWorldContext;
  let mockRepository;
  let mockValidatedEventDispatcher;
  let mockEventDispatchService;
  let mockLogger;
  let mockScopeRegistry;
  let mockConfig;

  const createMockEntityInstance = (
    instanceId,
    definitionId,
    initialComponentsData = {}
  ) => {
    const internalComponentsMap = new Map();

    for (const [type, data] of Object.entries(initialComponentsData)) {
      internalComponentsMap.set(type, JSON.parse(JSON.stringify(data)));
    }

    return {
      id: instanceId,
      instanceId,
      definitionId: definitionId,
      getComponentData: jest.fn((componentTypeId) => {
        const data = internalComponentsMap.get(componentTypeId);
        return data ? JSON.parse(JSON.stringify(data)) : undefined;
      }),
      addComponent: jest.fn((componentTypeId, componentData) => {
        internalComponentsMap.set(
          componentTypeId,
          JSON.parse(JSON.stringify(componentData))
        );
      }),
      hasComponent: jest.fn((componentTypeId) =>
        internalComponentsMap.has(componentTypeId)
      ),
    };
  };

  beforeEach(() => {
    // Standard mock setup following existing patterns
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      batchCreateEntities: jest.fn(),
      hasBatchSupport: jest.fn().mockReturnValue(true),
      getAllComponents: jest.fn(),
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

    // Set up default config values to avoid batch processing (for original method testing)
    mockConfig.isFeatureEnabled.mockImplementation((key) => {
      if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION') return false;
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

  describe('batch validation failures - #validateAndPrepareSpec (Line 274)', () => {
    it('should return null when validation fails for missing instanceId', async () => {
      // Arrange: world instance without instanceId
      const invalidWorldInstance = {
        definitionId: 'test:def',
        // Missing instanceId
      };
      const worldName = 'test:world';

      // Mock repository to return null for missing instance definition
      mockRepository.getEntityInstanceDefinition.mockReturnValue(null);

      // Act: Call the method via initializeWorldEntities to trigger validation
      mockRepository.getWorld.mockReturnValue({
        instances: [invalidWorldInstance],
      });

      const result = await worldInitializer.initializeWorldEntities(worldName);

      // Assert: Should handle invalid instance gracefully
      expect(result.instantiatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer (Pass 1): Skipping invalid world instance (missing instanceId):',
        invalidWorldInstance
      );
    });

    it('should return null when getEntityInstanceDefinition returns null', async () => {
      // Arrange: valid world instance but missing entity definition
      const worldInstance = {
        instanceId: 'test:missing_def',
      };
      const worldName = 'test:world';

      // Mock repository to return null for missing entity definition
      mockRepository.getWorld.mockReturnValue({
        instances: [worldInstance],
      });
      mockRepository.getEntityInstanceDefinition.mockReturnValue(null);

      // Act
      const result = await worldInitializer.initializeWorldEntities(worldName);

      // Assert: Should skip instance with missing definition
      expect(result.instantiatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "WorldInitializer (Pass 1): Entity instance definition not found for instance ID: 'test:missing_def'. Referenced in world 'test:world'. Skipping."
      );
    });
  });

  describe('empty batch handling - #executeBatchEntityCreation (Line 329)', () => {
    it('should return early result when entitySpecs is empty', async () => {
      // Arrange: Enable batch processing and create empty world
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      mockRepository.getWorld.mockReturnValue({
        instances: [], // Empty instances array
      });

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should return early with empty result
      expect(result).toEqual({
        entities: [],
        instantiatedCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        optimizationUsed: 'sequential',
      });

      // Should not call batch creation
      expect(mockEntityManager.batchCreateEntities).not.toHaveBeenCalled();
    });

    it('should handle empty entitySpecs after validation failures in batch mode', async () => {
      // Arrange: Enable batch processing
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      // Create instances that will all fail validation
      const invalidInstances = [
        { instanceId: 'test:invalid1' },
        { instanceId: 'test:invalid2' },
        { instanceId: 'test:invalid3' },
        { instanceId: 'test:invalid4' },
        { instanceId: 'test:invalid5' }, // 5 instances to trigger batch mode
      ];

      mockRepository.getWorld.mockReturnValue({
        instances: invalidInstances,
      });

      // Mock all instance definitions to return null (validation failures)
      mockRepository.getEntityInstanceDefinition.mockReturnValue(null);

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should handle all validation failures
      expect(result.instantiatedCount).toBe(0);
      expect(result.failedCount).toBe(5);
      expect(result.totalProcessed).toBe(5);
    });
  });

  describe('error classification - #classifyBatchError (Lines 547, 550, 553)', () => {
    it('should classify ValidationError correctly', async () => {
      // Arrange: Enable batch processing and setup failure
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      const instances = Array(5)
        .fill(null)
        .map((_, i) => ({ instanceId: `test:instance${i}` }));

      mockRepository.getWorld.mockReturnValue({ instances });
      mockRepository.getEntityInstanceDefinition.mockReturnValue({
        definitionId: 'test:def',
      });

      // Mock batch creation to fail with ValidationError
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'test:instance0' } },
            error: validationError,
          },
        ],
        successCount: 0,
        failureCount: 1,
      });

      // Act
      await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should log the failure but continue (non-critical)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer: Failed to create entity in batch: test:instance0',
        validationError
      );
    });

    it('should classify EntityNotFoundError correctly', async () => {
      // Arrange: Enable batch processing and setup failure
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      const instances = Array(5)
        .fill(null)
        .map((_, i) => ({ instanceId: `test:instance${i}` }));

      mockRepository.getWorld.mockReturnValue({ instances });
      mockRepository.getEntityInstanceDefinition.mockReturnValue({
        definitionId: 'test:def',
      });

      // Mock batch creation to fail with EntityNotFoundError
      const entityNotFoundError = new Error('Entity not found');
      entityNotFoundError.name = 'EntityNotFoundError';

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'test:instance0' } },
            error: entityNotFoundError,
          },
        ],
        successCount: 0,
        failureCount: 1,
      });

      // Act
      await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should log the failure but continue (non-critical)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer: Failed to create entity in batch: test:instance0',
        entityNotFoundError
      );
    });

    it('should classify timeout errors correctly and trigger fallback', async () => {
      // Arrange: Enable batch processing and setup timeout failure
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      const instances = Array(5)
        .fill(null)
        .map((_, i) => ({ instanceId: `test:instance${i}` }));

      mockRepository.getWorld.mockReturnValue({ instances });
      mockRepository.getEntityInstanceDefinition.mockReturnValue({
        definitionId: 'test:def',
      });

      // Mock batch creation to fail with timeout error
      const timeoutError = new Error('Operation timeout exceeded');

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'test:instance0' } },
            error: timeoutError,
          },
        ],
        successCount: 0,
        failureCount: 1,
      });

      // Mock sequential fallback
      mockEntityManager.createEntityInstance.mockResolvedValue(
        createMockEntityInstance('test:instance0', 'test:def')
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should trigger fallback to sequential processing
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to sequential processing')
      );
      expect(result.optimizationUsed).toBe('sequential_fallback');
    });

    it('should classify RepositoryConsistencyError and trigger fallback', async () => {
      // Arrange: Enable batch processing and setup consistency failure
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      const instances = Array(5)
        .fill(null)
        .map((_, i) => ({ instanceId: `test:instance${i}` }));

      mockRepository.getWorld.mockReturnValue({ instances });
      mockRepository.getEntityInstanceDefinition.mockReturnValue({
        definitionId: 'test:def',
      });

      // Mock batch creation to fail with RepositoryConsistencyError
      const consistencyError = new Error('Repository consistency violation');
      consistencyError.name = 'RepositoryConsistencyError';

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'test:instance0' } },
            error: consistencyError,
          },
        ],
        successCount: 0,
        failureCount: 1,
      });

      // Mock sequential fallback
      mockEntityManager.createEntityInstance.mockResolvedValue(
        createMockEntityInstance('test:instance0', 'test:def')
      );

      // Act
      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should trigger fallback due to critical failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Critical failures detected in batch operation')
      );
      expect(result.optimizationUsed).toBe('sequential_fallback');
    });

    it('should classify unknown errors correctly', async () => {
      // Arrange: Enable batch processing and setup unknown failure
      mockConfig.isFeatureEnabled.mockImplementation((key) => {
        if (key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION')
          return true;
        return false;
      });

      const instances = Array(5)
        .fill(null)
        .map((_, i) => ({ instanceId: `test:instance${i}` }));

      mockRepository.getWorld.mockReturnValue({ instances });
      mockRepository.getEntityInstanceDefinition.mockReturnValue({
        definitionId: 'test:def',
      });

      // Mock batch creation to fail with unknown error type
      const unknownError = new Error('Some unknown error');
      unknownError.name = 'UnknownErrorType';

      mockEntityManager.batchCreateEntities.mockResolvedValue({
        successes: [],
        failures: [
          {
            item: { opts: { instanceId: 'test:instance0' } },
            error: unknownError,
          },
        ],
        successCount: 0,
        failureCount: 1,
      });

      // Act
      await worldInitializer.initializeWorldEntities('test:world');

      // Assert: Should log the failure but continue (non-critical)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer: Failed to create entity in batch: test:instance0',
        unknownError
      );
    });
  });

});
