import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BatchSpatialIndexManager from '../../../../src/entities/operations/BatchSpatialIndexManager.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

// Mock the batchOperationUtils module
jest.mock('../../../../src/entities/utils/batchOperationUtils.js', () => ({
  processBatch: jest.fn(),
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
import { processBatch } from '../../../../src/entities/utils/batchOperationUtils.js';
import { validateDependency } from '../../../../src/utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../../src/utils/loggerUtils.js';

/**
 * Creates mock dependencies for BatchSpatialIndexManager
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

  const mockSpatialIndex = {
    add: jest.fn(),
    remove: jest.fn().mockReturnValue(true),
    move: jest.fn().mockReturnValue(true),
    clear: jest.fn(),
    getEntitiesAtLocation: jest.fn().mockReturnValue([]),
    size: 10,
    getStats: jest
      .fn()
      .mockReturnValue({ totalEntities: 10, totalLocations: 5 }),
  };

  return {
    logger: mockLogger,
    spatialIndex: mockSpatialIndex,
    defaultBatchSize: 100,
    ...overrides,
  };
};

/**
 * Creates a BatchSpatialIndexManager instance with mock dependencies
 *
 * @param {object} dependencyOverrides - Optional dependency overrides
 * @returns {BatchSpatialIndexManager} Configured instance
 */
const createBatchSpatialIndexManager = (dependencyOverrides = {}) => {
  const deps = createMockDependencies(dependencyOverrides);
  return new BatchSpatialIndexManager(deps);
};

/**
 * Configures processBatch mock to simulate successful processing
 *
 * @param {object} options - Options for the mock behavior
 */
const configureMockProcessBatchSuccess = (options = {}) => {
  const { successCount = 10, failureCount = 0, processingTime = 100 } = options;

  processBatch.mockImplementation(async (items, processor, batchOptions) => {
    const results = {
      successes: [],
      failures: [],
      totalProcessed: items.length,
      successCount,
      failureCount,
      processingTime,
    };

    // Simulate processing each item
    for (let i = 0; i < items.length; i++) {
      if (i < successCount) {
        const result = await processor(items[i]);
        results.successes.push(result);
      } else {
        results.failures.push({
          item: items[i],
          error: new Error('Processing failed'),
        });
      }
    }

    return results;
  });
};

/**
 * Configures processBatch mock to simulate processing errors
 */
const configureMockProcessBatchError = () => {
  processBatch.mockRejectedValue(new Error('Batch processing failed'));
};

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementations
  validateDependency.mockImplementation(() => {});
  ensureValidLogger.mockImplementation((logger) => logger);
  // Reset performance.now mock
  jest.spyOn(performance, 'now').mockReturnValue(1000);
});

describe('BatchSpatialIndexManager - Constructor and Dependencies', () => {
  it('should initialize with valid dependencies', () => {
    const manager = createBatchSpatialIndexManager();

    expect(manager).toBeInstanceOf(BatchSpatialIndexManager);
    expect(validateDependency).toHaveBeenCalledTimes(2); // Called for logger and spatialIndex
    expect(validateDependency).toHaveBeenCalledWith(
      expect.objectContaining({
        info: expect.any(Function),
        error: expect.any(Function),
        warn: expect.any(Function),
        debug: expect.any(Function),
      }),
      'ILogger',
      console,
      {
        requiredMethods: ['info', 'error', 'warn', 'debug'],
      }
    );
    expect(validateDependency).toHaveBeenCalledWith(
      expect.objectContaining({
        add: expect.any(Function),
        remove: expect.any(Function),
        move: expect.any(Function),
        getEntitiesAtLocation: expect.any(Function),
      }),
      'SpatialIndexManager',
      expect.any(Object),
      {
        requiredMethods: ['add', 'remove', 'move', 'getEntitiesAtLocation'],
      }
    );
    expect(ensureValidLogger).toHaveBeenCalled();
  });

  it('should use default batch size when not provided', () => {
    const deps = createMockDependencies();
    delete deps.defaultBatchSize;

    const manager = new BatchSpatialIndexManager(deps);
    const stats = manager.getStats();

    expect(stats.defaultBatchSize).toBe(100);
  });

  it('should use provided batch size', () => {
    const manager = createBatchSpatialIndexManager({ defaultBatchSize: 200 });
    const stats = manager.getStats();

    expect(stats.defaultBatchSize).toBe(200);
  });

  it('should log initialization with debug level', () => {
    const mockLogger = createMockDependencies().logger;
    const manager = new BatchSpatialIndexManager({
      logger: mockLogger,
      spatialIndex: createMockDependencies().spatialIndex,
      defaultBatchSize: 150,
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'BatchSpatialIndexManager initialized',
      { defaultBatchSize: 150 }
    );
  });
});

describe('BatchSpatialIndexManager - batchAdd', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should successfully add multiple entities to locations', async () => {
    const additions = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
    ];

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1100); // End time

    const result = await manager.batchAdd(additions);

    expect(processBatch).toHaveBeenCalledWith(additions, expect.any(Function), {
      batchSize: 100,
      enableParallel: false,
      stopOnError: false,
    });

    expect(result).toEqual({
      successful: expect.any(Array),
      failed: [],
      totalProcessed: 2,
      indexSize: 10,
      processingTime: 100,
    });

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch spatial index addition: 2 entities'
    );
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch spatial index addition completed',
      expect.objectContaining({
        successful: 10,
        failed: 0,
        totalProcessed: 2,
        processingTime: 100,
      })
    );
  });

  it('should use custom batch size when provided', async () => {
    const additions = [{ entityId: 'entity1', locationId: 'loc1' }];

    await manager.batchAdd(additions, { batchSize: 50 });

    expect(processBatch).toHaveBeenCalledWith(
      additions,
      expect.any(Function),
      expect.objectContaining({ batchSize: 50 })
    );
  });

  it('should enable parallel processing when specified', async () => {
    const additions = [{ entityId: 'entity1', locationId: 'loc1' }];

    await manager.batchAdd(additions, { enableParallel: true });

    expect(processBatch).toHaveBeenCalledWith(
      additions,
      expect.any(Function),
      expect.objectContaining({ enableParallel: true })
    );
  });

  it('should validate input is an array', async () => {
    await expect(manager.batchAdd('not-an-array')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchAdd('not-an-array')).rejects.toThrow(
      'additions must be an array'
    );
  });

  it('should validate input is not empty', async () => {
    await expect(manager.batchAdd([])).rejects.toThrow(InvalidArgumentError);
    await expect(manager.batchAdd([])).rejects.toThrow(
      'additions cannot be empty'
    );
  });

  it('should call spatialIndex.add for each item during processing', async () => {
    const additions = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
    ];

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    await manager.batchAdd(additions);

    expect(mockDeps.spatialIndex.add).toHaveBeenCalledTimes(2);
    expect(mockDeps.spatialIndex.add).toHaveBeenCalledWith('entity1', 'loc1');
    expect(mockDeps.spatialIndex.add).toHaveBeenCalledWith('entity2', 'loc2');
  });

  it('should handle mixed success and failure results', async () => {
    configureMockProcessBatchSuccess({ successCount: 1, failureCount: 1 });

    const additions = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
    ];

    const result = await manager.batchAdd(additions);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch spatial index addition completed',
      expect.objectContaining({
        successful: 1,
        failed: 1,
      })
    );
  });

  it('should handle when spatial index size is undefined', async () => {
    mockDeps.spatialIndex.size = undefined;

    const additions = [{ entityId: 'entity1', locationId: 'loc1' }];
    const result = await manager.batchAdd(additions);

    expect(result.indexSize).toBe(0);
  });
});

