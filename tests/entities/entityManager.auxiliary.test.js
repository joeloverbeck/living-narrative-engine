// tests/entities/entityManager.auxiliary.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import Entity from '../../src/entities/entity.js';
import {POSITION_COMPONENT_ID} from "../../src/constants/componentIds.js";

// --- Mock Implementations ---
const createMockDataRegistry = () => ({
    getEntityDefinition: jest.fn(),
});

const createMockSchemaValidator = () => ({
    validate: jest.fn(() => ({isValid: true})), // Default to valid
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
const INSTANCE_ID_1 = 'aux-instance-01'; // Was TEST_ENTITY_ID_1
const INSTANCE_ID_2_POS = 'aux-instance-02-pos'; // Was TEST_ENTITY_ID_2
const DEFINITION_ID_DUMMY = 'def:dummy-aux'; // Common definition ID for these test entities

const NON_EXISTENT_INSTANCE_ID = 'ghost-instance-404'; // Was NON_EXISTENT_ENTITY_ID
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
    let entity2_pos; // Entity with position, renamed for clarity

    beforeEach(() => {
        mockRegistry = createMockDataRegistry();
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        mockSpatialIndex = createMockSpatialIndexManager();
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);
        jest.clearAllMocks();

        // Setup common entities with both instanceId and definitionId
        entity1 = new Entity(INSTANCE_ID_1, DEFINITION_ID_DUMMY);
        entity1.addComponent(OTHER_COMPONENT_ID, {...OTHER_COMPONENT_DATA});

        entity2_pos = new Entity(INSTANCE_ID_2_POS, DEFINITION_ID_DUMMY);
        entity2_pos.addComponent(OTHER_COMPONENT_ID, {...OTHER_COMPONENT_DATA});
        entity2_pos.addComponent(POSITION_COMPONENT_ID, {...POSITION_DATA});
    });

    afterEach(() => {
        if (entityManager) {
            entityManager.activeEntities.clear();
        }
    });

    // --- getEntityInstance Tests ---
    describe('getEntityInstance', () => {
        beforeEach(() => {
            entityManager.activeEntities.set(entity1.id, entity1); // entity1.id is INSTANCE_ID_1
        });

        it('should return the correct entity instance when retrieving an existing entity', () => {
            const retrievedEntity = entityManager.getEntityInstance(INSTANCE_ID_1);
            expect(retrievedEntity).toBe(entity1);
            expect(retrievedEntity.id).toBe(INSTANCE_ID_1);
        });

        it('should return undefined when retrieving a non-existent entity', () => {
            const retrievedEntity = entityManager.getEntityInstance(NON_EXISTENT_INSTANCE_ID);
            expect(retrievedEntity).toBeUndefined();
        });

        it('should return undefined if called with null or undefined id', () => {
            expect(entityManager.getEntityInstance(null)).toBeUndefined();
            expect(entityManager.getEntityInstance(undefined)).toBeUndefined();
        });
    });

    // --- removeEntityInstance Tests ---
    describe('removeEntityInstance', () => {
        describe('when removing an entity without position', () => {
            beforeEach(() => {
                entityManager.activeEntities.set(entity1.id, entity1);
                expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(true);
            });

            it('should return true', () => {
                expect(entityManager.removeEntityInstance(INSTANCE_ID_1)).toBe(true);
            });

            it('should remove the entity from activeEntities', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_1);
                expect(entityManager.activeEntities.has(INSTANCE_ID_1)).toBe(false);
            });

            it('should NOT call ISpatialIndexManager.removeEntity', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_1);
                expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
            });

            it('should log an info message about removal', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_1);
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Removed entity instance ${INSTANCE_ID_1} from active map.`));
            });
        });

        describe('when removing an entity with position', () => {
            beforeEach(() => {
                entityManager.activeEntities.set(entity2_pos.id, entity2_pos); // entity2_pos.id is INSTANCE_ID_2_POS
                expect(entityManager.activeEntities.has(INSTANCE_ID_2_POS)).toBe(true);
                expect(entity2_pos.hasComponent(POSITION_COMPONENT_ID)).toBe(true);
                expect(entity2_pos.getComponentData(POSITION_COMPONENT_ID)?.locationId).toBe(TEST_LOCATION_ID);
            });

            it('should return true', () => {
                expect(entityManager.removeEntityInstance(INSTANCE_ID_2_POS)).toBe(true);
            });

            it('should remove the entity from activeEntities', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
                expect(entityManager.activeEntities.has(INSTANCE_ID_2_POS)).toBe(false);
            });

            it('should call ISpatialIndexManager.removeEntity with the correct entity ID and location ID', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
                expect(mockSpatialIndex.removeEntity).toHaveBeenCalledWith(INSTANCE_ID_2_POS, TEST_LOCATION_ID);
            });

            it('should log debug and info messages about removal', () => {
                entityManager.removeEntityInstance(INSTANCE_ID_2_POS);
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Removed entity ${INSTANCE_ID_2_POS} from spatial index (location: ${TEST_LOCATION_ID}).`));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Removed entity instance ${INSTANCE_ID_2_POS} from active map.`));
            });
        });

        describe('when removing an entity with position but invalid locationId', () => {
            const instanceIdInvalidPos = 'aux-instance-invalid-pos';
            let entityWithInvalidPos;

            beforeEach(() => {
                entityWithInvalidPos = new Entity(instanceIdInvalidPos, DEFINITION_ID_DUMMY);
                entityWithInvalidPos.addComponent(POSITION_COMPONENT_ID, {x: 0, y: 0}); // No locationId
                entityManager.activeEntities.set(instanceIdInvalidPos, entityWithInvalidPos);
            });

            it('should return true and remove from activeEntities', () => {
                expect(entityManager.removeEntityInstance(instanceIdInvalidPos)).toBe(true);
                expect(entityManager.activeEntities.has(instanceIdInvalidPos)).toBe(false);
            });

            it('should NOT call ISpatialIndexManager.removeEntity', () => {
                entityManager.removeEntityInstance(instanceIdInvalidPos);
                expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
            });
        });

        describe('when attempting to remove a non-existent entity', () => {
            it('should return false', () => {
                expect(entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID)).toBe(false);
            });

            it('should log a warning message', () => {
                entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Attempted to remove non-existent entity instance ${NON_EXISTENT_INSTANCE_ID}`));
            });

            it('should not change the activeEntities map', () => {
                const initialSize = entityManager.activeEntities.size;
                entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID);
                expect(entityManager.activeEntities.size).toBe(initialSize);
            });

            it('should NOT call ISpatialIndexManager.removeEntity', () => {
                entityManager.removeEntityInstance(NON_EXISTENT_INSTANCE_ID);
                expect(mockSpatialIndex.removeEntity).not.toHaveBeenCalled();
            });
        });
    });

    describe('getEntitiesInLocation', () => {
        const queryLocationId = 'zone:query-location';
        const expectedEntityIds = new Set(['inst-a', 'inst-b']);

        beforeEach(() => {
            mockSpatialIndex.getEntitiesInLocation.mockReturnValue(expectedEntityIds);
        });

        it('should call ISpatialIndexManager.getEntitiesInLocation with the correct locationId', () => {
            entityManager.getEntitiesInLocation(queryLocationId);
            expect(mockSpatialIndex.getEntitiesInLocation).toHaveBeenCalledWith(queryLocationId);
        });

        it('should return the Set of entity IDs provided by the spatial index manager', () => {
            const result = entityManager.getEntitiesInLocation(queryLocationId);
            expect(result).toBe(expectedEntityIds); // It returns the set directly
        });

        it('should return an empty Set if the spatial index manager returns one', () => {
            const emptySet = new Set();
            mockSpatialIndex.getEntitiesInLocation.mockReturnValue(emptySet);
            const result = entityManager.getEntitiesInLocation('zone:empty');
            expect(result.size).toBe(0);
            expect(result).toBe(emptySet);
        });
    });

    describe('buildInitialSpatialIndex', () => {
        it('should call ISpatialIndexManager.buildIndex, passing the EntityManager instance itself', () => {
            entityManager.buildInitialSpatialIndex();
            expect(mockSpatialIndex.buildIndex).toHaveBeenCalledWith(entityManager);
        });

        it('should log an info message indicating delegation', () => {
            entityManager.buildInitialSpatialIndex();
            expect(mockLogger.info).toHaveBeenCalledWith('EntityManager: Delegating initial spatial index build...');
        });
    });

    describe('clearAll', () => {
        beforeEach(() => {
            entityManager.activeEntities.set(entity1.id, entity1);
            entityManager.activeEntities.set(entity2_pos.id, entity2_pos);
            expect(entityManager.activeEntities.size).toBeGreaterThan(0);
        });

        it('should clear the entityManager.activeEntities map', () => {
            entityManager.clearAll();
            expect(entityManager.activeEntities.size).toBe(0);
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
});