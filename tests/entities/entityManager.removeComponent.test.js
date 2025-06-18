// tests/entities/entityManager.removeComponent.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
// Entity import might not be directly needed if we only interact via EntityManager
// import Entity from '../../src/entities/entity.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  // Add other methods if EntityManager constructor or tested methods need them
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })), // Default to valid for most tests
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
const TEST_DEFINITION_ID = 'test-def-01'; // Was TEST_ENTITY_ID, now represents definition
const MOCK_INSTANCE_ID = 'mock-instance-uuid-001'; // Predictable instance ID for tests

const COMPONENT_TYPE_ID_NAME = 'core:name';
const COMPONENT_TYPE_ID_HEALTH = 'core:health';
const COMPONENT_TYPE_ID_NON_EXISTENT = 'core:inventory';
const COMPONENT_DATA_NAME = { name: 'Test Dummy' };
const COMPONENT_DATA_HEALTH = { current: 50, max: 100 };
const TEST_LOCATION_ID = 'zone:test-area';
const POSITION_DATA_WITH_LOCATION = {
  x: 1,
  y: 2,
  locationId: TEST_LOCATION_ID,
};
const POSITION_DATA_NO_LOCATION = { x: 5, y: 5 }; // locationId will be undefined
const POSITION_DATA_NULL_LOCATION = { x: 6, y: 6, locationId: null };