describe('BatchSpatialIndexManager - batchRemove', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should successfully remove multiple entities', async () => {
    const entityIds = ['entity1', 'entity2', 'entity3'];

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1200); // End time

    const result = await manager.batchRemove(entityIds);

    expect(processBatch).toHaveBeenCalledWith(entityIds, expect.any(Function), {
      batchSize: 100,
      enableParallel: false,
      stopOnError: false,
    });

    expect(result).toEqual({
      successful: expect.any(Array),
      failed: [],
      totalProcessed: 3,
      indexSize: 10,
      processingTime: 200,
    });

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch spatial index removal: 3 entities'
    );
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch spatial index removal completed',
      expect.objectContaining({
        successful: 10,
        failed: 0,
        totalProcessed: 3,
        processingTime: 200,
      })
    );
  });

  it('should use custom options when provided', async () => {
    const entityIds = ['entity1'];

    await manager.batchRemove(entityIds, {
      batchSize: 25,
      enableParallel: true,
    });

    expect(processBatch).toHaveBeenCalledWith(
      entityIds,
      expect.any(Function),
      expect.objectContaining({
        batchSize: 25,
        enableParallel: true,
      })
    );
  });

  it('should validate input is an array', async () => {
    await expect(manager.batchRemove('not-an-array')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchRemove('not-an-array')).rejects.toThrow(
      'entityIds must be an array'
    );
  });

  it('should validate input is not empty', async () => {
    await expect(manager.batchRemove([])).rejects.toThrow(InvalidArgumentError);
    await expect(manager.batchRemove([])).rejects.toThrow(
      'entityIds cannot be empty'
    );
  });

  it('should call spatialIndex.remove for each entity', async () => {
    const entityIds = ['entity1', 'entity2'];

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    await manager.batchRemove(entityIds);

    expect(mockDeps.spatialIndex.remove).toHaveBeenCalledTimes(2);
    expect(mockDeps.spatialIndex.remove).toHaveBeenCalledWith('entity1');
    expect(mockDeps.spatialIndex.remove).toHaveBeenCalledWith('entity2');
  });

  it('should track removal results', async () => {
    mockDeps.spatialIndex.remove
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    const result = await manager.batchRemove(['entity1', 'entity2']);

    expect(result.successful).toEqual([
      { entityId: 'entity1', removed: true, operation: 'remove' },
      { entityId: 'entity2', removed: false, operation: 'remove' },
    ]);
  });

  it('should handle when spatial index size is undefined', async () => {
    mockDeps.spatialIndex.size = undefined;
    configureMockProcessBatchSuccess();

    const entityIds = ['entity1'];
    const result = await manager.batchRemove(entityIds);

    expect(result.indexSize).toBe(0);
  });
});

