import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityLifecycleManager from '../../../../src/entities/services/entityLifecycleManager.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import { RepositoryConsistencyError } from '../../../../src/errors/repositoryConsistencyError.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

jest.mock(
  '../../../../src/entities/services/helpers/EntityLifecycleValidator.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      validateCreateEntityParams: jestMock.fn(),
      validateCreationOptions: jestMock.fn(),
      validateReconstructEntityParams: jestMock.fn(),
      validateSerializedEntityStructure: jestMock.fn(),
      validateRemoveEntityInstanceParams: jestMock.fn(),
    };
    global.__validatorMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

jest.mock(
  '../../../../src/entities/services/helpers/EntityEventDispatcher.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      dispatchEntityCreated: jestMock.fn(),
      dispatchEntityRemoved: jestMock.fn(),
      getStats: jestMock.fn(() => ({ dispatched: 0 })),
    };
    global.__eventDispatcherMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

jest.mock(
  '../../../../src/entities/services/helpers/EntityDefinitionHelper.js',
  () => {
    const { jest: jestMock } = require('@jest/globals');
    const mock = {
      getDefinitionForCreate: jestMock.fn((id) => ({ id })),
      getDefinitionForReconstruct: jestMock.fn((id) => ({ id })),
      preloadDefinitions: jestMock.fn((ids) => ({
        loaded: ids,
        failed: [],
        alreadyCached: [],
      })),
      getCacheStats: jestMock.fn(() => ({ hits: 0 })),
      clearCache: jestMock.fn(),
    };
    global.__definitionHelperMock = mock;
    return { __esModule: true, default: jestMock.fn(() => mock) };
  }
);

const createDeps = (extra = {}) => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  const registry = { getEntityDefinition: jest.fn() };
  const entityRepository = {
    add: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    entities: jest.fn(() => []),
    size: extra.size,
  };
  const factory = { create: jest.fn(), reconstruct: jest.fn() };
  const errorTranslator = { translate: jest.fn((e) => e) };
  const eventDispatcher = { dispatch: jest.fn(), getStats: jest.fn() };
  const definitionCache = { get: jest.fn(), clear: jest.fn() };
  return {
    registry,
    logger,
    entityRepository,
    factory,
    errorTranslator,
    eventDispatcher,
    definitionCache,
  };
};

const initManager = (deps) =>
  new EntityLifecycleManager({
    registry: deps.registry,
    logger: deps.logger,
    eventDispatcher: deps.eventDispatcher,
    entityRepository: deps.entityRepository,
    factory: deps.factory,
    errorTranslator: deps.errorTranslator,
    definitionCache: deps.definitionCache,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EntityLifecycleManager - Constructor and Dependencies', () => {
  it('throws error when logger is missing', () => {
    expect(() => {
      new EntityLifecycleManager({
        registry: { getEntityDefinition: jest.fn() },
        logger: null,
        eventDispatcher: { dispatch: jest.fn() },
        entityRepository: { add: jest.fn() },
        factory: { create: jest.fn() },
        errorTranslator: { translate: jest.fn() },
        definitionCache: { get: jest.fn() },
      });
    }).toThrow('Missing required dependency: ILogger');
  });

  it('throws error when registry is missing', () => {
    expect(() => {
      new EntityLifecycleManager({
        registry: null,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        eventDispatcher: { dispatch: jest.fn() },
        entityRepository: { add: jest.fn() },
        factory: { create: jest.fn() },
        errorTranslator: { translate: jest.fn() },
        definitionCache: { get: jest.fn() },
      });
    }).toThrow('Missing required dependency: IDataRegistry');
  });

  it('initializes successfully with optional monitoring coordinator', () => {
    const mockMonitoring = {
      executeMonitored: jest.fn(),
      getCircuitBreaker: jest.fn(),
      getStats: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      registry: { getEntityDefinition: jest.fn() },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      eventDispatcher: { dispatch: jest.fn() },
      entityRepository: {
        add: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn(),
        entities: jest.fn(),
      },
      factory: { create: jest.fn(), reconstruct: jest.fn() },
      errorTranslator: { translate: jest.fn() },
      definitionCache: { get: jest.fn(), clear: jest.fn() },
      monitoringCoordinator: mockMonitoring,
    });

    expect(manager).toBeInstanceOf(EntityLifecycleManager);
  });
});

