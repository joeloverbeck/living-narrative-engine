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
import EntityDefinition from '../../src/entities/entityDefinition.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { EntityNotFoundError } from '../../src/errors/entityNotFoundError.js';
import { COMPONENT_REMOVED_ID } from '../../src/constants/eventIds.js'; // Added import

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

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
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
const POSITION_DATA_NO_LOCATION = { x: 5, y: 5, locationId: undefined };
const POSITION_DATA_NULL_LOCATION = { x: 6, y: 6, locationId: null };

// --- Test Suite ---
describe('EntityManager.removeComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let mockEventDispatcher;
  // let testEntityInstance; // Not directly used in assertions, entity is fetched via entityManager

  const setupBaseEntity = (
    instanceOverrides = {},
    definitionComponents = {}
  ) => {
    const baseEntityDefData = {
      description: 'Base Test Entity Def',
      components: definitionComponents,
    };
    mockRegistry.getEntityDefinition.mockReturnValue(
      new EntityDefinition(TEST_DEFINITION_ID, baseEntityDefData)
    );

    const createdEntity = entityManager.createEntityInstance(
      TEST_DEFINITION_ID,
      { instanceId: MOCK_INSTANCE_ID, componentOverrides: instanceOverrides }
    );

    if (!createdEntity) {
      throw new Error(
        `Failed to create test entity instance for definition ${TEST_DEFINITION_ID}`
      );
    }
    // Clear mocks that might have been called during createEntityInstance
    mockLogger.debug.mockClear();
    mockValidator.validate.mockClear(); // Potentially called during injectDefaultComponents
    mockSpatialIndex.addEntity.mockClear();
    mockLogger.info.mockClear();
    mockEventDispatcher.dispatch.mockClear(); // Clear after entity creation
  };

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
    jest.clearAllMocks(); // Clear mocks before each test setup
  });

  afterEach(() => {
    entityManager.clearAll();
    // testEntityInstance = null; // No longer needed
    jest.clearAllMocks(); // Clear all mocks after each test
  });

  it('Success Case (Remove Non-Position Component): should remove component, return true, dispatch event, and NOT expect direct spatial index call', () => {
    // Setup: NAME as override, HEALTH as override (or on def, but override for this test ensures it exists if needed)
    // Definition is empty for this test's specific needs regarding NAME.
    setupBaseEntity(
      {
        [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME },
        [COMPONENT_TYPE_ID_HEALTH]: { ...COMPONENT_DATA_HEALTH },
      },
      {} // No components on definition relevant to removal test for NAME
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME, true)
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
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME, true)
    ).toBe(false); // NAME override gone, definition was empty for NAME
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_HEALTH)
    ).toBe(true); // HEALTH override still there

    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled(); // Still valid as non-position shouldn't affect it

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      { entity: entityInstance, componentTypeId: COMPONENT_TYPE_ID_NAME }
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    const debugCalls = mockLogger.debug.mock.calls.filter(call => call[0].startsWith('EntityManager.removeComponent: Component override'));
    expect(debugCalls.length).toBe(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `EntityManager.removeComponent: Component override '${COMPONENT_TYPE_ID_NAME}' removed from entity '${MOCK_INSTANCE_ID}'.`
    );
  });

  it('Success Case (Remove Position Component): should remove component, return true, and dispatch COMPONENT_REMOVED_ID event', () => {
    setupBaseEntity(
      {
        [POSITION_COMPONENT_ID]: { ...POSITION_DATA_WITH_LOCATION },
        [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME },
      },
      {}
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(true);
    expect(
      entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
        ?.locationId
    ).toBe(TEST_LOCATION_ID);

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      POSITION_COMPONENT_ID
    );

    expect(result).toBe(true);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(false);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME, true)
    ).toBe(true);

    // Removed spatial index direct call checks
    // expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    // expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
    //   MOCK_INSTANCE_ID,
    //   TEST_LOCATION_ID
    // );

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      { entity: entityInstance, componentTypeId: POSITION_COMPONENT_ID }
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    
    // Check for the generic component removal log
    const genericLogCall = mockLogger.debug.mock.calls.find(call => 
      call[0] === `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
    );
    expect(genericLogCall).toBeDefined();

    // Ensure the specific spatial index log is NOT present
    const spatialIndexLogCall = mockLogger.debug.mock.calls.find(call =>
      call[0].includes('removed from spatial index')
    );
    expect(spatialIndexLogCall).toBeUndefined();
  });

  it('Success Case (Remove Position Component - No locationId): should remove component, return true, dispatch event, and NOT expect direct spatial index call', () => {
    setupBaseEntity(
      { [POSITION_COMPONENT_ID]: { ...POSITION_DATA_NO_LOCATION } },
      {}
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
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
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(false);

    expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(0); // This was already 0, still valid

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      { entity: entityInstance, componentTypeId: POSITION_COMPONENT_ID }
    );
    
    // Check for the generic component removal log
    const genericLogCall = mockLogger.debug.mock.calls.find(call => 
      call[0] === `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
    );
    expect(genericLogCall).toBeDefined();

    // Ensure the specific log about 'undefined' location is NOT present as a separate call (or adjust if it's part of the generic one)
    const specificUndefinedLogCall = mockLogger.debug.mock.calls.find(call =>
      call[0].includes("Old override location was 'undefined'")
    );
    expect(specificUndefinedLogCall).toBeUndefined();
  });

  it('Success Case (Remove Position Component - Null locationId): should remove component, return true, and dispatch COMPONENT_REMOVED_ID event', () => {
    setupBaseEntity(
      { [POSITION_COMPONENT_ID]: { ...POSITION_DATA_NULL_LOCATION } },
      {}
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(true);
    expect(
      entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
        ?.locationId
    ).toBe(null);

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      POSITION_COMPONENT_ID
    );

    expect(result).toBe(true);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(false);

    // Removed spatial index direct call checks
    // expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
    // expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(
    //   MOCK_INSTANCE_ID,
    //   null
    // );

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_REMOVED_ID,
      { entity: entityInstance, componentTypeId: POSITION_COMPONENT_ID }
    );
    
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // Check for the generic component removal log
    const genericLogCall = mockLogger.debug.mock.calls.find(call => 
      call[0] === `EntityManager.removeComponent: Component override '${POSITION_COMPONENT_ID}' removed from entity '${MOCK_INSTANCE_ID}'.`
    );
    expect(genericLogCall).toBeDefined();
    
    // Ensure the specific spatial index log is NOT present
    const spatialIndexLogCall = mockLogger.debug.mock.calls.find(call =>
      call[0].includes('removed from spatial index') 
    );
    expect(spatialIndexLogCall).toBeUndefined();
  });

  it('Failure Case (Component Not Found - Override): should return false, NOT dispatch event, and log debug if component override does not exist', () => {
    // Setup: NAME on definition, HEALTH as override. Try to remove NAME.
    // removeComponent only acts on overrides. So if NAME is not an override, it logs and returns false.
    setupBaseEntity(
      { [COMPONENT_TYPE_ID_HEALTH]: { ...COMPONENT_DATA_HEALTH } }, // HEALTH is an override
      { [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME } } // NAME is on the definition
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    // Pre-check: NAME is present (from definition), but not as an override
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)
    ).toBe(true);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME, true)
    ).toBe(false); // Not an override

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      COMPONENT_TYPE_ID_NAME // Attempting to remove NAME (which is not an override)
    );

    expect(result).toBe(false);
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)
    ).toBe(true); // NAME (from definition) should still be there
    expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith( // Changed from info to debug
      `EntityManager.removeComponent: Component '${COMPONENT_TYPE_ID_NAME}' not found as an override on entity '${MOCK_INSTANCE_ID}'. Nothing to remove at instance level.` // Updated message
    );
  });

  it('Failure Case (Component Not Found - Definition): should return false, NOT dispatch event, and log debug if component does not exist on definition (and no override)', () => {
    // Setup: Entity has HEALTH as override. Try to remove NON_EXISTENT component.
    setupBaseEntity(
      { [COMPONENT_TYPE_ID_HEALTH]: { ...COMPONENT_DATA_HEALTH } }, // HEALTH is an override
      {} // No components on definition for this test
    );
    const entityInstance = entityManager.getEntityInstance(MOCK_INSTANCE_ID);
    expect(entityInstance).toBeDefined();

    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NON_EXISTENT)
    ).toBe(false); // NON_EXISTENT is not there at all

    const result = entityManager.removeComponent(
      MOCK_INSTANCE_ID,
      COMPONENT_TYPE_ID_NON_EXISTENT
    );

    expect(result).toBe(false);
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith( // Changed from info to debug
      `EntityManager.removeComponent: Component '${COMPONENT_TYPE_ID_NON_EXISTENT}' not found as an override on entity '${MOCK_INSTANCE_ID}'. Nothing to remove at instance level.` // Updated message
    );
  });

  it('Failure Case (Entity Not Found): should throw EntityNotFoundError and NOT dispatch event', () => {
    const nonExistentInstanceId = 'ghost-instance-uuid';

    // Assert that the specific error is thrown
    expect(() =>
      entityManager.removeComponent(
        nonExistentInstanceId,
        COMPONENT_TYPE_ID_NAME
      )
    ).toThrow(EntityNotFoundError);

    // Optional: check the message and properties of the thrown error
    expect(() =>
      entityManager.removeComponent(
        nonExistentInstanceId,
        COMPONENT_TYPE_ID_NAME
      )
    ).toThrow(new EntityNotFoundError(nonExistentInstanceId));

    // Verify side effects did not happen
    expect(mockLogger.error).toHaveBeenCalledWith(
      `EntityManager.removeComponent: Entity not found with ID: '${nonExistentInstanceId}'. Cannot remove component '${COMPONENT_TYPE_ID_NAME}'.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('Failure Case (Invalid but existing-format Instance ID): should throw EntityNotFoundError, NOT dispatch event, and log error', () => {
    const invalidInstanceId = '###INVALID_ID###';
    mockLogger.warn.mockClear();

    // Assert that the specific error is thrown
    expect(() =>
      entityManager.removeComponent(invalidInstanceId, COMPONENT_TYPE_ID_NAME)
    ).toThrow(EntityNotFoundError);

    // Verify side effects did not happen
    expect(mockLogger.error).toHaveBeenCalledWith(
      `EntityManager.removeComponent: Entity not found with ID: '${invalidInstanceId}'. Cannot remove component '${COMPONENT_TYPE_ID_NAME}'.`
    );
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    { id: null, idStr: 'null' },
    { id: undefined, idStr: 'undefined' },
    { id: '', idStr: '' },
    { id: '   ', idStr: '   ' }, // Whitespace-only string
  ])(
    'Failure Case (Invalid Component Type ID - $idStr): should log warning and return false',
    ({ id, idStr }) => {
      setupBaseEntity({ [COMPONENT_TYPE_ID_NAME]: { ...COMPONENT_DATA_NAME } }); // Ensure entity exists
      mockLogger.warn.mockClear();
      mockLogger.debug.mockClear();

      const result = entityManager.removeComponent(MOCK_INSTANCE_ID, id);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `EntityManager.removeComponent: Invalid componentTypeId: '${idStr}' for entity '${MOCK_INSTANCE_ID}'`
      );
      expect(mockLogger.debug).not.toHaveBeenCalled(); // Should not reach the "not found as override" debug log
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    }
  );
});