describe('BatchSpatialIndexManager - batchMove', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should successfully move multiple entities', async () => {
    const updates = [
      { entityId: 'entity1', oldLocationId: 'loc1', newLocationId: 'loc2' },
      { entityId: 'entity2', oldLocationId: 'loc2', newLocationId: 'loc3' },
    ];

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1150); // End time

    const result = await manager.batchMove(updates);

    expect(processBatch).toHaveBeenCalledWith(updates, expect.any(Function), {
      batchSize: 100,
      enableParallel: false,
      stopOnError: false,
    });

    expect(result).toEqual({
      successful: expect.any(Array),
      failed: [],
      totalProcessed: 2,
      indexSize: 10,
      processingTime: 150,
    });

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch spatial index move: 2 entities'
    );
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch spatial index move completed',
      expect.objectContaining({
        successful: 10,
        failed: 0,
        totalProcessed: 2,
        processingTime: 150,
      })
    );
  });

  it('should validate input is an array', async () => {
    await expect(manager.batchMove('not-an-array')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchMove('not-an-array')).rejects.toThrow(
      'updates must be an array'
    );
  });

  it('should validate input is not empty', async () => {
    await expect(manager.batchMove([])).rejects.toThrow(InvalidArgumentError);
    await expect(manager.batchMove([])).rejects.toThrow(
      'updates cannot be empty'
    );
  });

  it('should validate update has required fields during processing', async () => {
    const updates = [
      { entityId: null, newLocationId: 'loc2' }, // Missing entityId
      { entityId: 'entity2', newLocationId: null }, // Missing newLocationId
    ];

    // Configure processBatch to actually call the processor and catch errors
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      const failures = [];
      for (const item of items) {
        try {
          results.push(await processor(item));
        } catch (error) {
          failures.push({ item, error });
        }
      }
      return {
        successes: results,
        failures,
        totalProcessed: items.length,
        successCount: results.length,
        failureCount: failures.length,
      };
    });

    const result = await manager.batchMove(updates);

    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBeInstanceOf(InvalidArgumentError);
    expect(result.failed[0].error.message).toBe(
      'EntityId and newLocationId are required'
    );
  });

  it('should call spatialIndex.move for valid updates', async () => {
    const updates = [
      { entityId: 'entity1', oldLocationId: 'loc1', newLocationId: 'loc2' },
      { entityId: 'entity2', oldLocationId: null, newLocationId: 'loc3' },
    ];

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    await manager.batchMove(updates);

    expect(mockDeps.spatialIndex.move).toHaveBeenCalledTimes(2);
    expect(mockDeps.spatialIndex.move).toHaveBeenCalledWith(
      'entity1',
      'loc1',
      'loc2'
    );
    expect(mockDeps.spatialIndex.move).toHaveBeenCalledWith(
      'entity2',
      null,
      'loc3'
    );
  });

  it('should track move results', async () => {
    mockDeps.spatialIndex.move
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const updates = [
      { entityId: 'entity1', oldLocationId: 'loc1', newLocationId: 'loc2' },
      { entityId: 'entity2', oldLocationId: 'loc2', newLocationId: 'loc3' },
    ];

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    const result = await manager.batchMove(updates);

    expect(result.successful).toEqual([
      {
        entityId: 'entity1',
        oldLocationId: 'loc1',
        newLocationId: 'loc2',
        moved: true,
        operation: 'move',
      },
      {
        entityId: 'entity2',
        oldLocationId: 'loc2',
        newLocationId: 'loc3',
        moved: false,
        operation: 'move',
      },
    ]);
  });

  it('should use custom options when provided', async () => {
    const updates = [
      { entityId: 'entity1', oldLocationId: 'loc1', newLocationId: 'loc2' },
    ];

    await manager.batchMove(updates, {
      batchSize: 10,
      enableParallel: true,
    });

    expect(processBatch).toHaveBeenCalledWith(
      updates,
      expect.any(Function),
      expect.objectContaining({
        batchSize: 10,
        enableParallel: true,
      })
    );
  });

  it('should handle when spatial index size is undefined', async () => {
    mockDeps.spatialIndex.size = undefined;
    configureMockProcessBatchSuccess();

    const updates = [
      { entityId: 'entity1', oldLocationId: 'loc1', newLocationId: 'loc2' },
    ];
    const result = await manager.batchMove(updates);

    expect(result.indexSize).toBe(0);
  });
});

