// tests/entities/entityManager.getEntitiesWithComponent.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js'; // Adjust path if necessary
import Entity from '../../src/entities/entity.js';

// --- Mock Implementations ---
const createMockDataRegistry = () => ({getEntityDefinition: jest.fn()});
const createMockSchemaValidator = () => ({validate: jest.fn()});
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

// --- Test Suite ---
describe('EntityManager.getEntitiesWithComponent', () => {
    let mockRegistry;
    let mockValidator;
    let mockLogger;
    let mockSpatialIndex;
    let entityManager;

    // --- Test Constants ---
    const COMPONENT_A = 'core:component_a';
    const COMPONENT_B = 'core:component_b';
    const UNUSED_COMPONENT = 'core:unused';
    const UNKNOWN_COMPONENT = 'vendor:unknown';

    const ENTITY_1_ID = 'entity-1'; // Has A
    const ENTITY_2_ID = 'entity-2'; // Has B
    const ENTITY_3_ID = 'entity-3'; // Has A and B

    let entity1, entity2, entity3;

    beforeEach(() => {
        mockRegistry = createMockDataRegistry();
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        mockSpatialIndex = createMockSpatialIndexManager();
        entityManager = new EntityManager(mockRegistry, mockValidator, mockLogger, mockSpatialIndex);

        // Clear mocks and active entities
        jest.clearAllMocks();
        entityManager.activeEntities.clear();

        // Create test entities (don't add to manager yet, tests will do that)
        entity1 = new Entity(ENTITY_1_ID);
        entity1.addComponent(COMPONENT_A, {value: 1});

        entity2 = new Entity(ENTITY_2_ID);
        entity2.addComponent(COMPONENT_B, {text: 'hello'});

        entity3 = new Entity(ENTITY_3_ID);
        entity3.addComponent(COMPONENT_A, {value: 3});
        entity3.addComponent(COMPONENT_B, {text: 'world'});
    });

    afterEach(() => {
        if (entityManager) {
            entityManager.clearAll();
        }
    });

    // --- Test Cases ---

    it('should return an empty array ([]) if the entity manager is empty', () => {
        expect(entityManager.activeEntities.size).toBe(0); // Sanity check
        const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(result).toEqual([]); // AC: Calling helper on empty manager returns []
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 0 entities with component '${COMPONENT_A}'`));
    });

    it('should return an empty array ([]) if no active entities have the specified component', () => {
        entityManager.activeEntities.set(entity2.id, entity2); // Only entity 2 (has B)
        entityManager.activeEntities.set(entity3.id, entity3); // Entity 3 (has A and B) - oh wait, adding this makes the test invalid. Add only entity 2.
        entityManager.activeEntities.clear(); // Reset
        entityManager.activeEntities.set(entity2.id, entity2); // Add only entity 2

        expect(entityManager.activeEntities.size).toBe(1); // Sanity check
        const result = entityManager.getEntitiesWithComponent(COMPONENT_A); // Look for A
        expect(result).toEqual([]); // AC: Coverage hits "0 results" branch
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 0 entities with component '${COMPONENT_A}'`));
    });

    it('should return an array containing only entities that have the specified component (single match)', () => {
        entityManager.activeEntities.set(entity1.id, entity1); // Has A
        entityManager.activeEntities.set(entity2.id, entity2); // Has B

        const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(result).toHaveLength(1); // AC: Coverage hits "N results" branch
        expect(result[0]).toBe(entity1); // Check instance equality
        expect(result[0].id).toBe(ENTITY_1_ID);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 1 entities with component '${COMPONENT_A}'`));
    });

    it('should return an array containing only entities that have the specified component (multiple matches)', () => {
        entityManager.activeEntities.set(entity1.id, entity1); // Has A
        entityManager.activeEntities.set(entity2.id, entity2); // Has B
        entityManager.activeEntities.set(entity3.id, entity3); // Has A and B

        const result = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(result).toHaveLength(2); // AC: Coverage hits "N results" branch
        // Order isn't guaranteed by Map iteration, so check IDs present
        const resultIds = result.map(e => e.id).sort();
        expect(resultIds).toEqual([ENTITY_1_ID, ENTITY_3_ID].sort());
        // Verify instances are correct (find them)
        expect(result.find(e => e.id === ENTITY_1_ID)).toBe(entity1);
        expect(result.find(e => e.id === ENTITY_3_ID)).toBe(entity3);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 2 entities with component '${COMPONENT_A}'`));

        const resultB = entityManager.getEntitiesWithComponent(COMPONENT_B);
        expect(resultB).toHaveLength(2);
        const resultBIds = resultB.map(e => e.id).sort();
        expect(resultBIds).toEqual([ENTITY_2_ID, ENTITY_3_ID].sort());
        expect(resultB.find(e => e.id === ENTITY_2_ID)).toBe(entity2);
        expect(resultB.find(e => e.id === ENTITY_3_ID)).toBe(entity3);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 2 entities with component '${COMPONENT_B}'`));
    });

    it('should return an empty array ([]) and not throw for an unknown or unused component type ID', () => {
        entityManager.activeEntities.set(entity1.id, entity1);
        entityManager.activeEntities.set(entity2.id, entity2);
        entityManager.activeEntities.set(entity3.id, entity3);

        let result;
        expect(() => {
            result = entityManager.getEntitiesWithComponent(UNKNOWN_COMPONENT); // AC: Helper never throws on unknown component id.
        }).not.toThrow();
        expect(result).toEqual([]); // AC: Coverage hits "0 results" branch
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 0 entities with component '${UNKNOWN_COMPONENT}'`));

        expect(() => {
            result = entityManager.getEntitiesWithComponent(UNUSED_COMPONENT);
        }).not.toThrow();
        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 0 entities with component '${UNUSED_COMPONENT}'`));
    });

    it('should return an empty array ([]) for invalid componentTypeIds (null, undefined, empty string, non-string)', () => {
        entityManager.activeEntities.set(entity1.id, entity1); // Add some entities

        expect(entityManager.getEntitiesWithComponent(null)).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received invalid componentTypeId (null)'));

        expect(entityManager.getEntitiesWithComponent(undefined)).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received invalid componentTypeId (undefined)'));

        expect(entityManager.getEntitiesWithComponent('')).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received invalid componentTypeId ()'));

        expect(entityManager.getEntitiesWithComponent(123)).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received invalid componentTypeId (123)'));

        expect(entityManager.getEntitiesWithComponent({})).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Received invalid componentTypeId ([object Object])'));
    });


    it('should return a new array (not a live reference)', () => {
        entityManager.activeEntities.set(entity1.id, entity1); // Has A
        entityManager.activeEntities.set(entity3.id, entity3); // Has A and B

        const initialResult = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(initialResult).toHaveLength(2);
        expect(initialResult.map(e => e.id).sort()).toEqual([ENTITY_1_ID, ENTITY_3_ID].sort());

        // Modify the source map AFTER getting the result
        entityManager.activeEntities.delete(entity1.id);
        const newEntity4 = new Entity('entity-4');
        newEntity4.addComponent(COMPONENT_A, {value: 4});
        entityManager.activeEntities.set(newEntity4.id, newEntity4);

        // Check the original result array - it should be unchanged
        expect(initialResult).toHaveLength(2); // Still has 2 elements
        expect(initialResult.map(e => e.id).sort()).toEqual([ENTITY_1_ID, ENTITY_3_ID].sort()); // Still contains the original IDs

        // Get a new result - it should reflect the current state
        const newResult = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(newResult).toHaveLength(2); // Now has 2 different entities
        expect(newResult.map(e => e.id).sort()).toEqual([ENTITY_3_ID, newEntity4.id].sort()); // Contains the updated IDs
        expect(newResult.find(e => e.id === ENTITY_3_ID)).toBe(entity3);
        expect(newResult.find(e => e.id === newEntity4.id)).toBe(newEntity4);

        // AC: Assert helper returns correct ids and is not a live reference. (Verified above)
    });

});