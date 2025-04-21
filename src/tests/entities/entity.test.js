// src/tests/entities/entity.test.js

import {describe, it, expect, beforeEach} from '@jest/globals';
import Entity from '../../entities/entity.js'; // Adjust the path as necessary

describe('Entity Class - Core CRUD Operations & Iterators', () => { // Updated describe title
    const validEntityId = 'test-entity-123';
    let entity;

    beforeEach(() => {
        // Create a valid entity before each test that doesn't test the constructor
        entity = new Entity(validEntityId);
    });

    // --- 1. Constructor Tests ---
    describe('constructor', () => {
        it('should create an instance successfully with a valid string ID', () => {
            expect(entity).toBeInstanceOf(Entity);
        });

        it('should assign the id property correctly', () => {
            expect(entity.id).toBe(validEntityId);
        });

        it('should initialize the internal #components Map as empty', () => {
            // We can test this indirectly via methods that interact with #components
            // Updated to use iterator test from Ticket 3.3.2
            expect(Array.from(entity.componentTypeIds)).toEqual([]);
            expect(entity.getComponentData('any-id')).toBeUndefined();
            expect(entity.hasComponent('any-id')).toBe(false);
        });

        // Test invalid IDs
        it.each([
            [null, 'null'],
            [undefined, 'undefined'],
            ['', 'empty string'],
            [123, 'number'],
            [true, 'boolean'],
            [{}, 'object'],
            [[], 'array'],
        ])('should throw an Error if the ID is %s (%p)', (invalidId, type) => {
            expect(() => new Entity(invalidId)).toThrow('Entity must have a valid string ID.');
        });

        it('should throw an Error if no ID is provided', () => {
            expect(() => new Entity()).toThrow('Entity must have a valid string ID.');
        });
    });

    // --- 2. addComponent Tests ---
    describe('addComponent', () => {
        const componentTypeId1 = 'core:position';
        const componentData1 = {x: 10, y: 20, locationId: 'zone:a'};
        const componentTypeId2 = 'core:health';
        const componentData2 = {current: 50, max: 100};

        // --- Happy Path Tests (Existing) ---
        it('should add a new component with valid componentTypeId and data', () => {
            entity.addComponent(componentTypeId1, componentData1);
            expect(entity.hasComponent(componentTypeId1)).toBe(true);
            expect(entity.getComponentData(componentTypeId1)).toEqual(componentData1);
            expect(entity.getComponentData(componentTypeId1)).toBe(componentData1); // Check reference
        });

        it('should overwrite the data if adding a component with an existing componentTypeId', () => {
            const updatedData1 = {x: 50, y: 60, locationId: 'zone:b'};
            entity.addComponent(componentTypeId1, componentData1); // Initial add
            entity.addComponent(componentTypeId1, updatedData1); // Overwrite

            expect(entity.hasComponent(componentTypeId1)).toBe(true);
            expect(entity.getComponentData(componentTypeId1)).toEqual(updatedData1);
            expect(entity.getComponentData(componentTypeId1)).not.toEqual(componentData1);
        });

        it('should allow adding multiple different components', () => {
            entity.addComponent(componentTypeId1, componentData1);
            entity.addComponent(componentTypeId2, componentData2);

            expect(entity.hasComponent(componentTypeId1)).toBe(true);
            expect(entity.getComponentData(componentTypeId1)).toEqual(componentData1);
            expect(entity.hasComponent(componentTypeId2)).toBe(true);
            expect(entity.getComponentData(componentTypeId2)).toEqual(componentData2);
            // Using iterator check from Ticket 3.3.2
            expect(Array.from(entity.componentTypeIds)).toHaveLength(2);
            expect(Array.from(entity.componentTypeIds)).toEqual(expect.arrayContaining([componentTypeId1, componentTypeId2]));
        });

        it('should correctly add components with nested object data', () => {
            const nestedData = {stats: {str: 10, dex: 8}, flags: {active: true}};
            entity.addComponent('core:stats', nestedData);
            expect(entity.getComponentData('core:stats')).toEqual(nestedData);
        });

        it('should correctly add components with array data within objects', () => {
            const arrayData = {inventory: ['item:potion', 'item:sword'], capacity: 10};
            entity.addComponent('core:inventory', arrayData);
            expect(entity.getComponentData('core:inventory')).toEqual(arrayData);
        });

        it('should correctly add components with empty objects as data (e.g., for tags)', () => {
            const tagData = {};
            entity.addComponent('tag:player', tagData);
            expect(entity.hasComponent('tag:player')).toBe(true);
            expect(entity.getComponentData('tag:player')).toEqual(tagData);
        });

        // --- Edge Case Tests (New - Ticket 3.3.2) ---
        describe('Edge Cases', () => {
            const validTestData = {value: 1};
            const validTestTypeId = 'test:component';

            // Test invalid componentTypeId
            it.each([
                [null, 'null'],
                [undefined, 'undefined'],
                ['', 'empty string'],
                [123, 'number'],
                [true, 'boolean'],
                [{}, 'object'], // Although technically an object, it's not a valid string ID
                [[], 'array'], // Not a valid string ID
            ])('should throw an Error if componentTypeId is %s (%p)', (invalidTypeId, type) => {
                const expectedErrorMessage = `Invalid componentTypeId provided to addComponent for entity ${validEntityId}. Expected non-empty string.`;
                expect(() => entity.addComponent(invalidTypeId, validTestData))
                    .toThrow(expectedErrorMessage);
            });

            // Test invalid componentData
            it.each([
                [null, 'null'],
                [undefined, 'undefined'],
                ['a string', 'string'],
                [123, 'number'],
                [true, 'boolean'],
                [Symbol('sym'), 'symbol'], // typeof symbol is 'symbol', not 'object'
                // Arrays are technically objects, but let's assume the intent is plain objects,
                // although the current implementation allows arrays. Add if requirement changes.
                // [[], 'array'],
            ])('should throw an Error if componentData is %s (%p)', (invalidData, type) => {
                const expectedErrorMessage = `Invalid componentData provided for component ${validTestTypeId} on entity ${validEntityId}. Expected an object.`;
                expect(() => entity.addComponent(validTestTypeId, invalidData))
                    .toThrow(expectedErrorMessage);
            });
        });
    });

    // --- 3. getComponentData Tests (Existing) ---
    describe('getComponentData', () => {
        const componentTypeId = 'core:properties';
        const componentData = {color: 'blue', weight: 5};

        it('should return the correct data object for an existing componentTypeId', () => {
            entity.addComponent(componentTypeId, componentData);
            expect(entity.getComponentData(componentTypeId)).toEqual(componentData);
            expect(entity.getComponentData(componentTypeId)).toBe(componentData); // Check reference
        });

        it('should return undefined for a non-existent componentTypeId', () => {
            expect(entity.getComponentData('non:existent')).toBeUndefined();
        });

        it('should return undefined after a component has been removed', () => {
            entity.addComponent(componentTypeId, componentData);
            entity.removeComponent(componentTypeId);
            expect(entity.getComponentData(componentTypeId)).toBeUndefined();
        });

        it('should return undefined if componentTypeId is invalid (e.g., null, empty)', () => {
            expect(entity.getComponentData(null)).toBeUndefined();
            expect(entity.getComponentData('')).toBeUndefined();
            expect(entity.getComponentData(undefined)).toBeUndefined();
        });
    });

    // --- 4. hasComponent Tests (Existing) ---
    describe('hasComponent', () => {
        const componentTypeId = 'core:ai';
        const componentData = {state: 'idle', target: null};

        it('should return true for an existing componentTypeId', () => {
            entity.addComponent(componentTypeId, componentData);
            expect(entity.hasComponent(componentTypeId)).toBe(true);
        });

        it('should return false for a non-existent componentTypeId', () => {
            expect(entity.hasComponent('non:existent')).toBe(false);
        });

        it('should return false after a component has been removed', () => {
            entity.addComponent(componentTypeId, componentData);
            expect(entity.hasComponent(componentTypeId)).toBe(true);
            entity.removeComponent(componentTypeId);
            expect(entity.hasComponent(componentTypeId)).toBe(false);
        });

        it('should return false if componentTypeId is invalid (e.g., null, empty)', () => {
            expect(entity.hasComponent(null)).toBe(false);
            expect(entity.hasComponent('')).toBe(false);
            expect(entity.hasComponent(undefined)).toBe(false);
        });
    });

    // --- 5. removeComponent Tests (Existing) ---
    describe('removeComponent', () => {
        const componentTypeId = 'core:physics';
        const componentData = {velocity: {x: 0, y: 0}, mass: 10};

        it('should return true when removing an existing component', () => {
            entity.addComponent(componentTypeId, componentData);
            expect(entity.removeComponent(componentTypeId)).toBe(true);
        });

        it('should ensure the component is no longer present via hasComponent after removal', () => {
            entity.addComponent(componentTypeId, componentData);
            entity.removeComponent(componentTypeId);
            expect(entity.hasComponent(componentTypeId)).toBe(false);
        });

        it('should ensure the component data is no longer retrievable via getComponentData after removal', () => {
            entity.addComponent(componentTypeId, componentData);
            entity.removeComponent(componentTypeId);
            expect(entity.getComponentData(componentTypeId)).toBeUndefined();
        });

        it('should return false when attempting to remove a non-existent component', () => {
            expect(entity.removeComponent('non:existent')).toBe(false);
        });

        it('should return false when attempting to remove a component that was already removed', () => {
            entity.addComponent(componentTypeId, componentData);
            entity.removeComponent(componentTypeId); // First removal
            expect(entity.removeComponent(componentTypeId)).toBe(false); // Second removal attempt
        });

        it('should correctly handle removal when multiple components exist', () => {
            const componentTypeId1 = 'core:position';
            const componentData1 = {x: 1, y: 1};
            const componentTypeId2 = 'core:health';
            const componentData2 = {hp: 10};

            entity.addComponent(componentTypeId1, componentData1);
            entity.addComponent(componentTypeId2, componentData2);

            expect(entity.removeComponent(componentTypeId1)).toBe(true);

            expect(entity.hasComponent(componentTypeId1)).toBe(false);
            expect(entity.getComponentData(componentTypeId1)).toBeUndefined();
            expect(entity.hasComponent(componentTypeId2)).toBe(true);
            expect(entity.getComponentData(componentTypeId2)).toEqual(componentData2);
            // Using iterator check from Ticket 3.3.2
            expect(Array.from(entity.componentTypeIds)).toEqual([componentTypeId2]);
        });

        it('should return false if componentTypeId is invalid (e.g., null, empty)', () => {
            expect(entity.removeComponent(null)).toBe(false);
            expect(entity.removeComponent('')).toBe(false);
            expect(entity.removeComponent(undefined)).toBe(false);
        });
    });

    // --- 6. Component Iterator Tests (New - Ticket 3.3.2) ---
    describe('Component Iterators', () => {
        const componentTypeId1 = 'test:position';
        const componentData1 = {x: 100, y: 200};
        const componentTypeId2 = 'test:tag';
        const componentData2 = {}; // Tag component
        const componentTypeId3 = 'test:inventory';
        const componentData3 = {items: ['a', 'b'], capacity: 5};

        // Helper to add multiple components
        const addMultipleComponents = () => {
            entity.addComponent(componentTypeId1, componentData1);
            entity.addComponent(componentTypeId2, componentData2);
            entity.addComponent(componentTypeId3, componentData3);
        };

        describe('componentTypeIds', () => {
            it('should return an IterableIterator', () => {
                // Check if the getter returns something with the iterator protocol
                expect(entity.componentTypeIds[Symbol.iterator]).toBeInstanceOf(Function);
            });

            it('should return an empty iterator for an entity with no components', () => {
                const iterator = entity.componentTypeIds;
                expect(Array.from(iterator)).toEqual([]);
            });

            it('should return an iterator containing the correct string IDs of added components', () => {
                addMultipleComponents();
                const expectedIds = [componentTypeId1, componentTypeId2, componentTypeId3];
                const actualIds = Array.from(entity.componentTypeIds);

                expect(actualIds).toHaveLength(expectedIds.length);
                // Map iteration order is insertion order, so direct equality should work
                expect(actualIds).toEqual(expectedIds);
                // Alternative (order-independent):
                // expect(actualIds).toEqual(expect.arrayContaining(expectedIds));
            });
        });

        describe('allComponentData', () => {
            it('should return an IterableIterator', () => {
                expect(entity.allComponentData[Symbol.iterator]).toBeInstanceOf(Function);
            });

            it('should return an empty iterator for an entity with no components', () => {
                const iterator = entity.allComponentData;
                expect(Array.from(iterator)).toEqual([]);
            });

            it('should return an iterator containing the correct data objects of added components', () => {
                addMultipleComponents();
                const expectedData = [componentData1, componentData2, componentData3];
                const actualData = Array.from(entity.allComponentData);

                expect(actualData).toHaveLength(expectedData.length);
                // Deep equality check for objects, order matters (insertion order)
                expect(actualData).toEqual(expectedData);
                // Alternative (order-independent):
                // expect(actualData).toEqual(expect.arrayContaining(expectedData));
            });
        });

        describe('componentEntries', () => {
            it('should return an IterableIterator', () => {
                expect(entity.componentEntries[Symbol.iterator]).toBeInstanceOf(Function);
            });

            it('should return an empty iterator for an entity with no components', () => {
                const iterator = entity.componentEntries;
                expect(Array.from(iterator)).toEqual([]);
            });

            it('should return an iterator containing the correct [componentTypeId, componentData] pairs', () => {
                addMultipleComponents();
                const expectedEntries = [
                    [componentTypeId1, componentData1],
                    [componentTypeId2, componentData2],
                    [componentTypeId3, componentData3],
                ];
                const actualEntries = Array.from(entity.componentEntries);

                expect(actualEntries).toHaveLength(expectedEntries.length);
                // Deep equality check for arrays of [id, data], order matters (insertion order)
                expect(actualEntries).toEqual(expectedEntries);
                // Alternative (order-independent, checks if each expected entry exists):
                // expect(actualEntries).toEqual(expect.arrayContaining(expectedEntries));
            });
        });
    });
});