// src/tests/entities/entityManager.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals'; // Added afterEach
import EntityManager from '../../src/entities/entityManager.js'; // Adjust path if necessary
import Entity from '../../src/entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js"; // Adjust path if necessary

// --- Mock Implementations ---
// (Keep the mock creation functions as they are)
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  getManifest: jest.fn(),
  setManifest: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(),
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
const TEST_ENTITY_ID = 'test-entity-01'; // For creation tests
const ACCESS_TEST_ENTITY_ID = 'access-entity-99'; // For access tests (get/has)
const EXISTING_COMPONENT_ID = 'core:stats';
const EXISTING_COMPONENT_DATA = {hp: 10, mp: 5};
const NON_EXISTENT_COMPONENT_ID = 'core:inventory';
const NON_EXISTENT_ENTITY_ID = 'ghost-entity-404';


// --- Test Suite ---

describe('EntityManager', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  // Variable to hold the entity created specifically for access tests
  let accessTestEntity;

  beforeEach(() => {
    // AC: Setup mocks for IDataRegistry, ISchemaValidator, ILogger, and ISpatialIndexManager before each test.
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();

    // Instantiate EntityManager for general use
    entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);

    // Clear mocks before each test to ensure isolation
    jest.clearAllMocks();

    // Specific setup for tests needing an existing entity (getComponentData, hasComponent)
    // is handled in their respective describe blocks or a shared helper if preferred.
    accessTestEntity = null; // Reset before each test
  });

  // Added afterEach to ensure cleanup between test files if run together
  afterEach(() => {
    if (entityManager) {
      entityManager.clearAll(); // Ensure active entities are cleared
    }
    accessTestEntity = null;
  });

  // --- 1. Constructor Tests ---
  describe('constructor', () => {
    // (Constructor tests remain unchanged - keeping them for context)
    // AC: Verify it creates an instance successfully when all valid dependencies are provided.
    it('should create an instance successfully with valid dependencies', () => {
      expect(() => {
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);
      }).not.toThrow();
      expect(entityManager).toBeInstanceOf(EntityManager);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('EntityManager initialized'));
    });

    // AC: Verify it throws an Error if any dependency is missing or invalid (lacks required methods).
    const invalidRegistryMissingMethod = {...createMockDataRegistry()};
    delete invalidRegistryMissingMethod.getEntityDefinition;

    const invalidValidatorMissingMethod = {...createMockSchemaValidator()};
    delete invalidValidatorMissingMethod.validate;

    const invalidLoggerMissingMethod = {...createMockLogger()};
    delete invalidLoggerMissingMethod.error;

    const invalidSpatialMissingMethod = {...createMockSpatialIndexManager()};
    delete invalidSpatialMissingMethod.addEntity;

    it.each([
      ['IDataRegistry', null, /IDataRegistry instance with getEntityDefinition/],
      ['ISchemaValidator', null, /ISchemaValidator instance with validate/],
      ['ILogger', null, /ILogger instance/],
      ['ISpatialIndexManager', null, /ISpatialIndexManager instance/],
      ['IDataRegistry (missing method)', invalidRegistryMissingMethod, /IDataRegistry instance with getEntityDefinition/],
      ['ISchemaValidator (missing method)', invalidValidatorMissingMethod, /ISchemaValidator instance with validate/],
      ['ILogger (missing method)', invalidLoggerMissingMethod, /ILogger instance/],
      ['ISpatialIndexManager (missing method)', invalidSpatialMissingMethod, /ISpatialIndexManager instance/],
    ])('should throw an Error if %s is missing or invalid (%s)', (depName, invalidDep, expectedError) => {
      const args = [
        depName.startsWith('IDataRegistry') ? invalidDep : mockRegistry,
        depName.startsWith('ISchemaValidator') ? invalidDep : mockValidator,
        depName.startsWith('ILogger') ? invalidDep : mockLogger,
        depName.startsWith('ISpatialIndexManager') ? invalidDep : mockSpatialIndex,
      ];
      expect(() => new EntityManager(...args)).toThrow(expectedError);
    });
  });

  // --- 2. createEntityInstance Tests ---
  describe('createEntityInstance', () => {
    // (createEntityInstance tests remain unchanged - keeping them for context)
    const testEntityId = TEST_ENTITY_ID; // Use the constant defined above
    const testLocationId = 'zone:test-area';
    const componentDataName = {name: 'Test Dummy'};
    const componentDataPosition = {x: 10, y: 20, locationId: testLocationId};
    const componentDataHealth = {current: 100, max: 100};

    const validDefinitionWithPosition = {
      id: testEntityId,
      name: 'Test Entity with Position',
      components: {
        'core:name': {...componentDataName},
        [POSITION_COMPONENT_ID]: {...componentDataPosition},
      },
    };
    // ... other definitions from original code ...
    const validDefinitionWithoutPosition = {
      id: testEntityId,
      name: 'Test Entity without Position',
      components: {
        'core:name': {...componentDataName},
        'core:health': {...componentDataHealth},
      },
    };

    const validDefinitionEmptyComponents = {
      id: testEntityId,
      name: 'Test Entity with Empty Components',
      components: {},
    };

    const validDefinitionNullComponents = {
      id: testEntityId,
      name: 'Test Entity with Null Components',
      components: null,
    };


    // No beforeEach needed here as it's covered by the outer one

    it('Success Case: should create entity, copy components, add to spatial index, and active map', () => {
      mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithPosition);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(testEntityId);
      expect(entity.hasComponent('core:name')).toBe(true);
      expect(entity.getComponentData('core:name')).toEqual(componentDataName);
      expect(entity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
      expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual(componentDataPosition);
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(testEntityId, testLocationId);
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
      expect(entityManager.activeEntities.get(testEntityId)).toBe(entity);
    });

    it('Success Case (No Position): should create entity, copy components, NOT add to spatial index', () => {
      mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithoutPosition);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(testEntityId);
      expect(entity.hasComponent('core:name')).toBe(true);
      expect(entity.hasComponent(POSITION_COMPONENT_ID)).toBe(false);
      expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
      expect(entityManager.activeEntities.get(testEntityId)).toBe(entity);
    });

    // ... other createEntityInstance tests from original code ...
    it('Success Case (Empty Components): should create entity with no components, NOT add to spatial index', () => {
      mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionEmptyComponents);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(Array.from(entity.componentTypeIds)).toHaveLength(0);
      expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
    });

    it('Success Case (Null Components): should treat null components as empty, create entity, NOT add to spatial index', () => {
      mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionNullComponents);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(Array.from(entity.componentTypeIds)).toHaveLength(0);
      expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Ensure no warning for null
    });

    it('Failure Case (Definition Not Found): should return null and log error if definition not found', () => {
      mockRegistry.getEntityDefinition.mockReturnValue(undefined);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Entity definition not found'));
      expect(entityManager.activeEntities.has(testEntityId)).toBe(false);
    });

    it('Existing Entity (forceNew: false): should return existing instance, NOT call registry or spatial index', () => {
      const existingEntity = new Entity(testEntityId);
      entityManager.activeEntities.set(testEntityId, existingEntity);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBe(existingEntity);
      expect(mockRegistry.getEntityDefinition).not.toHaveBeenCalled();
      expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
    });

    it('Existing Entity (forceNew: true): should create NEW instance, copy components, add to spatial index, NOT modify active map', () => {
      const originalEntity = new Entity(testEntityId);
      entityManager.activeEntities.set(testEntityId, originalEntity);
      mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithPosition);
      const newEntity = entityManager.createEntityInstance(testEntityId, true);
      expect(newEntity).toBeInstanceOf(Entity);
      expect(newEntity).not.toBe(originalEntity);
      expect(newEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(testEntityId, testLocationId);
      expect(entityManager.activeEntities.get(testEntityId)).toBe(originalEntity); // Original still in map
      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1);
    });

    it.each([null, undefined, '', 123, {}])('should return null and log error if entityId is invalid (%s)', (invalidId) => {
      const entity = entityManager.createEntityInstance(invalidId);
      expect(entity).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid entityId provided: ${invalidId}`));
      expect(entityManager.activeEntities.size).toBe(0);
    });
    // ... edge cases for position component without/null locationId ...
    it('should create entity and call addEntity with undefined locationId if position component lacks locationId', () => {
      const definitionMissingLocationId = {id: testEntityId, components: {[POSITION_COMPONENT_ID]: {x: 5, y: 5}}};
      mockRegistry.getEntityDefinition.mockReturnValue(definitionMissingLocationId);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(testEntityId, undefined);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('invalid/null locationId (undefined). Not added to spatial index'));
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
    });

    it('should create entity and call addEntity with null locationId if position component has null locationId', () => {
      const definitionNullLocationId = {
        id: testEntityId,
        components: {[POSITION_COMPONENT_ID]: {x: 5, y: 5, locationId: null}}
      };
      mockRegistry.getEntityDefinition.mockReturnValue(definitionNullLocationId);
      const entity = entityManager.createEntityInstance(testEntityId);
      expect(entity).toBeInstanceOf(Entity);
      expect(mockSpatialIndex.addEntity).toHaveBeenCalledWith(testEntityId, null);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('invalid/null locationId (null). Not added to spatial index'));
      expect(entityManager.activeEntities.has(testEntityId)).toBe(true);
    });


  });

  // --- 3. addComponent Tests ---
  // describe('addComponent', () => { ... }); // Assuming these tests exist elsewhere or are not needed now

  // --- 4. removeComponent Tests ---
  // describe('removeComponent', () => { ... }); // Assuming these tests exist elsewhere or are not needed now


  // --- 5. getComponentData Tests (Ticket 3.3.6) ---
  describe('getComponentData', () => {
    // Setup: Ensure an entity instance with components exists in entityManager.activeEntities before tests.
    beforeEach(() => {
      // Manually create and add an entity for these specific tests
      // Avoids mocking registry/definition if not strictly needed for *access* tests
      accessTestEntity = new Entity(ACCESS_TEST_ENTITY_ID);
      accessTestEntity.addComponent(EXISTING_COMPONENT_ID, {...EXISTING_COMPONENT_DATA}); // Add a component
      entityManager.activeEntities.set(ACCESS_TEST_ENTITY_ID, accessTestEntity);

      // Verify setup (optional but good practice)
      expect(entityManager.activeEntities.has(ACCESS_TEST_ENTITY_ID)).toBe(true);
      expect(entityManager.getEntityInstance(ACCESS_TEST_ENTITY_ID)?.hasComponent(EXISTING_COMPONENT_ID)).toBe(true);
    });

    // AC: Verify retrieving data for an existing component on an existing entity returns the correct data object.
    it('should return the component data object for an existing component on an existing entity', () => {
      const data = entityManager.getComponentData(ACCESS_TEST_ENTITY_ID, EXISTING_COMPONENT_ID);
      expect(data).toBeDefined();
      expect(data).toEqual(EXISTING_COMPONENT_DATA);
      // Optional: Verify it's the same object reference (as Entity doesn't clone on get)
      expect(data).toBe(accessTestEntity.getComponentData(EXISTING_COMPONENT_ID));
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
    });

    // AC: Verify attempting to retrieve data for a non-existent component on an existing entity returns undefined.
    it('should return undefined for a non-existent component on an existing entity', () => {
      const data = entityManager.getComponentData(ACCESS_TEST_ENTITY_ID, NON_EXISTENT_COMPONENT_ID);
      expect(data).toBeUndefined();
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
    });

    // AC: Verify attempting to retrieve data for any component on a non-existent entity returns undefined.
    it('should return undefined when attempting to get component data from a non-existent entity', () => {
      const data = entityManager.getComponentData(NON_EXISTENT_ENTITY_ID, EXISTING_COMPONENT_ID);
      expect(data).toBeUndefined();
      // Implementation currently doesn't log warning here, which is fine.
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // --- 6. hasComponent Tests (Ticket 3.3.6) ---
  describe('hasComponent', () => {
    // Setup: Ensure an entity instance with components exists in entityManager.activeEntities before tests.
    beforeEach(() => {
      // Reuse the same setup logic as getComponentData
      accessTestEntity = new Entity(ACCESS_TEST_ENTITY_ID);
      accessTestEntity.addComponent(EXISTING_COMPONENT_ID, {...EXISTING_COMPONENT_DATA});
      entityManager.activeEntities.set(ACCESS_TEST_ENTITY_ID, accessTestEntity);

      expect(entityManager.activeEntities.has(ACCESS_TEST_ENTITY_ID)).toBe(true);
    });

    // AC: Verify checking for an existing component on an existing entity returns true.
    it('should return true for an existing component on an existing entity', () => {
      const result = entityManager.hasComponent(ACCESS_TEST_ENTITY_ID, EXISTING_COMPONENT_ID);
      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // AC: Verify checking for a non-existent component on an existing entity returns false.
    it('should return false for a non-existent component on an existing entity', () => {
      const result = entityManager.hasComponent(ACCESS_TEST_ENTITY_ID, NON_EXISTENT_COMPONENT_ID);
      expect(result).toBe(false);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // AC: Verify checking for any component on a non-existent entity returns false.
    it('should return false when checking for any component on a non-existent entity', () => {
      const result = entityManager.hasComponent(NON_EXISTENT_ENTITY_ID, EXISTING_COMPONENT_ID);
      expect(result).toBe(false);
      // Implementation currently doesn't log warning here, which is fine.
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // --- 7. Other EntityManager Methods (getEntityInstance, removeEntityInstance, etc.) ---
  // describe('getEntityInstance', () => { ... });
  // describe('removeEntityInstance', () => { ... });
  // describe('getEntitiesInLocation', () => { ... });
  // describe('buildInitialSpatialIndex', () => { ... });
  // describe('clearAll', () => { ... });

}); // End describe('EntityManager')