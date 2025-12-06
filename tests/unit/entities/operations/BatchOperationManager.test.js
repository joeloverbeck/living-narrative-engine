import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BatchOperationManager from '../../../../src/entities/operations/BatchOperationManager.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

// Mock the configUtils module
jest.mock('../../../../src/entities/utils/configUtils.js', () => ({
  validateBatchSize: jest.fn(),
}));

// Mock the validateDependency function
jest.mock('../../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

// Mock the ensureValidLogger function
jest.mock('../../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn((logger) => logger),
}));

// Import mocked modules
import { validateBatchSize } from '../../../../src/entities/utils/configUtils.js';
import { validateDependency } from '../../../../src/utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../../src/utils/loggerUtils.js';

/**
 * Creates mock dependencies for BatchOperationManager
 *
 * @param {object} overrides - Optional overrides for specific dependencies
 * @returns {object} Mock dependencies
 */
const createMockDependencies = (overrides = {}) => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockLifecycleManager = {
    createEntityInstance: jest.fn(),
    removeEntityInstance: jest.fn(),
  };

  const mockComponentMutationService = {
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
  };

  return {
    logger: mockLogger,
    lifecycleManager: mockLifecycleManager,
    componentMutationService: mockComponentMutationService,
    defaultBatchSize: 50,
    enableTransactions: true,
    ...overrides,
  };
};

/**
 * Creates a BatchOperationManager instance with mock dependencies
 *
 * @param {object} dependencyOverrides - Optional dependency overrides
 * @returns {BatchOperationManager} Configured instance
 */
const createBatchOperationManager = (dependencyOverrides = {}) => {
  const deps = createMockDependencies(dependencyOverrides);
  return new BatchOperationManager(deps);
};

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementations
  validateDependency.mockImplementation(() => {});
  validateBatchSize.mockImplementation(() => {});
  ensureValidLogger.mockImplementation((logger) => logger);
});

describe('BatchOperationManager - Constructor and Dependencies', () => {
  it('should initialize with valid dependencies', () => {
    const manager = createBatchOperationManager();

    expect(manager).toBeInstanceOf(BatchOperationManager);
    expect(validateDependency).toHaveBeenCalledTimes(3);
    expect(ensureValidLogger).toHaveBeenCalled();
  });

  it('should use default values when optional parameters not provided', () => {
    const deps = createMockDependencies();
    delete deps.defaultBatchSize;
    delete deps.enableTransactions;

    const manager = new BatchOperationManager(deps);

    expect(manager).toBeInstanceOf(BatchOperationManager);
    const stats = manager.getStats();
    expect(stats.defaultBatchSize).toBe(50);
    expect(stats.enableTransactions).toBe(true);
  });

  it('should use provided values for optional parameters', () => {
    const manager = createBatchOperationManager({
      defaultBatchSize: 25,
      enableTransactions: false,
    });

    const stats = manager.getStats();
    expect(stats.defaultBatchSize).toBe(25);
    expect(stats.enableTransactions).toBe(false);
  });

  it('should validate logger dependency', () => {
    const deps = createMockDependencies();
    // Don't actually pass null logger to avoid runtime error

    new BatchOperationManager(deps);

    expect(validateDependency).toHaveBeenCalledWith(
      deps.logger,
      'ILogger',
      console,
      {
        requiredMethods: ['info', 'error', 'warn', 'debug'],
      }
    );
  });

  it('should validate lifecycleManager dependency', () => {
    const deps = createMockDependencies();

    new BatchOperationManager(deps);

    expect(validateDependency).toHaveBeenCalledWith(
      deps.lifecycleManager,
      'EntityLifecycleManager',
      deps.logger,
      {
        requiredMethods: ['createEntityInstance', 'removeEntityInstance'],
      }
    );
  });

  it('should validate componentMutationService dependency', () => {
    const deps = createMockDependencies();

    new BatchOperationManager(deps);

    expect(validateDependency).toHaveBeenCalledWith(
      deps.componentMutationService,
      'ComponentMutationService',
      deps.logger,
      {
        requiredMethods: ['addComponent', 'removeComponent'],
      }
    );
  });

  it('should log debug message during initialization', () => {
    const deps = createMockDependencies();
    new BatchOperationManager(deps);

    expect(deps.logger.debug).toHaveBeenCalledWith(
      'BatchOperationManager initialized',
      {
        defaultBatchSize: 50,
        enableTransactions: true,
      }
    );
  });
});

