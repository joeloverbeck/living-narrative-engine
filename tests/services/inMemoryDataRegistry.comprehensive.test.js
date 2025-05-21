// src/tests/core/services/inMemoryDataRegistry.comprehensive.test.js

import InMemoryDataRegistry from '../../src/services/inMemoryDataRegistry.js';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'; // Adjust path as needed

describe('InMemoryDataRegistry', () => {
    /** @type {InMemoryDataRegistry} */
    let registry;

    // Create a fresh registry instance before each test
    beforeEach(() => {
        registry = new InMemoryDataRegistry();
        // Mock console.error to prevent actual error logging during tests
        // and allow checking if it was called (optional but good practice)
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    // Restore console.error after each test
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with an empty data map', () => {
            // Internal inspection isn't ideal, but possible for testing setup
            // Using Object.getOwnPropertyDescriptor to check the private field indirectly if needed,
            // but checking its effects (like getAll) is usually better.
            // For this simple case, let's assume we can check its effect or rely on other tests.
            // A simple check might be:
            expect(registry.getAll('anyType')).toEqual([]); // An empty registry returns [] for any type
        });

        // REMOVED: it('should initialize with a null manifest', ...)
        // Reason: getManifest no longer exists.
    });

    describe('store() / get()', () => {
        it('should store and retrieve a data object correctly', () => {
            const testData = {id: 'item1', name: 'Test Item', value: 100};
            registry.store('items', 'item1', testData);
            const retrieved = registry.get('items', 'item1');
            expect(retrieved).toEqual(testData);
        });

        it('should return undefined when getting data with non-existent ID', () => {
            registry.store('items', 'item1', {id: 'item1'});
            const retrieved = registry.get('items', 'nonExistentId');
            expect(retrieved).toBeUndefined();
        });

        it('should return undefined when getting data with non-existent type', () => {
            registry.store('items', 'item1', {id: 'item1'});
            const retrieved = registry.get('nonExistentType', 'item1');
            expect(retrieved).toBeUndefined();
        });

        it('should overwrite existing data when storing with the same type and ID', () => {
            const initialData = {id: 'item1', name: 'Old Item'};
            const newData = {id: 'item1', name: 'New Item', description: 'Updated'};
            registry.store('items', 'item1', initialData);
            registry.store('items', 'item1', newData);
            const retrieved = registry.get('items', 'item1');
            expect(retrieved).toEqual(newData); // Should have the new data
            expect(retrieved).not.toEqual(initialData);
        });

        it('should handle storing multiple types of data', () => {
            const itemData = {id: 'potion', type: 'consumable'};
            const actionData = {id: 'use', command: 'use', target: 'item'};
            const entityData = {id: 'player', hp: 100};

            registry.store('items', 'potion', itemData);
            registry.store('actions', 'use', actionData);
            registry.store('entities', 'player', entityData);

            expect(registry.get('items', 'potion')).toEqual(itemData);
            expect(registry.get('actions', 'use')).toEqual(actionData);
            expect(registry.get('entities', 'player')).toEqual(entityData);
            expect(registry.get('items', 'use')).toBeUndefined(); // Check wrong type
        });

        it('should log an error and not store if type is invalid', () => {
            const testData = {id: 'test'};
            registry.store('', 'validId', testData); // Empty type
            registry.store(' ', 'validId', testData); // Whitespace type
            registry.store(null, 'validId', testData); // Null type
            registry.store(undefined, 'validId', testData); // Undefined type

            expect(console.error).toHaveBeenCalledTimes(4);
            // Check that no data was actually stored for these invalid types
            expect(registry.getAll('')).toEqual([]);
            expect(registry.getAll(' ')).toEqual([]);
            expect(registry.getAll(null)).toEqual([]); // Although invalid input, getAll might handle it gracefully or error depending on implementation
            expect(registry.getAll(undefined)).toEqual([]);
        });

        it('should log an error and not store if ID is invalid', () => {
            const testData = {id: 'test'};
            registry.store('validType', '', testData); // Empty ID
            registry.store('validType', ' ', testData); // Whitespace ID
            registry.store('validType', null, testData); // Null ID
            registry.store('validType', undefined, testData); // Undefined ID

            expect(console.error).toHaveBeenCalledTimes(4);
            expect(registry.get('validType', '')).toBeUndefined();
            expect(registry.get('validType', ' ')).toBeUndefined();
            expect(registry.get('validType', null)).toBeUndefined();
            expect(registry.get('validType', undefined)).toBeUndefined();
            expect(registry.getAll('validType')).toEqual([]); // Type might exist but no data stored under invalid IDs
        });

        it('should log an error and not store if data is not a non-null object', () => {
            registry.store('validType', 'validId', null);
            registry.store('validType', 'validId', undefined);
            registry.store('validType', 'validId', 'a string');
            registry.store('validType', 'validId', 123);

            expect(console.error).toHaveBeenCalledTimes(4);
            expect(registry.get('validType', 'validId')).toBeUndefined(); // Should not have stored invalid data
        });

        it('should allow storing an empty object', () => {
            const emptyData = {};
            registry.store('validType', 'validId', emptyData);
            expect(console.error).not.toHaveBeenCalled();
            expect(registry.get('validType', 'validId')).toEqual(emptyData);
        });
    });

    describe('getAll()', () => {
        it('should return an empty array for a non-existent type', () => {
            expect(registry.getAll('nonExistentType')).toEqual([]);
        });

        it('should return an empty array for a type with no stored data', () => {
            registry.store('items', 'item1', {id: 'item1'}); // Store something else
            expect(registry.getAll('actions')).toEqual([]);
        });

        it('should return an array with a single object for a type with one item', () => {
            const itemData = {id: 'item1', name: 'Test Item'};
            registry.store('items', 'item1', itemData);
            const allItems = registry.getAll('items');
            expect(allItems).toEqual([itemData]);
        });

        it('should return an array with all objects for a type with multiple items', () => {
            const item1 = {id: 'item1', name: 'Test Item 1'};
            const item2 = {id: 'item2', name: 'Test Item 2'};
            const action1 = {id: 'action1', name: 'Action 1'}; // Different type

            registry.store('items', 'item1', item1);
            registry.store('items', 'item2', item2);
            registry.store('actions', 'action1', action1);

            const allItems = registry.getAll('items');
            expect(allItems).toBeInstanceOf(Array);
            expect(allItems).toHaveLength(2);
            // Use arrayContaining to be independent of insertion order
            expect(allItems).toEqual(expect.arrayContaining([item1, item2]));
        });
    });

    describe('getAllSystemRules()', () => {
        // These tests are from the previous response, integrated here
        it('should return an empty array when no system rules are stored', () => {
            const rules = registry.getAllSystemRules();
            expect(rules).toEqual([]);
        });

        it('should return an empty array even if other data types are stored', () => {
            registry.store('actions', 'action1', {id: 'action1'});
            registry.store('entities', 'player', {id: 'player'});
            const rules = registry.getAllSystemRules();
            expect(rules).toEqual([]);
        });

        it('should return all stored system rules when they exist', () => {
            const rule1 = {rule_id: 'rule-001', event_type: 'test-event', actions: []};
            const rule2 = {rule_id: 'rule-002', event_type: 'another-event', condition: {}, actions: []};

            registry.store('rules', 'rule-001', rule1);
            registry.store('rules', 'rule-002', rule2);
            registry.store('items', 'potion', {id: 'potion'}); // Other data

            const rules = registry.getAllSystemRules();

            expect(rules).toBeInstanceOf(Array);
            expect(rules).toHaveLength(2);
            expect(rules).toEqual(expect.arrayContaining([rule1, rule2]));
        });

        it('should return an empty array after clear() is called', () => {
            const rule1 = {rule_id: 'rule-001', event_type: 'test-event', actions: []};
            registry.store('rules', 'rule-001', rule1);
            expect(registry.getAllSystemRules()).toHaveLength(1); // Verify before clear

            registry.clear();

            expect(registry.getAllSystemRules()).toEqual([]); // Should be empty after clear
        });
    });

    describe('clear()', () => {
        it('should remove all stored typed data', () => {
            registry.store('items', 'item1', {id: 'item1'});
            registry.store('actions', 'action1', {id: 'action1'});
            expect(registry.getAll('items').length).toBe(1); // Verify data exists

            registry.clear();

            expect(registry.getAll('items')).toEqual([]);
            expect(registry.getAll('actions')).toEqual([]);
            expect(registry.get('items', 'item1')).toBeUndefined();
            // Check internal state if possible/necessary, e.g., check size of the internal map
            // This depends on how you want to test (black-box vs white-box)
            // For black-box, checking effects via get/getAll is sufficient.
        });

        // REMOVED: it('should reset the manifest to null', ...)
        // Reason: setManifest/getManifest no longer exist. clear() no longer resets a manifest.

        it('should work correctly when called on an empty registry', () => {
            expect(() => registry.clear()).not.toThrow();
            // Verify the state is still empty after clearing an empty registry
            expect(registry.getAll('anyType')).toEqual([]);
            // REMOVED: expect(registry.getManifest()).toBeNull();
            // Reason: getManifest no longer exists.
        });
    });

    // REMOVED: describe('setManifest() / getManifest()', ...)
    // Reason: These methods no longer exist.

    // --- Specific Getter Tests (Add more as needed) ---

    describe('getEntityDefinition()', () => {
        const entity = {id: 'goblin', type: 'monster'};
        const item = {id: 'sword', type: 'weapon'};
        // Assuming getEntityDefinition ONLY checks 'entities' now based on implementation
        // If it checked multiple types, those tests would remain.

        beforeEach(() => {
            registry.store('entities', entity.id, entity);
            registry.store('items', item.id, item); // Store something else
        });

        it('should retrieve definition from "entities" type', () => {
            expect(registry.getEntityDefinition('goblin')).toEqual(entity);
        });

        it('should return undefined if ID not found in "entities" type', () => {
            expect(registry.getEntityDefinition('dragon')).toBeUndefined();
        });

        it('should return undefined if ID exists but in a different type', () => {
            expect(registry.getEntityDefinition('sword')).toBeUndefined(); // 'sword' is an item, not entity
        });
    });


    describe('getActionDefinition() / getAllActionDefinitions()', () => {
        const action1 = {id: 'look', command: 'look'};
        const action2 = {id: 'take', command: 'take'};

        beforeEach(() => {
            registry.store('actions', action1.id, action1);
            registry.store('actions', action2.id, action2);
            registry.store('items', 'potion', {id: 'potion'}); // Other type
        });

        it('getActionDefinition should retrieve a specific action', () => {
            expect(registry.getActionDefinition('take')).toEqual(action2);
        });

        it('getActionDefinition should return undefined for non-existent action ID', () => {
            expect(registry.getActionDefinition('nonExistent')).toBeUndefined();
        });

        it('getActionDefinition should return undefined for ID of different type', () => {
            expect(registry.getActionDefinition('potion')).toBeUndefined();
        });

        it('getAllActionDefinitions should return all stored actions', () => {
            const allActions = registry.getAllActionDefinitions();
            expect(allActions).toHaveLength(2);
            expect(allActions).toEqual(expect.arrayContaining([action1, action2]));
        });

        it('getAllActionDefinitions should return empty array if no actions stored', () => {
            registry.clear();
            expect(registry.getAllActionDefinitions()).toEqual([]);
        });
    });

    // Add tests for getStartingPlayerId and getStartingLocationId if desired
    describe('getStartingPlayerId() / getStartingLocationId()', () => {
        const playerEntity = {
            id: 'player1',
            name: 'Hero',
            components: {'core:player': {}, 'core:position': {locationId: 'startRoom'}}
        };
        const npcEntity = {id: 'npc1', name: 'Villager', components: {'core:position': {locationId: 'village'}}};
        const startRoomLoc = {id: 'startRoom', name: 'Starting Room'};

        it('should return null if no entities are loaded', () => {
            expect(registry.getStartingPlayerId()).toBeNull();
            expect(registry.getStartingLocationId()).toBeNull();
        });

        it('should return null if entities are loaded but none have core:player component', () => {
            registry.store('entities', npcEntity.id, npcEntity);
            expect(registry.getStartingPlayerId()).toBeNull();
            expect(registry.getStartingLocationId()).toBeNull();
        });

        it('should find the starting player ID if an entity has core:player component', () => {
            registry.store('entities', npcEntity.id, npcEntity);
            registry.store('entities', playerEntity.id, playerEntity);
            expect(registry.getStartingPlayerId()).toBe(playerEntity.id);
        });

        it('should find the starting location ID from the player entity', () => {
            registry.store('entities', playerEntity.id, playerEntity);
            registry.store('locations', startRoomLoc.id, startRoomLoc); // Location definition isn't strictly needed for the ID lookup
            expect(registry.getStartingLocationId()).toBe('startRoom');
        });

        it('should return null for starting location if player has no position component', () => {
            const playerNoPos = {id: 'playerNoPos', name: 'Lost Hero', components: {'core:player': {}}};
            registry.store('entities', playerNoPos.id, playerNoPos);
            expect(registry.getStartingPlayerId()).toBe(playerNoPos.id);
            expect(registry.getStartingLocationId()).toBeNull();
        });

        it('should return null for starting location if player position component has no locationId', () => {
            const playerNoLocId = {
                id: 'playerNoLocId',
                name: 'Nowhere Hero',
                components: {'core:player': {}, 'core:position': {x: 0, y: 0}}
            };
            registry.store('entities', playerNoLocId.id, playerNoLocId);
            expect(registry.getStartingPlayerId()).toBe(playerNoLocId.id);
            expect(registry.getStartingLocationId()).toBeNull();
        });
    });

});

// JSDoc type import for interface reference - ensures tools can understand the @implements tag
/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */ // This typedef remains relevant if the class still intends to implement an interface, even if parts changed.