// src/tests/core/services/inMemoryDataRegistry.comprehensive.test.js

import InMemoryDataRegistry from '../../../core/services/inMemoryDataRegistry.js';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'; // Adjust path as needed

describe('InMemoryDataRegistry', () => {
  /** @type {InMemoryDataRegistry} */
  let registry;

  // Create a fresh registry instance before each test
  beforeEach(() => {
    registry = new InMemoryDataRegistry();
    // Mock console.error to prevent actual error logging during tests
    // and allow checking if it was called (optional but good practice)
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Restore console.error after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with an empty data map', () => {
      // Internal inspection isn't ideal, but possible for testing setup
      expect(registry.data).toBeInstanceOf(Map);
      expect(registry.data.size).toBe(0);
    });

    it('should initialize with a null manifest', () => {
      expect(registry.getManifest()).toBeNull();
    });
  });

  describe('store() / get()', () => {
    it('should store and retrieve a data object correctly', () => {
      const testData = { id: 'item1', name: 'Test Item', value: 100 };
      registry.store('items', 'item1', testData);
      const retrieved = registry.get('items', 'item1');
      expect(retrieved).toEqual(testData);
    });

    it('should return undefined when getting data with non-existent ID', () => {
      registry.store('items', 'item1', { id: 'item1' });
      const retrieved = registry.get('items', 'nonExistentId');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined when getting data with non-existent type', () => {
      registry.store('items', 'item1', { id: 'item1' });
      const retrieved = registry.get('nonExistentType', 'item1');
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing data when storing with the same type and ID', () => {
      const initialData = { id: 'item1', name: 'Old Item' };
      const newData = { id: 'item1', name: 'New Item', description: 'Updated' };
      registry.store('items', 'item1', initialData);
      registry.store('items', 'item1', newData);
      const retrieved = registry.get('items', 'item1');
      expect(retrieved).toEqual(newData); // Should have the new data
      expect(retrieved).not.toEqual(initialData);
    });

    it('should handle storing multiple types of data', () => {
      const itemData = { id: 'potion', type: 'consumable' };
      const actionData = { id: 'use', command: 'use', target: 'item' };
      const entityData = { id: 'player', hp: 100 };

      registry.store('items', 'potion', itemData);
      registry.store('actions', 'use', actionData);
      registry.store('entities', 'player', entityData);

      expect(registry.get('items', 'potion')).toEqual(itemData);
      expect(registry.get('actions', 'use')).toEqual(actionData);
      expect(registry.get('entities', 'player')).toEqual(entityData);
      expect(registry.get('items', 'use')).toBeUndefined(); // Check wrong type
    });

    it('should log an error and not store if type is invalid', () => {
      const testData = { id: 'test' };
      registry.store('', 'validId', testData); // Empty type
      registry.store(' ', 'validId', testData); // Whitespace type
      registry.store(null, 'validId', testData); // Null type
      registry.store(undefined, 'validId', testData); // Undefined type

      expect(console.error).toHaveBeenCalledTimes(4);
      expect(registry.data.size).toBe(0); // No types should have been created
      expect(registry.get('', 'validId')).toBeUndefined();
    });

    it('should log an error and not store if ID is invalid', () => {
      const testData = { id: 'test' };
      registry.store('validType', '', testData); // Empty ID
      registry.store('validType', ' ', testData); // Whitespace ID
      registry.store('validType', null, testData); // Null ID
      registry.store('validType', undefined, testData); // Undefined ID

      expect(console.error).toHaveBeenCalledTimes(4);
      expect(registry.get('validType', '')).toBeUndefined();
      expect(registry.getAll('validType')).toEqual([]); // Type might exist but no data stored
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
      registry.store('items', 'item1', { id: 'item1' }); // Store something else
      expect(registry.getAll('actions')).toEqual([]);
    });

    it('should return an array with a single object for a type with one item', () => {
      const itemData = { id: 'item1', name: 'Test Item' };
      registry.store('items', 'item1', itemData);
      const allItems = registry.getAll('items');
      expect(allItems).toEqual([itemData]);
    });

    it('should return an array with all objects for a type with multiple items', () => {
      const item1 = { id: 'item1', name: 'Test Item 1' };
      const item2 = { id: 'item2', name: 'Test Item 2' };
      const action1 = { id: 'action1', name: 'Action 1' }; // Different type

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
      registry.store('actions', 'action1', { id: 'action1' });
      registry.store('entities', 'player', { id: 'player' });
      const rules = registry.getAllSystemRules();
      expect(rules).toEqual([]);
    });

    it('should return all stored system rules when they exist', () => {
      const rule1 = { rule_id: 'rule-001', event_type: 'test-event', actions: [] };
      const rule2 = { rule_id: 'rule-002', event_type: 'another-event', condition: {}, actions: [] };

      registry.store('rules', 'rule-001', rule1);
      registry.store('rules', 'rule-002', rule2);
      registry.store('items', 'potion', { id: 'potion' }); // Other data

      const rules = registry.getAllSystemRules();

      expect(rules).toBeInstanceOf(Array);
      expect(rules).toHaveLength(2);
      expect(rules).toEqual(expect.arrayContaining([rule1, rule2]));
    });

    it('should return an empty array after clear() is called', () => {
      const rule1 = { rule_id: 'rule-001', event_type: 'test-event', actions: [] };
      registry.store('rules', 'rule-001', rule1);
      expect(registry.getAllSystemRules()).toHaveLength(1); // Verify before clear

      registry.clear();

      expect(registry.getAllSystemRules()).toEqual([]); // Should be empty after clear
    });
  });

  describe('clear()', () => {
    it('should remove all stored typed data', () => {
      registry.store('items', 'item1', { id: 'item1' });
      registry.store('actions', 'action1', { id: 'action1' });
      expect(registry.getAll('items').length).toBe(1); // Verify data exists

      registry.clear();

      expect(registry.getAll('items')).toEqual([]);
      expect(registry.getAll('actions')).toEqual([]);
      expect(registry.get('items', 'item1')).toBeUndefined();
      // Internal check (less ideal but verifies map clearing)
      expect(registry.data.size).toBe(0);
    });

    it('should reset the manifest to null', () => {
      const manifestData = { world: 'TestWorld' };
      registry.setManifest(manifestData);
      expect(registry.getManifest()).toEqual(manifestData); // Verify manifest exists

      registry.clear();

      expect(registry.getManifest()).toBeNull();
    });

    it('should work correctly when called on an empty registry', () => {
      expect(() => registry.clear()).not.toThrow();
      expect(registry.data.size).toBe(0);
      expect(registry.getManifest()).toBeNull();
    });
  });

  describe('setManifest() / getManifest()', () => {
    it('should initially return null for the manifest', () => {
      expect(registry.getManifest()).toBeNull();
    });

    it('should store and retrieve a manifest object', () => {
      const manifestData = { worldName: 'MyWorld', startLocation: 'loc1' };
      registry.setManifest(manifestData);
      expect(registry.getManifest()).toEqual(manifestData);
    });

    it('should overwrite a previously stored manifest', () => {
      const oldManifest = { worldName: 'Old' };
      const newManifest = { worldName: 'New', version: 2 };
      registry.setManifest(oldManifest);
      registry.setManifest(newManifest);
      expect(registry.getManifest()).toEqual(newManifest);
    });

    it('should log an error and not set manifest if data is not a non-null object', () => {
      const initialManifest = { worldName: 'Initial' };
      registry.setManifest(initialManifest); // Set a valid one first

      registry.setManifest(null);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(registry.getManifest()).toEqual(initialManifest); // Should still hold the initial one

      registry.setManifest(undefined);
      expect(console.error).toHaveBeenCalledTimes(2);
      expect(registry.getManifest()).toEqual(initialManifest);

      registry.setManifest('not an object');
      expect(console.error).toHaveBeenCalledTimes(3);
      expect(registry.getManifest()).toEqual(initialManifest);

      registry.setManifest(123);
      expect(console.error).toHaveBeenCalledTimes(4);
      expect(registry.getManifest()).toEqual(initialManifest);
    });
  });

  // --- Specific Getter Tests (Add more as needed) ---

  describe('getEntityDefinition()', () => {
    const entity = { id: 'goblin', type: 'monster' };
    const location = { id: 'cave', type: 'location', description: 'dark' };
    const item = { id: 'sword', type: 'weapon' };
    const connection = {id: 'door', type: 'portal'};

    beforeEach(() => {
      registry.store('entities', entity.id, entity);
      registry.store('locations', location.id, location);
      registry.store('items', item.id, item);
      registry.store('connections', connection.id, connection);
    });

    it('should retrieve definition from "entities" type', () => {
      expect(registry.getEntityDefinition('goblin')).toEqual(entity);
    });
    it('should retrieve definition from "locations" type', () => {
      expect(registry.getEntityDefinition('cave')).toEqual(location);
    });
    it('should retrieve definition from "items" type', () => {
      expect(registry.getEntityDefinition('sword')).toEqual(item);
    });
    it('should retrieve definition from "connections" type', () => {
      expect(registry.getEntityDefinition('door')).toEqual(connection);
    });
    it('should return undefined if ID not found in any relevant type', () => {
      expect(registry.getEntityDefinition('dragon')).toBeUndefined();
    });
  });

  describe('getActionDefinition() / getAllActionDefinitions()', () => {
    const action1 = { id: 'look', command: 'look' };
    const action2 = { id: 'take', command: 'take' };

    beforeEach(() => {
      registry.store('actions', action1.id, action1);
      registry.store('actions', action2.id, action2);
      registry.store('items', 'potion', { id: 'potion'}); // Other type
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

  describe('getLocationDefinition()', () => {
    const loc1 = { id: 'town', type: 'location', description: 'bustling' };
    const loc2AsEntity = { id: 'forest', type: 'area', description: 'ancient' }; // Stored under 'entities'

    beforeEach(() => {
      registry.store('locations', loc1.id, loc1);
      registry.store('entities', loc2AsEntity.id, loc2AsEntity);
      registry.store('items', 'key', { id: 'key'}); // Other type
    });

    it('should retrieve location stored under "locations"', () => {
      expect(registry.getLocationDefinition('town')).toEqual(loc1);
    });

    it('should retrieve location stored under "entities" if not found under "locations"', () => {
      expect(registry.getLocationDefinition('forest')).toEqual(loc2AsEntity);
    });

    it('should prioritize "locations" type if ID exists in both', () => {
      const locForestAsLoc = {id: 'forest', type: 'location', description: 'overridden'};
      registry.store('locations', locForestAsLoc.id, locForestAsLoc); // Add under 'locations' too
      expect(registry.getLocationDefinition('forest')).toEqual(locForestAsLoc); // Should get this one
    });

    it('should return undefined if location ID not found in either type', () => {
      expect(registry.getLocationDefinition('castle')).toBeUndefined();
    });

    it('should return undefined for ID of different type', () => {
      expect(registry.getLocationDefinition('key')).toBeUndefined();
    });
  });

});