describe('BatchOperationManager - Batch Create Entities', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
    // Mock performance.now for consistent timing tests
    global.performance = { now: jest.fn().mockReturnValue(1000) };
  });

  afterEach(() => {
    delete global.performance;
  });

  it('should create entities successfully in sequential mode', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: { instanceId: 'id1' } },
      { definitionId: 'test:entity2', opts: { instanceId: 'id2' } },
    ];

    mockDeps.lifecycleManager.createEntityInstance
      .mockResolvedValueOnce({ id: 'id1', definitionId: 'test:entity1' })
      .mockResolvedValueOnce({ id: 'id2', definitionId: 'test:entity2' });

    const result = await manager.batchCreateEntities(entitySpecs);

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);

    expect(
      mockDeps.lifecycleManager.createEntityInstance
    ).toHaveBeenCalledTimes(2);
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch entity creation: 2 entities'
    );
  });

  it('should create entities successfully in parallel mode', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: {} },
      { definitionId: 'test:entity2', opts: {} },
    ];

    mockDeps.lifecycleManager.createEntityInstance
      .mockResolvedValueOnce({ id: 'id1' })
      .mockResolvedValueOnce({ id: 'id2' });

    const result = await manager.batchCreateEntities(entitySpecs, {
      enableParallel: true,
    });

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
  });

  it('should handle mixed success and failure results', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: {} },
      { definitionId: 'test:entity2', opts: {} },
      { definitionId: 'test:entity3', opts: {} },
    ];

    mockDeps.lifecycleManager.createEntityInstance
      .mockResolvedValueOnce({ id: 'id1' })
      .mockRejectedValueOnce(new Error('Creation failed'))
      .mockResolvedValueOnce({ id: 'id3' });

    const result = await manager.batchCreateEntities(entitySpecs);

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.totalProcessed).toBe(3);

    expect(result.failures[0].item).toEqual(entitySpecs[1]);
    expect(result.failures[0].error.message).toBe('Creation failed');
  });

  it('should stop processing remaining batches when stopOnError is true and batch has failures', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: {} },
      { definitionId: 'test:entity2', opts: {} },
      { definitionId: 'test:entity3', opts: {} },
    ];

    mockDeps.lifecycleManager.createEntityInstance
      .mockResolvedValueOnce({ id: 'id1' })
      .mockRejectedValueOnce(new Error('Creation failed'))
      .mockResolvedValueOnce({ id: 'id3' }); // This would be for the third entity, but we won't reach it if batchSize is small

    const result = await manager.batchCreateEntities(entitySpecs, {
      stopOnError: true,
      batchSize: 2, // Force the first two into one batch
    });

    // First batch should process both items (success + failure), then stop due to failure
    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.totalProcessed).toBe(2);

    // Third entity should not be processed at all
    expect(
      mockDeps.lifecycleManager.createEntityInstance
    ).toHaveBeenCalledTimes(2);

    expect(mockDeps.logger.warn).toHaveBeenCalledWith(
      'Stopping batch creation due to error in batch 1'
    );
  });

  it('should reject empty entity specs array', async () => {
    await expect(manager.batchCreateEntities([])).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchCreateEntities([])).rejects.toThrow(
      'Batch specifications cannot be empty'
    );
  });

  it('should validate batch specifications', async () => {
    await expect(manager.batchCreateEntities(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchCreateEntities([])).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('should respect custom batch size', async () => {
    const entitySpecs = new Array(10).fill(0).map((_, i) => ({
      definitionId: `test:entity${i}`,
      opts: {},
    }));

    mockDeps.lifecycleManager.createEntityInstance.mockResolvedValue({
      id: 'test',
    });

    await manager.batchCreateEntities(entitySpecs, { batchSize: 3 });

    expect(validateBatchSize).toHaveBeenCalledWith(3);
  });

  it('should handle batch processing errors and continue when stopOnError is false', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: {} },
      { definitionId: 'test:entity2', opts: {} },
    ];

    // Mock the dependency method to throw an error
    mockDeps.lifecycleManager.createEntityInstance
      .mockRejectedValueOnce(new Error('Creation error'))
      .mockRejectedValueOnce(new Error('Creation error'));

    const result = await manager.batchCreateEntities(entitySpecs);

    expect(result.failures).toHaveLength(2); // All items failed
    expect(result.failureCount).toBe(2);
    expect(result.successes).toHaveLength(0);
  });

  it('should stop and continue with remaining operations when individual item fails with stopOnError false', async () => {
    const entitySpecs = [
      { definitionId: 'test:entity1', opts: {} },
      { definitionId: 'test:entity2', opts: {} },
    ];

    mockDeps.lifecycleManager.createEntityInstance
      .mockRejectedValueOnce(new Error('Creation error'))
      .mockResolvedValueOnce({ id: 'entity2' });

    const result = await manager.batchCreateEntities(entitySpecs, {
      stopOnError: false,
    });

    expect(result.failures).toHaveLength(1);
    expect(result.successes).toHaveLength(1);
    expect(result.totalProcessed).toBe(2);
  });

  it('should log completion message with statistics', async () => {
    const entitySpecs = [{ definitionId: 'test:entity1', opts: {} }];
    mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
      id: 'id1',
    });

    await manager.batchCreateEntities(entitySpecs);

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch entity creation completed',
      expect.objectContaining({
        totalProcessed: 1,
        successes: 1,
        failures: 0,
        processingTime: expect.any(Number),
      })
    );
  });
});