describe('BatchSpatialIndexManager - rebuild', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should clear index and rebuild with new entities', async () => {
    const entityLocations = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
      { entityId: 'entity3', locationId: 'loc3' },
    ];

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1300); // End time

    const result = await manager.rebuild(entityLocations);

    expect(mockDeps.spatialIndex.clear).toHaveBeenCalledTimes(1);
    expect(processBatch).toHaveBeenCalledWith(
      entityLocations,
      expect.any(Function),
      {
        batchSize: 100,
        enableParallel: false,
        stopOnError: false,
      }
    );

    expect(result).toEqual({
      successful: expect.any(Array),
      failed: [],
      totalProcessed: 3,
      indexSize: 10,
      processingTime: 300,
    });

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting spatial index rebuild: 3 entities'
    );
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Spatial index rebuild completed',
      expect.objectContaining({
        successful: 10,
        failed: 0,
        totalProcessed: 3,
        finalIndexSize: 10,
        processingTime: 300,
      })
    );
  });

  it('should validate input is an array', async () => {
    await expect(manager.rebuild('not-an-array')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.rebuild('not-an-array')).rejects.toThrow(
      'entityLocations must be an array'
    );
  });

  it('should validate input is not empty', async () => {
    await expect(manager.rebuild([])).rejects.toThrow(InvalidArgumentError);
    await expect(manager.rebuild([])).rejects.toThrow(
      'entityLocations cannot be empty'
    );
  });

  it('should add each entity during rebuild', async () => {
    const entityLocations = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
    ];

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    await manager.rebuild(entityLocations);

    expect(mockDeps.spatialIndex.clear).toHaveBeenCalledTimes(1);
    expect(mockDeps.spatialIndex.add).toHaveBeenCalledTimes(2);
    expect(mockDeps.spatialIndex.add).toHaveBeenCalledWith('entity1', 'loc1');
    expect(mockDeps.spatialIndex.add).toHaveBeenCalledWith('entity2', 'loc2');
  });

  it('should use custom options when provided', async () => {
    const entityLocations = [{ entityId: 'entity1', locationId: 'loc1' }];

    await manager.rebuild(entityLocations, {
      batchSize: 5,
      enableParallel: true,
    });

    expect(processBatch).toHaveBeenCalledWith(
      entityLocations,
      expect.any(Function),
      expect.objectContaining({
        batchSize: 5,
        enableParallel: true,
      })
    );
  });

  it('should handle when spatial index size is undefined', async () => {
    mockDeps.spatialIndex.size = undefined;
    configureMockProcessBatchSuccess();

    const entityLocations = [{ entityId: 'entity1', locationId: 'loc1' }];
    const result = await manager.rebuild(entityLocations);

    expect(result.indexSize).toBe(0);
  });
});

