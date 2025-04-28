// src/tests/entities/entityManager.auxiliary.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../entities/entityManager.js'; // Adjust path if necessary
import Entity from '../../entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../types/components.js"; // Adjust path if necessary

// --- Mock Implementations ---
// Helper functions to create fresh mocks for each test context
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  // Add other methods if EntityManager constructor requires them, even if unused in these tests
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  getManifest: jest.fn(),
  setManifest: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(),
  // Add other methods if EntityManager constructor requires them
  addSchema: jest.fn(),
  getValidator: jest.fn(),
  isSchemaLoaded: jest.fn(),
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

// --- Constants ---
const TEST_ENTITY_ID_1 = 'aux-entity-01';
const TEST_ENTITY_ID_2 = 'aux-entity-02-pos'; // Entity with position
const NON_EXISTENT_ENTITY_ID = 'ghost-entity-404';
const TEST_LOCATION_ID = 'zone:test-aux';
const POSITION_DATA = {x: 10, y: 20, locationId: TEST_LOCATION_ID};
const OTHER_COMPONENT_ID = 'core:tag';
const OTHER_COMPONENT_DATA = {tag: 'test'};

// --- Test Suite ---
describe('EntityManager - Auxiliary Methods (Lifecycle & Spatial Index)', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let entity1; // Entity without position
  let entity2; // Entity with position

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();

    // Instantiate EntityManager with mocks
    entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);

    // Clear mocks (especially call counts) before each test
    jest.clearAllMocks();

    // Setup common entities for tests needing existing entities
    entity1 = new Entity(TEST_ENTITY_ID_1);
    entity1.addComponent(OTHER_COMPONENT_ID, {...OTHER_COMPONENT_DATA});

    entity2 = new Entity(TEST_ENTITY_ID_2);
    entity2.addComponent(OTHER_COMPONENT_ID, {...OTHER_COMPONENT_DATA});
    entity2.addComponent(POSITION_COMPONENT_ID, {...POSITION_DATA}); // Add position component

    // Note: Entities are NOT added to entityManager.activeEntities here by default.
    // Individual tests or describe blocks will add them as needed for setup.
  });

  afterEach(() => {
    // Clean up active entities and spatial index mock calls if needed
    if (entityManager) {
      entityManager.activeEntities.clear(); // Ensure map is empty
    }
    mockSpatialIndex.clearIndex.mockClear(); // Clear calls to clearIndex
    mockSpatialIndex.removeEntity.mockClear();
    // etc. for other mocks if needed, although jest.clearAllMocks() handles most cases
  });

  // --- getEntityInstance Tests ---
  describe('getEntityInstance', () => {
    beforeEach(() => {
      // Setup: Add entity1 to activeEntities for these tests
      entityManager.activeEntities.set(entity1.id, entity1);
    });

    it('should return the correct entity instance when retrieving an existing entity', () => {
      const retrievedEntity = entityManager.getEntityInstance(TEST_ENTITY_ID_1);
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity).toBe(entity1); // Should be the exact same instance
      expect(retrievedEntity.id).toBe(TEST_ENTITY_ID_1);
    });

    it('should return undefined when retrieving a non-existent entity', () => {
      const retrievedEntity = entityManager.getEntityInstance(NON_EXISTENT_ENTITY_ID);
      expect(retrievedEntity).toBeUndefined();
    });

    it('should return undefined if called with null or undefined id', () => {
      expect(entityManager.getEntityInstance(null)).toBeUndefined();
      expect(entityManager.getEntityInstance(undefined)).toBeUndefined();
    });
  });

  // --- removeEntityInstance Tests ---
  describe('removeEntityInstance', () => {
    // Test case 1: Removing an existing entity WITHOUT position
    describe('when removing an entity without position', () => {
      beforeEach(() => {
        // Setup: Add entity1 (no position) to activeEntities
        entityManager.activeEntities.set(entity1.id, entity1);
        expect(entityManager.activeEntities.has(TEST_ENTITY_ID_1)).toBe(true); // Verify setup
      });

      it('should return true', () => {
        const result = entityManager.removeEntityInstance(TEST_ENTITY_ID_1);
        expect(result).toBe(true);
      });

      it('should remove the entity from activeEntities', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_1);
        expect(entityManager.activeEntities.has(TEST_ENTITY_ID_1)).toBe(false);
        expect(entityManager.getEntityInstance(TEST_ENTITY_ID_1)).toBeUndefined();
      });

      it('should NOT call ISpatialIndexManager.removeEntity', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_1);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
      });

      it('should log an info message about removal', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_1);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Removed entity instance ${TEST_ENTITY_ID_1} from active map.`));
      });
    });

    // Test case 2: Removing an existing entity WITH position
    describe('when removing an entity with position', () => {
      beforeEach(() => {
        // Setup: Add entity2 (with position) to activeEntities
        entityManager.activeEntities.set(entity2.id, entity2);
        expect(entityManager.activeEntities.has(TEST_ENTITY_ID_2)).toBe(true); // Verify setup
        expect(entity2.hasComponent(POSITION_COMPONENT_ID)).toBe(true); // Verify setup
        expect(entity2.getComponentData(POSITION_COMPONENT_ID)?.locationId).toBe(TEST_LOCATION_ID); // Verify setup
      });

      it('should return true', () => {
        const result = entityManager.removeEntityInstance(TEST_ENTITY_ID_2);
        expect(result).toBe(true);
      });

      it('should remove the entity from activeEntities', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_2);
        expect(entityManager.activeEntities.has(TEST_ENTITY_ID_2)).toBe(false);
        expect(entityManager.getEntityInstance(TEST_ENTITY_ID_2)).toBeUndefined();
      });

      it('should call ISpatialIndexManager.removeEntity with the correct entity ID and location ID', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_2);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(TEST_ENTITY_ID_2, TEST_LOCATION_ID);
      });

      it('should log debug and info messages about removal', () => {
        entityManager.removeEntityInstance(TEST_ENTITY_ID_2);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removed entity ${TEST_ENTITY_ID_2} from spatial index (location: ${TEST_LOCATION_ID}).`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Removed entity instance ${TEST_ENTITY_ID_2} from active map.`));
      });
    });

    // Test case 3: Removing an existing entity WITH position but null/undefined locationId
    describe('when removing an entity with position but invalid locationId', () => {
      let entityWithInvalidPos;
      const entityIdInvalidPos = 'aux-entity-invalid-pos';

      beforeEach(() => {
        // Setup entity with position but no locationId
        entityWithInvalidPos = new Entity(entityIdInvalidPos);
        entityWithInvalidPos.addComponent(POSITION_COMPONENT_ID, {x: 0, y: 0}); // No locationId
        entityManager.activeEntities.set(entityIdInvalidPos, entityWithInvalidPos);
        expect(entityManager.activeEntities.has(entityIdInvalidPos)).toBe(true);
      });

      it('should return true and remove from activeEntities', () => {
        const result = entityManager.removeEntityInstance(entityIdInvalidPos);
        expect(result).toBe(true);
        expect(entityManager.activeEntities.has(entityIdInvalidPos)).toBe(false);
      });

      it('should NOT call ISpatialIndexManager.removeEntity', () => {
        // Because the locationId was never valid (null/undefined), removeEntity should not be called
        entityManager.removeEntityInstance(entityIdInvalidPos);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
      });
    });

    // Test case 4: Attempting to remove a non-existent entity
    describe('when attempting to remove a non-existent entity', () => {
      beforeEach(() => {
        // Ensure the entity is not in the map
        expect(entityManager.activeEntities.has(NON_EXISTENT_ENTITY_ID)).toBe(false); // Verify setup
      });

      it('should return false', () => {
        const result = entityManager.removeEntityInstance(NON_EXISTENT_ENTITY_ID);
        expect(result).toBe(false);
      });

      it('should log a warning message', () => {
        entityManager.removeEntityInstance(NON_EXISTENT_ENTITY_ID);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Attempted to remove non-existent entity instance ${NON_EXISTENT_ENTITY_ID}`));
      });

      it('should not change the activeEntities map', () => {
        const initialSize = entityManager.activeEntities.size;
        entityManager.removeEntityInstance(NON_EXISTENT_ENTITY_ID);
        expect(entityManager.activeEntities.size).toBe(initialSize); // Size remains the same
      });

      it('should NOT call ISpatialIndexManager.removeEntity', () => {
        entityManager.removeEntityInstance(NON_EXISTENT_ENTITY_ID);
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
      });
    });
  });

  // --- getEntitiesInLocation Tests ---
  describe('getEntitiesInLocation', () => {
    const queryLocationId = 'zone:query-location';
    const expectedEntityIds = new Set(['ent-a', 'ent-b', 'ent-c']);

    beforeEach(() => {
      // Configure the mock spatial index manager for this test
      mockSpatialIndex.getEntitiesInLocation.mockReturnValue(expectedEntityIds);
    });

    it('should call ISpatialIndexManager.getEntitiesInLocation with the correct locationId', () => {
      entityManager.getEntitiesInLocation(queryLocationId);
      expect(mockSpatialIndex.getEntitiesInLocation).toHaveBeenCalledTimes(1);
      expect(mockSpatialIndex.getEntitiesInLocation).toHaveBeenCalledWith(queryLocationId);
    });

    it('should return the Set of entity IDs provided by the spatial index manager', () => {
      const result = entityManager.getEntitiesInLocation(queryLocationId);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(expectedEntityIds); // Check if the contents are the same
      expect(result).toBe(expectedEntityIds); // Check if it's the exact same Set instance (as expected by direct delegation)
    });

    it('should return an empty Set if the spatial index manager returns one', () => {
      const emptySet = new Set();
      mockSpatialIndex.getEntitiesInLocation.mockReturnValue(emptySet);
      const result = entityManager.getEntitiesInLocation('zone:empty');
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(result).toBe(emptySet);
    });
  });

  // --- buildInitialSpatialIndex Tests ---
  describe('buildInitialSpatialIndex', () => {
    it('should call ISpatialIndexManager.buildIndex, passing the EntityManager instance itself', () => {
      entityManager.buildInitialSpatialIndex();
      expect(mockSpatialIndex.buildIndex).toHaveBeenCalledTimes(1);
      // Verify that the argument passed to buildIndex is the entityManager instance
      expect(mockSpatialIndex.buildIndex).toHaveBeenCalledWith(entityManager);
    });

    it('should log an info message indicating delegation', () => {
      entityManager.buildInitialSpatialIndex();
      expect(mockLogger.info).toHaveBeenCalledWith('EntityManager: Delegating initial spatial index build...');
    });
  });

  // --- clearAll Tests ---
  describe('clearAll', () => {
    beforeEach(() => {
      // Pre-populate activeEntities
      entityManager.activeEntities.set(entity1.id, entity1);
      entityManager.activeEntities.set(entity2.id, entity2);
      expect(entityManager.activeEntities.size).toBeGreaterThan(0); // Verify setup
    });

    it('should clear the entityManager.activeEntities map', () => {
      entityManager.clearAll();
      expect(entityManager.activeEntities.size).toBe(0);
      expect(entityManager.activeEntities.has(entity1.id)).toBe(false);
      expect(entityManager.activeEntities.has(entity2.id)).toBe(false);
    });

    it('should call ISpatialIndexManager.clearIndex', () => {
      entityManager.clearAll();
      expect(mockSpatialIndex.clearIndex).toHaveBeenCalledTimes(1);
    });

    it('should log an info message about clearing', () => {
      entityManager.clearAll();
      expect(mockLogger.info).toHaveBeenCalledWith('EntityManager: Cleared all active entities and delegated spatial index clearing.');
    });
  });

}); // End describe('EntityManager - Auxiliary Methods')