describe('BatchOperationManager - Batch Add Components', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
    global.performance = { now: jest.fn().mockReturnValue(1000) };
  });

  afterEach(() => {
    delete global.performance;
  });

  it('should add components successfully in sequential mode', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
      {
        instanceId: 'entity2',
        componentTypeId: 'test:component2',
        componentData: { value: 2 },
      },
    ];

    mockDeps.componentMutationService.addComponent
      .mockResolvedValueOnce('success1')
      .mockResolvedValueOnce('success2');

    const result = await manager.batchAddComponents(componentSpecs);

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    expect(
      mockDeps.componentMutationService.addComponent
    ).toHaveBeenCalledTimes(2);
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch component addition: 2 components'
    );
  });

  it('should add components successfully in parallel mode', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
    ];

    mockDeps.componentMutationService.addComponent.mockResolvedValueOnce(
      'success'
    );

    const result = await manager.batchAddComponents(componentSpecs, {
      enableParallel: true,
    });

    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
    expect(result.successCount).toBe(1);
  });

  it('should handle mixed success and failure in component addition', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
      {
        instanceId: 'entity2',
        componentTypeId: 'test:component2',
        componentData: { value: 2 },
      },
    ];

    mockDeps.componentMutationService.addComponent
      .mockResolvedValueOnce('success')
      .mockRejectedValueOnce(new Error('Component add failed'));

    const result = await manager.batchAddComponents(componentSpecs);

    expect(result.successes).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it('should stop on error when stopOnError is true for component addition', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
      {
        instanceId: 'entity2',
        componentTypeId: 'test:component2',
        componentData: { value: 2 },
      },
    ];

    mockDeps.componentMutationService.addComponent.mockRejectedValueOnce(
      new Error('Component add failed')
    );

    const result = await manager.batchAddComponents(componentSpecs, {
      stopOnError: true,
    });

    expect(result.failures).toHaveLength(1);
    expect(mockDeps.logger.warn).toHaveBeenCalledWith(
      'Stopping batch component addition due to error in batch 1'
    );
  });

  it('should validate component specifications', async () => {
    await expect(manager.batchAddComponents(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchAddComponents([])).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('should handle component addition errors', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
    ];

    mockDeps.componentMutationService.addComponent.mockRejectedValueOnce(
      new Error('Component addition failed')
    );

    const result = await manager.batchAddComponents(componentSpecs);

    expect(result.failures).toHaveLength(1);
    expect(result.successes).toHaveLength(0);
    expect(result.failureCount).toBe(1);
  });

  it('should log completion message for component addition', async () => {
    const componentSpecs = [
      {
        instanceId: 'entity1',
        componentTypeId: 'test:component1',
        componentData: { value: 1 },
      },
    ];

    mockDeps.componentMutationService.addComponent.mockResolvedValueOnce(
      'success'
    );

    await manager.batchAddComponents(componentSpecs);

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch component addition completed',
      expect.objectContaining({
        totalProcessed: 1,
        successes: 1,
        failures: 0,
        processingTime: expect.any(Number),
      })
    );
  });
});