describe('EntityLifecycleManager - Core Operations', () => {
  it('throws EntityNotFoundError when entity is missing', async () => {
    const deps = createDeps();
    deps.entityRepository.get.mockReturnValue(undefined);
    const manager = initManager(deps);
    await expect(manager.removeEntityInstance('missing')).rejects.toThrow(
      EntityNotFoundError
    );
    expect(deps.entityRepository.remove).not.toHaveBeenCalled();
  });

  it('throws RepositoryConsistencyError when remove returns false', async () => {
    const deps = createDeps();
    const entity = { id: 'e1', definitionId: 'def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(false);
    const manager = initManager(deps);
    await expect(manager.removeEntityInstance('e1')).rejects.toThrow(
      RepositoryConsistencyError
    );
    expect(
      global.__eventDispatcherMock.dispatchEntityRemoved
    ).not.toHaveBeenCalled();
  });

  it('wraps errors from repository.remove', async () => {
    const deps = createDeps();
    const entity = { id: 'e2', definitionId: 'def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockImplementation(() => {
      throw new Error('fail');
    });
    const manager = initManager(deps);
    await expect(manager.removeEntityInstance('e2')).rejects.toThrow(
      RepositoryConsistencyError
    );
    expect(
      global.__eventDispatcherMock.dispatchEntityRemoved
    ).not.toHaveBeenCalled();
  });

  it('handles successful entity removal with events', async () => {
    const deps = createDeps();
    const entity = { id: 'e3', definitionId: 'def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(true);
    const manager = initManager(deps);

    await manager.removeEntityInstance('e3');

    expect(deps.entityRepository.remove).toHaveBeenCalledWith('e3');
    expect(
      global.__eventDispatcherMock.dispatchEntityRemoved
    ).toHaveBeenCalledWith(entity);
    expect(deps.logger.debug).toHaveBeenCalledWith('Entity removed: e3');
  });
});

describe('EntityLifecycleManager - Error Handling', () => {
  it('handles factory.create errors and translates them', async () => {
    const deps = createDeps();
    const originalError = new Error('Factory creation failed');
    const translatedError = new Error('Translated error');

    deps.factory.create.mockImplementation(() => {
      throw originalError;
    });
    deps.errorTranslator.translate.mockReturnValue(translatedError);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps);

    await expect(manager.createEntityInstance('test:def')).rejects.toThrow(
      'Translated error'
    );
    expect(deps.errorTranslator.translate).toHaveBeenCalledWith(originalError);
    expect(deps.logger.error).toHaveBeenCalledWith(
      "Failed to construct entity 'test:def':",
      originalError
    );
  });

  it('handles factory.reconstruct errors and translates them', () => {
    const deps = createDeps();
    const originalError = new Error('Factory reconstruction failed');
    const translatedError = new Error('Translated reconstruction error');
    const serializedEntity = {
      instanceId: 'test-id',
      definitionId: 'test:def',
    };

    deps.factory.reconstruct.mockImplementation(() => {
      throw originalError;
    });
    deps.errorTranslator.translate.mockReturnValue(translatedError);
    global.__definitionHelperMock.getDefinitionForReconstruct.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps);

    expect(() => manager.reconstructEntity(serializedEntity)).toThrow(
      'Translated reconstruction error'
    );
    expect(deps.errorTranslator.translate).toHaveBeenCalledWith(originalError);
    expect(deps.logger.error).toHaveBeenCalledWith(
      "Failed to reconstruct entity 'test-id':",
      originalError
    );
  });
});

