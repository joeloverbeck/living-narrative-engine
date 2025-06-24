import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../../../src/constants/eventIds.js';

let worldInitializer;
let mockEntityManager;
let mockWorldContext;
let mockRepository;
let mockDispatcher;
let mockLogger;
let mockScopeRegistry;

beforeEach(() => {
  mockEntityManager = { createEntityInstance: jest.fn() };
  mockWorldContext = {};
  mockRepository = {
    getWorld: jest.fn(),
    getEntityInstanceDefinition: jest.fn(),
  };
  mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  mockScopeRegistry = { initialize: jest.fn() };

  worldInitializer = new WorldInitializer({
    entityManager: mockEntityManager,
    worldContext: mockWorldContext,
    gameDataRepository: mockRepository,
    validatedEventDispatcher: mockDispatcher,
    logger: mockLogger,
    scopeRegistry: mockScopeRegistry,
  });
});

describe('WorldInitializer helper methods', () => {
  it('_validateAndGetInstanceDefinition returns null for invalid instance', () => {
    const res = worldInitializer._validateAndGetInstanceDefinition({}, 'w');
    expect(res).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('_createEntity returns null on creation error', () => {
    mockEntityManager.createEntityInstance.mockImplementation(() => {
      throw new Error('fail');
    });
    const res = worldInitializer._createEntity('def', 'id', {});
    expect(res).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('_dispatchInstantiationSuccess sends success event', async () => {
    const inst = { id: 'e1', instanceId: 'i1', definitionId: 'd1' };
    await worldInitializer._dispatchInstantiationSuccess(inst, 'w1');
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      WORLDINIT_ENTITY_INSTANTIATED_ID,
      expect.objectContaining({ entityId: 'e1', worldName: 'w1' }),
      expect.any(Object)
    );
  });

  it('_dispatchInstantiationFailure sends failure event', async () => {
    await worldInitializer._dispatchInstantiationFailure('i1', 'd1', 'w1');
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
      expect.objectContaining({ instanceId: 'i1', definitionId: 'd1' }),
      expect.any(Object)
    );
  });
});