describe('BatchOperationManager - Batch Remove Entities', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
    global.performance = { now: jest.fn().mockReturnValue(1000) };
  });

  afterEach(() => {
    delete global.performance;
  });

  it('should remove entities successfully in sequential mode', async () => {
    const instanceIds = ['entity1', 'entity2', 'entity3'];

    mockDeps.lifecycleManager.removeEntityInstance
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await manager.batchRemoveEntities(instanceIds);

    expect(result.successes).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
    expect(result.totalProcessed).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);

    expect(
      mockDeps.lifecycleManager.removeEntityInstance
    ).toHaveBeenCalledTimes(3);
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch entity removal: 3 entities'
    );
  });

  it('should remove entities successfully in parallel mode', async () => {
    const instanceIds = ['entity1', 'entity2'];

    mockDeps.lifecycleManager.removeEntityInstance
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await manager.batchRemoveEntities(instanceIds, {
      enableParallel: true,
    });

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(result.successCount).toBe(2);
  });

  it('should handle mixed success and failure in entity removal', async () => {
    const instanceIds = ['entity1', 'entity2', 'entity3'];

    mockDeps.lifecycleManager.removeEntityInstance
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('Removal failed'))
      .mockResolvedValueOnce(true);

    const result = await manager.batchRemoveEntities(instanceIds);

    expect(result.successes).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.failures[0].item).toBe('entity2');
  });

  it('should stop on error when stopOnError is true for entity removal', async () => {
    const instanceIds = ['entity1', 'entity2'];

    mockDeps.lifecycleManager.removeEntityInstance.mockRejectedValueOnce(
      new Error('Removal failed')
    );

    const result = await manager.batchRemoveEntities(instanceIds, {
      stopOnError: true,
    });

    expect(result.failures).toHaveLength(1);
    expect(mockDeps.logger.warn).toHaveBeenCalledWith(
      'Stopping batch removal due to error in batch 1'
    );
  });

  it('should validate instance IDs array', async () => {
    await expect(manager.batchRemoveEntities(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchRemoveEntities([])).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('should handle entity removal errors', async () => {
    const instanceIds = ['entity1'];

    mockDeps.lifecycleManager.removeEntityInstance.mockRejectedValueOnce(
      new Error('Removal failed')
    );

    const result = await manager.batchRemoveEntities(instanceIds);

    expect(result.failures).toHaveLength(1);
    expect(result.successes).toHaveLength(0);
    expect(result.failureCount).toBe(1);
  });

  it('should log completion message for entity removal', async () => {
    const instanceIds = ['entity1'];

    mockDeps.lifecycleManager.removeEntityInstance.mockResolvedValueOnce(true);

    await manager.batchRemoveEntities(instanceIds);

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch entity removal completed',
      expect.objectContaining({
        totalProcessed: 1,
        successes: 1,
        failures: 0,
        processingTime: expect.any(Number),
      })
    );
  });
});

