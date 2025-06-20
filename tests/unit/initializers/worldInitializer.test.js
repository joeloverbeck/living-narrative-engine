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
    it('should complete successfully with no entity definitions', async () => {
      mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([]);
      const result = await worldInitializer.initializeWorldEntities();
      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer (Pass 1): No entity definitions found. World may be empty of defined entities.'
      );
      expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
    });

    it('should instantiate entities in Pass 1', async () => {
      const entityDef1 = { id: 'def:room1', components: {} };
      mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
        entityDef1,
      ]);
      const mockInstance1 = createMockEntityInstance(
        'uuid-room1',
        'def:room1',
        {}
      );
      mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

      await worldInitializer.initializeWorldEntities();

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'def:room1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'WorldInitializer (Pass 1): Instantiated entity uuid-room1 (from definition: def:room1)'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Processing entity uuid-room1. This step is mostly a no-op as 'resolveFields' is deprecated."
        )
      );
    });

    it('should handle failed entity instantiation in Pass 1', async () => {
      const entityDef1 = { id: 'def:broken', components: {} };
      mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
        entityDef1,
      ]);
      mockEntityManager.createEntityInstance.mockReturnValueOnce(null);

      await worldInitializer.initializeWorldEntities();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WorldInitializer (Pass 1): Failed to instantiate entity from definition: def:broken.'
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'Processing entity def:broken. This step is mostly a no-op'
        )
      );
    });

    describe('Pass 2: Component Processing (No Reference Resolution)', () => {
      it('should log that component processing is happening but no resolution for entities with components', async () => {
        const locationDef = { id: 'def:location1' };
        const locationInstance = createMockEntityInstance(
          'uuid-loc1',
          'def:location1',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'another-place' },
          }
        );
        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          locationDef,
        ]);
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          locationInstance
        );

        mockGameDataRepository.getComponentDefinition.mockImplementation(
          (componentTypeId) => ({
            id: componentTypeId,
          })
        );

        await worldInitializer.initializeWorldEntities();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Processing entity uuid-loc1. This step is mostly a no-op as 'resolveFields' is deprecated."
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity uuid-loc1, component core:position has no 'resolveFields' to process, or it is empty. (Expected)"
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity uuid-loc1 has POSITION_COMPONENT_ID with locationId 'another-place'. Spatial index add/update is handled by EntityManager."
          )
        );
      });

      it('should log a warning if a component definition surprisingly still has resolveFields', async () => {
        const problematicDef = { id: 'def:problem' };
        const problematicInstance = createMockEntityInstance(
          'uuid-problem1',
          'def:problem',
          {
            'custom:testcomponent': { someField: 'test:ref' },
          }
        );
        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          problematicDef,
        ]);
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

        await worldInitializer.initializeWorldEntities();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Entity uuid-problem1, component custom:testcomponent still has 'resolveFields'. This is a DEPRECATED pattern."
          )
        );
      });

      it('should log if entity componentEntries is not iterable in Pass 2', async () => {
        const entityDef = { id: 'def:baditerator' };
        const mockInstance = createMockEntityInstance(
          'uuid-baditer',
          'def:baditerator'
        );

        Object.defineProperty(mockInstance, 'componentEntries', {
          get: jest.fn(() => ({
            [Symbol.iterator]: () => 'not an iterator',
          })),
          configurable: true,
        });

        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          entityDef,
        ]);
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          mockInstance
        );

        await worldInitializer.initializeWorldEntities();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Entity uuid-baditer componentEntries[Symbol.iterator]() did not return a valid iterator.'
          )
        );
      });

      it('should log if entity componentEntries itself is not iterable in Pass 2', async () => {
        const nonIterableEntity = createMockEntityInstance(
          'uuid-noniter',
          'def:noniter'
        );
        // Make componentEntries return an object that is not null/undefined but lacks Symbol.iterator
        Object.defineProperty(nonIterableEntity, 'componentEntries', {
          get: () => ({
            description: 'I am an object, but not an iterator factory',
          }),
          configurable: true,
        });

        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          { id: 'def:noniter' },
        ]);
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          nonIterableEntity
        );

        await worldInitializer.initializeWorldEntities();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer (Pass 2 RefResolution): Entity uuid-noniter componentEntries IS NOT ITERABLE or is problematic. Value: [object Object]. Skipping component processing for this entity.'
          )
        );
      });
    });

    describe('Pass 3: Build Spatial Index', () => {
      it('should log completion of entity processing and spatial index additions (formerly Pass 3)', async () => {
        // Setup a basic entity definition
        const entityDef = { id: 'def:spatialDummy' };
        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          entityDef,
        ]);
        // Mock entity instance creation
        const mockInstance = createMockEntityInstance(
          'uuid-spatialDummy',
          'def:spatialDummy',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'some-place' }, // Ensure it could be added to spatial index
          }
        );
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          mockInstance
        );

        await worldInitializer.initializeWorldEntities();

        // Check for the Pass 2 completion log which includes spatial index summary
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer (Pass 2): Completed entity processing. Processed 1 entities. Added 1 entities to spatial index.'
          ) // Adjusted for one entity
        );
      });

      it('Pass 2 - Post-Processing: EntityManager handles adding entities with position to spatial index', async () => {
        const roomDefPos1 = { id: 'def:roomPos1' };
        const roomInstancePos1 = createMockEntityInstance(
          'uuid-roomPos1',
          'def:roomPos1',
          {
            [POSITION_COMPONENT_ID]: { locationId: 'some-other-place' },
          }
        );
        mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
          roomDefPos1,
        ]);
        mockEntityManager.createEntityInstance.mockReturnValueOnce(
          roomInstancePos1
        );

        // This mock is for getComponentDefinition in _resolveReferencesForEntityComponents
        mockGameDataRepository.getComponentDefinition.mockImplementation(
          (componentTypeId) => ({ id: componentTypeId })
        );

        await worldInitializer.initializeWorldEntities();

        // This log comes from _resolveReferencesForEntityComponents's post-processing part
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "WorldInitializer (Pass 2 Post-Processing): Entity uuid-roomPos1 has POSITION_COMPONENT_ID with locationId 'some-other-place'. Spatial index add/update is handled by EntityManager."
          )
        );
        // And check for the overall completion
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'WorldInitializer: World entity initialization and spatial indexing complete.'
          )
        );
      });
    });

    it('should complete and log final success message', async () => {
      mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([]);
      await worldInitializer.initializeWorldEntities();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'WorldInitializer: World entity initialization and spatial indexing complete.'
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
      const entityDef1 = { id: 'def:eventTest' };
      const mockInstance1 = createMockEntityInstance(
        'uuid-eventTest1',
        'def:eventTest'
      );
      mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([
        entityDef1,
      ]);
      mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

      await worldInitializer.initializeWorldEntities();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed dispatching 'worldinit:entity_instantiated' event for entity uuid-eventTest1"
        ),
        expect.any(Error)
      );
    });
  });
});
// --- FILE END ---
