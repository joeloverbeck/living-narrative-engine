// tests/entities/entityManager.addComponent.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
// Entity import might not be needed if only interacting via EntityManager
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js";

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

// --- Constants ---
const TEST_DEFINITION_ID = 'test-def-for-addcomponent'; // Represents the definition ID
const MOCK_INSTANCE_ID = 'instance-uuid-for-addcomponent-test'; // Predictable instance ID for tests

const INITIAL_COMPONENT_TYPE_ID = 'core:name';
const INITIAL_COMPONENT_DATA = {name: 'Test Dummy'};
const NEW_COMPONENT_TYPE_ID = 'core:health';
const NEW_COMPONENT_DATA = {current: 100, max: 100};
const UPDATED_COMPONENT_DATA = {name: 'Updated Dummy'};

const INITIAL_LOCATION_ID = 'zone:start-addcomponent';
const NEW_LOCATION_ID = 'zone:target-addcomponent';
const POSITION_DATA_INITIAL = {x: 1, y: 2, locationId: INITIAL_LOCATION_ID};
const POSITION_DATA_NEW = {x: 10, y: 20, locationId: NEW_LOCATION_ID};
const POSITION_DATA_NO_LOCATION = {x: 5, y: 5}; // locationId will be undefined
const POSITION_DATA_NULL_LOCATION = {x: 6, y: 6, locationId: null};