describe('EntityLifecycleManager - Monitoring Integration', () => {
  it('executes createEntityInstance with monitoring when coordinator is present', async () => {
    const deps = createDeps();
    const mockEntity = { id: 'monitored-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const mockMonitoring = {
      executeMonitored: jest
        .fn()
        .mockImplementation(async (name, fn, context) => {
          return await fn(); // Actually execute the provided function
        }),
      getCircuitBreaker: jest.fn(),
      getStats: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    const result = await manager.createEntityInstance('test:def');

    expect(mockMonitoring.executeMonitored).toHaveBeenCalledWith(
      'createEntityInstance',
      expect.any(Function),
      { context: 'definition:test:def' }
    );
    expect(result).toBe(mockEntity);
  });

  it('executes removeEntityInstance with monitoring when coordinator is present', async () => {
    const deps = createDeps();
    const entity = { id: 'test-id', definitionId: 'test:def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(true);

    const mockMonitoring = {
      executeMonitored: jest
        .fn()
        .mockImplementation(async (name, fn, context) => {
          return await fn(); // Actually execute the provided function
        }),
      getCircuitBreaker: jest.fn(),
      getStats: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    await manager.removeEntityInstance('test-id');

    expect(mockMonitoring.executeMonitored).toHaveBeenCalledWith(
      'removeEntityInstance',
      expect.any(Function),
      { context: 'instance:test-id' }
    );
  });

  it('executes createEntityInstanceWithMonitoring successfully', async () => {
    const deps = createDeps();
    const mockEntity = { id: 'monitored-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const mockMonitoring = {
      executeMonitored: jest
        .fn()
        .mockImplementation(async (name, fn, context) => {
          return await fn(); // Actually execute the provided function
        }),
      getCircuitBreaker: jest.fn(),
      getStats: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    const result = await manager.createEntityInstanceWithMonitoring(
      'test:def',
      { instanceId: 'custom-id' }
    );

    expect(mockMonitoring.executeMonitored).toHaveBeenCalledWith(
      'createEntityInstance',
      expect.any(Function),
      { context: 'definition:test:def' }
    );
    expect(result).toBe(mockEntity);
  });

  it('falls back to normal createEntityInstance when monitoring is disabled', async () => {
    const deps = createDeps();
    const manager = initManager(deps); // No monitoring coordinator

    // Mock the factory to return a proper entity
    const mockEntity = { id: 'test-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);

    const result = await manager.createEntityInstanceWithMonitoring('test:def');

    expect(deps.logger.warn).toHaveBeenCalledWith(
      'createEntityInstanceWithMonitoring called but monitoring is disabled'
    );
    expect(result).toBe(mockEntity);
  });

  it('returns monitoring stats when coordinator is present', () => {
    const deps = createDeps();
    const mockStats = { operations: 5, averageTime: 100 };
    const mockMonitoring = {
      getStats: jest.fn().mockReturnValue(mockStats),
      executeMonitored: jest.fn(),
      getCircuitBreaker: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    const result = manager.getMonitoringStats();

    expect(result).toBe(mockStats);
    expect(mockMonitoring.getStats).toHaveBeenCalled();
  });

  it('returns null for monitoring stats when coordinator is absent', () => {
    const deps = createDeps();
    const manager = initManager(deps);

    const result = manager.getMonitoringStats();

    expect(result).toBeNull();
  });

  it('returns circuit breaker status when coordinator is present', () => {
    const deps = createDeps();
    const mockCircuitBreaker = {
      getStats: jest.fn().mockReturnValue({ state: 'CLOSED', failures: 0 }),
    };
    const mockMonitoring = {
      getCircuitBreaker: jest.fn().mockReturnValue(mockCircuitBreaker),
      executeMonitored: jest.fn(),
      getStats: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    const result = manager.getCircuitBreakerStatus('testOperation');

    expect(mockMonitoring.getCircuitBreaker).toHaveBeenCalledWith(
      'testOperation'
    );
    expect(result).toEqual({ state: 'CLOSED', failures: 0 });
  });

  it('returns null for circuit breaker status when coordinator is absent', () => {
    const deps = createDeps();
    const manager = initManager(deps);

    const result = manager.getCircuitBreakerStatus('testOperation');

    expect(result).toBeNull();
  });
});

describe('EntityLifecycleManager - Batch Operations', () => {
  it('collects errors during batchCreateEntities', async () => {
    const deps = createDeps();
    const manager = initManager(deps);
    jest
      .spyOn(manager, 'createEntityInstance')
      .mockResolvedValueOnce({ id: 'a' })
      .mockRejectedValueOnce(new Error('boom'));
    const result = await manager.batchCreateEntities([
      { definitionId: 'd1', opts: {} },
      { definitionId: 'd2', opts: {} },
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it('handles successful batch creation with no errors', async () => {
    const deps = createDeps();
    const manager = initManager(deps);
    jest
      .spyOn(manager, 'createEntityInstance')
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'b' });

    const result = await manager.batchCreateEntities([
      { definitionId: 'd1', opts: {} },
      { definitionId: 'd2', opts: {} },
    ]);

    expect(result.entities).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });

  it('handles empty batch creation', async () => {
    const deps = createDeps();
    const manager = initManager(deps);

    const result = await manager.batchCreateEntities([]);

    expect(result.entities).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });
});

describe('EntityLifecycleManager - Successful Operations', () => {
  it('successfully creates entity without monitoring', async () => {
    const deps = createDeps();
    const mockEntity = { id: 'test-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps);

    const result = await manager.createEntityInstance('test:def', {
      instanceId: 'custom-id',
    });

    expect(result).toBe(mockEntity);
    expect(deps.entityRepository.add).toHaveBeenCalledWith(mockEntity);
    expect(
      global.__eventDispatcherMock.dispatchEntityCreated
    ).toHaveBeenCalledWith(mockEntity, false);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'Entity created: test-entity (definition: test:def)'
    );
  });

  it('logs detailed debug information when constructing the park bench entity', async () => {
    const deps = createDeps();
    const mockEntity = {
      id: 'p_erotica:park_bench_instance',
      definitionId: 'park:def',
      componentTypeIds: ['positioning:allows_sitting', 'core:test'],
    };

    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'park:def',
    });

    const manager = initManager(deps);

    await manager.createEntityInstance('park:def');

    expect(deps.logger.debug).toHaveBeenCalledWith(
      '[DEBUG] EntityLifecycleManager adding park bench to repository (construct):',
      expect.objectContaining({
        entityId: 'p_erotica:park_bench_instance',
        hasAllowsSitting: true,
        componentTypeIds: expect.arrayContaining(['positioning:allows_sitting']),
      })
    );
  });

  it('successfully reconstructs entity', () => {
    const deps = createDeps();
    const mockEntity = { id: 'test-entity', definitionId: 'test:def' };
    const serializedEntity = {
      instanceId: 'test-entity',
      definitionId: 'test:def',
    };

    deps.factory.reconstruct.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForReconstruct.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps);

    const result = manager.reconstructEntity(serializedEntity);

    expect(result).toBe(mockEntity);
    expect(deps.entityRepository.add).toHaveBeenCalledWith(mockEntity);
    expect(
      global.__eventDispatcherMock.dispatchEntityCreated
    ).toHaveBeenCalledWith(mockEntity, true);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'Entity reconstructed: test-entity (definition: test:def)'
    );
  });

  it('logs detailed debug information when reconstructing the park bench entity', () => {
    const deps = createDeps();
    const mockEntity = {
      id: 'p_erotica:park_bench_instance',
      definitionId: 'park:def',
      componentTypeIds: ['positioning:allows_sitting'],
    };
    const serializedEntity = {
      instanceId: 'p_erotica:park_bench_instance',
      definitionId: 'park:def',
    };

    deps.factory.reconstruct.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForReconstruct.mockReturnValue({
      id: 'park:def',
    });

    const manager = initManager(deps);

    manager.reconstructEntity(serializedEntity);

    expect(deps.logger.debug).toHaveBeenCalledWith(
      '[DEBUG] EntityLifecycleManager adding park bench to repository (reconstruct):',
      expect.objectContaining({
        entityId: 'p_erotica:park_bench_instance',
        hasAllowsSitting: true,
        componentTypeIds: expect.arrayContaining(['positioning:allows_sitting']),
      })
    );
  });
});

describe('EntityLifecycleManager - Stats and Cache', () => {
  it('returns stats with repository size and monitoring', () => {
    const deps = createDeps({ size: 5 });
    deps.entityRepository.size = 5;
    const mockMonitoringStats = { operations: 10 };
    const mockMonitoring = {
      getStats: jest.fn().mockReturnValue(mockMonitoringStats),
      executeMonitored: jest.fn(),
      getCircuitBreaker: jest.fn(),
    };

    const manager = new EntityLifecycleManager({
      ...deps,
      monitoringCoordinator: mockMonitoring,
    });

    const stats = manager.getStats();
    expect(stats.entityCount).toBe(5);
    expect(stats.monitoringStats).toBe(mockMonitoringStats);
    expect(global.__definitionHelperMock.getCacheStats).toHaveBeenCalled();
    expect(global.__eventDispatcherMock.getStats).toHaveBeenCalled();
  });

  it('returns stats without monitoring when coordinator is absent', () => {
    const deps = createDeps({ size: 3 });
    deps.entityRepository.size = 3;
    const manager = initManager(deps);

    const stats = manager.getStats();
    expect(stats.entityCount).toBe(3);
    expect(stats.monitoringStats).toBeUndefined();
    expect(global.__definitionHelperMock.getCacheStats).toHaveBeenCalled();
    expect(global.__eventDispatcherMock.getStats).toHaveBeenCalled();
  });

  it('handles repository without size property', () => {
    const deps = createDeps();
    // Don't set size property
    const manager = initManager(deps);

    const stats = manager.getStats();
    expect(stats.entityCount).toBe(0);
  });

  it('clears cache via helper', () => {
    const deps = createDeps();
    const manager = initManager(deps);
    manager.clearCache();
    expect(global.__definitionHelperMock.clearCache).toHaveBeenCalled();
  });

  it('preloads definitions via helper', () => {
    const deps = createDeps();
    const manager = initManager(deps);
    const definitionIds = ['def1', 'def2'];

    manager.preloadDefinitions(definitionIds);

    expect(
      global.__definitionHelperMock.preloadDefinitions
    ).toHaveBeenCalledWith(definitionIds);
  });
});

describe('EntityLifecycleManager - Additional Edge Cases', () => {
  it('handles createEntityInstance directly without monitoring', async () => {
    const deps = createDeps();
    const mockEntity = { id: 'direct-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps);

    const result = await manager.createEntityInstance('test:def');

    expect(result).toBe(mockEntity);
    expect(
      global.__validatorMock.validateCreateEntityParams
    ).toHaveBeenCalledWith('test:def');
    expect(global.__validatorMock.validateCreationOptions).toHaveBeenCalledWith(
      {}
    );
  });

  it('validates parameters through helper validators', async () => {
    const deps = createDeps();
    const manager = initManager(deps);
    const serializedEntity = {
      instanceId: 'test-id',
      definitionId: 'test:def',
    };

    // Setup mocks to prevent actual execution
    deps.factory.reconstruct.mockReturnValue({ id: 'test-entity' });
    global.__definitionHelperMock.getDefinitionForReconstruct.mockReturnValue({
      id: 'test:def',
    });

    manager.reconstructEntity(serializedEntity);

    expect(
      global.__validatorMock.validateReconstructEntityParams
    ).toHaveBeenCalledWith(serializedEntity);
    expect(
      global.__validatorMock.validateSerializedEntityStructure
    ).toHaveBeenCalledWith(serializedEntity);
  });

  it('validates remove entity instance parameters', async () => {
    const deps = createDeps();
    const entity = { id: 'test-id', definitionId: 'test:def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(true);

    const manager = initManager(deps);

    await manager.removeEntityInstance('test-id');

    expect(
      global.__validatorMock.validateRemoveEntityInstanceParams
    ).toHaveBeenCalledWith('test-id');
  });

  it('executes removeEntityInstanceCore directly via removeEntityInstance without monitoring', async () => {
    const deps = createDeps();
    const entity = { id: 'test-id', definitionId: 'test:def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(true);

    const manager = initManager(deps); // No monitoring coordinator

    await manager.removeEntityInstance('test-id');

    expect(deps.entityRepository.get).toHaveBeenCalledWith('test-id');
    expect(deps.entityRepository.remove).toHaveBeenCalledWith('test-id');
  });

  it('executes createEntityInstanceCore directly via createEntityInstance without monitoring', async () => {
    const deps = createDeps();
    const mockEntity = { id: 'core-test-entity', definitionId: 'test:def' };
    deps.factory.create.mockReturnValue(mockEntity);
    global.__definitionHelperMock.getDefinitionForCreate.mockReturnValue({
      id: 'test:def',
    });

    const manager = initManager(deps); // No monitoring coordinator

    const result = await manager.createEntityInstance('test:def', {
      instanceId: 'core-test',
    });

    expect(result).toBe(mockEntity);
    expect(deps.factory.create).toHaveBeenCalledWith(
      'test:def',
      { instanceId: 'core-test' },
      deps.registry,
      deps.entityRepository,
      { id: 'test:def' }
    );
  });
});
