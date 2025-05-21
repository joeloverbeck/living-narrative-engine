// src/tests/core/services/inMemoryDataRegistry.test.js

import {describe, it, expect, beforeEach} from '@jest/globals';
import InMemoryDataRegistry from '../../../src/services/inMemoryDataRegistry.js'; // Adjust path as needed

describe('InMemoryDataRegistry', () => {
    let registry;

    // Sample data for testing
    const type1 = 'items';
    const id1 = 'item:potion_health';
    const obj1 = {name: 'Health Potion', effect: 'heal', value: 50};

    const type2 = 'entities';
    const id2 = 'entity:goblin_warrior';
    const obj2 = {name: 'Goblin Warrior', hp: 15, attack: 3};

    const id3 = 'item:key_rusty'; // Same type as obj1, different id
    const obj3 = {name: 'Rusty Key', opens: 'chest:old'};

    const id4 = 'entity:player'; // Same id as obj1, different type // <<< NOTE: Typo in original comment? id4 is different from id1
    const obj4 = {name: 'Hero', hp: 100, inventory: []}; // <<< Using id4 = 'entity:player' for this

    const complexObj = {
        id: 'complex:1',
        data: {
            nested: {arr: [1, 'a', true], flag: true},
            topLevel: 'value'
        }
    };

    // Manifest constants removed as they are no longer used in tests
    // const manifest1 = {worldName: 'Test World 1', startLocation: 'loc:start', version: 1};
    // const manifest2 = {worldName: 'Test World 2', startLocation: 'loc:alt_start', creators: ['Dev1']};

    // Create a fresh registry before each test
    beforeEach(() => {
        registry = new InMemoryDataRegistry();
    });

    // Task 1: Test Initial State
    describe('constructor and initial state', () => {
        it('should initialize with an empty internal data map', () => {
            // Accessing 'data' directly for testing purposes as it's not private in the implementation
            expect(registry.data).toBeInstanceOf(Map);
            expect(registry.data.size).toBe(0);
        });

        // Removed test: 'should initialize with manifest as null'
        // it('should initialize with manifest as null', () => {
        //   expect(registry.getManifest()).toBeNull();
        // });

        it('should return an empty array from getAll for any type initially', () => {
            expect(registry.getAll('any_type')).toEqual([]);
        });

        it('should return undefined from get for any type/id initially', () => {
            expect(registry.get('any_type', 'any_id')).toBeUndefined();
        });
    });

    // Task 2: Test `store` and `get`
    describe('store and get', () => {
        it('should store and retrieve a simple object using get()', () => {
            registry.store(type1, id1, obj1);
            const retrieved = registry.get(type1, id1);
            expect(retrieved).toEqual(obj1); // Deep equality check
        });

        it('should store and retrieve multiple objects under the same type', () => {
            registry.store(type1, id1, obj1);
            registry.store(type1, id3, obj3);
            expect(registry.get(type1, id1)).toEqual(obj1);
            expect(registry.get(type1, id3)).toEqual(obj3);
        });

        it('should store objects under different types correctly (type isolation)', () => {
            registry.store(type1, id1, obj1);
            registry.store(type2, id4, obj4); // Use id4 here for clarity
            expect(registry.get(type1, id1)).toEqual(obj1);
            expect(registry.get(type2, id4)).toEqual(obj4);
        });

        it('should store and retrieve complex/nested objects', () => {
            registry.store('complex_type', complexObj.id, complexObj);
            expect(registry.get('complex_type', complexObj.id)).toEqual(complexObj);
        });

        it('should overwrite an existing object when storing with the same type and id', () => {
            const updatedObj1 = {...obj1, value: 100}; // Create a modified version
            registry.store(type1, id1, obj1);
            expect(registry.get(type1, id1)).toEqual(obj1); // Verify initial store

            registry.store(type1, id1, updatedObj1); // Overwrite
            expect(registry.get(type1, id1)).toEqual(updatedObj1); // Verify overwrite
            expect(registry.get(type1, id1)).not.toEqual(obj1);
        });

        describe('get non-existent data', () => {
            it('should return undefined for a non-existent id within an existing type', () => {
                registry.store(type1, id1, obj1); // Ensure type exists
                expect(registry.get(type1, 'non_existent_id')).toBeUndefined();
            });

            it('should return undefined for a non-existent type', () => {
                expect(registry.get('non_existent_type', id1)).toBeUndefined();
            });
        });

        describe('invalid input handling for store', () => {
            // Helper to check state after invalid store attempt
            const assertNotStored = (testRegistry, checkType, checkId) => {
                expect(testRegistry.get(checkType, checkId)).toBeUndefined();
                // Also check that the type map wasn't inadvertently created if it didn't exist
                if (checkType) {
                    // Ensure we check the actual map, not getAll which returns [] anyway
                    const typeMap = testRegistry.data.get(checkType);
                    expect(typeMap?.size ?? 0).toBe(0);
                } else if (checkType === '') {
                    const typeMap = testRegistry.data.get(checkType);
                    expect(typeMap).toBeUndefined(); // Explicitly check empty string wasn't added
                }
            };

            it('should not store data if type is an empty string', () => {
                registry.store('', id1, obj1);
                assertNotStored(registry, '', id1);
                expect(registry.data.size).toBe(0); // Check map wasn't added
            });

            it('should not store data if type is null or undefined', () => {
                registry.store(null, id1, obj1);
                assertNotStored(registry, null, id1);
                registry.store(undefined, id1, obj1);
                assertNotStored(registry, undefined, id1);
                expect(registry.data.size).toBe(0);
            });

            it('should not store data if id is an empty string', () => {
                registry.store(type1, '', obj1);
                assertNotStored(registry, type1, '');
                // Check the inner map if the type was valid but id was not
                const typeMap = registry.data.get(type1);
                expect(typeMap?.size ?? 0).toBe(0);
            });

            it('should not store data if id is null or undefined', () => {
                registry.store(type1, null, obj1);
                assertNotStored(registry, type1, null);
                registry.store(type1, undefined, obj1);
                assertNotStored(registry, type1, undefined);
                const typeMap = registry.data.get(type1);
                expect(typeMap?.size ?? 0).toBe(0);
            });

            it('should not store data if data object is null or undefined', () => {
                registry.store(type1, id1, null);
                assertNotStored(registry, type1, id1);
                registry.store(type1, id1, undefined);
                assertNotStored(registry, type1, id1);
                const typeMap = registry.data.get(type1);
                expect(typeMap?.size ?? 0).toBe(0); // Ensure map wasn't created if it didn't exist
            });

            it('should not store data if data is a primitive', () => {
                registry.store(type1, id1, 123);
                assertNotStored(registry, type1, id1);
                registry.store(type1, id1, 'a string');
                assertNotStored(registry, type1, id1);
                registry.store(type1, id1, true);
                assertNotStored(registry, type1, id1);
                const typeMap = registry.data.get(type1);
                expect(typeMap?.size ?? 0).toBe(0);
            });

        });
    });

    // Task 3: Test `getAll`
    describe('getAll', () => {
        it('should return all objects stored under a specific type', () => {
            registry.store(type1, id1, obj1);
            registry.store(type1, id3, obj3);
            registry.store(type2, id2, obj2); // Add item of different type

            const items = registry.getAll(type1);
            expect(items).toHaveLength(2);
            expect(items).toEqual(expect.arrayContaining([obj1, obj3])); // Order-independent check

            const entities = registry.getAll(type2);
            expect(entities).toHaveLength(1);
            expect(entities).toEqual([obj2]);
        });

        it('should return an array with a single object when only one is stored for that type', () => {
            registry.store(type2, id2, obj2);
            expect(registry.getAll(type2)).toEqual([obj2]);
        });

        it('should return an empty array for a type with no stored objects', () => {
            registry.store(type1, id1, obj1); // Store something else
            expect(registry.getAll('non_existent_type')).toEqual([]);
        });

        it('should return an empty array for a type after clear()', () => {
            registry.store(type1, id1, obj1);
            expect(registry.getAll(type1)).toHaveLength(1); // Verify before clear
            registry.clear();
            expect(registry.getAll(type1)).toEqual([]);
        });
    });

    // Task 4: REMOVED - Test `setManifest` and `getManifest`
    // describe('setManifest and getManifest', () => { ... });

    // Task 5: Test `clear`
    describe('clear', () => {
        it('should remove all stored data objects', () => {
            // Populate
            registry.store(type1, id1, obj1);
            registry.store(type1, id3, obj3);
            registry.store(type2, id2, obj2);
            // Removed: registry.setManifest(manifest1);

            // Verify populated state (optional sanity check)
            expect(registry.getAll(type1)).toHaveLength(2);
            expect(registry.get(type2, id2)).toEqual(obj2);
            // Removed: expect(registry.getManifest()).toEqual(manifest1);

            // Clear
            registry.clear();

            // Verify cleared state
            expect(registry.get(type1, id1)).toBeUndefined();
            expect(registry.get(type1, id3)).toBeUndefined();
            expect(registry.get(type2, id2)).toBeUndefined();
            expect(registry.getAll(type1)).toEqual([]);
            expect(registry.getAll(type2)).toEqual([]);
            // Removed: expect(registry.getManifest()).toBeNull();
            expect(registry.data.size).toBe(0);
        });

        it('should not throw errors when clearing an already empty registry', () => {
            // Registry is empty initially
            expect(() => registry.clear()).not.toThrow();

            // Verify state remains empty
            // Removed: expect(registry.getManifest()).toBeNull();
            expect(registry.getAll('any_type')).toEqual([]);
            expect(registry.data.size).toBe(0);

            // Clear again
            expect(() => registry.clear()).not.toThrow();
            // Removed: expect(registry.getManifest()).toBeNull();
            expect(registry.getAll('any_type')).toEqual([]); // Re-verify just in case
            expect(registry.data.size).toBe(0);
        });
    });

    // Task 6: Test Interactions (Combine Operations)
    describe('method interactions', () => {
        it('Sequence 1: should handle store -> get -> overwrite -> get correctly', () => {
            const type = 'widgets';
            const id = 'widget:cog';
            const widget1 = {color: 'red'};
            const widget2 = {color: 'blue', size: 10};

            registry.store(type, id, widget1);
            expect(registry.get(type, id)).toEqual(widget1);

            registry.store(type, id, widget2); // Overwrite
            expect(registry.get(type, id)).toEqual(widget2);
        });

        it('Sequence 2: should handle store -> getAll -> clear -> getAll correctly', () => {
            const type = 'gadgets';
            const idA = 'gadget:A';
            const idB = 'gadget:B';
            const gadgetA = {value: 1};
            const gadgetB = {value: 2};

            registry.store(type, idA, gadgetA);
            registry.store(type, idB, gadgetB);

            const allGadgets = registry.getAll(type);
            expect(allGadgets).toHaveLength(2);
            expect(allGadgets).toEqual(expect.arrayContaining([gadgetA, gadgetB]));

            registry.clear();

            expect(registry.getAll(type)).toEqual([]);
        });

        it('Sequence 3: should handle a full cycle of store -> verify -> clear -> verify correctly', () => {
            // 1. Populate
            // Removed: registry.setManifest(manifest1);
            registry.store(type1, id1, obj1);
            registry.store(type2, id2, obj2);

            // 2. Verify populated state
            // Removed: expect(registry.getManifest()).toEqual(manifest1);
            expect(registry.get(type1, id1)).toEqual(obj1);
            expect(registry.getAll(type2)).toEqual([obj2]);

            // 3. Clear
            registry.clear();

            // 4. Verify cleared state
            // Removed: expect(registry.getManifest()).toBeNull();
            expect(registry.get(type1, id1)).toBeUndefined();
            expect(registry.getAll(type2)).toEqual([]);
        });
    });
});