describe('BatchSpatialIndexManager - batchValidateLocations', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should validate entities at multiple locations', async () => {
    const locationIds = ['loc1', 'loc2', 'loc3'];

    mockDeps.spatialIndex.getEntitiesAtLocation
      .mockReturnValueOnce(['entity1', 'entity2'])
      .mockReturnValueOnce(['entity3'])
      .mockReturnValueOnce([]);

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1100); // End time

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    const result = await manager.batchValidateLocations(locationIds);

    expect(processBatch).toHaveBeenCalledWith(
      locationIds,
      expect.any(Function),
      {
        batchSize: 100,
        enableParallel: true, // Note: true by default for validation
        stopOnError: false,
      }
    );

    expect(result.successful).toEqual([
      {
        locationId: 'loc1',
        entityCount: 2,
        entities: ['entity1', 'entity2'],
        operation: 'validate',
      },
      {
        locationId: 'loc2',
        entityCount: 1,
        entities: ['entity3'],
        operation: 'validate',
      },
      {
        locationId: 'loc3',
        entityCount: 0,
        entities: [],
        operation: 'validate',
      },
    ]);

    expect(result.totalEntities).toBe(3);
    expect(result.processingTime).toBe(100);

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting batch location validation: 3 locations'
    );
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Batch location validation completed',
      expect.objectContaining({
        locationsValidated: 3,
        totalEntities: 3,
        processingTime: 100,
      })
    );
  });

  it('should limit entities to first 10 for performance', async () => {
    const manyEntities = Array.from({ length: 20 }, (_, i) => `entity${i}`);
    mockDeps.spatialIndex.getEntitiesAtLocation.mockReturnValueOnce(
      manyEntities
    );

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    const result = await manager.batchValidateLocations(['loc1']);

    expect(result.successful[0].entities).toHaveLength(10);
    expect(result.successful[0].entityCount).toBe(20); // Still shows actual count
  });

  it('should validate input is an array', async () => {
    await expect(
      manager.batchValidateLocations('not-an-array')
    ).rejects.toThrow(InvalidArgumentError);
    await expect(
      manager.batchValidateLocations('not-an-array')
    ).rejects.toThrow('locationIds must be an array');
  });

  it('should validate input is not empty', async () => {
    await expect(manager.batchValidateLocations([])).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.batchValidateLocations([])).rejects.toThrow(
      'locationIds cannot be empty'
    );
  });

  it('should handle locations with no entities', async () => {
    mockDeps.spatialIndex.getEntitiesAtLocation.mockReturnValue([]);

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      for (const item of items) {
        results.push(await processor(item));
      }
      return {
        successes: results,
        failures: [],
        totalProcessed: items.length,
        successCount: items.length,
        failureCount: 0,
      };
    });

    const result = await manager.batchValidateLocations(['loc1', 'loc2']);

    expect(result.totalEntities).toBe(0);
    expect(result.successful).toHaveLength(2);
    expect(result.successful[0].entityCount).toBe(0);
    expect(result.successful[0].entities).toEqual([]);
  });

  it('should use custom options when provided', async () => {
    await manager.batchValidateLocations(['loc1'], {
      batchSize: 20,
      enableParallel: false,
    });

    expect(processBatch).toHaveBeenCalledWith(
      ['loc1'],
      expect.any(Function),
      expect.objectContaining({
        batchSize: 20,
        enableParallel: false,
      })
    );
  });

  it('should handle validation failures', async () => {
    configureMockProcessBatchSuccess({ successCount: 1, failureCount: 1 });

    const result = await manager.batchValidateLocations(['loc1', 'loc2']);

    expect(result.failed).toHaveLength(1);
    expect(result.totalEntities).toBe(0); // Only counts successful validations
  });
});