describe('BatchOperationManager - Configuration Methods', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
  });

  describe('getStats', () => {
    it('should return current configuration statistics', () => {
      const stats = manager.getStats();

      expect(stats).toEqual({
        defaultBatchSize: 50,
        enableTransactions: true,
      });
    });

    it('should return custom configuration values', () => {
      const customManager = createBatchOperationManager({
        defaultBatchSize: 25,
        enableTransactions: false,
      });

      const stats = customManager.getStats();

      expect(stats.defaultBatchSize).toBe(25);
      expect(stats.enableTransactions).toBe(false);
    });
  });

  describe('setDefaultBatchSize', () => {
    it('should update the default batch size', () => {
      manager.setDefaultBatchSize(100);

      const stats = manager.getStats();
      expect(stats.defaultBatchSize).toBe(100);

      expect(validateBatchSize).toHaveBeenCalledWith(100);
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Default batch size set to 100'
      );
    });

    it('should validate the new batch size', () => {
      validateBatchSize.mockImplementation((size) => {
        if (size > 1000) {
          throw new Error('Batch size too large');
        }
      });

      expect(() => manager.setDefaultBatchSize(2000)).toThrow(
        'Batch size too large'
      );
    });
  });

  describe('setTransactionsEnabled', () => {
    it('should enable transactions', () => {
      const customDeps = createMockDependencies({ enableTransactions: false });
      const customManager = new BatchOperationManager(customDeps);

      customManager.setTransactionsEnabled(true);

      const stats = customManager.getStats();
      expect(stats.enableTransactions).toBe(true);

      expect(customDeps.logger.debug).toHaveBeenCalledWith(
        'Transactions enabled'
      );
    });

    it('should disable transactions', () => {
      manager.setTransactionsEnabled(false);

      const stats = manager.getStats();
      expect(stats.enableTransactions).toBe(false);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Transactions disabled'
      );
    });
  });
});

describe('BatchOperationManager - Private Methods Coverage', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
    global.performance = { now: jest.fn().mockReturnValue(1000) };
  });

  afterEach(() => {
    delete global.performance;
  });

  describe('executeOperation method coverage', () => {
    it('should handle create operation', async () => {
      const entitySpec = { definitionId: 'test:entity', opts: {} };
      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
        id: 'test',
      });

      // Test create operation through batchCreateEntities
      const result = await manager.batchCreateEntities([entitySpec]);

      expect(result.successes).toHaveLength(1);
      expect(
        mockDeps.lifecycleManager.createEntityInstance
      ).toHaveBeenCalledWith('test:entity', {});
    });

    it('should handle addComponent operation', async () => {
      const componentSpec = {
        instanceId: 'entity1',
        componentTypeId: 'test:component',
        componentData: { value: 1 },
      };
      mockDeps.componentMutationService.addComponent.mockResolvedValueOnce(
        'success'
      );

      // Test addComponent operation through batchAddComponents
      const result = await manager.batchAddComponents([componentSpec]);

      expect(result.successes).toHaveLength(1);
      expect(
        mockDeps.componentMutationService.addComponent
      ).toHaveBeenCalledWith('entity1', 'test:component', { value: 1 });
    });

    it('should handle remove operation', async () => {
      const instanceId = 'entity1';
      mockDeps.lifecycleManager.removeEntityInstance.mockResolvedValueOnce(
        true
      );

      // Test remove operation through batchRemoveEntities
      const result = await manager.batchRemoveEntities([instanceId]);

      expect(result.successes).toHaveLength(1);
      expect(
        mockDeps.lifecycleManager.removeEntityInstance
      ).toHaveBeenCalledWith('entity1');
    });

    it('should handle all three operation types correctly', async () => {
      // Test all operation types are handled correctly by testing each batch method

      // Create operation
      const entitySpec = { definitionId: 'test:entity', opts: {} };
      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
        id: 'test',
      });

      const createResult = await manager.batchCreateEntities([entitySpec]);
      expect(createResult.successes).toHaveLength(1);

      // AddComponent operation
      const componentSpec = {
        instanceId: 'entity1',
        componentTypeId: 'test:component',
        componentData: { value: 1 },
      };
      mockDeps.componentMutationService.addComponent.mockResolvedValueOnce(
        'success'
      );

      const addResult = await manager.batchAddComponents([componentSpec]);
      expect(addResult.successes).toHaveLength(1);

      // Remove operation
      const instanceId = 'entity1';
      mockDeps.lifecycleManager.removeEntityInstance.mockResolvedValueOnce(
        true
      );

      const removeResult = await manager.batchRemoveEntities([instanceId]);
      expect(removeResult.successes).toHaveLength(1);
    });
  });

  describe('parallel processing coverage', () => {
    it('should handle parallel processing with fulfilled promises', async () => {
      const entitySpecs = [
        { definitionId: 'test:entity1', opts: {} },
        { definitionId: 'test:entity2', opts: {} },
      ];

      mockDeps.lifecycleManager.createEntityInstance
        .mockResolvedValueOnce({ id: 'id1' })
        .mockResolvedValueOnce({ id: 'id2' });

      const result = await manager.batchCreateEntities(entitySpecs, {
        enableParallel: true,
      });

      expect(result.successes).toHaveLength(2);
      expect(result.failures).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle parallel processing with mixed results', async () => {
      const entitySpecs = [
        { definitionId: 'test:entity1', opts: {} },
        { definitionId: 'test:entity2', opts: {} },
      ];

      mockDeps.lifecycleManager.createEntityInstance
        .mockResolvedValueOnce({ id: 'id1' })
        .mockRejectedValueOnce(new Error('Creation failed'));

      const result = await manager.batchCreateEntities(entitySpecs, {
        enableParallel: true,
      });

      expect(result.successes).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle parallel processing with all failures', async () => {
      const entitySpecs = [{ definitionId: 'test:entity1', opts: {} }];

      mockDeps.lifecycleManager.createEntityInstance.mockRejectedValueOnce(
        new Error('Creation failed')
      );

      const result = await manager.batchCreateEntities(entitySpecs, {
        enableParallel: true,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.successes).toHaveLength(0);
      expect(result.totalProcessed).toBe(1);
    });
  });
});

