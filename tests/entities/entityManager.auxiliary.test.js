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
import { ENTITY_REMOVED_ID } from '../../src/constants/eventIds.js';
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
      let mockEntityWithoutPos;
      beforeEach(() => {
        // Use a mock entity that can be added to the real map instance
        mockEntityWithoutPos = { // Renamed for clarity
          id: INSTANCE_ID_1,
          hasComponent: jest.fn().mockReturnValue(false),
        };
        entityManager.activeEntities.set(INSTANCE_ID_1, mockEntityWithoutPos);
        expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(true);
        mockEventDispatcher.dispatch.mockClear(); // Clear before action
      });

      it('should return true', () => {
        expect(entityManager.removeEntityInstance(INSTANCE_ID_1)).toBe(true);
      });

      it('should remove the entity from activeEntities', () => {
        entityManager.removeEntityInstance(INSTANCE_ID_1);
        expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(false);
      });

      it('should dispatch ENTITY_REMOVED_ID event and NOT call ISpatialIndexManager.removeEntity', () => { // Updated description
        expect(ENTITY_REMOVED_ID).toBe('core:entity_removed'); // Added check
        entityManager.removeEntityInstance(INSTANCE_ID_1);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(ENTITY_REMOVED_ID, { entity: mockEntityWithoutPos }); // Added event check
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      });
      it('should log info message about removal', () => { // Added test for generic log
        entityManager.removeEntityInstance(INSTANCE_ID_1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Entity instance ${INSTANCE_ID_1} removed from EntityManager.`
        );
      });
    });

    describe('when removing an entity with position', () => {
      let mockEntityWithPos; // Renamed for clarity
      beforeEach(() => {
        mockEntityWithPos = {
          id: INSTANCE_ID_2_POS,
          hasComponent: jest.fn((id) => id === POSITION_COMPONENT_ID),
          getComponentData: jest
            .fn()
            .mockReturnValue({ locationId: TEST_LOCATION_ID }),
        };
        entityManager.activeEntities.set(INSTANCE_ID_2_POS, mockEntityWithPos);
        expect(entityManager.activeEntities.has(INSTANCE_ID_2_POS)).toBe(true);
        mockEventDispatcher.dispatch.mockClear(); // Clear before action
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

      it('should dispatch ENTITY_REMOVED_ID event and NOT call ISpatialIndexManager.removeEntity', () => { // Updated description and assertion
        expect(ENTITY_REMOVED_ID).toBe('core:entity_removed'); // Added check
        entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // No direct call
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(ENTITY_REMOVED_ID, { entity: mockEntityWithPos }); // Added event check
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      });

      it('should log info message about removal and NOT log spatial index specific debug message', () => { // Updated description
        entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
        expect(mockLogger.debug).not.toHaveBeenCalledWith( // Ensure old debug log is gone
          expect.stringContaining('from spatial index')
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Entity instance ${INSTANCE_ID_2_POS} removed from EntityManager.`
        );
      });
    });

    describe('when removing an entity with position but invalid locationId', () => {
      const instanceIdInvalidPos = 'aux-instance-invalid-pos';
      let mockEntityInvalidPos;

      beforeEach(() => {
        // Entity with position component but no locationId in it (invalid for spatial index)
        mockEntityInvalidPos = { // Renamed for clarity
          id: instanceIdInvalidPos,
          hasComponent: jest.fn((id) => id === POSITION_COMPONENT_ID),
          getComponentData: jest.fn().mockReturnValue({ x: 0, y: 0 }),
        };
        entityManager.activeEntities.set(
          instanceIdInvalidPos,
          mockEntityInvalidPos
        );
        mockEventDispatcher.dispatch.mockClear(); // Clear before action
      });

      it('should return true and remove from activeEntities', () => {
        expect(entityManager.removeEntityInstance(instanceIdInvalidPos)).toBe(
          true
        );
        expect(entityManager.activeEntities.has(instanceIdInvalidPos)).toBe(
          false
        );
      });

      it('should dispatch ENTITY_REMOVED_ID event and NOT call ISpatialIndexManager.removeEntity', () => { // Updated description and assertion
        expect(ENTITY_REMOVED_ID).toBe('core:entity_removed'); // Added check
        entityManager.removeEntityInstance(instanceIdInvalidPos);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // No direct call
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(ENTITY_REMOVED_ID, { entity: mockEntityInvalidPos }); // Added event check
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      });

      it('should log info about removal and NOT specific spatial debug messages', () => { // Updated description
        entityManager.removeEntityInstance(instanceIdInvalidPos);
        expect(mockLogger.debug).not.toHaveBeenCalledWith( // Ensure old debug log is gone
           expect.stringContaining('from spatial index')
        );
         expect(mockLogger.info).toHaveBeenCalledWith(
          `Entity instance ${instanceIdInvalidPos} removed from EntityManager.`
        );
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
    const emptySet = new Set();

    beforeEach(() => {
      mockLogger.warn.mockClear(); // Clear before test
    });

    it('should log a deprecation warning', () => { // New test for warning
      entityManager.getEntitiesInLocation(queryLocationId);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'EntityManager.getEntitiesInLocation: This method is deprecated as EntityManager is decoupled from SpatialIndexManager. Returning an empty set. Consumers should rely on events to maintain their own spatial data.'
      );
    });
    
    it('should NOT call ISpatialIndexManager.getEntitiesInLocation', () => { // Updated
      entityManager.getEntitiesInLocation(queryLocationId);
      expect(mockSpatialIndex.getEntitiesInLocation).not.toHaveBeenCalled();
    });

    it('should return an empty Set', () => { // Updated
      const result = entityManager.getEntitiesInLocation(queryLocationId);
      expect(result).toEqual(new Set()); // Check for empty set
      expect(result.size).toBe(0);
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      entityManager.activeEntities.set(entity1.id, entity1);
      entityManager.activeEntities.set(entity2_pos.id, entity2_pos);
      expect(entityManager.activeEntities.size).toBeGreaterThan(0);

      // Clear mocks that might have been called during setup
      mockLogger.info.mockClear();
      mockLogger.debug.mockClear();
      mockSpatialIndex.clearIndex.mockClear();
    });

    it('should clear the entityManager.activeEntities map', () => {
      entityManager.clearAll();
      expect(entityManager.activeEntities.size).toBe(0);
    });

    it('should log info messages about clearing entities and definition cache', () => { // Updated
      entityManager.clearAll();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All entity instances removed from EntityManager.'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Entity definition cache cleared.'
      );
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Ensure only these two info logs
    });

    it('should NOT call ISpatialIndexManager.clearIndex and NOT log about spatial index', () => { // Updated
      entityManager.clearAll();
      expect(mockSpatialIndex.clearIndex).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith('Spatial index cleared.');
    });
  });
});