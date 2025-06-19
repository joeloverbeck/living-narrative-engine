// tests/entities/entityManager.addComponent.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
// Entity import might not be needed if only interacting via EntityManager
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { EntityNotFoundError } from '../../src/errors/entityNotFoundError.js';
import { COMPONENT_ADDED_ID } from '../../src/constants/eventIds.js';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn(),
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
const TEST_DEFINITION_ID = 'test-def-for-addcomponent'; // Represents the definition ID
const MOCK_INSTANCE_ID = 'instance-uuid-for-addcomponent-test'; // Predictable instance ID for tests

const INITIAL_COMPONENT_TYPE_ID = 'core:name';
const INITIAL_COMPONENT_DATA = { name: 'Test Dummy' };
const NEW_COMPONENT_TYPE_ID = 'core:health';
const NEW_COMPONENT_DATA = { current: 100, max: 100 };
const UPDATED_COMPONENT_DATA = { name: 'Updated Dummy' };

const INITIAL_LOCATION_ID = 'zone:start-addcomponent';
const NEW_LOCATION_ID = 'zone:target-addcomponent';
const POSITION_DATA_INITIAL = { x: 1, y: 2, locationId: INITIAL_LOCATION_ID };
const POSITION_DATA_NEW = { x: 10, y: 20, locationId: NEW_LOCATION_ID };
const POSITION_DATA_NO_LOCATION = { x: 5, y: 5 }; // locationId will be undefined
const POSITION_DATA_NULL_LOCATION = { x: 6, y: 6, locationId: null };

