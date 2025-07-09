import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityLifecycleManager from '../../../../src/entities/services/entityLifecycleManager.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import { RepositoryConsistencyError } from '../../../../src/errors/repositoryConsistencyError.js';

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

describe('EntityLifecycleManager branches', () => {
  it('throws EntityNotFoundError when entity is missing', () => {
    const deps = createDeps();
    deps.entityRepository.get.mockReturnValue(undefined);
    const manager = initManager(deps);
    expect(() => manager.removeEntityInstance('missing')).toThrow(
      EntityNotFoundError
    );
    expect(deps.entityRepository.remove).not.toHaveBeenCalled();
  });

  it('throws RepositoryConsistencyError when remove returns false', () => {
    const deps = createDeps();
    const entity = { id: 'e1', definitionId: 'def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockReturnValue(false);
    const manager = initManager(deps);
    expect(() => manager.removeEntityInstance('e1')).toThrow(
      RepositoryConsistencyError
    );
    expect(
      global.__eventDispatcherMock.dispatchEntityRemoved
    ).not.toHaveBeenCalled();
  });

  it('wraps errors from repository.remove', () => {
    const deps = createDeps();
    const entity = { id: 'e2', definitionId: 'def' };
    deps.entityRepository.get.mockReturnValue(entity);
    deps.entityRepository.remove.mockImplementation(() => {
      throw new Error('fail');
    });
    const manager = initManager(deps);
    expect(() => manager.removeEntityInstance('e2')).toThrow(
      RepositoryConsistencyError
    );
    expect(
      global.__eventDispatcherMock.dispatchEntityRemoved
    ).not.toHaveBeenCalled();
  });

  it('collects errors during batchCreateEntities', () => {
    const deps = createDeps();
    const manager = initManager(deps);
    jest
      .spyOn(manager, 'createEntityInstance')
      .mockReturnValueOnce({ id: 'a' })
      .mockImplementationOnce(() => {
        throw new Error('boom');
      });
    const result = manager.batchCreateEntities([
      { definitionId: 'd1', opts: {} },
      { definitionId: 'd2', opts: {} },
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it('returns stats with repository size', () => {
    const deps = createDeps({ size: 5 });
    deps.entityRepository.size = 5;
    const manager = initManager(deps);
    const stats = manager.getStats();
    expect(stats.entityCount).toBe(5);
    expect(global.__definitionHelperMock.getCacheStats).toHaveBeenCalled();
    expect(global.__eventDispatcherMock.getStats).toHaveBeenCalled();
  });

  it('clears cache via helper', () => {
    const deps = createDeps();
    const manager = initManager(deps);
    manager.clearCache();
    expect(global.__definitionHelperMock.clearCache).toHaveBeenCalled();
  });
});
