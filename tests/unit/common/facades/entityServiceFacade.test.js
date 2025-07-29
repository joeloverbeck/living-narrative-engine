/**
 * @file Unit tests for the EntityServiceFacade class.
 * @description Tests the entity service facade that simplifies entity operations
 * for testing by wrapping EntityManager, EventBus, DataRegistry, ScopeRegistry, and related services.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { EntityServiceFacade } from '../../../common/facades/entityServiceFacade.js';

describe('EntityServiceFacade', () => {
  let mockDependencies;
  let facade;

  // Mock services
  const mockEntityManager = {
    createEntity: jest.fn(),
    getEntityInstance: jest.fn(),
    updateComponent: jest.fn(),
    removeEntity: jest.fn(),
    dispose: jest.fn(),
  };

  const mockEventBus = {
    dispatch: jest.fn(),
    dispose: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(),
    dispose: jest.fn(),
  };

  const mockScopeRegistry = {
    getScope: jest.fn(),
    dispose: jest.fn(),
  };

  const mockGameDataRepository = {
    getEntityDefinition: jest.fn(),
    dispose: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockDependencies = {
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      scopeRegistry: mockScopeRegistry,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
    };

    // Set up default mock implementations
    mockEntityManager.createEntity.mockResolvedValue('test-entity-id');
    mockEntityManager.getEntityInstance.mockReturnValue({
      id: 'test-entity-id',
      components: {
        'core:name': { name: 'Test Entity' },
      },
    });
    mockEntityManager.updateComponent.mockResolvedValue(true);
    mockEntityManager.removeEntity.mockResolvedValue(true);

    mockEventBus.dispatch.mockResolvedValue();

    mockGameDataRepository.getEntityDefinition.mockResolvedValue({
      id: 'core:actor',
      components: {
        'core:actor': {},
        'core:name': {},
        'core:location': {},
      },
    });

    const mockScopeInstance = {
      query: jest.fn().mockResolvedValue([]),
    };
    mockScopeRegistry.getScope.mockResolvedValue(mockScopeInstance);

    facade = new EntityServiceFacade(mockDependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create facade with valid dependencies', () => {
      expect(facade).toBeInstanceOf(EntityServiceFacade);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should throw error for missing entityManager', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          entityManager: null,
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid entityManager dependency.'
      );
    });

    test('should throw error for invalid entityManager', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          entityManager: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid entityManager dependency.'
      );
    });

    test('should throw error for missing eventBus', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          eventBus: null,
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid eventBus dependency.'
      );
    });

    test('should throw error for invalid eventBus', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          eventBus: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid eventBus dependency.'
      );
    });

    test('should throw error for missing dataRegistry', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          dataRegistry: null,
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid dataRegistry dependency.'
      );
    });

    test('should throw error for invalid dataRegistry', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          dataRegistry: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid dataRegistry dependency.'
      );
    });

    test('should throw error for missing scopeRegistry', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          scopeRegistry: null,
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid scopeRegistry dependency.'
      );
    });

    test('should throw error for invalid scopeRegistry', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          scopeRegistry: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid scopeRegistry dependency.'
      );
    });

    test('should throw error for missing gameDataRepository', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          gameDataRepository: null,
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid gameDataRepository dependency.'
      );
    });

    test('should throw error for invalid gameDataRepository', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          gameDataRepository: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'EntityServiceFacade: Missing or invalid gameDataRepository dependency.'
      );
    });

    test('should throw error for missing logger', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          logger: null,
        });
      }).toThrow('EntityServiceFacade: Missing or invalid logger dependency.');
    });

    test('should throw error for invalid logger', () => {
      expect(() => {
        new EntityServiceFacade({
          ...mockDependencies,
          logger: { invalidMethod: jest.fn() },
        });
      }).toThrow('EntityServiceFacade: Missing or invalid logger dependency.');
    });
  });

  describe('createTestActor', () => {
    test('should create test actor with default configuration', async () => {
      const actorId = await facade.createTestActor();

      expect(actorId).toBe('test-entity-id');
      expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(
        'core:actor'
      );
      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'core:actor',
        components: {
          'core:name': { name: 'Test Actor' },
          'core:location': { locationId: 'test-location' },
          'core:actor': { type: 'ai' },
        },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EntityServiceFacade: Creating test actor',
        expect.objectContaining({
          name: 'Test Actor',
          location: 'test-location',
          type: 'core:actor',
        })
      );
    });

    test('should create test actor with custom configuration', async () => {
      const config = {
        name: 'Custom Actor',
        location: 'custom-location',
        type: 'custom:actor',
        components: {
          'custom:component': { value: 'test' },
        },
      };

      const actorId = await facade.createTestActor(config);

      expect(actorId).toBe('test-entity-id');
      expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(
        'custom:actor'
      );
      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'custom:actor',
        components: {
          'core:name': { name: 'Custom Actor' },
          'core:location': { locationId: 'custom-location' },
          'core:actor': { type: 'ai' },
          'custom:component': { value: 'test' },
        },
      });
    });

    test('should throw error when actor definition not found', async () => {
      mockGameDataRepository.getEntityDefinition.mockResolvedValue(null);

      await expect(facade.createTestActor()).rejects.toThrow(
        'Actor definition not found: core:actor'
      );
    });

    test('should handle entity creation errors', async () => {
      const error = new Error('Entity creation failed');
      mockEntityManager.createEntity.mockRejectedValue(error);

      await expect(facade.createTestActor()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EntityServiceFacade: Error creating test actor',
        error
      );
    });
  });

  describe('createTestWorld', () => {
    test('should create test world with default configuration', async () => {
      const result = await facade.createTestWorld();

      expect(result).toEqual({
        mainLocationId: 'test-entity-id',
        locations: ['test-entity-id'],
      });
      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'core:location',
        components: {
          'core:name': { name: 'Test Location' },
          'core:description': {
            description: 'A test location for testing purposes',
          },
          'core:location': {
            type: 'room',
            contents: [],
          },
        },
      });
    });

    test('should create test world with connections', async () => {
      mockEntityManager.createEntity
        .mockResolvedValueOnce('main-location-id')
        .mockResolvedValueOnce('north-location-id');

      const result = await facade.createTestWorld({ createConnections: true });

      expect(result).toEqual({
        mainLocationId: 'main-location-id',
        locations: ['main-location-id', 'north-location-id'],
        northLocationId: 'north-location-id',
      });
      expect(mockEntityManager.createEntity).toHaveBeenCalledTimes(2);
    });

    test('should create test world with custom configuration', async () => {
      const config = {
        name: 'Custom World',
        description: 'Custom description',
        components: {
          'custom:component': { value: 'test' },
        },
      };

      const result = await facade.createTestWorld(config);

      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'core:location',
        components: {
          'core:name': { name: 'Custom World' },
          'core:description': { description: 'Custom description' },
          'core:location': {
            type: 'room',
            contents: [],
          },
          'custom:component': { value: 'test' },
        },
      });
    });

    test('should handle world creation errors', async () => {
      const error = new Error('World creation failed');
      mockEntityManager.createEntity.mockRejectedValue(error);

      await expect(facade.createTestWorld()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EntityServiceFacade: Error creating test world',
        error
      );
    });
  });

  describe('createEntity', () => {
    test('should create entity with required configuration', async () => {
      const config = {
        type: 'core:item',
        initialData: {
          'core:name': { name: 'Test Item' },
        },
      };

      const entityId = await facade.createEntity(config);

      expect(entityId).toBe('test-entity-id');
      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'core:item',
        id: undefined,
        components: {
          'core:name': { name: 'Test Item' },
        },
      });
    });

    test('should create entity with custom ID', async () => {
      const config = {
        type: 'core:item',
        id: 'custom-id',
        initialData: {},
      };

      const entityId = await facade.createEntity(config);

      expect(mockEntityManager.createEntity).toHaveBeenCalledWith({
        definitionId: 'core:item',
        id: 'custom-id',
        components: {},
      });
    });

    test('should throw error for missing type', async () => {
      await expect(facade.createEntity({})).rejects.toThrow(
        'Entity type is required'
      );
    });

    test('should handle entity creation errors', async () => {
      const error = new Error('Entity creation failed');
      mockEntityManager.createEntity.mockRejectedValue(error);

      await expect(facade.createEntity({ type: 'core:item' })).rejects.toThrow(
        error
      );
    });
  });

  describe('getEntity', () => {
    test('should retrieve entity by ID', () => {
      const entity = facade.getEntity('test-entity-id');

      expect(entity).toEqual({
        id: 'test-entity-id',
        components: {
          'core:name': { name: 'Test Entity' },
        },
      });
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'test-entity-id'
      );
    });

    test('should throw error for missing entity', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      expect(() => facade.getEntity('missing-id')).toThrow(
        'Entity not found: missing-id. Available entities: []'
      );
    });

    test('should handle retrieval errors', () => {
      const error = new Error('Retrieval failed');
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw error;
      });

      expect(() => facade.getEntity('test-id')).toThrow(error);
    });
  });

  describe('getComponent', () => {
    test('should retrieve component from entity', async () => {
      const component = await facade.getComponent(
        'test-entity-id',
        'core:name'
      );

      expect(component).toEqual({ name: 'Test Entity' });
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'test-entity-id'
      );
    });

    test('should return null for missing component', async () => {
      const component = await facade.getComponent(
        'test-entity-id',
        'missing:component'
      );

      expect(component).toBeNull();
    });

    test('should throw error for missing entity', async () => {
      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      await expect(
        facade.getComponent('missing-id', 'core:name')
      ).rejects.toThrow('Entity not found: missing-id');
    });
  });

  describe('updateComponent', () => {
    test('should update component on entity', async () => {
      const data = { name: 'Updated Name' };

      await facade.updateComponent('test-entity-id', 'core:name', data);

      expect(mockEntityManager.updateComponent).toHaveBeenCalledWith(
        'test-entity-id',
        'core:name',
        data
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EntityServiceFacade: Component updated',
        expect.objectContaining({
          entityId: 'test-entity-id',
          componentId: 'core:name',
        })
      );
    });

    test('should handle update errors', async () => {
      const error = new Error('Update failed');
      mockEntityManager.updateComponent.mockRejectedValue(error);

      await expect(
        facade.updateComponent('test-id', 'core:name', {})
      ).rejects.toThrow(error);
    });
  });

  describe('deleteEntity', () => {
    test('should delete entity by ID', async () => {
      await facade.deleteEntity('test-entity-id');

      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith(
        'test-entity-id'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EntityServiceFacade: Entity deleted',
        { entityId: 'test-entity-id' }
      );
    });

    test('should handle deletion errors', async () => {
      const error = new Error('Deletion failed');
      mockEntityManager.removeEntity.mockRejectedValue(error);

      await expect(facade.deleteEntity('test-id')).rejects.toThrow(error);
    });
  });

  describe('queryEntities', () => {
    test('should query entities by scope', async () => {
      const mockEntities = [{ id: 'entity1' }, { id: 'entity2' }];
      const mockScopeInstance = {
        query: jest.fn().mockResolvedValue(mockEntities),
      };
      mockScopeRegistry.getScope.mockResolvedValue(mockScopeInstance);

      const result = await facade.queryEntities('core:actor');

      expect(result).toEqual(mockEntities);
      expect(mockScopeRegistry.getScope).toHaveBeenCalledWith('core:actor');
      expect(mockScopeInstance.query).toHaveBeenCalledWith({});
    });

    test('should query entities with filter', async () => {
      const filter = { name: 'Test' };
      const mockScopeInstance = {
        query: jest.fn().mockResolvedValue([]),
      };
      mockScopeRegistry.getScope.mockResolvedValue(mockScopeInstance);

      await facade.queryEntities('core:actor', filter);

      expect(mockScopeInstance.query).toHaveBeenCalledWith(filter);
    });

    test('should throw error for missing scope', async () => {
      mockScopeRegistry.getScope.mockResolvedValue(null);

      await expect(facade.queryEntities('missing:scope')).rejects.toThrow(
        'Scope not found: missing:scope'
      );
    });
  });

  describe('dispatchEvent', () => {
    test('should dispatch event through event bus', async () => {
      const event = {
        type: 'TEST_EVENT',
        payload: { data: 'test' },
      };

      await facade.dispatchEvent(event);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(event);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EntityServiceFacade: Event dispatched',
        { type: 'TEST_EVENT' }
      );
    });

    test('should track dispatched events', async () => {
      const event = {
        type: 'TEST_EVENT',
        payload: { data: 'test' },
      };

      await facade.dispatchEvent(event);

      const dispatchedEvents = facade.getDispatchedEvents();
      expect(dispatchedEvents).toHaveLength(1);
      expect(dispatchedEvents[0]).toMatchObject({
        type: 'TEST_EVENT',
        payload: { data: 'test' },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('getDispatchedEvents', () => {
    test('should return all dispatched events', async () => {
      await facade.dispatchEvent({ type: 'EVENT1' });
      await facade.dispatchEvent({ type: 'EVENT2' });

      const events = facade.getDispatchedEvents();
      expect(events).toHaveLength(2);
    });

    test('should filter events by type', async () => {
      await facade.dispatchEvent({ type: 'EVENT1' });
      await facade.dispatchEvent({ type: 'EVENT2' });
      await facade.dispatchEvent({ type: 'EVENT1' });

      const events = facade.getDispatchedEvents('EVENT1');
      expect(events).toHaveLength(2);
      expect(events.every((event) => event.type === 'EVENT1')).toBe(true);
    });
  });

  describe('clearTestData', () => {
    test('should clear all test data', async () => {
      // Create some test data
      await facade.createTestActor();
      await facade.dispatchEvent({ type: 'TEST_EVENT' });

      await facade.clearTestData();

      expect(mockEntityManager.removeEntity).toHaveBeenCalled();
      expect(facade.getDispatchedEvents()).toHaveLength(0);
      expect(facade.getTestStatistics().totalEntities).toBe(0);
    });

    test('should handle removal errors gracefully', async () => {
      await facade.createTestActor();
      mockEntityManager.removeEntity.mockRejectedValue(
        new Error('Removal failed')
      );

      await facade.clearTestData();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'EntityServiceFacade: Error removing test entity',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('getTestStatistics', () => {
    test('should return test statistics', async () => {
      // Set up mocks to return different IDs for different entities
      mockEntityManager.createEntity
        .mockResolvedValueOnce('actor-id')
        .mockResolvedValueOnce('main-location-id')
        .mockResolvedValueOnce('north-location-id');

      await facade.createTestActor();
      await facade.createTestWorld({ createConnections: true });
      await facade.dispatchEvent({ type: 'TEST_EVENT' });

      const stats = facade.getTestStatistics();

      expect(stats).toEqual({
        totalEntities: 3,
        totalComponents: 0,
        totalEvents: 1,
        entityTypes: {
          actor: 1,
          location: 2,
        },
      });
    });
  });

  describe('Property Getters', () => {
    test('should provide access to entityManager', () => {
      expect(facade.entityManager).toBe(mockEntityManager);
    });

    test('should provide access to eventBus', () => {
      expect(facade.eventBus).toBe(mockEventBus);
    });

    test('should provide access to dataRegistry', () => {
      expect(facade.dataRegistry).toBe(mockDataRegistry);
    });

    test('should provide access to scopeRegistry', () => {
      expect(facade.scopeRegistry).toBe(mockScopeRegistry);
    });

    test('should provide access to gameDataRepository', () => {
      expect(facade.gameDataRepository).toBe(mockGameDataRepository);
    });
  });

  describe('dispose', () => {
    test('should dispose resources and clear test data', async () => {
      await facade.createTestActor();

      await facade.dispose();

      expect(mockEntityManager.removeEntity).toHaveBeenCalled();
      expect(mockEntityManager.dispose).toHaveBeenCalled();
      expect(mockEventBus.dispose).toHaveBeenCalled();
      expect(mockDataRegistry.dispose).toHaveBeenCalled();
      expect(mockScopeRegistry.dispose).toHaveBeenCalled();
      expect(mockGameDataRepository.dispose).toHaveBeenCalled();
    });

    test('should handle missing dispose methods gracefully', async () => {
      const facadeWithoutDispose = new EntityServiceFacade({
        ...mockDependencies,
        entityManager: { ...mockEntityManager, dispose: undefined },
      });

      await expect(facadeWithoutDispose.dispose()).resolves.not.toThrow();
    });
  });
});
