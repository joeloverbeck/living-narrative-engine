// tests/entities/entity.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import Entity from '../../../src/entities/entity.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Entity Class', () => {
  const testDefinitionId = 'testDef:basic';
  const testInstanceId = 'testInstance-123';
  let mockDefinition;
  let mockInstanceData;
  let entity;

  // Base definition data for most tests
  const baseDefinitionComponents = {
    'core:name': { name: 'DefaultName' },
    'core:health': { current: 100, max: 100 },
  };

  beforeEach(() => {
    // Create a fresh mock EntityDefinition
    mockDefinition = new EntityDefinition(testDefinitionId, {
      description: 'A test definition',
      components: JSON.parse(JSON.stringify(baseDefinitionComponents)), // Deep clone for isolation
    });

    // Create a fresh mock EntityInstanceData
    // Spies are on the prototype, so they need to be fresh for each test if a method is called multiple times across tests.
    // However, for most of these tests, we're checking the Entity's behavior given a certain state of InstanceData,
    // so direct spies on the instance passed to Entity constructor are fine.
    mockInstanceData = new EntityInstanceData(
      testInstanceId,
      mockDefinition,
      {},
      console
    );

    entity = new Entity(mockInstanceData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- 1. Constructor Tests ---
  describe('constructor', () => {
    it('should create an instance successfully with a valid EntityInstanceData object', () => {
      expect(entity).toBeInstanceOf(Entity);
    });

    it('should assign the _instanceData property correctly', () => {
      expect(entity.instanceData).toBe(mockInstanceData); // Changed from _instanceData to data
    });

    it('should throw an Error if not provided with an EntityInstanceData object', () => {
      expect(() => new Entity(null)).toThrow(
        'Entity must be initialized with an EntityInstanceData object.'
      );
      expect(() => new Entity({})).toThrow(
        'Entity must be initialized with an EntityInstanceData object.'
      );
    });

    it('should correctly get id from instanceData', () => {
      expect(entity.id).toBe(testInstanceId);
    });

    it('should correctly get definitionId from instanceData.definition', () => {
      expect(entity.definitionId).toBe(testDefinitionId);
    });
  });

  // --- 2. Component Management Method Tests (Delegation) ---
  describe('addComponent (as setComponentOverride)', () => {
    it('should call _instanceData.setComponentOverride with the componentTypeId and componentData', () => {
      const spy = jest.spyOn(mockInstanceData, 'setComponentOverride');
      const componentTypeId = 'core:armor';
      const componentData = { value: 10 };
      entity.addComponent(componentTypeId, componentData);
      expect(spy).toHaveBeenCalledWith(componentTypeId, componentData);
      spy.mockRestore();
    });

    it('should throw if componentTypeId is invalid (as per Entity.js own check)', () => {
      expect(() => entity.addComponent('', { data: 'test' })).toThrow(
        `Invalid componentTypeId provided to addComponent for entity ${entity.id}. Expected non-empty string.`
      );
      expect(() => entity.addComponent(null, { data: 'test' })).toThrow(
        `Invalid componentTypeId provided to addComponent for entity ${entity.id}. Expected non-empty string.`
      );
    });
  });

  describe('getComponentData', () => {
    it('should call _instanceData.getComponentData and return its result', () => {
      const spy = jest.spyOn(mockInstanceData, 'getComponentData');
      const expectedData = { current: 90, max: 100 };
      spy.mockReturnValue(expectedData); // Mock the return value

      const componentTypeId = 'core:health';
      const actualData = entity.getComponentData(componentTypeId);

      expect(spy).toHaveBeenCalledWith(componentTypeId);
      expect(actualData).toEqual(expectedData); // Use toEqual for objects
      spy.mockRestore();
    });

    it('should return merged data (definition + override) correctly via instanceData', () => {
      const def = new EntityDefinition('test:def', {
        components: {
          'core:health': { current: 100, max: 100 },
        },
      });
      const instanceData = new EntityInstanceData(
        'test-id',
        def,
        {
          'core:health': { current: 50 }, // Override only current
        },
        console
      );
      const entity = new Entity(instanceData);

      const healthData = entity.getComponentData('core:health');
      // Override replaces, so only { current: 50 } should be present.
      expect(healthData).toEqual({ current: 50 });
    });

    it('should return data only from definition if no override', () => {
      const nameData = entity.getComponentData('core:name');
      expect(nameData).toEqual({ name: 'DefaultName' });
    });

    it('should return data only from override if not in definition', () => {
      mockInstanceData.setComponentOverride('custom:mana', { current: 20 });
      const manaData = entity.getComponentData('custom:mana');
      expect(manaData).toEqual({ current: 20 });
    });

    it('should return undefined for a non-existent componentTypeId', () => {
      expect(entity.getComponentData('non:existent')).toBeUndefined();
    });

    it('should throw a TypeError if the override data is null', () => {
      expect(() =>
        mockInstanceData.setComponentOverride('core:health', null)
      ).toThrow(TypeError);
    });
  });

  describe('hasComponent', () => {
    it('should call _instanceData.hasComponent and return its result', () => {
      const componentTypeId = 'core:health';
      const spy = jest.spyOn(mockInstanceData, 'hasComponent');
      const result = entity.hasComponent(componentTypeId);

      expect(spy).toHaveBeenCalledWith(componentTypeId);
      expect(result).toBe(true);
      spy.mockRestore();
    });

    it('should return true if component in definition (via instanceData)', () => {
      expect(entity.hasComponent('core:name')).toBe(true);
    });

    it('should return true if component in override (via instanceData)', () => {
      mockInstanceData.setComponentOverride('custom:inventory', { items: [] });
      expect(entity.hasComponent('custom:inventory')).toBe(true);
    });

    it('should return false if component not in definition or overrides (via instanceData)', () => {
      expect(entity.hasComponent('non:existent')).toBe(false);
    });
  });

  describe('removeComponent (as removeComponentOverride)', () => {
    it('should call _instanceData.removeComponentOverride and return its result', () => {
      const spy = jest.spyOn(mockInstanceData, 'removeComponentOverride');
      spy.mockReturnValue(true); // Mock the return value

      const componentTypeId = 'core:health';
      const result = entity.removeComponent(componentTypeId);

      expect(spy).toHaveBeenCalledWith(componentTypeId);
      expect(result).toBe(true);
      spy.mockRestore();
    });

    it('getComponentData should fall back to definition after removing an override', () => {
      // Override: current: 50
      mockInstanceData.setComponentOverride('core:health', { current: 50 });
      let healthData = entity.getComponentData('core:health');
      expect(healthData.current).toBe(50);

      const removed = entity.removeComponent('core:health'); // Removes the override
      expect(removed).toBe(true);

      healthData = entity.getComponentData('core:health');
      // Should now be definition's value: { current: 100, max: 100 }
      expect(healthData.current).toBe(100);
      expect(healthData.max).toBe(100);
    });
  });

  describe('hasComponentOverride', () => {
    it('should reflect override presence accurately', () => {
      expect(entity.hasComponentOverride('core:health')).toBe(false);

      mockInstanceData.setComponentOverride('core:health', { current: 90 });
      expect(entity.hasComponentOverride('core:health')).toBe(true);

      mockInstanceData.removeComponentOverride('core:health');
      expect(entity.hasComponentOverride('core:health')).toBe(false);
    });
  });

  describe('getComponent alias', () => {
    it('should forward to getComponentData and return the same result', () => {
      const sentinel = { current: 77 };
      jest.spyOn(entity, 'getComponentData').mockReturnValueOnce(sentinel);

      const result = entity.getComponent('core:health');

      expect(entity.getComponentData).toHaveBeenCalledWith('core:health');
      expect(result).toBe(sentinel);
    });
  });

  // --- 3. Iterators and Getters ---
  describe('componentTypeIds getter', () => {
    it('should return an array for allComponentTypeIds from _instanceData', () => {
      const expectedIds = ['core:name', 'core:health', 'custom:mana'];
      // Ensure the mock returns something predictable
      jest
        .spyOn(mockInstanceData, 'allComponentTypeIds', 'get')
        .mockReturnValue(expectedIds);

      const ids = entity.componentTypeIds; // No longer need Array.from()
      expect(ids).toEqual(expectedIds);

      // Verify it called the getter on _instanceData
      expect(mockInstanceData.allComponentTypeIds).toEqual(expectedIds); // Check if the getter was accessed
    });

    it('should reflect definition and overrides', () => {
      mockInstanceData.setComponentOverride('custom:mana', { current: 20 });
      mockInstanceData.setComponentOverride('core:name', {
        name: 'OverrideName',
      }); // Override existing

      const ids = entity.componentTypeIds;
      expect(ids).toEqual(
        expect.arrayContaining(['core:name', 'core:health', 'custom:mana'])
      );
      expect(ids.length).toBe(3); // 'core:name' is overridden, not added twice
    });
  });

  describe('allComponentData getter', () => {
    it('should yield merged component data for each component type ID', () => {
      const definition = new EntityDefinition('test:complex', {
        components: {
          'core:name': { name: 'DefaultName' },
          'core:health': { current: 100, max: 100 }, // Definition data
        },
      });
      const instanceData = new EntityInstanceData(
        'entity-complex',
        definition,
        {
          'core:health': { current: 50 }, // Override only current health
          'custom:inventory': { items: ['potion'] },
        },
        console
      );
      const entity = new Entity(instanceData);

      const collectedData = entity.allComponentData;

      expect(collectedData).toEqual(
        expect.arrayContaining([
          { name: 'DefaultName' },
          { current: 50 }, // Health should now only have the overridden part
          { items: ['potion'] },
        ])
      );
      // Check that the length is also correct (no extra/missing components)
      expect(collectedData.length).toBe(3);
    });

    it('should throw a TypeError when setting a null override', () => {
      expect(() =>
        mockInstanceData.setComponentOverride('core:health', null)
      ).toThrow(TypeError);
    });
  });

  describe('componentEntries getter', () => {
    it('should yield [typeId, mergedData] pairs for each component type ID', () => {
      const definition = new EntityDefinition('test:entries', {
        components: {
          'core:name': { name: 'DefaultName' },
          'core:health': { current: 100, max: 100 },
        },
      });
      const instanceData = new EntityInstanceData(
        'entity-entries',
        definition,
        {
          'core:health': { current: 75 }, // Override only current health
          'custom:stamina': { value: 30 },
        },
        console
      );
      const entity = new Entity(instanceData);

      const collectedEntries = entity.componentEntries;

      expect(collectedEntries).toEqual(
        expect.arrayContaining([
          ['core:name', { name: 'DefaultName' }],
          ['core:health', { current: 75 }], // Health should now only have the overridden part
          ['custom:stamina', { value: 30 }],
        ])
      );
      // Check that the length is also correct
      expect(collectedEntries.length).toBe(3);
    });

    it('should throw a TypeError when overriding with null', () => {
      expect(() =>
        mockInstanceData.setComponentOverride('core:name', null)
      ).toThrow(TypeError);
    });
  });

  describe('getAllComponents and components getters', () => {
    it('should return mapped component data including null overrides but skipping undefined entries', () => {
      const definition = new EntityDefinition('test:all-components', {
        components: {
          'core:name': { name: 'DefaultName' },
          'core:ghost': undefined,
        },
      });
      const instanceData = new EntityInstanceData(
        'entity-all-components',
        definition,
        {
          'custom:visible': { flag: true },
          'custom:nullish': null,
        },
        console
      );
      const entityWithGaps = new Entity(instanceData);

      const allComponents = entityWithGaps.getAllComponents();

      expect(allComponents).toEqual({
        'core:name': { name: 'DefaultName' },
        'custom:visible': { flag: true },
        'custom:nullish': null,
      });
      expect(allComponents).not.toHaveProperty('core:ghost');
      const componentsFromGetter = entityWithGaps.components;
      expect(componentsFromGetter).toEqual(allComponents);
      expect(componentsFromGetter).not.toBe(allComponents); // ensure getter clones
    });
  });

  describe('modifyComponent', () => {
    it('should merge updates with existing component data', () => {
      const result = entity.modifyComponent('core:health', { regen: 5 });

      expect(result).toBe(true);
      expect(entity.getComponentData('core:health')).toEqual({
        current: 100,
        max: 100,
        regen: 5,
      });
      expect(mockDefinition.components['core:health']).toEqual({
        current: 100,
        max: 100,
      });
    });

    it('should add a component when one does not already exist', () => {
      const result = entity.modifyComponent('custom:mana', { current: 40 });

      expect(result).toBe(true);
      expect(entity.getComponentData('custom:mana')).toEqual({ current: 40 });
    });
  });

  describe('componentEntries filtering', () => {
    it('should exclude entries whose data resolves to null or undefined', () => {
      const definition = new EntityDefinition('test:filter', {
        components: {
          'core:name': { name: 'Base' },
          'core:ghost': undefined,
        },
      });
      const instanceData = new EntityInstanceData(
        'entity-filter',
        definition,
        {
          'custom:nullish': null,
          'custom:present': { foo: 'bar' },
        },
        console
      );
      const entityWithFilteredEntries = new Entity(instanceData);

      const entries = entityWithFilteredEntries.componentEntries;

      expect(entries).toEqual(
        expect.arrayContaining([
          ['core:name', { name: 'Base' }],
          ['custom:present', { foo: 'bar' }],
        ])
      );
      expect(entries).toHaveLength(2);
      expect(entries.find(([key]) => key === 'core:ghost')).toBeUndefined();
      expect(entries.find(([key]) => key === 'custom:nullish')).toBeUndefined();
    });
  });

  // --- 4. toString Method ---
  describe('toString', () => {
    it('should return a string representation of the entity including its ID, DefID and component types', () => {
      mockInstanceData.setComponentOverride('custom:mana', { current: 10 });
      const str = entity.toString();
      expect(str).toContain(
        `Entity[${testInstanceId} (Def: ${testDefinitionId})]`
      );
      expect(str).toContain('core:name');
      expect(str).toContain('core:health');
      expect(str).toContain('custom:mana');
    });

    it('should display "None" if no components are present', () => {
      const emptyDef = new EntityDefinition('empty:def', { components: {} });
      const emptyInstanceData = new EntityInstanceData(
        'emptyInst',
        emptyDef,
        {},
        console
      );
      const emptyEntity = new Entity(emptyInstanceData);

      const expectedString =
        'Entity[emptyInst (Def: empty:def)] Components: None';
      expect(emptyEntity.toString()).toBe(expectedString);
    });
  });

  // --- 5. instanceData getter ---
  describe('instanceData getter', () => {
    it('should return the underlying EntityInstanceData object', () => {
      expect(entity.instanceData).toBe(mockInstanceData);
    });
  });
});
