// src/tests/entities/entityManager.removeComponent.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../entities/entityManager.js'; // Adjust path if necessary
import Entity from '../../entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../types/components.js"; // Adjust path if necessary

// --- Mock Implementations ---
// Helper functions to create fresh mocks for each test context
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
  // removeComponent doesn't use the validator, but keep for consistency if EntityManager constructor needs it
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
const TEST_ENTITY_ID = 'test-entity-01';
const COMPONENT_TYPE_ID_NAME = 'core:name';
const COMPONENT_TYPE_ID_HEALTH = 'core:health';
const COMPONENT_TYPE_ID_NON_EXISTENT = 'core:inventory';
const COMPONENT_DATA_NAME = {name: 'Test Dummy'};
const COMPONENT_DATA_HEALTH = {current: 50, max: 100};
const TEST_LOCATION_ID = 'zone:test-area';
const POSITION_DATA_WITH_LOCATION = {x: 1, y: 2, locationId: TEST_LOCATION_ID};
const POSITION_DATA_NO_LOCATION = {x: 5, y: 5};
const POSITION_DATA_NULL_LOCATION = {x: 6, y: 6, locationId: null};

// --- Test Suite ---
describe('EntityManager.removeComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let testEntity; // To hold the entity created in beforeEach

  // Function to set up a base entity for tests
  const setupBaseEntity = (includePosition = false, positionData = POSITION_DATA_WITH_LOCATION) => {
    const components = {
      [COMPONENT_TYPE_ID_NAME]: {...COMPONENT_DATA_NAME},
      [COMPONENT_TYPE_ID_HEALTH]: {...COMPONENT_DATA_HEALTH}, // Add another common component
    };
    if (includePosition) {
      components[POSITION_COMPONENT_ID] = {...positionData};
    }
    const baseEntityDef = {
      id: TEST_ENTITY_ID,
      name: 'Base Test Entity Def',
      components: components,
    };
    mockRegistry.getEntityDefinition.mockReturnValue(baseEntityDef);
    testEntity = entityManager.createEntityInstance(TEST_ENTITY_ID);

    // Important: Clear mocks related to createEntityInstance if they might interfere
    mockSpatialIndex.addEntity.mockClear();
    mockLogger.info.mockClear(); // Clear constructor/create logs
    mockLogger.debug.mockClear();
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator(); // Needed for constructor
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();

    // Instantiate EntityManager with mocks
    entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);

    // Clear mocks (especially call counts) before setting up the entity for the test
    jest.clearAllMocks();

    // Note: setupBaseEntity is called within specific 'it' blocks or nested 'describe' blocks
    // as the required setup varies.
  });

  afterEach(() => {
    entityManager.clearAll(); // Clean up active entities and spatial index
    testEntity = null; // Clear reference
  });

  // --- Test Cases ---

  it('Success Case (Remove Non-Position Component): should remove component, return true, and NOT call spatial index remove', () => {
    // Arrange
    setupBaseEntity(false); // Create entity without position initially
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NAME)).toBe(true); // Pre-condition

    // Act
    const result = entityManager.removeComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NAME);

    // Assert
    expect(result).toBe(true); // AC: Verify the method returns true.
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NAME)).toBe(false); // AC: Verify component is no longer present
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_HEALTH)).toBe(true); // Verify other components remain
    expect(testEntity.hasComponent(COMPONENT_TYPE_ID_NAME)).toBe(false); // Verify directly on entity instance

    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // AC: Verify ISpatialIndexManager.removeEntity was NOT called.
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${COMPONENT_TYPE_ID_NAME}' from entity '${TEST_ENTITY_ID}'.`));
  });

  it('Success Case (Remove Position Component): should remove component, return true, and call spatial index remove with old locationId', () => {
    // Arrange
    setupBaseEntity(true, POSITION_DATA_WITH_LOCATION); // Create entity WITH position and valid locationId
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(true); // Pre-condition
    expect(entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID)?.locationId).toBe(TEST_LOCATION_ID); // Pre-condition

    // Act
    const result = entityManager.removeComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID);

    // Assert
    expect(result).toBe(true); // AC: Verify the method returns true.
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(false); // AC: Verify component is no longer present
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NAME)).toBe(true); // Verify other components remain

    // AC: Verify ISpatialIndexManager.removeEntity was called with the correct entity ID and the old locationId.
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(TEST_ENTITY_ID, TEST_LOCATION_ID);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${TEST_ENTITY_ID}. Old location was ${TEST_LOCATION_ID}.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${POSITION_COMPONENT_ID}' from entity '${TEST_ENTITY_ID}'.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${TEST_ENTITY_ID} removal from location ${TEST_LOCATION_ID}.`));
  });

  it('Success Case (Remove Position Component - No locationId): should remove component, return true, and call spatial index remove with undefined locationId', () => {
    // Arrange
    setupBaseEntity(true, POSITION_DATA_NO_LOCATION); // Create entity WITH position but NO locationId
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(true); // Pre-condition
    expect(entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID)?.locationId).toBeUndefined(); // Pre-condition

    // Act
    const result = entityManager.removeComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID);

    // Assert
    expect(result).toBe(true);
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(false);

    // Verify removeEntity was called, but with undefined for the locationId
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(TEST_ENTITY_ID, undefined);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${TEST_ENTITY_ID}. Old location was null/undefined.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${POSITION_COMPONENT_ID}' from entity '${TEST_ENTITY_ID}'.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${TEST_ENTITY_ID} removal from location null/undefined.`));
  });

  it('Success Case (Remove Position Component - Null locationId): should remove component, return true, and call spatial index remove with null locationId', () => {
    // Arrange
    setupBaseEntity(true, POSITION_DATA_NULL_LOCATION); // Create entity WITH position and NULL locationId
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(true); // Pre-condition
    expect(entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID)?.locationId).toBeNull(); // Pre-condition

    // Act
    const result = entityManager.removeComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID);

    // Assert
    expect(result).toBe(true);
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(false);

    // Verify removeEntity was called with null for the locationId
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(TEST_ENTITY_ID, null);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${TEST_ENTITY_ID}. Old location was null/undefined.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${POSITION_COMPONENT_ID}' from entity '${TEST_ENTITY_ID}'.`));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${TEST_ENTITY_ID} removal from location null/undefined.`));
  });

  it('Failure Case (Entity Not Found): should return false, log warning, and NOT call spatial index remove', () => {
    // Arrange
    const nonExistentEntityId = 'ghost-entity';
    setupBaseEntity(false); // Setup some other entity to ensure the map isn't empty

    // Act
    const result = entityManager.removeComponent(nonExistentEntityId, COMPONENT_TYPE_ID_NAME);

    // Assert
    expect(result).toBe(false); // AC: Verify the method returns false.
    expect(mockLogger.warn).toHaveBeenCalledTimes(1); // AC: Verify ILogger.warn was called.
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity not found with ID: ${nonExistentEntityId}. Cannot remove component.`));
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled(); // No debug messages for removal expected
  });

  it('Failure Case (Component Not Found on Entity): should return false and NOT call spatial index remove', () => {
    // Arrange
    setupBaseEntity(true, POSITION_DATA_WITH_LOCATION); // Setup entity with some components, including position
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NON_EXISTENT)).toBe(false); // Pre-condition

    // Act
    const result = entityManager.removeComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NON_EXISTENT);

    // Assert
    expect(result).toBe(false); // AC: Verify the method returns false.

    // Verify original components are still present
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_NAME)).toBe(true);
    expect(entityManager.hasComponent(TEST_ENTITY_ID, COMPONENT_TYPE_ID_HEALTH)).toBe(true);
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(true);

    // AC: Verify ISpatialIndexManager.removeEntity was NOT called.
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning expected in this case
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component '${COMPONENT_TYPE_ID_NON_EXISTENT}' not found on entity '${TEST_ENTITY_ID}'. Nothing removed.`));
    // Debug message confirming removal didn't happen IS expected
    expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully removed component'));
    // Debug message for spatial index update should NOT be present
    expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Updated spatial index'));
  });
});