describe('BatchSpatialIndexManager - synchronize', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
    configureMockProcessBatchSuccess();
  });

  it('should synchronize spatial index with entity provider', async () => {
    const mockEntities = [
      { entityId: 'entity1', locationId: 'loc1' },
      { entityId: 'entity2', locationId: 'loc2' },
    ];

    const entityProvider = jest.fn().mockResolvedValue(mockEntities);

    performance.now
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1200); // End time (from rebuild)

    const result = await manager.synchronize(entityProvider);

    expect(entityProvider).toHaveBeenCalledTimes(1);
    expect(mockDeps.spatialIndex.clear).toHaveBeenCalledTimes(1);

    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Starting spatial index synchronization'
    );

    // The synchronize method logs successful.length and failed.length from the result
    // The mock returns 10 successes based on our configureMockProcessBatchSuccess
    const lastInfoCall = mockDeps.logger.info.mock.calls.find(
      (call) => call[0] === 'Spatial index synchronization completed'
    );
    expect(lastInfoCall).toBeDefined();
    expect(lastInfoCall[1]).toMatchObject({
      entitiesProcessed: 2,
      successful: 2, // 2 successful items processed from the mockEntities array
      failed: 0,
      processingTime: expect.any(Number),
    });
  });

  it('should validate entityProvider is a function', async () => {
    await expect(manager.synchronize('not-a-function')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.synchronize('not-a-function')).rejects.toThrow(
      'entityProvider must be a function'
    );
  });

  it('should validate entityProvider returns an array', async () => {
    const entityProvider = jest.fn().mockResolvedValue('not-an-array');

    await expect(manager.synchronize(entityProvider)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(manager.synchronize(entityProvider)).rejects.toThrow(
      'entityProvider must return an array'
    );
  });

  it('should handle entityProvider errors', async () => {
    const error = new Error('Failed to fetch entities');
    const entityProvider = jest.fn().mockRejectedValue(error);

    await expect(manager.synchronize(entityProvider)).rejects.toThrow(error);

    expect(mockDeps.logger.error).toHaveBeenCalledWith(
      'Spatial index synchronization failed:',
      error
    );
  });

  it('should use custom options when provided', async () => {
    const entityProvider = jest.fn().mockResolvedValue([]);

    // We need to mock rebuild behavior since synchronize delegates to it
    jest
      .spyOn(manager, 'rebuild')
      .mockImplementation(async (entities, options) => {
        expect(options).toEqual({
          batchSize: 25,
          enableParallel: true,
        });
        return {
          successful: [],
          failed: [],
          totalProcessed: 0,
          indexSize: 0,
          processingTime: 100,
        };
      });

    await manager.synchronize(entityProvider, {
      batchSize: 25,
      enableParallel: true,
    });

    expect(manager.rebuild).toHaveBeenCalledWith([], {
      batchSize: 25,
      enableParallel: true,
    });
  });

  it('should handle empty entity list', async () => {
    const entityProvider = jest.fn().mockResolvedValue([]);

    // Need to handle the empty array case in rebuild
    const originalRebuild = manager.rebuild.bind(manager);
    jest
      .spyOn(manager, 'rebuild')
      .mockImplementation(async (entities, options) => {
        if (entities.length === 0) {
          return {
            successful: [],
            failed: [],
            totalProcessed: 0,
            indexSize: 0,
            processingTime: 50,
          };
        }
        return originalRebuild(entities, options);
      });

    const result = await manager.synchronize(entityProvider);

    expect(result.totalProcessed).toBe(0);
    expect(mockDeps.logger.info).toHaveBeenCalledWith(
      'Spatial index synchronization completed',
      expect.objectContaining({
        entitiesProcessed: 0,
        successful: 0,
        failed: 0,
      })
    );
  });
});