describe('BatchOperationManager - Error Handling and Edge Cases', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchOperationManager(mockDeps);
    global.performance = { now: jest.fn().mockReturnValue(1000) };
  });

  afterEach(() => {
    delete global.performance;
  });

  describe('Validation errors', () => {
    it('should throw InvalidArgumentError for non-array batch specs', async () => {
      await expect(manager.batchCreateEntities('not-an-array')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(manager.batchCreateEntities('not-an-array')).rejects.toThrow(
        'Batch specifications must be an array'
      );
    });

    it('should throw InvalidArgumentError for empty batch specs', async () => {
      await expect(manager.batchCreateEntities([])).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(manager.batchCreateEntities([])).rejects.toThrow(
        'Batch specifications cannot be empty'
      );
    });

    it('should validate batch size through configUtils', async () => {
      validateBatchSize.mockImplementation((size) => {
        if (size > 100) {
          throw new Error('Batch size exceeds limit');
        }
      });

      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];

      await expect(
        manager.batchCreateEntities(entitySpecs, { batchSize: 200 })
      ).rejects.toThrow('Batch size exceeds limit');

      expect(validateBatchSize).toHaveBeenCalledWith(200);
    });
  });

  describe('Performance timing', () => {
    it('should measure processing time correctly', async () => {
      let currentTime = 1000;
      global.performance = {
        now: jest.fn(() => {
          currentTime += 100;
          return currentTime;
        }),
      };

      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];
      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
        id: 'test',
      });

      const result = await manager.batchCreateEntities(entitySpecs);

      expect(result.processingTime).toBe(100);

      delete global.performance;
    });
  });

  describe('Large batch processing', () => {
    it('should process large batches with custom batch size', async () => {
      const entitySpecs = new Array(10).fill(0).map((_, i) => ({
        definitionId: `test:entity${i}`,
        opts: {},
      }));

      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValue({
        id: 'test',
      });

      const result = await manager.batchCreateEntities(entitySpecs, {
        batchSize: 3,
      });

      expect(result.totalProcessed).toBe(10);
      expect(result.successCount).toBe(10);
      expect(
        mockDeps.lifecycleManager.createEntityInstance
      ).toHaveBeenCalledTimes(10);
    });

    it('should handle single item batches', async () => {
      const entitySpec = { definitionId: 'test:entity', opts: {} };
      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
        id: 'test',
      });

      const result = await manager.batchCreateEntities([entitySpec]);

      expect(result.totalProcessed).toBe(1);
      expect(result.successes).toHaveLength(1);
    });
  });

  describe('Error propagation and logging', () => {
    it('should log processing errors correctly', async () => {
      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];

      mockDeps.lifecycleManager.createEntityInstance.mockRejectedValueOnce(
        new Error('Creation error')
      );

      const result = await manager.batchCreateEntities(entitySpecs);

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error.message).toBe('Creation error');
    });

    it('should handle edge case with parallel processing error', async () => {
      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];

      // This tests general error handling paths
      mockDeps.lifecycleManager.createEntityInstance.mockRejectedValueOnce(
        new Error('Operation failed')
      );

      const result = await manager.batchCreateEntities(entitySpecs, {
        enableParallel: true,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error.message).toBe('Operation failed');
    });

    it('should continue processing items after individual failures', async () => {
      const entitySpecs = new Array(4).fill(0).map((_, i) => ({
        definitionId: `test:entity${i}`,
        opts: {},
      }));

      // Mock alternating success and failure
      mockDeps.lifecycleManager.createEntityInstance
        .mockResolvedValueOnce({ id: 'entity0' })
        .mockRejectedValueOnce(new Error('Entity1 failed'))
        .mockResolvedValueOnce({ id: 'entity2' })
        .mockRejectedValueOnce(new Error('Entity3 failed'));

      const result = await manager.batchCreateEntities(entitySpecs, {
        stopOnError: false,
      });

      expect(result.totalProcessed).toBe(4);
      expect(result.failures).toHaveLength(2);
      expect(result.successes).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(2);
    });
  });

  describe('Batch processor failure scenarios', () => {
    /**
     * Runs a callback while forcing Promise.allSettled to throw.
     *
     * @param {(context: { failure: Error, failingAllSettled: jest.Mock }) => Promise<void>} callback - Test callback
     * @returns {Promise<void>}
     */
    const withFailingAllSettled = async (callback) => {
      const originalAllSettled = Promise.allSettled;
      const failure = new Error('allSettled failure');
      const failingAllSettled = jest.fn(() => {
        throw failure;
      });
      Promise.allSettled = failingAllSettled;

      try {
        await callback({ failure, failingAllSettled });
      } finally {
        Promise.allSettled = originalAllSettled;
      }
    };

    it('should mark entire creation batch as failed when processor throws', async () => {
      const entitySpecs = [
        { definitionId: 'test:entity1', opts: {} },
        { definitionId: 'test:entity2', opts: {} },
      ];

      await withFailingAllSettled(async ({ failure, failingAllSettled }) => {
        const result = await manager.batchCreateEntities(entitySpecs, {
          enableParallel: true,
        });

        expect(result.failures).toHaveLength(2);
        expect(result.totalProcessed).toBe(2);
        expect(result.failures.every(({ error }) => error === failure)).toBe(
          true
        );
        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Batch creation failed for batch 1'),
          failure
        );
        expect(failingAllSettled).toHaveBeenCalledTimes(1);
      });
    });

    it('should rethrow creation batch errors when stopOnError is enabled', async () => {
      const entitySpecs = [
        { definitionId: 'test:entity1', opts: {} },
        { definitionId: 'test:entity2', opts: {} },
      ];

      await withFailingAllSettled(async ({ failure }) => {
        await expect(
          manager.batchCreateEntities(entitySpecs, {
            enableParallel: true,
            stopOnError: true,
          })
        ).rejects.toBe(failure);

        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Batch creation failed for batch 1'),
          failure
        );
      });
    });

    it('should mark entire component addition batch as failed when processor throws', async () => {
      const componentSpecs = [
        {
          instanceId: 'entity1',
          componentTypeId: 'test:component',
          componentData: {},
        },
        {
          instanceId: 'entity2',
          componentTypeId: 'test:component',
          componentData: {},
        },
      ];

      await withFailingAllSettled(async ({ failure }) => {
        const result = await manager.batchAddComponents(componentSpecs, {
          enableParallel: true,
        });

        expect(result.failures).toHaveLength(2);
        expect(result.totalProcessed).toBe(2);
        expect(result.failures.every(({ error }) => error === failure)).toBe(
          true
        );
        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Batch component addition failed for batch 1'
          ),
          failure
        );
      });
    });

    it('should rethrow component addition errors when stopOnError is enabled', async () => {
      const componentSpecs = [
        {
          instanceId: 'entity1',
          componentTypeId: 'test:component',
          componentData: {},
        },
      ];

      await withFailingAllSettled(async ({ failure }) => {
        await expect(
          manager.batchAddComponents(componentSpecs, {
            enableParallel: true,
            stopOnError: true,
          })
        ).rejects.toBe(failure);

        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Batch component addition failed for batch 1'
          ),
          failure
        );
      });
    });

    it('should mark entire removal batch as failed when processor throws', async () => {
      const instanceIds = ['entity1', 'entity2'];

      await withFailingAllSettled(async ({ failure }) => {
        const result = await manager.batchRemoveEntities(instanceIds, {
          enableParallel: true,
        });

        expect(result.failures).toHaveLength(2);
        expect(result.totalProcessed).toBe(2);
        expect(result.failures.every(({ error }) => error === failure)).toBe(
          true
        );
        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Batch removal failed for batch 1'),
          failure
        );
      });
    });

    it('should rethrow removal errors when stopOnError is enabled', async () => {
      const instanceIds = ['entity1'];

      await withFailingAllSettled(async ({ failure }) => {
        await expect(
          manager.batchRemoveEntities(instanceIds, {
            enableParallel: true,
            stopOnError: true,
          })
        ).rejects.toBe(failure);

        expect(mockDeps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Batch removal failed for batch 1'),
          failure
        );
      });
    });

    it('should treat rejected promises from allSettled as failures', async () => {
      const originalAllSettled = Promise.allSettled;
      const rejection = new Error('promise rejected');
      Promise.allSettled = jest
        .fn()
        .mockResolvedValueOnce([{ status: 'rejected', reason: rejection }]);

      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];
      const result = await manager.batchCreateEntities(entitySpecs, {
        enableParallel: true,
      });

      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toEqual({ item: null, error: rejection });
      expect(result.failureCount).toBe(1);
      expect(result.totalProcessed).toBe(1);
      expect(Promise.allSettled).toHaveBeenCalledTimes(1);

      Promise.allSettled = originalAllSettled;
    });
  });

  describe('Mixed operation scenarios', () => {
    it('should handle all operations with different batch sizes', async () => {
      // Test entity creation
      const entitySpecs = [{ definitionId: 'test:entity', opts: {} }];
      mockDeps.lifecycleManager.createEntityInstance.mockResolvedValueOnce({
        id: 'e1',
      });

      const createResult = await manager.batchCreateEntities(entitySpecs, {
        batchSize: 1,
      });

      // Test component addition
      const componentSpecs = [
        { instanceId: 'e1', componentTypeId: 'test:comp', componentData: {} },
      ];
      mockDeps.componentMutationService.addComponent.mockResolvedValueOnce(
        'success'
      );

      const addResult = await manager.batchAddComponents(componentSpecs, {
        batchSize: 1,
      });

      // Test entity removal
      mockDeps.lifecycleManager.removeEntityInstance.mockResolvedValueOnce(
        true
      );

      const removeResult = await manager.batchRemoveEntities(['e1'], {
        batchSize: 1,
      });

      expect(createResult.successCount).toBe(1);
      expect(addResult.successCount).toBe(1);
      expect(removeResult.successCount).toBe(1);
    });
  });
});