// --- Test Suite ---
describe('EntityManager.removeComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let testEntityInstance; // To hold the entity instance

  const setupBaseEntity = (
    instanceOverrides = {},
    definitionComponents = {} // Components on the definition itself
  ) => {
    const baseEntityDef = {
      id: TEST_DEFINITION_ID,
      name: 'Base Test Entity Def',
      components: definitionComponents, // Use definitionComponents here
    };
    mockRegistry.getEntityDefinition.mockReturnValue(baseEntityDef);

    // Create instance, passing overrides. InstanceId is now the 3rd argument if overrides are present.
    testEntityInstance = entityManager.createEntityInstance(
      TEST_DEFINITION_ID,
      instanceOverrides, // Pass overrides here
      MOCK_INSTANCE_ID
    );

    if (!testEntityInstance) {
      throw new Error(
        `Failed to create test entity instance for definition ${TEST_DEFINITION_ID}`
      );
    }

    // Clear mocks related to createEntityInstance if they might interfere
    mockValidator.validate.mockClear(); // Potentially called during injectDefaultComponents
    mockSpatialIndex.addEntity.mockClear();
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
  };

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockValidator = createMockSchemaValidator();
    mockLogger = createMockLogger();
    mockSpatialIndex = createMockSpatialIndexManager();
    entityManager = new EntityManager(
      mockRegistry,
      mockValidator,
      mockLogger,
      mockSpatialIndex
    );
    jest.clearAllMocks(); // Clear mocks before each test setup
  });

  afterEach(() => {
    entityManager.clearAll();
    testEntityInstance = null;
  });

  it('Success Case (Remove Non-Position Component): should remove component, return true, and NOT call spatial index remove', () => {
    // Setup: NAME as override, HEALTH as override (or on def, but override for this test ensures it exists if needed)
    // Definition is empty for this test's specific needs regarding NAME.
    setupBaseEntity(
      {
        [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME },
        [COMPONENT_TYPE_ID_HEALTH]: { ...COMPONENT_DATA_HEALTH },
      },
      {} // No components on definition relevant to removal test for NAME
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)
    ).toBe(true); // From override
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_HEALTH)
    ).toBe(true); // From override

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      COMPONENT_TYPE_ID_NAME
    );

    expect(result).toBe(true); // Override removed
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)
    ).toBe(false); // NAME override gone, definition was empty for NAME
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_HEALTH)
    ).toBe(true); // HEALTH override still there

    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    // Updated log message to match actual output
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component override '${COMPONENT_TYPE_ID_NAME}' removed from entity '${MOCK_INSTANCE_ID}'.`
      )
    );
  });

  it('Success Case (Remove Position Component): should remove component, return true, and call spatial index remove with old locationId', () => {
    // Setup: POSITION as override, NAME as override (or on def)
    // Definition is empty for this test's specific needs regarding POSITION.
    setupBaseEntity(
      {
        [POSITION_COMPONENT_ID]: { ...POSITION_DATA_WITH_LOCATION },
        [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME },
      },
      {}
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(true); // From override
    expect(
      entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
        ?.locationId
    ).toBe(TEST_LOCATION_ID);

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      POSITION_COMPONENT_ID
    );

    expect(result).toBe(true); // Override removed
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(false); // POSITION override gone
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)
    ).toBe(true); // NAME override still there

    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
      MOCK_INSTANCE_ID,
      TEST_LOCATION_ID
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    // Updated log messages
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Entity '${MOCK_INSTANCE_ID}' removed from old location '${TEST_LOCATION_ID}' in spatial index due to ${POSITION_COMPONENT_ID} removal.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
      )
    );
  });

  it('Success Case (Remove Position Component - No locationId): should remove component, return true, and call spatial index remove with undefined locationId', () => {
    // POSITION_DATA_NO_LOCATION has undefined locationId
    setupBaseEntity(
      { [POSITION_COMPONENT_ID]: { ...POSITION_DATA_NO_LOCATION } },
      {}
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(true);
    expect(
      entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
        ?.locationId
    ).toBeUndefined();

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      POSITION_COMPONENT_ID
    );

    expect(result).toBe(true);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(false);

    // Spatial index removeEntity is called even with undefined oldLocationId, if component was POSITION
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
      MOCK_INSTANCE_ID,
      undefined // Correctly passing undefined
    );
    // Updated log messages
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Attempted removal of entity '${MOCK_INSTANCE_ID}' from spatial index (old location was undefined/null) due to ${POSITION_COMPONENT_ID} removal.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
      )
    );
  });

  it('Success Case (Remove Position Component - Null locationId): should remove component, return true, and call spatial index remove with null locationId', () => {
    setupBaseEntity(
      { [POSITION_COMPONENT_ID]: { ...POSITION_DATA_NULL_LOCATION } },
      {}
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(true);
    expect(
      entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
        ?.locationId
    ).toBeNull();

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      POSITION_COMPONENT_ID
    );

    expect(result).toBe(true);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
    ).toBe(false);

    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
      MOCK_INSTANCE_ID,
      null // Correctly passing null
    );
    // Updated log messages
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Attempted removal of entity '${MOCK_INSTANCE_ID}' from spatial index (old location was undefined/null) due to ${POSITION_COMPONENT_ID} removal.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
      )
    );
  });

  // Test for removing a component that is an override, but also exists on the definition
  it('Success Case (Remove Override - Component also on Definition): should remove override, return true, hasComponent still true (from def)', () => {
    const definitionComps = {
      [COMPONENT_TYPE_ID_NAME]: { name: 'Definition Name' },
    };
    const instanceOvers = {
      [COMPONENT_TYPE_ID_NAME]: { name: 'Instance Override Name' }, // Override
    };
    setupBaseEntity(instanceOvers, definitionComps);

    expect(entityManager.getComponentData(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME).name).toBe('Instance Override Name');
    expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true);

    const result = entityManager.removeComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME);

    expect(result).toBe(true); // Override was removed
    expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true); // Still true, from definition
    expect(entityManager.getComponentData(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME).name).toBe('Definition Name'); // Falls back to definition

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component override '${COMPONENT_TYPE_ID_NAME}' removed from entity '${MOCK_INSTANCE_ID}'.`
      )
    );
  });

  it('Failure Case (Component Not Found on Entity - exists on definition but not instance)', () => {
    // Setup: COMPONENT_TYPE_ID_NAME exists on definition, but not as an instance override.
    setupBaseEntity(
      {}, // No instance overrides
      { [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME } } // Component on definition
    );

    expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true); // True due to definition

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      COMPONENT_TYPE_ID_NAME
    );

    expect(result).toBe(false); // No override to remove
    expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true); // Still true from definition
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Component '${COMPONENT_TYPE_ID_NAME}' on entity '${MOCK_INSTANCE_ID}' was not an override or could not be removed.`
      )
    );
  });

  it('Failure Case (Component Not Found Anywhere)', () => {
    // Setup: Entity exists, but component is not on definition or as an override.
    setupBaseEntity({}, {}); // No components on definition, no overrides

    expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NON_EXISTENT)).toBe(false);

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      COMPONENT_TYPE_ID_NON_EXISTENT
    );

    expect(result).toBe(false);
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Component '${COMPONENT_TYPE_ID_NON_EXISTENT}' not found on entity '${MOCK_INSTANCE_ID}'. Nothing removed.`
      )
    );
  });

  it('Failure Case (Entity Not Found): should return false, log warning, and NOT call spatial index remove', () => {
    const nonExistentInstanceId = 'ghost-instance-uuid';
    // No setupBaseEntity call, so MOCK_INSTANCE_ID doesn't exist either.

    const result = entityManager.removeComponent(
      nonExistentInstanceId,
      COMPONENT_TYPE_ID_NAME
    );

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Entity not found with ID: ${nonExistentInstanceId}. Cannot remove component.`
      )
    );
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
  });

  // This test is similar to Entity Not Found because EntityManager.removeComponent doesn't
  // distinguish between syntactically invalid IDs and IDs of non-existent entities
  // if getEntityInstance returns null for both.
  it('Failure Case (Invalid Instance ID): should behave like Entity Not Found', () => {
    const invalidInstanceId = '###INVALID_ID###'; // An ID that might be syntactically invalid for some systems
    // No setupBaseEntity call

    const result = entityManager.removeComponent(
      invalidInstanceId,
      COMPONENT_TYPE_ID_NAME
    );

    expect(result).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `EntityManager.removeComponent: Entity not found with ID: ${invalidInstanceId}. Cannot remove component.`
      )
    );
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
  });

  it('Failure Case (Invalid Component Type ID - null): should log component not found and return false', () => {
    setupBaseEntity({}, {}); // Entity exists
    const invalidComponentTypeId = null;

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      invalidComponentTypeId
    );

    expect(result).toBe(false);
    // EntityManager.hasComponent(null) will be false, leading to "Component not found"
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Component '${invalidComponentTypeId}' not found on entity '${MOCK_INSTANCE_ID}'. Nothing removed.`
      )
    );
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
  });

  it('Failure Case (Invalid Component Type ID - undefined): should log component not found and return false', () => {
    setupBaseEntity({}, {}); // Entity exists
    const invalidComponentTypeId = undefined;

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      invalidComponentTypeId
    );

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Component '${invalidComponentTypeId}' not found on entity '${MOCK_INSTANCE_ID}'. Nothing removed.`
      )
    );
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
  });

  it('Failure Case (Invalid Component Type ID - empty string): should log component not found and return false', () => {
    setupBaseEntity({}, {}); // Entity exists
    const invalidComponentTypeId = '';

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      invalidComponentTypeId
    );

    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Component '${invalidComponentTypeId}' not found on entity '${MOCK_INSTANCE_ID}'. Nothing removed.`
      )
    );
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
  });
});
