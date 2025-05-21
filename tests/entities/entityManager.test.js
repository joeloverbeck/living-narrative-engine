// tests/entities/entityManager.test.js
// --- FILE START ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js";

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
    validate: jest.fn(() => ({isValid: true})),
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
const MOCK_DEFINITION_ID_MAIN = 'test-def-01';
const MOCK_INSTANCE_ID_PRE_EXISTING = 'existing-instance-uuid-123';

const ACCESS_DEFINITION_ID = 'access-def-99';
const ACCESS_INSTANCE_ID = 'access-instance-uuid-99';

const EXISTING_COMPONENT_ID = 'core:stats';
const EXISTING_COMPONENT_DATA = {hp: 10, mp: 5};
const NON_EXISTENT_COMPONENT_ID = 'core:inventory';
const NON_EXISTENT_ENTITY_INSTANCE_ID = 'ghost-instance-uuid-404';


describe('EntityManager', () => {
    let mockRegistry;
    let mockValidator;
    let mockLogger;
    let mockSpatialIndex;
    let entityManager;
    let accessTestEntity;

    beforeEach(() => {
        mockRegistry = createMockDataRegistry();
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        mockSpatialIndex = createMockSpatialIndexManager();
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);
        jest.clearAllMocks();
        accessTestEntity = null;
    });

    afterEach(() => {
        if (entityManager) {
            entityManager.clearAll();
        }
        accessTestEntity = null;
    });

    // --- 1. Constructor Tests ---
    describe('constructor', () => {
        it('should create an instance successfully with valid dependencies', () => {
            expect(entityManager).toBeInstanceOf(EntityManager);
        });

        const invalidRegistryMissingMethod = {...createMockDataRegistry()};
        delete invalidRegistryMissingMethod.getEntityDefinition;
        const invalidValidatorMissingMethod = {...createMockSchemaValidator()};
        delete invalidValidatorMissingMethod.validate;
        const invalidLoggerMissingMethod = {...createMockLogger()};
        delete invalidLoggerMissingMethod.error; // Example of a missing essential method
        const invalidSpatialMissingMethod = {...createMockSpatialIndexManager()};
        delete invalidSpatialMissingMethod.addEntity; // Example of a missing essential method

        it.each([
            ['IDataRegistry', null, /IDataRegistry instance with getEntityDefinition/],
            ['ISchemaValidator', null, /ISchemaValidator instance with validate/],
            ['ILogger', null, /ILogger instance/],
            ['ISpatialIndexManager', null, /ISpatialIndexManager instance/],
            ['IDataRegistry (missing method)', invalidRegistryMissingMethod, /IDataRegistry instance with getEntityDefinition/],
            ['ISchemaValidator (missing method)', invalidValidatorMissingMethod, /ISchemaValidator instance with validate/],
            ['ILogger (missing method)', invalidLoggerMissingMethod, /ILogger instance/],
            ['ISpatialIndexManager (missing method)', invalidSpatialMissingMethod, /ISpatialIndexManager instance/],
        ])('should throw an Error if %s is missing or invalid (%p)', (depName, invalidDep, expectedError) => {
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
        const testLocationId = 'zone:test-area'; // This would be a definition ID in component data
        const componentDataName = {name: 'Test Dummy'};
        const componentDataPosition = {x: 10, y: 20, locationId: testLocationId};
        const componentDataHealth = {current: 100, max: 100};

        const validDefinitionWithPosition = {
            id: MOCK_DEFINITION_ID_MAIN,
            name: 'Test Entity with Position',
            components: {
                'core:name': {...componentDataName},
                [POSITION_COMPONENT_ID]: {...componentDataPosition},
            },
        };
        const validDefinitionWithoutPosition = {
            id: MOCK_DEFINITION_ID_MAIN,
            name: 'Test Entity without Position',
            components: {'core:name': {...componentDataName}, 'core:health': {...componentDataHealth}},
        };
        const validDefinitionEmptyComponents = {
            id: MOCK_DEFINITION_ID_MAIN, name: 'Test Entity with Empty Components', components: {},
        };
        const validDefinitionNullComponents = {
            id: MOCK_DEFINITION_ID_MAIN, name: 'Test Entity with Null Components', components: null,
        };

        it('Success Case: should create entity, copy components, and add to active map (spatial index deferred)', () => {
            mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithPosition);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(typeof entity.id).toBe('string');
            expect(entity.id).not.toBe(MOCK_DEFINITION_ID_MAIN);
            expect(entity.definitionId).toBe(MOCK_DEFINITION_ID_MAIN);

            expect(entity.hasComponent('core:name')).toBe(true);
            expect(entity.getComponentData('core:name')).toEqual(componentDataName);
            expect(entity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
            expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual(componentDataPosition);

            // VVVVVV MODIFIED VVVVVV
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled(); // No longer called here
            // ^^^^^^ MODIFIED ^^^^^^
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
            expect(entityManager.activeEntities.get(entity.id)).toBe(entity);
            expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(entity);
        });

        it('Success Case (No Position): should create entity, copy components, NOT interact with spatial index', () => {
            mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithoutPosition);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(typeof entity.id).toBe('string');
            expect(entity.definitionId).toBe(MOCK_DEFINITION_ID_MAIN);

            expect(entity.hasComponent('core:name')).toBe(true);
            expect(entity.hasComponent(POSITION_COMPONENT_ID)).toBe(false);
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
            expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(entity);
        });

        it('Success Case (Empty Components): should create entity with no components, NOT interact with spatial index', () => {
            mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionEmptyComponents);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(Array.from(entity.componentTypeIds)).toHaveLength(0);
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
            expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(entity);
        });

        it('Success Case (Null Components): should treat null components as empty, create entity, NOT interact with spatial index', () => {
            mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionNullComponents);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(Array.from(entity.componentTypeIds)).toHaveLength(0);
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
            expect(entityManager.getPrimaryInstanceByDefinitionId(MOCK_DEFINITION_ID_MAIN)).toBe(entity);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("invalid 'components' field"));
        });

        it('Failure Case (Definition Not Found): should return null and log error if definition not found', () => {
            mockRegistry.getEntityDefinition.mockReturnValue(undefined);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeNull();
            // VVVVVV MODIFIED VVVVVV
            expect(mockLogger.error).toHaveBeenCalledWith(`EntityManager.createEntityInstance: Entity definition not found for ID: ${MOCK_DEFINITION_ID_MAIN}`);
            // ^^^^^^ MODIFIED ^^^^^^
            expect(entityManager.activeEntities.size).toBe(0);
        });

        it('Existing Entity (forceNew: false): should return existing instance, NOT call registry or interact with spatial index', () => {
            const existingEntity = new Entity(MOCK_INSTANCE_ID_PRE_EXISTING, MOCK_DEFINITION_ID_MAIN);
            entityManager.activeEntities.set(MOCK_INSTANCE_ID_PRE_EXISTING, existingEntity);
            mockRegistry.getEntityDefinition.mockClear();

            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN, MOCK_INSTANCE_ID_PRE_EXISTING, false);

            expect(entity).toBe(existingEntity);
            expect(mockRegistry.getEntityDefinition).not.toHaveBeenCalled();
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Returning existing instance for ID: ${MOCK_INSTANCE_ID_PRE_EXISTING}`));
        });

        it('Existing Entity (forceNew: true): should create NEW instance, copy components, NOT interact with spatial index directly, NOT modify active map for original', () => {
            const originalEntity = new Entity(MOCK_INSTANCE_ID_PRE_EXISTING, MOCK_DEFINITION_ID_MAIN);
            entityManager.activeEntities.set(MOCK_INSTANCE_ID_PRE_EXISTING, originalEntity);
            mockRegistry.getEntityDefinition.mockReturnValue(validDefinitionWithPosition);

            const newEntity = entityManager.createEntityInstance(validDefinitionWithPosition.id, MOCK_INSTANCE_ID_PRE_EXISTING, true);

            expect(newEntity).toBeInstanceOf(Entity);
            expect(newEntity.id).toBe(MOCK_INSTANCE_ID_PRE_EXISTING);
            expect(newEntity.definitionId).toBe(validDefinitionWithPosition.id);
            expect(newEntity).not.toBe(originalEntity);

            expect(newEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
            // VVVVVV MODIFIED VVVVVV
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled(); // No longer called here
            // ^^^^^^ MODIFIED ^^^^^^
            expect(entityManager.activeEntities.get(MOCK_INSTANCE_ID_PRE_EXISTING)).toBe(originalEntity);
            expect(mockRegistry.getEntityDefinition).toHaveBeenCalledTimes(1);
            expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith(validDefinitionWithPosition.id);
        });

        it.each([
            [null, 'null'],
            [undefined, 'undefined'],
            ['', 'empty string'],
            [123, 'number'],
            [{}, 'object'],
        ])('should return null and log error if definitionId is invalid (%p)', (invalidDefId) => {
            const entity = entityManager.createEntityInstance(invalidDefId);
            expect(entity).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`Invalid definitionId provided: ${invalidDefId}`));
            expect(entityManager.activeEntities.size).toBe(0);
        });

        it('should create entity with position component lacking locationId (spatial index deferred)', () => {
            const definitionMissingLocationId = {
                id: MOCK_DEFINITION_ID_MAIN,
                components: {[POSITION_COMPONENT_ID]: {x: 5, y: 5}} // No locationId
            };
            mockRegistry.getEntityDefinition.mockReturnValue(definitionMissingLocationId);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual({x: 5, y: 5});
            // VVVVVV MODIFIED VVVVVV
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            // The specific debug log about invalid/null locationId for spatial index was part of the addEntity logic,
            // which is now deferred. So, we don't expect that specific log from createEntityInstance.
            // ^^^^^^ MODIFIED ^^^^^^
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
        });

        it('should create entity with position component having null locationId (spatial index deferred)', () => {
            const definitionNullLocationId = {
                id: MOCK_DEFINITION_ID_MAIN,
                components: {[POSITION_COMPONENT_ID]: {x: 5, y: 5, locationId: null}}
            };
            mockRegistry.getEntityDefinition.mockReturnValue(definitionNullLocationId);
            const entity = entityManager.createEntityInstance(MOCK_DEFINITION_ID_MAIN);

            expect(entity).toBeInstanceOf(Entity);
            expect(entity.getComponentData(POSITION_COMPONENT_ID)).toEqual({x: 5, y: 5, locationId: null});
            // VVVVVV MODIFIED VVVVVV
            expect(mockSpatialIndex.addEntity).not.toHaveBeenCalled();
            // Similar to above, the debug log related to spatial index is deferred.
            // ^^^^^^ MODIFIED ^^^^^^
            expect(entityManager.activeEntities.has(entity.id)).toBe(true);
        });
    });

    // --- getComponentData / hasComponent Tests ---
    describe('getComponentData and hasComponent (Access Methods)', () => {
        beforeEach(() => {
            accessTestEntity = new Entity(ACCESS_INSTANCE_ID, ACCESS_DEFINITION_ID);
            accessTestEntity.addComponent(EXISTING_COMPONENT_ID, {...EXISTING_COMPONENT_DATA});
            entityManager.activeEntities.set(ACCESS_INSTANCE_ID, accessTestEntity);
        });

        it('should return the component data object for an existing component on an existing entity', () => {
            const data = entityManager.getComponentData(ACCESS_INSTANCE_ID, EXISTING_COMPONENT_ID);
            expect(data).toEqual(EXISTING_COMPONENT_DATA);
        });

        it('should return undefined for a non-existent component on an existing entity', () => {
            const data = entityManager.getComponentData(ACCESS_INSTANCE_ID, NON_EXISTENT_COMPONENT_ID);
            expect(data).toBeUndefined();
        });

        it('should return undefined when attempting to get component data from a non-existent entity', () => {
            const data = entityManager.getComponentData(NON_EXISTENT_ENTITY_INSTANCE_ID, EXISTING_COMPONENT_ID);
            expect(data).toBeUndefined();
        });

        it('should return true for an existing component on an existing entity', () => {
            const result = entityManager.hasComponent(ACCESS_INSTANCE_ID, EXISTING_COMPONENT_ID);
            expect(result).toBe(true);
        });

        it('should return false for a non-existent component on an existing entity', () => {
            const result = entityManager.hasComponent(ACCESS_INSTANCE_ID, NON_EXISTENT_COMPONENT_ID);
            expect(result).toBe(false);
        });

        it('should return false when checking for any component on a non-existent entity', () => {
            const result = entityManager.hasComponent(NON_EXISTENT_ENTITY_INSTANCE_ID, EXISTING_COMPONENT_ID);
            expect(result).toBe(false);
        });
    });
});
// --- FILE END ---