describe('BatchSpatialIndexManager - Helper Methods', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
  });

  describe('getStats', () => {
    it('should return basic statistics', () => {
      const stats = manager.getStats();

      expect(stats).toEqual({
        defaultBatchSize: 100,
        indexSize: 10,
        spatialIndexStats: {
          totalEntities: 10,
          totalLocations: 5,
        },
      });
    });

    it('should handle missing spatialIndex.getStats method', () => {
      delete mockDeps.spatialIndex.getStats;
      manager = new BatchSpatialIndexManager(mockDeps);

      const stats = manager.getStats();

      expect(stats).toEqual({
        defaultBatchSize: 100,
        indexSize: 10,
        spatialIndexStats: null,
      });
    });

    it('should handle undefined index size', () => {
      mockDeps.spatialIndex.size = undefined;
      manager = new BatchSpatialIndexManager(mockDeps);

      const stats = manager.getStats();

      expect(stats.indexSize).toBe(0);
    });
  });

  describe('setDefaultBatchSize', () => {
    it('should set a valid batch size', () => {
      manager.setDefaultBatchSize(200);

      const stats = manager.getStats();
      expect(stats.defaultBatchSize).toBe(200);
      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        'Default batch size set to 200'
      );
    });

    it('should reject non-number batch size', () => {
      expect(() => manager.setDefaultBatchSize('not-a-number')).toThrow(
        InvalidArgumentError
      );
      expect(() => manager.setDefaultBatchSize('not-a-number')).toThrow(
        'batchSize must be a positive number'
      );
    });

    it('should reject zero batch size', () => {
      expect(() => manager.setDefaultBatchSize(0)).toThrow(
        InvalidArgumentError
      );
      expect(() => manager.setDefaultBatchSize(0)).toThrow(
        'batchSize must be a positive number'
      );
    });

    it('should reject negative batch size', () => {
      expect(() => manager.setDefaultBatchSize(-10)).toThrow(
        InvalidArgumentError
      );
      expect(() => manager.setDefaultBatchSize(-10)).toThrow(
        'batchSize must be a positive number'
      );
    });

    it('should update batch size used in operations', async () => {
      configureMockProcessBatchSuccess();
      manager.setDefaultBatchSize(5);

      await manager.batchAdd([{ entityId: 'entity1', locationId: 'loc1' }]);

      expect(processBatch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        expect.objectContaining({ batchSize: 5 })
      );
    });
  });

  describe('validateBatchInput (indirect testing)', () => {
    // This private method is tested through public methods

    it('should be called by all batch methods with correct parameter names', async () => {
      // Test each method to ensure proper validation messages
      const testCases = [
        {
          method: 'batchAdd',
          args: ['not-an-array'],
          expectedMessage: 'additions must be an array',
        },
        {
          method: 'batchRemove',
          args: ['not-an-array'],
          expectedMessage: 'entityIds must be an array',
        },
        {
          method: 'batchMove',
          args: ['not-an-array'],
          expectedMessage: 'updates must be an array',
        },
        {
          method: 'rebuild',
          args: ['not-an-array'],
          expectedMessage: 'entityLocations must be an array',
        },
        {
          method: 'batchValidateLocations',
          args: ['not-an-array'],
          expectedMessage: 'locationIds must be an array',
        },
      ];

      for (const testCase of testCases) {
        await expect(
          manager[testCase.method](...testCase.args)
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    it('should validate empty arrays with correct parameter names', async () => {
      const testCases = [
        {
          method: 'batchAdd',
          args: [[]],
          expectedMessage: 'additions cannot be empty',
        },
        {
          method: 'batchRemove',
          args: [[]],
          expectedMessage: 'entityIds cannot be empty',
        },
        {
          method: 'batchMove',
          args: [[]],
          expectedMessage: 'updates cannot be empty',
        },
        {
          method: 'rebuild',
          args: [[]],
          expectedMessage: 'entityLocations cannot be empty',
        },
        {
          method: 'batchValidateLocations',
          args: [[]],
          expectedMessage: 'locationIds cannot be empty',
        },
      ];

      for (const testCase of testCases) {
        await expect(
          manager[testCase.method](...testCase.args)
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });
  });
});

describe('BatchSpatialIndexManager - Edge Cases and Error Handling', () => {
  let manager;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    manager = new BatchSpatialIndexManager(mockDeps);
  });

  it('should handle processBatch throwing an error', async () => {
    configureMockProcessBatchError();

    await expect(
      manager.batchAdd([{ entityId: 'entity1', locationId: 'loc1' }])
    ).rejects.toThrow('Batch processing failed');
  });

  it('should handle null/undefined options gracefully', async () => {
    configureMockProcessBatchSuccess();

    // The actual implementation uses default destructuring, so null will cause an error
    // This is expected behavior - we should test that it throws
    await expect(
      manager.batchAdd([{ entityId: 'entity1', locationId: 'loc1' }], null)
    ).rejects.toThrow(TypeError);

    // Test with undefined options (already default) - this should work
    await expect(
      manager.batchAdd([{ entityId: 'entity1', locationId: 'loc1' }], undefined)
    ).resolves.toBeTruthy();
  });

  it('should handle very large batch sizes', async () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => ({
      entityId: `entity${i}`,
      locationId: `loc${i % 100}`,
    }));

    configureMockProcessBatchSuccess({
      successCount: 10000,
      failureCount: 0,
    });

    const result = await manager.batchAdd(largeArray, { batchSize: 1000 });

    expect(result.totalProcessed).toBe(10000);
    expect(processBatch).toHaveBeenCalledWith(
      largeArray,
      expect.any(Function),
      expect.objectContaining({ batchSize: 1000 })
    );
  });

  it('should handle performance.now edge cases', async () => {
    // Test when performance.now returns same value (0ms processing time)
    performance.now.mockReturnValue(1000);

    configureMockProcessBatchSuccess();

    const result = await manager.batchAdd([
      { entityId: 'entity1', locationId: 'loc1' },
    ]);

    expect(result.processingTime).toBe(0);
  });

  it('should handle spatial index methods throwing errors', async () => {
    mockDeps.spatialIndex.add.mockImplementation(() => {
      throw new Error('Add failed');
    });

    // Configure processBatch to actually call the processor
    processBatch.mockImplementationOnce(async (items, processor) => {
      const results = [];
      const failures = [];
      for (const item of items) {
        try {
          results.push(await processor(item));
        } catch (error) {
          failures.push({ item, error });
        }
      }
      return {
        successes: results,
        failures,
        totalProcessed: items.length,
        successCount: results.length,
        failureCount: failures.length,
      };
    });

    const result = await manager.batchAdd([
      { entityId: 'entity1', locationId: 'loc1' },
    ]);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error.message).toBe('Add failed');
  });

  it('should handle getStats when spatialIndex.getStats throws', () => {
    mockDeps.spatialIndex.getStats = jest.fn(() => {
      throw new Error('Stats failed');
    });

    // The actual implementation doesn't catch errors from getStats,
    // so it will throw - let's test the actual behavior
    expect(() => manager.getStats()).toThrow('Stats failed');
  });
});
