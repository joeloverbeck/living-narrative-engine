// tests/entities/entityManager.removeComponent.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
// Entity import might not be directly needed if we only interact via EntityManager
// import Entity from '../../src/entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js";

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
    // Add other methods if EntityManager constructor or tested methods need them
});

const createMockSchemaValidator = () => ({
    validate: jest.fn(() => ({isValid: true})), // Default to valid for most tests
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
const COMPONENT_DATA_NAME = {name: 'Test Dummy'};
const COMPONENT_DATA_HEALTH = {current: 50, max: 100};
const TEST_LOCATION_ID = 'zone:test-area';
const POSITION_DATA_WITH_LOCATION = {x: 1, y: 2, locationId: TEST_LOCATION_ID};
const POSITION_DATA_NO_LOCATION = {x: 5, y: 5}; // locationId will be undefined
const POSITION_DATA_NULL_LOCATION = {x: 6, y: 6, locationId: null};

// --- Test Suite ---
describe('EntityManager.removeComponent', () => {
    let mockRegistry;
    let mockValidator;
    let mockLogger;
    let mockSpatialIndex;
    let entityManager;
    let testEntityInstance; // To hold the entity instance

    const setupBaseEntity = (includePosition = false, positionData = POSITION_DATA_WITH_LOCATION) => {
        const components = {
            [COMPONENT_TYPE_ID_NAME]: {...COMPONENT_DATA_NAME},
            [COMPONENT_TYPE_ID_HEALTH]: {...COMPONENT_DATA_HEALTH},
        };
        if (includePosition) {
            components[POSITION_COMPONENT_ID] = {...positionData};
        }

        const baseEntityDef = {
            id: TEST_DEFINITION_ID, // The definition has its own ID
            name: 'Base Test Entity Def',
            components: components,
        };
        mockRegistry.getEntityDefinition.mockReturnValue(baseEntityDef);

        // Create instance using definitionId and a mock instanceId
        // The second argument is the instanceId.
        testEntityInstance = entityManager.createEntityInstance(TEST_DEFINITION_ID, MOCK_INSTANCE_ID);

        if (!testEntityInstance) {
            throw new Error(`Failed to create test entity instance for definition ${TEST_DEFINITION_ID}`);
        }

        // Clear mocks related to createEntityInstance if they might interfere with assertions for removeComponent
        mockSpatialIndex.addEntity.mockClear(); // Called during createEntityInstance
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
    };

    beforeEach(() => {
        mockRegistry = createMockDataRegistry();
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        mockSpatialIndex = createMockSpatialIndexManager();
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);
        jest.clearAllMocks(); // Clear mocks before each test setup
    });

    afterEach(() => {
        entityManager.clearAll();
        testEntityInstance = null;
    });


    it('Success Case (Remove Non-Position Component): should remove component, return true, and NOT call spatial index remove', () => {
        setupBaseEntity(false);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true);

        const result = entityManager.removeComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME);

        expect(result).toBe(true);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(false);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_HEALTH)).toBe(true);
        // If testEntityInstance is an Entity object, this check is also good:
        expect(testEntityInstance.hasComponent(COMPONENT_TYPE_ID_NAME)).toBe(false);


        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${COMPONENT_TYPE_ID_NAME}' from entity '${MOCK_INSTANCE_ID}'.`));
    });

    it('Success Case (Remove Position Component): should remove component, return true, and call spatial index remove with old locationId', () => {
        setupBaseEntity(true, POSITION_DATA_WITH_LOCATION);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(true);
        expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)?.locationId).toBe(TEST_LOCATION_ID);

        const result = entityManager.removeComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID);

        expect(result).toBe(true);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(false);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true);

        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(MOCK_INSTANCE_ID, TEST_LOCATION_ID);

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${MOCK_INSTANCE_ID}. Old location was ${TEST_LOCATION_ID}.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed component '${POSITION_COMPONENT_ID}' from entity '${MOCK_INSTANCE_ID}'.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${MOCK_INSTANCE_ID} removal from location ${TEST_LOCATION_ID}.`));
    });

    it('Success Case (Remove Position Component - No locationId): should remove component, return true, and call spatial index remove with undefined locationId', () => {
        setupBaseEntity(true, POSITION_DATA_NO_LOCATION);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(true);
        expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)?.locationId).toBeUndefined();

        const result = entityManager.removeComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID);

        expect(result).toBe(true);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(false);

        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(MOCK_INSTANCE_ID, undefined);

        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${MOCK_INSTANCE_ID}. Old location was null/undefined.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${MOCK_INSTANCE_ID} removal from location null/undefined.`));
    });

    it('Success Case (Remove Position Component - Null locationId): should remove component, return true, and call spatial index remove with null locationId', () => {
        setupBaseEntity(true, POSITION_DATA_NULL_LOCATION);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(true);
        expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)?.locationId).toBeNull();

        const result = entityManager.removeComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID);

        expect(result).toBe(true);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(false);

        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledTimes(1);
        expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(MOCK_INSTANCE_ID, null);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removing position component from entity ${MOCK_INSTANCE_ID}. Old location was null/undefined.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Updated spatial index for entity ${MOCK_INSTANCE_ID} removal from location null/undefined.`));
    });

    it('Failure Case (Entity Not Found): should return false, log warning, and NOT call spatial index remove', () => {
        const nonExistentInstanceId = 'ghost-instance-uuid';
        // setupBaseEntity(); // Ensure EntityManager isn't empty and has some other entity

        const result = entityManager.removeComponent(nonExistentInstanceId, COMPONENT_TYPE_ID_NAME);

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Entity not found with ID: ${nonExistentInstanceId}. Cannot remove component.`));
        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
    });

    it('Failure Case (Component Not Found on Entity): should return false and NOT call spatial index remove', () => {
        setupBaseEntity(true, POSITION_DATA_WITH_LOCATION);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NON_EXISTENT)).toBe(false);

        const result = entityManager.removeComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NON_EXISTENT);

        expect(result).toBe(false);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, COMPONENT_TYPE_ID_NAME)).toBe(true);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(true);

        expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component '${COMPONENT_TYPE_ID_NON_EXISTENT}' not found on entity '${MOCK_INSTANCE_ID}'. Nothing removed.`));
    });
});
