// tests/initializers/worldInitializer.test.js
// --- FILE START ---

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import _isEqual from 'lodash/isEqual.js'; // For comparing complex objects in logs if needed
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

describe('WorldInitializer', () => {
  let mockEntityManager;
  let mockWorldContext;
  let mockGameDataRepository;
  let mockValidatedEventDispatcher;
  let mockLogger;
  let mockSpatialIndexManager;
  let mockScopeRegistry;
  let worldInitializer;

  const createMockEntityInstance = (
    instanceId,
    definitionId,
    initialComponentsData = {}
  ) => {
    const internalComponentsMap = new Map();

    for (const [type, data] of Object.entries(initialComponentsData)) {
      internalComponentsMap.set(type, JSON.parse(JSON.stringify(data)));
    }

    const mockInstanceBase = {
      id: instanceId,
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
      _getInternalComponentData: (componentTypeId) => {
        return internalComponentsMap.get(componentTypeId);
      },
      hasComponent: jest.fn((componentTypeId) =>
        internalComponentsMap.has(componentTypeId)
      ),
    };

    Object.defineProperty(mockInstanceBase, 'componentEntries', {
      get: jest.fn(() => {
        const entriesArray = [];
        for (const [key, value] of internalComponentsMap.entries()) {
          entriesArray.push([key, value]);
        }
        return entriesArray[Symbol.iterator]();
      }),
      configurable: true,
    });

    return mockInstanceBase;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn((id) => id.startsWith('uuid-')),
    };
    mockWorldContext = {};
    mockGameDataRepository = {
      getAllEntityDefinitions: jest.fn(),
      getComponentDefinition: jest.fn(),
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      get: jest.fn().mockReturnValue({ scopes: {} }), // Add the missing get method with default return
    };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockSpatialIndexManager = {
      addEntity: jest.fn(),
    };
    mockScopeRegistry = {
      initialize: jest.fn(),
      getScope: jest.fn(),
      clear: jest.fn(),
    };

    worldInitializer = new WorldInitializer({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
      scopeRegistry: mockScopeRegistry,
    });

    mockGameDataRepository.getComponentDefinition.mockImplementation(
      (componentTypeId) => {
        return { id: componentTypeId };
      }
    );
  });

  describe('constructor', () => {
    it('should instantiate successfully with all valid dependencies', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'WorldInitializer: Instance created. Spatial index management is now handled by SpatialIndexSynchronizer through event listening.'
      );
      expect(worldInitializer).toBeInstanceOf(WorldInitializer);
    });

    const constructorErrorTestCases = [
      [
        'EntityManager',
        'entityManager',
        'WorldInitializer requires an EntityManager.',
      ],
      [
        'WorldContext',
        'worldContext',
        'WorldInitializer requires a WorldContext.',
      ],
      [
        'GameDataRepository',
        'gameDataRepository',
        'WorldInitializer requires a GameDataRepository.',
      ],
      [
        'ValidatedEventDispatcher',
        'validatedEventDispatcher',
        'WorldInitializer requires a ValidatedEventDispatcher.',
      ],
      ['ILogger', 'logger', 'WorldInitializer requires an ILogger.'],
      [
        'ScopeRegistry',
        'scopeRegistry',
        'WorldInitializer requires a ScopeRegistry.',
      ],
    ];

    it.each(constructorErrorTestCases)(
      'should throw if %s is missing',
      (depDisplayName, depsKey, expectedErrorMessage) => {
        const deps = {
          entityManager: mockEntityManager,
          worldContext: mockWorldContext,
          gameDataRepository: mockGameDataRepository,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          logger: mockLogger,
          scopeRegistry: mockScopeRegistry,
        };
        delete deps[depsKey];
        expect(() => new WorldInitializer(deps)).toThrow(expectedErrorMessage);
      }
    );
  });

  describe('initializeWorldEntities', () => {
    it('should successfully instantiate entities from world instances in Pass 1', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:hero_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:hero_instance',
        definitionId: 'test:hero',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );

      const mockInstance1 = createMockEntityInstance(
        'test:hero_instance',
        'test:hero',
        {}
      );
      mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

      await worldInitializer.initializeWorldEntities('test:world');

      expect(mockGameDataRepository.getWorld).toHaveBeenCalledWith(
        'test:world'
      );
      expect(
        mockGameDataRepository.getEntityInstanceDefinition
      ).toHaveBeenCalledWith('test:hero_instance');
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'test:hero',
        {
          instanceId: 'test:hero_instance',
          componentOverrides: undefined,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'WorldInitializer (Pass 1): Successfully instantiated entity test:hero_instance (from definition: test:hero)'
        )
      );
      // Pass 2 reference resolution has been removed as it's no longer needed
      // with data-driven entity instances
    });

    it('should handle failed entity instantiation in Pass 1', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:broken_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:broken_instance',
        definitionId: 'test:broken',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );
      mockEntityManager.createEntityInstance.mockReturnValueOnce(null);

      await worldInitializer.initializeWorldEntities('test:world');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WorldInitializer (Pass 1): Failed to instantiate entity from definition: test:broken for instance: test:broken_instance. createEntityInstance returned null/undefined or threw an error.'
      );
      // Pass 2 reference resolution has been removed, so no related logs expected
    });

    // Pass 2 (component reference resolution) has been removed as it's no longer needed
    // with data-driven entity instances. Spatial index management is handled automatically
    // by SpatialIndexSynchronizer through event listening.

    describe('Spatial Index Management', () => {
      it('should complete entity instantiation with spatial index handled by SpatialIndexSynchronizer', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:spatialDummy_instance',
            },
          ],
        };

        const entityInstanceDef = {
          instanceId: 'test:spatialDummy_instance',
          definitionId: 'test:spatialDummy',
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
          entityInstanceDef
        );

        // Mock entity instance creation
        const mockInstance = createMockEntityInstance(
          'test:spatialDummy_instance',
          'test:spatialDummy',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'some-other-place' },
          }
        );
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          mockInstance
        );

        // Mock the location entity to exist so spatial index validation passes
        const mockLocationEntity = createMockEntityInstance(
          'some-other-place',
          'test:location',
          {}
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'some-other-place') {
            return mockLocationEntity;
          }
          return id.startsWith('uuid-') ? mockLocationEntity : undefined;
        });

        await worldInitializer.initializeWorldEntities('test:world');

        // Pass 2 reference resolution has been removed - no longer expect those logs
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer: World entity initialization complete for world: test:world. Instantiated: 1, Failed: 0, Total Processed: 1. Spatial index management is handled by SpatialIndexSynchronizer.'
          )
        );
      });

      it('EntityManager handles adding entities with position to spatial index via SpatialIndexSynchronizer', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:roomPos1_instance',
            },
          ],
        };

        const entityInstanceDef = {
          instanceId: 'test:roomPos1_instance',
          definitionId: 'test:roomPos1',
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
          entityInstanceDef
        );

        const roomInstancePos1 = createMockEntityInstance(
          'test:roomPos1_instance',
          'test:roomPos1',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'some-other-place' },
          }
        );
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          roomInstancePos1
        );

        // Mock the location entity to exist so spatial index validation passes
        const mockLocationEntity = createMockEntityInstance(
          'some-other-place',
          'test:location',
          {}
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'some-other-place') {
            return mockLocationEntity;
          }
          return id.startsWith('uuid-') ? mockLocationEntity : undefined;
        });

        await worldInitializer.initializeWorldEntities('test:world');

        // Pass 2 reference resolution has been removed - no longer expect those logs
        // And check for the overall completion
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer: World entity initialization complete for world: test:world. Instantiated: 1, Failed: 0, Total Processed: 1. Spatial index management is handled by SpatialIndexSynchronizer.'
          )
        );
      });
    });

    it('should handle invalid world instances gracefully', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:valid_instance',
          },
          {
            // Invalid instance - missing instanceId
            definitionId: 'test:invalid',
          },
          {
            instanceId: 'test:another_valid_instance',
            definitionId: 'test:another_valid',
          },
        ],
      };

      const validInstanceDef1 = {
        instanceId: 'test:valid_instance',
        definitionId: 'test:valid',
      };

      const validInstanceDef2 = {
        instanceId: 'test:another_valid_instance',
        definitionId: 'test:another_valid',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition
        .mockReturnValueOnce(validInstanceDef1)
        .mockReturnValueOnce(validInstanceDef2);

      const mockInstance1 = createMockEntityInstance(
        'test:valid_instance',
        'test:valid',
        {}
      );
      const mockInstance2 = createMockEntityInstance(
        'test:another_valid_instance',
        'test:another_valid',
        {}
      );

      mockEntityManager.createEntityInstance
        .mockReturnValueOnce(mockInstance1)
        .mockReturnValueOnce(mockInstance2);

      await worldInitializer.initializeWorldEntities('test:world');

      // Should only create 2 entities (the valid ones)
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'WorldInitializer (Pass 1): Skipping invalid world instance (missing instanceId):'
        ),
        expect.any(Object)
      );
    });

    it('should throw an error when world is not found', async () => {
      mockGameDataRepository.getWorld.mockReturnValue(null);

      await expect(
        worldInitializer.initializeWorldEntities('nonexistent:world')
      ).rejects.toThrow(
        "Game cannot start: World 'nonexistent:world' not found in the world data. Please ensure the world is properly defined."
      );

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockValidatedEventDispatcher,
        `World 'nonexistent:world' not found. The game cannot start without a valid world.`,
        expect.objectContaining({
          statusCode: 500,
          raw: expect.stringContaining(
            "World 'nonexistent:world' not available in game data repository"
          ),
        })
      );
    });

    it('should handle empty instances array gracefully', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [],
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);

      const result =
        await worldInitializer.initializeWorldEntities('test:world');

      expect(result).toEqual({
        entities: [],
        instantiatedCount: 0,
        failedCount: 0,
        totalProcessed: 0,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'WorldInitializer: World entity initialization complete for world: test:world'
        )
      );
    });
  });

  // Test for _dispatchWorldInitEvent error handling
  describe('_dispatchWorldInitEvent error handling', () => {
    it('should log an error if event dispatching fails', async () => {
      const MOCK_ERROR_MESSAGE = 'Dispatch failed';
      mockValidatedEventDispatcher.dispatch.mockRejectedValueOnce(
        new Error(MOCK_ERROR_MESSAGE)
      );

      // Need to trigger an event dispatch. Easiest is via entity instantiation.
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:eventTest_instance',
          },
        ],
      };

      const entityInstanceDef = {
        instanceId: 'test:eventTest_instance',
        definitionId: 'test:eventTest',
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(
        entityInstanceDef
      );

      const mockInstance1 = createMockEntityInstance(
        'test:eventTest_instance',
        'test:eventTest'
      );
      mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

      await worldInitializer.initializeWorldEntities('test:world');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed dispatching 'worldinit:entity_instantiated' event for entity test:eventTest_instance"
        ),
        expect.any(Error)
      );
    });
  });

  describe('initializeScopeRegistry', () => {
    it('should call scopeRegistry.initialize with scopes from repository', async () => {
      const mockScopes = { 'core:testScope': 'actor' };
      mockGameDataRepository.get = jest.fn().mockReturnValue(mockScopes);
      worldInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: mockWorldContext,
        gameDataRepository: mockGameDataRepository,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        logger: mockLogger,
        scopeRegistry: mockScopeRegistry,
      });

      await worldInitializer.initializeScopeRegistry();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'WorldInitializer: Initializing ScopeRegistry with loaded scopes...'
      );
      expect(mockGameDataRepository.get).toHaveBeenCalledWith('scopes');
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(mockScopes);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldInitializer: ScopeRegistry initialized with 1 scopes.'
      );
    });

    it('should log an error and not throw if scopeRegistry.initialize fails', async () => {
      const initError = new Error('Initialization failed');
      mockGameDataRepository.get = jest
        .fn()
        .mockReturnValue({ 'core:testScope': 'actor' });
      mockScopeRegistry.initialize.mockImplementationOnce(() => {
        throw initError;
      });
      worldInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: mockWorldContext,
        gameDataRepository: mockGameDataRepository,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        logger: mockLogger,
        scopeRegistry: mockScopeRegistry,
      });

      await worldInitializer.initializeScopeRegistry();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WorldInitializer: Failed to initialize ScopeRegistry:',
        initError
      );
    });

    it('should handle case where no scopes are returned from repository', async () => {
      mockGameDataRepository.get = jest.fn().mockReturnValue(null); // or undefined
      worldInitializer = new WorldInitializer({
        entityManager: mockEntityManager,
        worldContext: mockWorldContext,
        gameDataRepository: mockGameDataRepository,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        logger: mockLogger,
        scopeRegistry: mockScopeRegistry,
      });
      await worldInitializer.initializeScopeRegistry();

      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorldInitializer: ScopeRegistry initialized with 0 scopes.'
      );
    });
  });
});
// --- FILE END ---
