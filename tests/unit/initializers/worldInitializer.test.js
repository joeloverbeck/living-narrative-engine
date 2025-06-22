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

    worldInitializer = new WorldInitializer({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
      spatialIndexManager: mockSpatialIndexManager,
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
        'WorldInitializer: Instance created. Reference resolution step has been removed.'
      );
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
        'ISpatialIndexManager',
        'spatialIndexManager',
        'WorldInitializer requires an ISpatialIndexManager.',
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
          spatialIndexManager: mockSpatialIndexManager,
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
            definitionId: 'test:hero'
          }
        ]
      };
      
      const entityInstanceDef = {
        instanceId: 'test:hero_instance',
        definitionId: 'test:hero'
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
      
      const mockInstance1 = createMockEntityInstance(
        'test:hero_instance',
        'test:hero',
        {}
      );
      mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

      await worldInitializer.initializeWorldEntities('test:world');

      expect(mockGameDataRepository.getWorld).toHaveBeenCalledWith('test:world');
      expect(mockGameDataRepository.getEntityInstanceDefinition).toHaveBeenCalledWith('test:hero_instance');
      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'test:hero',
        {
          instanceId: 'test:hero_instance',
          componentOverrides: undefined
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'WorldInitializer (Pass 1): Instantiated entity test:hero_instance (from definition: test:hero)'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Processing entity test:hero_instance. This step is mostly a no-op as 'resolveFields' is deprecated."
        )
      );
    });

    it('should handle failed entity instantiation in Pass 1', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:broken_instance',
            definitionId: 'test:broken'
          }
        ]
      };
      
      const entityInstanceDef = {
        instanceId: 'test:broken_instance',
        definitionId: 'test:broken'
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
      mockEntityManager.createEntityInstance.mockReturnValueOnce(null);

      await worldInitializer.initializeWorldEntities('test:world');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer (Pass 1): Failed to instantiate entity from definition: test:broken for instance: test:broken_instance.'
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'Processing entity test:broken. This step is mostly a no-op'
        )
      );
    });

    describe('Pass 2: Component Processing (No Reference Resolution)', () => {
      it('should log that component processing is happening but no resolution for entities with components', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:location_instance',
              definitionId: 'test:location'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:location_instance',
          definitionId: 'test:location'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
        const locationInstance = createMockEntityInstance(
          'test:location_instance',
          'test:location',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'another-place' },
          }
        );
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          locationInstance
        );

        mockGameDataRepository.getComponentDefinition.mockImplementation(
          (componentTypeId) => ({
            id: componentTypeId,
          })
        );

        await worldInitializer.initializeWorldEntities('test:world');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Processing entity test:location_instance. This step is mostly a no-op as 'resolveFields' is deprecated."
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity test:location_instance, component core:position has no 'resolveFields' to process, or it is empty. (Expected)"
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity test:location_instance has POSITION_COMPONENT_ID with locationId 'another-place'. Spatial index add/update is handled by EntityManager."
          )
        );
      });

      it('should log a warning if a component definition surprisingly still has resolveFields', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:problem_instance',
              definitionId: 'test:problem'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:problem_instance',
          definitionId: 'test:problem'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
        const problematicInstance = createMockEntityInstance(
          'test:problem_instance',
          'test:problem',
          {
            'custom:testcomponent': { someField: 'test:ref' },
          }
        );
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          problematicInstance
        );

        mockGameDataRepository.getComponentDefinition.mockImplementation(
          (componentTypeId) => {
            if (componentTypeId === 'custom:testcomponent') {
              return {
                id: componentTypeId,
                resolveFields: [
                  {
                    dataPath: 'someField',
                    resolutionStrategy: { type: 'direct' },
                  },
                ],
              };
            }
            return { id: componentTypeId };
          }
        );

        await worldInitializer.initializeWorldEntities('test:world');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity test:problem_instance, component custom:testcomponent still has 'resolveFields'. This is a DEPRECATED pattern."
          )
        );
      });

      it('should log if entity componentEntries is not iterable in Pass 2', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:baditerator_instance',
              definitionId: 'test:baditerator'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:baditerator_instance',
          definitionId: 'test:baditerator'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
        const mockInstance = createMockEntityInstance(
          'test:baditerator_instance',
          'test:baditerator'
        );

        Object.defineProperty(mockInstance, 'componentEntries', {
          get: jest.fn(() => ({
            [Symbol.iterator]: () => 'not an iterator',
          })),
          configurable: true,
        });

        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          mockInstance
        );

        await worldInitializer.initializeWorldEntities('test:world');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Entity test:baditerator_instance componentEntries[Symbol.iterator]() did not return a valid iterator.'
          )
        );
      });

      it('should log if entity componentEntries itself is not iterable in Pass 2', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:noniter_instance',
              definitionId: 'test:noniter'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:noniter_instance',
          definitionId: 'test:noniter'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
        const nonIterableEntity = createMockEntityInstance(
          'test:noniter_instance',
          'test:noniter'
        );
        // Make componentEntries return an object that is not null/undefined but lacks Symbol.iterator
        Object.defineProperty(nonIterableEntity, 'componentEntries', {
          get: () => ({
            description: 'I am an object, but not an iterator factory',
          }),
          configurable: true,
        });

        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          nonIterableEntity
        );

        await worldInitializer.initializeWorldEntities('test:world');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer (Pass 2 RefResolution): Entity test:noniter_instance componentEntries IS NOT ITERABLE or is problematic. Value: [object Object]. Skipping component processing for this entity.'
          )
        );
      });
    });

    describe('Pass 3: Build Spatial Index', () => {
      it('should log completion of entity processing and spatial index additions (formerly Pass 3)', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:spatialDummy_instance',
              definitionId: 'test:spatialDummy'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:spatialDummy_instance',
          definitionId: 'test:spatialDummy'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
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

        await worldInitializer.initializeWorldEntities('test:world');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer (Pass 2): Completed entity processing. Processed 1 entities. Added 1 entities to spatial index.'
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity test:spatialDummy_instance has POSITION_COMPONENT_ID with locationId 'some-other-place'. Spatial index add/update is handled by EntityManager."
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer: World entity initialization and spatial indexing complete for world: test:world.'
          )
        );
      });

      it('Pass 2 - Post-Processing: EntityManager handles adding entities with position to spatial index', async () => {
        const worldData = {
          id: 'test:world',
          name: 'Test World',
          instances: [
            {
              instanceId: 'test:roomPos1_instance',
              definitionId: 'test:roomPos1'
            }
          ]
        };
        
        const entityInstanceDef = {
          instanceId: 'test:roomPos1_instance',
          definitionId: 'test:roomPos1'
        };

        mockGameDataRepository.getWorld.mockReturnValue(worldData);
        mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
        
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

        // This mock is for getComponentDefinition in _resolveReferencesForEntityComponents
        mockGameDataRepository.getComponentDefinition.mockImplementation(
          (componentTypeId) => ({ id: componentTypeId })
        );

        await worldInitializer.initializeWorldEntities('test:world');

        // This log comes from _resolveReferencesForEntityComponents's post-processing part
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "WorldInitializer (Pass 2 Post-Processing): Entity test:roomPos1_instance has POSITION_COMPONENT_ID with locationId 'some-other-place'. Spatial index add/update is handled by EntityManager."
          )
        );
        // And check for the overall completion
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer: World entity initialization and spatial indexing complete for world: test:world.'
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
            definitionId: 'test:valid'
          },
          {
            // Invalid instance - missing instanceId
            definitionId: 'test:invalid'
          },
          {
            instanceId: 'test:another_valid_instance',
            definitionId: 'test:another_valid'
          }
        ]
      };
      
      const validInstanceDef1 = {
        instanceId: 'test:valid_instance',
        definitionId: 'test:valid'
      };
      
      const validInstanceDef2 = {
        instanceId: 'test:another_valid_instance',
        definitionId: 'test:another_valid'
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
          'WorldInitializer (Pass 1): Skipping invalid world instance (missing instanceId or definitionId):'
        ),
        expect.any(Object)
      );
    });

    it('should throw an error when world is not found', async () => {
      mockGameDataRepository.getWorld.mockReturnValue(null);

      await expect(worldInitializer.initializeWorldEntities('nonexistent:world')).rejects.toThrow(
        'Game cannot start: World \'nonexistent:world\' not found in the world data. Please ensure the world is properly defined.'
      );

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockValidatedEventDispatcher,
        `World 'nonexistent:world' not found. The game cannot start without a valid world.`,
        expect.objectContaining({
          statusCode: 500,
          raw: expect.stringContaining("World 'nonexistent:world' not available in game data repository"),
        })
      );
    });

    it('should throw an error when world has no instances defined', async () => {
      const worldData = {
        id: 'test:world',
        name: 'Test World',
        instances: []
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);

      await expect(worldInitializer.initializeWorldEntities('test:world')).rejects.toThrow(
        'Game cannot start: World \'test:world\' has no entities defined. Please ensure at least one entity is defined in the world.'
      );

      expect(safeDispatchError).toHaveBeenCalledWith(
        mockValidatedEventDispatcher,
        `World 'test:world' has no entities defined. The game cannot start without any entities in the world.`,
        expect.objectContaining({
          statusCode: 500,
          raw: expect.stringContaining("World 'test:world' has no instances defined"),
        })
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
            definitionId: 'test:eventTest'
          }
        ]
      };
      
      const entityInstanceDef = {
        instanceId: 'test:eventTest_instance',
        definitionId: 'test:eventTest'
      };

      mockGameDataRepository.getWorld.mockReturnValue(worldData);
      mockGameDataRepository.getEntityInstanceDefinition.mockReturnValue(entityInstanceDef);
      
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
});
// --- FILE END ---