// --- Test Suite ---
describe('EntityManager.addComponent', () => {
    let mockRegistry;
    let mockValidator;
    let mockLogger;
    let mockSpatialIndex;
    let entityManager;
    let testEntityInstance;

    const setupBaseEntity = (includePosition = false, initialPositionData = POSITION_DATA_INITIAL) => {
        const components = {[INITIAL_COMPONENT_TYPE_ID]: {...INITIAL_COMPONENT_DATA}};
        if (includePosition) {
            components[POSITION_COMPONENT_ID] = {...initialPositionData};
        }
        const baseEntityDef = {
            id: TEST_DEFINITION_ID,
            name: 'Base Test Entity Def for AddComponent',
            components: components,
        };
        mockRegistry.getEntityDefinition.mockReturnValue(baseEntityDef);

        // Create instance using definitionId and the mock instanceId
        testEntityInstance = entityManager.createEntityInstance(TEST_DEFINITION_ID, MOCK_INSTANCE_ID);

        if (!testEntityInstance) {
            throw new Error(`Test setup failed: Entity could not be created for definition ${TEST_DEFINITION_ID} and instance ${MOCK_INSTANCE_ID}`);
        }

        // Clear mocks that might have been called during createEntityInstance
        mockValidator.validate.mockClear(); // Clear any validation calls from initial component adds
        mockSpatialIndex.addEntity.mockClear();
        mockSpatialIndex.updateEntityLocation.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
    };

    beforeEach(() => {
        mockRegistry = createMockDataRegistry();
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        mockSpatialIndex = createMockSpatialIndexManager();
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);
        jest.clearAllMocks();

        // Default setup for most tests in this suite: an entity with an initial component but no position.
        setupBaseEntity(false);
        mockValidator.validate.mockReturnValue({isValid: true}); // Default to valid for success cases
    });

    afterEach(() => {
        entityManager.clearAll();
        testEntityInstance = null;
    });


    it('Success Case (New Component): should add a new component, return true, and NOT update spatial index', () => {
        const result = entityManager.addComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID, {...NEW_COMPONENT_DATA});

        expect(result).toBe(true);
        const addedData = entityManager.getComponentData(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID);
        expect(addedData).toEqual(NEW_COMPONENT_DATA);
        expect(addedData).not.toBe(NEW_COMPONENT_DATA); // Cloned
        expect(testEntityInstance.hasComponent(NEW_COMPONENT_TYPE_ID)).toBe(true);
        expect(testEntityInstance.getComponentData(NEW_COMPONENT_TYPE_ID)).toEqual(NEW_COMPONENT_DATA);

        expect(mockValidator.validate).toHaveBeenCalledWith(NEW_COMPONENT_TYPE_ID, NEW_COMPONENT_DATA);
        expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully added/updated component '${NEW_COMPONENT_TYPE_ID}' data on entity '${MOCK_INSTANCE_ID}'.`));
    });

    it('Success Case (Update Component): should update existing component data, return true, and NOT update spatial index', () => {
        const initialDataCheck = entityManager.getComponentData(MOCK_INSTANCE_ID, INITIAL_COMPONENT_TYPE_ID);
        expect(initialDataCheck).toEqual(INITIAL_COMPONENT_DATA); // Pre-condition

        const result = entityManager.addComponent(MOCK_INSTANCE_ID, INITIAL_COMPONENT_TYPE_ID, {...UPDATED_COMPONENT_DATA});

        expect(result).toBe(true);
        const updatedData = entityManager.getComponentData(MOCK_INSTANCE_ID, INITIAL_COMPONENT_TYPE_ID);
        expect(updatedData).toEqual(UPDATED_COMPONENT_DATA);
        expect(updatedData).not.toBe(UPDATED_COMPONENT_DATA); // Cloned
        expect(updatedData).not.toEqual(INITIAL_COMPONENT_DATA);

        expect(mockValidator.validate).toHaveBeenCalledWith(INITIAL_COMPONENT_TYPE_ID, UPDATED_COMPONENT_DATA);
        expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully added/updated component '${INITIAL_COMPONENT_TYPE_ID}' data on entity '${MOCK_INSTANCE_ID}'.`));
    });

    describe('Position Component Handling', () => {
        beforeEach(() => {
            // For this nested describe, ensure entity is recreated without initial position,
            // so we are testing ADDING position component, not updating an existing one unless specified.
            entityManager.activeEntities.clear(); // Clear entity from outer beforeEach
            mockSpatialIndex.clearIndex();
            jest.clearAllMocks(); // Clear mocks again for this specific context
            setupBaseEntity(false); // Entity with only 'core:name'
            mockValidator.validate.mockReturnValue({isValid: true}); // Default to valid
        });

        it('Success Case (Add Position Component): should add position, return true, and update spatial index with undefined oldLocationId', () => {
            expect(testEntityInstance.hasComponent(POSITION_COMPONENT_ID)).toBe(false);

            const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NEW});

            expect(result).toBe(true);
            expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NEW);
            expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, undefined, NEW_LOCATION_ID);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${MOCK_INSTANCE_ID} was null/undefined.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${MOCK_INSTANCE_ID} is ${NEW_LOCATION_ID}.`));
        });

        it('Success Case (Add Position Component - No LocationId): should add position, return true, update spatial index with undefined old/new locationId', () => {
            const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NO_LOCATION});

            expect(result).toBe(true);
            expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NO_LOCATION);
            expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, undefined, undefined);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${MOCK_INSTANCE_ID} is null/undefined.`));
        });

        it('Success Case (Add Position Component - Null LocationId): should add position, return true, update spatial index with undefined old and null new locationId', () => {
            const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NULL_LOCATION});

            expect(result).toBe(true);
            expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NULL_LOCATION);
            expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, undefined, null);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${MOCK_INSTANCE_ID} is null/undefined.`));
        });

        describe('With Initial Position Component', () => {
            beforeEach(() => {
                entityManager.activeEntities.clear();
                mockSpatialIndex.clearIndex();
                jest.clearAllMocks();
                setupBaseEntity(true, POSITION_DATA_INITIAL); // Entity has 'core:name' and 'core:position'
                mockValidator.validate.mockReturnValue({isValid: true});
                // Clear mocks from setupBaseEntity's createEntityInstance call
                mockSpatialIndex.addEntity.mockClear();
                mockSpatialIndex.updateEntityLocation.mockClear();
                mockLogger.debug.mockClear();
            });

            it('Success Case (Update Position Component): should update position, return true, and update spatial index with old and new locationIds', () => {
                const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NEW});

                expect(result).toBe(true);
                expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NEW);
                expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, INITIAL_LOCATION_ID, NEW_LOCATION_ID);
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Old location for entity ${MOCK_INSTANCE_ID} was ${INITIAL_LOCATION_ID}.`));
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`New location for entity ${MOCK_INSTANCE_ID} is ${NEW_LOCATION_ID}.`));
            });

            it('Success Case (Update Position Component - To Null LocationId): should update position, return true, update spatial index with old and null new locationId', () => {
                const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NULL_LOCATION});

                expect(result).toBe(true);
                expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NULL_LOCATION);
                expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, INITIAL_LOCATION_ID, null);
            });

            it('Success Case (Update Position Component - To No LocationId): should update position, return true, update spatial index with old and undefined new locationId', () => {
                const result = entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, {...POSITION_DATA_NO_LOCATION});
                expect(result).toBe(true);
                expect(entityManager.getComponentData(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toEqual(POSITION_DATA_NO_LOCATION);
                expect(mockSpatialIndex.updateEntityLocation).toHaveBeenCalledWith(MOCK_INSTANCE_ID, INITIAL_LOCATION_ID, undefined);
            });
        });
    });

    it('Failure Case (Entity Not Found): should throw Error and log error', () => {
        const nonExistentInstanceId = 'ghost-instance-uuid';
        expect(() => {
            entityManager.addComponent(nonExistentInstanceId, NEW_COMPONENT_TYPE_ID, {...NEW_COMPONENT_DATA});
        }).toThrow(`EntityManager.addComponent: Entity not found with ID: ${nonExistentInstanceId}`);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Entity not found with ID: ${nonExistentInstanceId}`));
        expect(mockValidator.validate).not.toHaveBeenCalled();
    });

    it('Failure Case (Validation Fails): should throw Error, log error with details, NOT add/update component, and NOT update spatial index', () => {
        const validationErrors = [{field: 'data.current', message: 'must be a number'}];
        mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});
        const invalidHealthData = {current: 'one hundred', max: 100}; // Data that would fail validation

        // Ensure the component does not exist initially or has different data
        entityManager.removeComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID); // Ensure it's not there

        expect(() => {
            entityManager.addComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID, invalidHealthData);
        }).toThrow(`EntityManager.addComponent: Component data validation failed for type '${NEW_COMPONENT_TYPE_ID}' on entity '${MOCK_INSTANCE_ID}'.`);

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        const expectedErrorDetails = JSON.stringify(validationErrors, null, 2);
        expect(mockLogger.error).toHaveBeenCalledWith(
            `EntityManager.addComponent: Component data validation failed for type '${NEW_COMPONENT_TYPE_ID}' on entity '${MOCK_INSTANCE_ID}'. Errors:\n${expectedErrorDetails}`
        );
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, NEW_COMPONENT_TYPE_ID)).toBe(false);
        expect(mockValidator.validate).toHaveBeenCalledWith(NEW_COMPONENT_TYPE_ID, invalidHealthData);
        expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
    });

    it('Failure Case (Validation Fails - Position): should throw, log, NOT add/update, and NOT update spatial index', () => {
        const validationErrors = [{field: 'data.locationId', message: 'must be a string'}];
        mockValidator.validate.mockReturnValue({isValid: false, errors: validationErrors});
        const invalidPositionData = {x: 1, y: 1, locationId: 12345};

        entityManager.removeComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID); // Ensure not there

        expect(() => {
            entityManager.addComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID, invalidPositionData);
        }).toThrow(`EntityManager.addComponent: Component data validation failed for type '${POSITION_COMPONENT_ID}' on entity '${MOCK_INSTANCE_ID}'.`);

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(entityManager.hasComponent(MOCK_INSTANCE_ID, POSITION_COMPONENT_ID)).toBe(false);
        expect(mockValidator.validate).toHaveBeenCalledWith(POSITION_COMPONENT_ID, invalidPositionData);
        expect(mockSpatialIndex.updateEntityLocation).not.toHaveBeenCalled();
    });
});