// --- Test Suite ---
describe('EntityManager.addComponent', () => {
  let mockRegistry;
  let mockValidator;
  let mockLogger;
  let mockSpatialIndex;
  let entityManager;
  let testEntityInstance;
  let mockEventDispatcher;

  const setupBaseEntity = (
    includePosition = false,
    initialPositionData = POSITION_DATA_INITIAL
  ) => {
    const components = {
      [INITIAL_COMPONENT_TYPE_ID]: { ...INITIAL_COMPONENT_DATA },
    };
    if (includePosition) {
      components[POSITION_COMPONENT_ID] = { ...initialPositionData };
    }
    const baseEntityDefData = {
      description: 'Base Test Entity Def for AddComponent',
      components: components,
    };
    mockRegistry.getEntityDefinition.mockReturnValue(
      new EntityDefinition(TEST_DEFINITION_ID, baseEntityDefData)
    );

    // Create instance using definitionId and the mock instanceId
    // FIXED: The second argument must be an options object with an instanceId property.
    testEntityInstance = entityManager.createEntityInstance(
      TEST_DEFINITION_ID,
      { instanceId: MOCK_INSTANCE_ID }
    );

    if (!testEntityInstance) {
      throw new Error(
        `Test setup failed: Entity could not be created for definition ${TEST_DEFINITION_ID} and instance ${MOCK_INSTANCE_ID}`
      );
    }

    // Clear mocks that might have been called during createEntityInstance
    mockValidator.validate.mockClear(); // Clear any validation calls from initial component adds
    mockSpatialIndex.addEntity.mockClear();
    mockSpatialIndex.updateEntityLocation.mockClear();
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
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
    jest.clearAllMocks();

    // Default setup for most tests in this suite: an entity with an initial component but no position.
    setupBaseEntity(false);
    mockValidator.validate.mockReturnValue({ isValid: true }); // Default to valid for success cases
  });

  afterEach(() => {
    entityManager.clearAll();
    testEntityInstance = null;
  });

  it('Success Case (New Component): should add a new component, return true, dispatch event, and NOT expect direct spatial index call', () => {
    const dataToAdd = { ...NEW_COMPONENT_DATA };
    const result = entityManager.addComponent(
      MOCK_INSTANCE_ID,
      NEW_COMPONENT_TYPE_ID,
      dataToAdd
    );

    expect(result).toBe(true);
    const addedData = entityManager.getComponentData(
      MOCK_INSTANCE_ID,
      NEW_COMPONENT_TYPE_ID
    );
    expect(addedData).toEqual(NEW_COMPONENT_DATA);
    expect(addedData).not.toBe(NEW_COMPONENT_DATA); // Cloned
    expect(testEntityInstance.hasComponent(NEW_COMPONENT_TYPE_ID)).toBe(true);
    expect(testEntityInstance.getComponentData(NEW_COMPONENT_TYPE_ID)).toEqual(
      NEW_COMPONENT_DATA
    );

    expect(mockValidator.validate).toHaveBeenCalledWith(
      NEW_COMPONENT_TYPE_ID,
      expect.any(Object) // The exact object passed to validate is a clone
    );
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_ADDED_ID,
      {
        entity: testEntityInstance,
        componentTypeId: NEW_COMPONENT_TYPE_ID,
        componentData: dataToAdd,
      }
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Successfully added/updated component '${NEW_COMPONENT_TYPE_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
    );
  });

  it('Success Case (Update Component): should update existing component data, return true, dispatch event, and NOT expect direct spatial index call', () => {
    const initialDataCheck = entityManager.getComponentData(
      MOCK_INSTANCE_ID,
      INITIAL_COMPONENT_TYPE_ID
    );
    expect(initialDataCheck).toEqual(INITIAL_COMPONENT_DATA); // Pre-condition

    const dataToUpdate = { ...UPDATED_COMPONENT_DATA };
    const result = entityManager.addComponent(
      MOCK_INSTANCE_ID,
      INITIAL_COMPONENT_TYPE_ID,
      dataToUpdate
    );

    expect(result).toBe(true);
    const updatedData = entityManager.getComponentData(
      MOCK_INSTANCE_ID,
      INITIAL_COMPONENT_TYPE_ID
    );
    expect(updatedData).toEqual(UPDATED_COMPONENT_DATA);
    expect(updatedData).not.toBe(UPDATED_COMPONENT_DATA); // Cloned
    expect(updatedData).not.toEqual(INITIAL_COMPONENT_DATA);

    expect(mockValidator.validate).toHaveBeenCalledWith(
      INITIAL_COMPONENT_TYPE_ID,
      expect.any(Object) // The exact object passed to validate is a clone
    );
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();

    expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_ADDED_ID,
      {
        entity: testEntityInstance,
        componentTypeId: INITIAL_COMPONENT_TYPE_ID,
        componentData: dataToUpdate,
      }
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Successfully added/updated component '${INITIAL_COMPONENT_TYPE_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
    );
  });

  describe('Position Component Handling', () => {
    beforeEach(() => {
      // For this nested describe, ensure entity is recreated without initial position,
      // so we are testing ADDING position component, not updating an existing one unless specified.
      entityManager.clearAll(); // Clears active entities AND definition cache
      // mockSpatialIndex.clearIndex(); // Old, can be removed if not used by any test in this block
      jest.clearAllMocks(); // Clear mocks again for this specific context
      setupBaseEntity(false); // Entity with only 'core:name'
      mockValidator.validate.mockReturnValue({ isValid: true }); // Default to valid
      mockEventDispatcher.dispatch.mockClear(); // Clear again after setup
    });

    it('Success Case (Add Position Component): should add position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
      expect(testEntityInstance.hasComponent(POSITION_COMPONENT_ID)).toBe(
        false
      );
      const positionDataForEvent = { ...POSITION_DATA_NEW };
      const result = entityManager.addComponent(
        MOCK_INSTANCE_ID,
        POSITION_COMPONENT_ID,
        positionDataForEvent
      );

      expect(result).toBe(true);
      expect(
        entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
      ).toEqual(POSITION_DATA_NEW);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: testEntityInstance,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: positionDataForEvent,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
      );
    });

    it('Success Case (Add Position Component - No LocationId): should add position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
      const positionDataForEvent = { ...POSITION_DATA_NO_LOCATION };
      const result = entityManager.addComponent(
        MOCK_INSTANCE_ID,
        POSITION_COMPONENT_ID,
        positionDataForEvent
      );

      expect(result).toBe(true);
      expect(
        entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
      ).toEqual(POSITION_DATA_NO_LOCATION);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: testEntityInstance,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: positionDataForEvent,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
      );
    });

    it('Success Case (Add Position Component - Null LocationId): should add position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
      const positionDataForEvent = { ...POSITION_DATA_NULL_LOCATION };
      const result = entityManager.addComponent(
        MOCK_INSTANCE_ID,
        POSITION_COMPONENT_ID,
        positionDataForEvent
      );

      expect(result).toBe(true);
      expect(
        entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)
      ).toEqual(POSITION_DATA_NULL_LOCATION);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: testEntityInstance,
          componentTypeId: POSITION_COMPONENT_ID,
          componentData: positionDataForEvent,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
      );
    });

    describe('With Initial Position Component', () => {
      beforeEach(() => {
        entityManager.clearAll(); // Clears active entities AND definition cache
        // mockSpatialIndex.clearIndex(); // Old
        jest.clearAllMocks(); // Clears all mocks.
        setupBaseEntity(true, POSITION_DATA_INITIAL); // Entity WITH 'position'.
        mockValidator.validate.mockReturnValue({ isValid: true });
        mockEventDispatcher.dispatch.mockClear();
      });

      it('Success Case (Update Position Component): should update position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
        expect(
          entityManager.getComponentData(
            MOCK_INSTANCE_ID,
            POSITION_COMPONENT_ID
          )?.locationId
        ).toBe(INITIAL_LOCATION_ID);

        const positionDataForEvent = { ...POSITION_DATA_NEW };
        const result = entityManager.addComponent(
          MOCK_INSTANCE_ID,
          POSITION_COMPONENT_ID,
          positionDataForEvent
        );

        expect(result).toBe(true);
        expect(
          entityManager.getComponentData(
            MOCK_INSTANCE_ID,
            POSITION_COMPONENT_ID
          )
        ).toEqual(POSITION_DATA_NEW);

        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          {
            entity: testEntityInstance,
            componentTypeId: POSITION_COMPONENT_ID,
            componentData: positionDataForEvent,
          }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
        );
      });

      it('Success Case (Update Position Component - To Null LocationId): should update position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
        const positionDataForEvent = { ...POSITION_DATA_NULL_LOCATION };
        const result = entityManager.addComponent(
          MOCK_INSTANCE_ID,
          POSITION_COMPONENT_ID,
          positionDataForEvent
        );

        expect(result).toBe(true);
        expect(
          entityManager.getComponentData(
            MOCK_INSTANCE_ID,
            POSITION_COMPONENT_ID
          )
        ).toEqual(POSITION_DATA_NULL_LOCATION);

        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          {
            entity: testEntityInstance,
            componentTypeId: POSITION_COMPONENT_ID,
            componentData: positionDataForEvent,
          }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
        );
      });

      it('Success Case (Update Position Component - To No LocationId): should update position, return true, and dispatch COMPONENT_ADDED_ID event', () => {
        const positionDataForEvent = { ...POSITION_DATA_NO_LOCATION };
        const result = entityManager.addComponent(
          MOCK_INSTANCE_ID,
          POSITION_COMPONENT_ID,
          positionDataForEvent
        );

        expect(result).toBe(true);
        expect(
          entityManager.getComponentData(
            MOCK_INSTANCE_ID,
            POSITION_COMPONENT_ID
          )
        ).toEqual(POSITION_DATA_NO_LOCATION);

        expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
          COMPONENT_ADDED_ID,
          {
            entity: testEntityInstance,
            componentTypeId: POSITION_COMPONENT_ID,
            componentData: positionDataForEvent,
          }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Successfully added/updated component '${POSITION_COMPONENT_ID}' data on entity '${MOCK_INSTANCE_ID}'.`
        );
      });
    });
  });

  it('Failure Case (Entity Not Found): should throw EntityNotFoundError and log error', () => {
    const nonExistentInstanceId = 'ghost-instance-uuid';
    const componentTypeId = 'core:health';

    expect(() => {
      entityManager.addComponent(nonExistentInstanceId, componentTypeId, {
        ...NEW_COMPONENT_DATA,
      });
    }).toThrow(EntityNotFoundError);

    // Also check for the correct error message from the new error type
    expect(() => {
      entityManager.addComponent(nonExistentInstanceId, componentTypeId, {
        ...NEW_COMPONENT_DATA,
      });
    }).toThrow(`Entity instance not found: '${nonExistentInstanceId}'`);

    // Verify the logger was still called with the more detailed internal message
    expect(mockLogger.error).toHaveBeenCalledWith(
      `EntityManager.addComponent: Entity not found with ID: ${nonExistentInstanceId}`,
      { instanceId: nonExistentInstanceId, componentTypeId: componentTypeId }
    );
    expect(mockValidator.validate).not.toHaveBeenCalled();
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('Failure Case (Validation Fails): should throw Error, log error with details, NOT add/update component, and NOT dispatch event', () => {
    const validationErrors = [
      { field: 'data.current', message: 'must be a number' },
    ];
    mockValidator.validate.mockReturnValue({
      isValid: false,
      errors: validationErrors,
    });
    const invalidHealthData = { current: 'one hundred', max: 100 }; // Data that would fail validation
    const expectedErrorDetails = JSON.stringify(validationErrors, null, 2);

    // Ensure the component does not exist initially or has different data
    entityManager.removeComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID); // Ensure it's not there

    expect(() => {
      entityManager.addComponent(
        MOCK_INSTANCE_ID,
        NEW_COMPONENT_TYPE_ID,
        invalidHealthData
      );
    }).toThrow(
      `addComponent ${NEW_COMPONENT_TYPE_ID} to entity ${MOCK_INSTANCE_ID} Errors:\n${expectedErrorDetails}`
    );

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    // The logger is expected to be called with the exact same message as the error thrown
    expect(mockLogger.error).toHaveBeenCalledWith(
      `addComponent ${NEW_COMPONENT_TYPE_ID} to entity ${MOCK_INSTANCE_ID} Errors:\n${expectedErrorDetails}`
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID, true) // Check override specifically
    ).toBe(false);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      NEW_COMPONENT_TYPE_ID,
      expect.any(Object)
    );
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    // Ensure spatial index was not updated
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
  });

  it('Failure Case (Validation Fails - Position): should throw, log, NOT add/update, NOT dispatch event, and NOT update spatial index', () => {
    const validationErrors = [
      { field: 'data.locationId', message: 'must be a string' },
    ];
    mockValidator.validate.mockReturnValue({
      isValid: false,
      errors: validationErrors,
    });
    const invalidPositionData = { x: 1, y: 1, locationId: 12345 };
    const expectedErrorDetails = JSON.stringify(validationErrors, null, 2);

    entityManager.removeComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID); // Ensure not there

    expect(() => {
      entityManager.addComponent(
        MOCK_INSTANCE_ID,
        POSITION_COMPONENT_ID,
        invalidPositionData
      );
    }).toThrow(
      `addComponent ${POSITION_COMPONENT_ID} to entity ${MOCK_INSTANCE_ID} Errors:\n${expectedErrorDetails}`
    );

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    // The logger is expected to be called with the exact same message as the error thrown
    expect(mockLogger.error).toHaveBeenCalledWith(
      `addComponent ${POSITION_COMPONENT_ID} to entity ${MOCK_INSTANCE_ID} Errors:\n${expectedErrorDetails}`
    );
    expect(
      entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, true)
    ).toBe(false);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      POSITION_COMPONENT_ID,
      expect.any(Object)
    );
    expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
  });
});
