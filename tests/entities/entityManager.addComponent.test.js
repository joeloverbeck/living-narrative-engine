// src/tests/entities/entityManager.addComponent.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js'; // Adjust path if necessary
import Entity from '../../src/entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js"; // Adjust path if necessary

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
const INITIAL_COMPONENT_TYPE_ID = 'core:name';
const INITIAL_COMPONENT_DATA = {name: 'Test Dummy'};
const NEW_COMPONENT_TYPE_ID = 'core:health';
const NEW_COMPONENT_DATA = {current: 100, max: 100};
const UPDATED_COMPONENT_DATA = {name: 'Updated Dummy'};
const INITIAL_LOCATION_ID = 'zone:start';
const NEW_LOCATION_ID = 'zone:target';
const POSITION_DATA_INITIAL = {x: 1, y: 2, locationId: INITIAL_LOCATION_ID};
const POSITION_DATA_NEW = {x: 10, y: 20, locationId: NEW_LOCATION_ID};
const POSITION_DATA_NO_LOCATION = {x: 5, y: 5};
const POSITION_DATA_NULL_LOCATION = {x: 6, y: 6, locationId: null};

// --- Test Suite ---
describe('EntityManager.addComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let testEntity; // To hold the entity created in beforeEach

  // Function to set up a base entity for tests
  const setupBaseEntity = (includePosition = false) => {
    const components = {[INITIAL_COMPONENT_TYPE_ID]: {...INITIAL_COMPONENT_DATA}};
    if (includePosition) {
      components[POSITION_COMPONENT_ID] = {...POSITION_DATA_INITIAL};
    }
    const baseEntityDef = {
      id: TEST_ENTITY_ID,
      name: 'Base Test Entity Def',
      components: components,
    };
    mockRegistry.getEntityDefinition.mockReturnValue(baseEntityDef);
    testEntity = entityManager.createEntityInstance(TEST_ENTITY_ID);

    // Important: Clear mocks related to createEntityInstance if they might interfere
    // Especially spatial index if position was added.
    if (includePosition) {
      mockSpatialIndex.addEntity.mockClear();
    }
    mockLogger.info.mockClear(); // Clear constructor/create logs
    mockLogger.debug.mockClear();
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();

    // Instantiate EntityManager with mocks
    entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);

    // Clear mocks (especially call counts) before setting up the entity for the test
    jest.clearAllMocks();

    // Default setup: Create an entity WITHOUT position component initially
    // Specific describe blocks can call setupBaseEntity(true) if needed
    setupBaseEntity(false);

    // Pre-condition check: Ensure entity exists
    if (!testEntity) {
      throw new Error('Test setup failed: Entity could not be created.');
    }
    // Pre-configure validator to be valid by default for success cases
    mockValidator.validate.mockReturnValue({isValid: true});
  });

  afterEach(() => {
    entityManager.clearAll(); // Clean up active entities and spatial index
    testEntity = null; // Clear reference
  });

  // --- Test Cases ---

  it('Success Case (New Component): should add a new component, return true, and NOT update spatial index', () => {
    // Arrange (Validator already mocked to return true in beforeEach)

    // Act
    const result = entityManager.addComponent(TEST_ENTITY_ID, NEW_COMPONENT_TYPE_ID, {...NEW_COMPONENT_DATA});

    // Assert
    expect(result).toBe(true);
    const addedData = entityManager.getComponentData(TEST_ENTITY_ID, NEW_COMPONENT_TYPE_ID);
    expect(addedData).toBeDefined();
    expect(addedData).toEqual(NEW_COMPONENT_DATA);
    expect(addedData).not.toBe(NEW_COMPONENT_DATA); // Ensure it was cloned
    expect(testEntity.hasComponent(NEW_COMPONENT_TYPE_ID)).toBe(true); // Verify on entity directly
    expect(testEntity.getComponentData(NEW_COMPONENT_TYPE_ID)).toEqual(NEW_COMPONENT_DATA);

    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.validate).toHaveBeenCalledWith(NEW_COMPONENT_TYPE_ID, NEW_COMPONENT_DATA);
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled(); // Not a position component
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully added/updated component '${NEW_COMPONENT_TYPE_ID}'`));
  });

  it('Success Case (Update Component): should update existing component data, return true, and NOT update spatial index', () => {
    // Arrange (Entity has INITIAL_COMPONENT_TYPE_ID from setup)
    // (Validator already mocked to return true in beforeEach)
    const initialDataCheck = entityManager.getComponentData(TEST_ENTITY_ID, INITIAL_COMPONENT_TYPE_ID);
    expect(initialDataCheck).toEqual(INITIAL_COMPONENT_DATA); // Pre-condition

    // Act
    const result = entityManager.addComponent(TEST_ENTITY_ID, INITIAL_COMPONENT_TYPE_ID, {...UPDATED_COMPONENT_DATA});

    // Assert
    expect(result).toBe(true);
    const updatedData = entityManager.getComponentData(TEST_ENTITY_ID, INITIAL_COMPONENT_TYPE_ID);
    expect(updatedData).toBeDefined();
    expect(updatedData).toEqual(UPDATED_COMPONENT_DATA); // Data is updated
    expect(updatedData).not.toBe(UPDATED_COMPONENT_DATA); // Ensure it was cloned
    expect(updatedData).not.toEqual(INITIAL_COMPONENT_DATA); // Data is different from initial

    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.validate).toHaveBeenCalledWith(INITIAL_COMPONENT_TYPE_ID, UPDATED_COMPONENT_DATA);
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled(); // Not a position component
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully added/updated component '${INITIAL_COMPONENT_TYPE_ID}'`));
  });

  describe('Position Component Handling', () => {
    // Tests specifically involving the position component

    it('Success Case (Add Position Component): should add position, return true, and update spatial index with undefined oldLocationId', () => {
      // Arrange (Entity starts WITHOUT position)
      expect(testEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(false); // Pre-condition
      // (Validator already mocked to return true in beforeEach)

      // Act
      const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NEW});

      // Assert
      expect(result).toBe(true);
      const addedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
      expect(addedData).toEqual(POSITION_DATA_NEW);

      expect(mockValidator.validate).toHaveBeenCalledTimes(1);
      expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NEW);
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
      // Old location was undefined/null because the component didn't exist
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, undefined, NEW_LOCATION_ID);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was null/undefined`));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is ${NEW_LOCATION_ID}`));
    });

    it('Success Case (Add Position Component - No LocationId): should add position, return true, update spatial index with undefined old/new locationId', () => {
      // Arrange
      expect(testEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(false); // Pre-condition

      // Act
      const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NO_LOCATION});

      // Assert
      expect(result).toBe(true);
      const addedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
      expect(addedData).toEqual(POSITION_DATA_NO_LOCATION);

      expect(mockValidator.validate).toHaveBeenCalledTimes(1);
      expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NO_LOCATION);
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
      // Old location undefined (no component), new location undefined (no locationId prop)
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, undefined, undefined);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was null/undefined`));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is null/undefined`));
    });

    it('Success Case (Add Position Component - Null LocationId): should add position, return true, update spatial index with undefined old and null new locationId', () => {
      // Arrange
      expect(testEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(false); // Pre-condition

      // Act
      const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NULL_LOCATION});

      // Assert
      expect(result).toBe(true);
      const addedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
      expect(addedData).toEqual(POSITION_DATA_NULL_LOCATION);

      expect(mockValidator.validate).toHaveBeenCalledTimes(1);
      expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NULL_LOCATION);
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
      // Old location undefined (no component), new location null
      expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, undefined, null);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was null/undefined`));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is null/undefined`)); // Logger treats null and undefined similarly here
    });

    // --- Nested Describe for tests requiring initial position ---
    describe('With Initial Position Component', () => {
      beforeEach(() => {
        // Clear mocks and entity from outer scope
        jest.clearAllMocks();
        entityManager.activeEntities.clear();
        mockSpatialIndex.clearIndex(); // Ensure index is clean too

        // Setup entity *with* position for this specific context
        setupBaseEntity(true); // This now includes POSITION_COMPONENT_ID

        // Pre-configure validator to be valid by default
        mockValidator.validate.mockReturnValue({isValid: true});

        // Pre-condition check
        expect(testEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
        expect(testEntity.getComponentData(POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_INITIAL);
        // CreateEntityInstance would have called addEntity, clear that mock call for the actual test
        mockSpatialIndex.addEntity.mockClear();
        mockSpatialIndex.updateEntityLocation.mockClear(); // Also clear this, just in case
        mockLogger.debug.mockClear(); // Clear create logs
      });

      it('Success Case (Update Position Component): should update position, return true, and update spatial index with old and new locationIds', () => {
        // Arrange (Entity has position from inner beforeEach)
        // (Validator mock is set)

        // Act
        const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NEW});

        // Assert
        expect(result).toBe(true);
        const updatedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
        expect(updatedData).toEqual(POSITION_DATA_NEW);

        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NEW);
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
        // Old location was INITIAL_LOCATION_ID, new is NEW_LOCATION_ID
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, INITIAL_LOCATION_ID, NEW_LOCATION_ID);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was ${INITIAL_LOCATION_ID}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is ${NEW_LOCATION_ID}`));
      });

      it('Success Case (Update Position Component - To Null LocationId): should update position, return true, update spatial index with old and null new locationId', () => {
        // Act
        const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NULL_LOCATION});

        // Assert
        expect(result).toBe(true);
        const updatedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
        expect(updatedData).toEqual(POSITION_DATA_NULL_LOCATION);

        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NULL_LOCATION);
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
        // Old location was INITIAL_LOCATION_ID, new is null
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, INITIAL_LOCATION_ID, null);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was ${INITIAL_LOCATION_ID}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is null/undefined`));
      });

      it('Success Case (Update Position Component - To No LocationId): should update position, return true, update spatial index with old and undefined new locationId', () => {
        // Act
        const result = entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NO_LOCATION});

        // Assert
        expect(result).toBe(true);
        const updatedData = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
        expect(updatedData).toEqual(POSITION_DATA_NO_LOCATION);

        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, POSITION_DATA_NO_LOCATION);
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledTimes(1);
        // Old location was INITIAL_LOCATION_ID, new is undefined
        expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(TEST_ENTITY_ID, INITIAL_LOCATION_ID, undefined);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${TEST_ENTITY_ID} was ${INITIAL_LOCATION_ID}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${TEST_ENTITY_ID} is null/undefined`));
      });
    }); // End describe With Initial Position Component
  }); // End describe Position Component Handling

  it('Failure Case (Entity Not Found): should throw Error and log error', () => {
    // Arrange
    const nonExistentEntityId = 'ghost-entity';
    // (Validator mock doesn't matter here)

    // Act & Assert
    expect(() => {
      entityManager.addComponent(nonExistentEntityId, NEW_COMPONENT_TYPE_ID, {...NEW_COMPONENT_DATA});
    }).toThrow(`EntityManager.addComponent: Entity not found with ID: ${nonExistentEntityId}`);

    // Assert Mocks
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Entity not found with ID: ${nonExistentEntityId}`));
    expect(mockValidator.validate).not.toHaveBeenCalled();
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
  });

  it('Failure Case (Validation Fails): should throw Error, log error with details, NOT add/update component, and NOT update spatial index', () => {
    // Arrange
    const validationErrors = [{field: 'data.current', message: 'must be a number'}];
    mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});
    const invalidHealthData = {current: 'one hundred', max: 100};

    const initialComponentState = entityManager.getComponentData(TEST_ENTITY_ID, NEW_COMPONENT_TYPE_ID);
    expect(initialComponentState).toBeUndefined(); // Pre-condition: component doesn't exist yet

    // Act & Assert
    expect(() => {
      entityManager.addComponent(TEST_ENTITY_ID, NEW_COMPONENT_TYPE_ID, invalidHealthData);
    }).toThrow(`EntityManager.addComponent: Component data validation failed for type '${NEW_COMPONENT_TYPE_ID}' on entity '${TEST_ENTITY_ID}'.`);

    // Assert Mocks and State
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const expectedErrorDetails = JSON.stringify(validationErrors, null, 2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `EntityManager.addComponent: Component data validation failed for type '${NEW_COMPONENT_TYPE_ID}' on entity '${TEST_ENTITY_ID}'. Errors:\n${expectedErrorDetails}`
    );

    // Verify component was NOT added/updated
    const finalComponentState = entityManager.getComponentData(TEST_ENTITY_ID, NEW_COMPONENT_TYPE_ID);
    expect(finalComponentState).toBeUndefined(); // Still undefined

    // Verify validator was called
    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.validate).toHaveBeenCalledWith(NEW_COMPONENT_TYPE_ID, invalidHealthData);

    // Verify spatial index was NOT called
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
  });

  it('Failure Case (Validation Fails - Position): should throw, log, NOT add/update, and NOT update spatial index', () => {
    // Arrange
    const validationErrors = [{field: 'data.locationId', message: 'must be a string'}];
    mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});
    const invalidPositionData = {x: 1, y: 1, locationId: 12345}; // Invalid locationId type

    const initialPositionState = entityManager.getComponentData(TEST_ENTITY_ID, POSITION_COMPONENT_ID);
    expect(initialPositionState).toBeUndefined(); // Pre-condition

    // Act & Assert
    expect(() => {
      entityManager.addComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID, invalidPositionData);
    }).toThrow(`EntityManager.addComponent: Component data validation failed for type '${POSITION_COMPONENT_ID}' on entity '${TEST_ENTITY_ID}'.`);

    // Assert Mocks and State
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const expectedErrorDetails = JSON.stringify(validationErrors, null, 2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`validation failed for type '${POSITION_COMPONENT_ID}' on entity '${TEST_ENTITY_ID}'. Errors:\n${expectedErrorDetails}`)
    );
    expect(entityManager.hasComponent(TEST_ENTITY_ID, POSITION_COMPONENT_ID)).toBe(false);
    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, invalidPositionData);
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
  });

});