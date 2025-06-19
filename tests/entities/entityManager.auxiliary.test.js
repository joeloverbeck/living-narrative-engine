// tests/entities/entityManager.auxiliary.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../src/entities/entityInstanceData.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { EntityNotFoundError } from '../../src/errors/entityNotFoundError';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })), // Default to valid
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockSpatialIndexManager = () => ({
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  updateEntityLocation: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  buildIndex: jest.fn(),
  clearIndex: jest.fn(),
});

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

// --- Constants ---
const INSTANCE_ID_1 = 'aux-instance-01'; // Was TEST_ENTITY_ID_1
const INSTANCE_ID_2_POS = 'aux-instance-02-pos'; // Was TEST_ENTITY_ID_2
const DEFINITION_ID_DUMMY = 'def:dummy-aux'; // Common definition ID for these test entities

const NON_EXISTENT_INSTANCE_ID = 'ghost-instance-404'; // Was NON_EXISTENT_ENTITY_ID
const TEST_LOCATION_ID = 'zone:test-aux';
const POSITION_DATA = { x: 10, y: 20, locationId: TEST_LOCATION_ID };
const OTHER_COMPONENT_ID = 'core:tag';
const OTHER_COMPONENT_DATA = { tag: 'test' };

// Helper function to create entity instances for testing
const createTestEntity = (
  instanceId,
  definitionId,
  defComponents = {},
  instanceOverrides = {}
) => {
  const definition = new EntityDefinition(definitionId, {
    description: `Test Definition ${definitionId}`,
    components: defComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    instanceOverrides
  );
  return new Entity(instanceData);
};

// --- Test Suite ---
describe('EntityManager - Auxiliary Methods (Lifecycle & Spatial Index)', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let entity1; // Entity without position
  let entity2_pos; // Entity with position, renamed for clarity
  let mockEventDispatcher;

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();
    mockEventDispatcher = createMockSafeEventDispatcher();

    entityManager = new EntityManager(
      mockRegistry,
      mockValidator,
      mockLogger,
      mockSpatialIndex,
      mockEventDispatcher
    );
    jest.clearAllMocks();

    // Setup common entities
    // entity1 (no position) is created with just its definition.
    // Components (OTHER_COMPONENT_ID) are added as instance overrides.
    entity1 = createTestEntity(
      INSTANCE_ID_1,
      DEFINITION_ID_DUMMY,
      {}, // No components on definition
      { [OTHER_COMPONENT_ID]: { ...OTHER_COMPONENT_DATA } }
    );

    // entity2_pos (with position) is also created from a base definition.
    // Both OTHER_COMPONENT_ID and POSITION_COMPONENT_ID are added as instance overrides.
    entity2_pos = createTestEntity(
      INSTANCE_ID_2_POS,
      DEFINITION_ID_DUMMY,
      {}, // No components on definition
      {
        [OTHER_COMPONENT_ID]: { ...OTHER_COMPONENT_DATA },
        [POSITION_COMPONENT_ID]: { ...POSITION_DATA },
      }
    );
  });

  afterEach(() => {
    if (entityManager) {
      entityManager.activeEntities.clear();
    }
  });

  // --- getEntityInstance Tests ---
  describe('getEntityInstance', () => {
    beforeEach(() => {
      entityManager.activeEntities.set(entity1.id, entity1); // entity1.id is INSTANCE_ID_1
    });

    it('should return the correct entity instance when retrieving an existing entity', () => {
      const retrievedEntity = entityManager.getEntityInstance(INSTANCE_ID_1);
      expect(retrievedEntity).toBe(entity1);
      expect(retrievedEntity.id).toBe(INSTANCE_ID_1);
    });

    it('should return undefined when retrieving a non-existent entity', () => {
      const retrievedEntity = entityManager.getEntityInstance(
        NON_EXISTENT_INSTANCE_ID
      );
      expect(retrievedEntity).toBeUndefined();
    });

    it('should return undefined if called with null or undefined id', () => {
      expect(entityManager.getEntityInstance(null)).toBeUndefined();
      expect(entityManager.getEntityInstance(undefined)).toBeUndefined();
    });
  });

  // --- removeEntityInstance Tests ---
  describe('removeEntityInstance', () => {
    describe('when removing an entity without position', () => {
      beforeEach(() => {
        // Use a mock entity that can be added to the real map instance
        const mockEntity = {
          id: INSTANCE_ID_1,
          hasComponent: jest.fn().mockReturnValue(false),
        };
        entityManager.activeEntities.set(INSTANCE_ID_1, mockEntity);
        expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(true);
      });

      it('should return true', () => {
        expect(entityManager.removeEntityInstance(INSTANCE_ID_1)).toBe(true);
      });

      it('should remove the entity from activeEntities', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_1);
        expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(false);
      });

      it('should NOT call ISpatialIndexManager.removeEntity', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_1);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
      });
    });

    describe('when removing an entity with position', () => {
      beforeEach(() => {
        const mockEntityWithPos = {
          id: INSTANCE_ID_2_POS,
          hasComponent: jest.fn((id) => id === POSITION_COMPONENT_ID),
          getComponentData: jest
            .fn()
            .mockReturnValue({ locationId: TEST_LOCATION_ID }),
        };
        entityManager.activeEntities.set(INSTANCE_ID_2_POS, mockEntityWithPos);
        expect(entityManager.activeEntities.has(INSTANCE_ID_2_POS)).toBe(true);
      });

      it('should return true', () => {
        expect(entityManager.removeEntityInstance(INSTANCE_ID_2_POS)).toBe(
          true
        );
      });

      it('should remove the entity from activeEntities', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
        expect(entityManager.activeEntities.has(INSTANCE_ID_2_POS)).toBe(false);
      });

      it('should call ISpatialIndexManager.removeEntity with the correct entity ID and location ID', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
          INSTANCE_ID_2_POS,
          TEST_LOCATION_ID
        );
      });

      it('should log debug and info messages about removal', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Removed entity ${INSTANCE_ID_2_POS} from spatial index (old location was ${TEST_LOCATION_ID}) during entity removal.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Entity instance ${INSTANCE_ID_2_POS} removed from EntityManager.`
        );
      });
    });

    describe('when removing an entity with position but invalid locationId', () => {
      const instanceIdInvalidPos = 'aux-instance-invalid-pos';
      let entityWithInvalidPos;

      beforeEach(() => {
        // Entity with position component but no locationId in it (invalid for spatial index)
        const mockEntityInvalidPos = {
          id: instanceIdInvalidPos,
          hasComponent: jest.fn((id) => id === POSITION_COMPONENT_ID),
          getComponentData: jest.fn().mockReturnValue({ x: 0, y: 0 }),
        };
        entityManager.activeEntities.set(
          instanceIdInvalidPos,
          mockEntityInvalidPos
        );
      });

      it('should return true and remove from activeEntities', () => {
        expect(entityManager.removeEntityInstance(instanceIdInvalidPos)).toBe(
          true
        );
        expect(entityManager.activeEntities.has(instanceIdInvalidPos)).toBe(
          false
        );
      });

      it('should NOT call ISpatialIndexManager.removeEntity', () => {
        entityManager.removeEntityInstance(instanceIdInvalidPos);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
      });
    });

    // --- FIXED TEST BLOCK ---
    describe('when attempting to remove a non-existent entity', () => {
      it('should throw EntityNotFoundError and not have side effects', () => {
        const initialSize = entityManager.activeEntities.size;

        // Assert that the error is thrown
        expect(() =>
          entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID)
        ).toThrow(EntityNotFoundError);
        expect(() =>
          entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID)
        ).toThrow(`Entity instance not found: '${NON_EXISTENT_INSTANCE_ID}'`);

        // Assert side-effects (or lack thereof) after catching the error
        expect(mockLogger.error).toHaveBeenCalledWith(
          `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance '${NON_EXISTENT_INSTANCE_ID}'.`
        );
        expect(entityManager.activeEntities.size).toBe(initialSize); // No change in map size
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // No spatial index call
      });
    });
  });

  describe('getEntitiesInLocation', () => {
    const queryLocationId = 'zone:query-location';
    const expectedEntityIds = new Set(['inst-a', 'inst-b']);

    beforeEach(() => {
      mockSpatialIndex.getEntitiesInLocation.mockReturnValue(expectedEntityIds);
    });

    it('should call ISpatialIndexManager.getEntitiesInLocation with the correct locationId', () => {
      entityManager.getEntitiesInLocation(queryLocationId);
      expect(mockSpatialIndex.getEntitiesInLocation).toHaveBeenCalledWith(
        queryLocationId
      );
    });

    it('should return the Set of entity IDs provided by the spatial index manager', () => {
      const result = entityManager.getEntitiesInLocation(queryLocationId);
      expect(result).toBe(expectedEntityIds); // It returns the set directly
    });

    it('should return an empty Set if the spatial index manager returns one', () => {
      const emptySet = new Set();
      mockSpatialIndex.getEntitiesInLocation.mockReturnValue(emptySet);
      const result = entityManager.getEntitiesInLocation('zone:empty');
      expect(result.size).toBe(0);
      expect(result).toBe(emptySet);
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      entityManager.activeEntities.set(entity1.id, entity1);
      entityManager.activeEntities.set(entity2_pos.id, entity2_pos);
      expect(entityManager.activeEntities.size).toBeGreaterThan(0);
    });

    it('should clear the entityManager.activeEntities map', () => {
      entityManager.clearAll();
      expect(entityManager.activeEntities.size).toBe(0);
    });

    it('should call ISpatialIndexManager.clearIndex', () => {
      entityManager.clearAll();
      expect(mockSpatialIndex.clearIndex).toHaveBeenCalledTimes(1);
    });
  });
});