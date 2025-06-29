import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';

describe('EntityInstanceData', () => {
  const definitionData = {
    description: 'Test Creature',
    components: {
      'core:health': { current: 50, max: 50, regen: 1 },
      'core:name': { name: 'Default Name' },
      'custom:mana': { current: 20, max: 20 },
    },
  };
  let entityDef;

  beforeEach(() => {
    entityDef = new EntityDefinition('test:creature', definitionData);
  });

  const validInstanceId = 'instance-123';

  it('should be creatable with valid instanceId and EntityDefinition', () => {
    const instanceData = new EntityInstanceData(
      validInstanceId,
      entityDef,
      {},
      console
    );
    expect(instanceData).toBeInstanceOf(EntityInstanceData);
    expect(instanceData.instanceId).toBe(validInstanceId);
    expect(instanceData.definition).toBe(entityDef);
    expect(instanceData.overrides).toEqual({});
  });

  it('should accept initial overrides', () => {
    const initialOverrides = {
      'core:health': { current: 40 }, // Override one property
      'custom:inventory': { items: ['item1'] }, // New component
    };
    const instanceData = new EntityInstanceData(
      validInstanceId,
      entityDef,
      initialOverrides,
      console
    );
    expect(instanceData.overrides['core:health'].current).toBe(40);
    // Check that it does not affect the original initialOverrides object
    expect(instanceData.overrides['core:health']).not.toBe(
      initialOverrides['core:health']
    );
    expect(instanceData.overrides['custom:inventory']).toEqual({
      items: ['item1'],
    });
  });

  it('should throw an error if instanceId is invalid', () => {
    expect(() => new EntityInstanceData(null, entityDef, {}, console)).toThrow(
      'EntityInstanceData requires a valid string instanceId.'
    );
    expect(() => new EntityInstanceData('', entityDef, {}, console)).toThrow(
      'EntityInstanceData requires a valid string instanceId.'
    );
  });

  it('should throw an error if definition is not an EntityDefinition', () => {
    expect(
      () => new EntityInstanceData(validInstanceId, {}, {}, console)
    ).toThrow('EntityInstanceData requires a valid EntityDefinition object.');
  });

  it('should throw an error if logger lacks required methods', () => {
    const invalidLogger = {};
    expect(
      () =>
        new EntityInstanceData(validInstanceId, entityDef, {}, invalidLogger)
    ).toThrow("Invalid or missing method 'info' on dependency 'ILogger'.");
  });

  describe('getComponentData', () => {
    it('should return data from definition if no override exists', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      const health = instanceData.getComponentData('core:health');
      expect(health).toEqual({ current: 50, max: 50, regen: 1 });
      // Ensure it's a clone and not the definition's object
      expect(health).not.toBe(entityDef.components['core:health']);
    });

    it('should return overridden data if an override exists', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': { current: 30, max: 45 },
        },
        console
      );
      const health = instanceData.getComponentData('core:health');
      // Should now only return the override, not a merge
      expect(health).toEqual({ current: 30, max: 45 });
    });

    it('should merge object properties: override wins over definition', () => {
      // This test title is now a misnomer, as it no longer merges.
      // The behavior is that override replaces.
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': { current: 25 }, // Only current is overridden
        },
        console
      );
      const health = instanceData.getComponentData('core:health');
      expect(health).toEqual({ current: 25 }); // Only the override data should be present
    });

    it('should return a clone of the override if definition does not have the component', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'custom:status': { effect: 'poisoned' },
        },
        console
      );
      const status = instanceData.getComponentData('custom:status');
      expect(status).toEqual({ effect: 'poisoned' });
      expect(status).not.toBe(instanceData.overrides['custom:status']);
    });

    it('should return undefined if component is not in definition or overrides', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(instanceData.getComponentData('non:existent')).toBeUndefined();
    });

    it('should throw a TypeError if override data is null', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(() =>
        instanceData.setComponentOverride('core:health', null)
      ).toThrow(TypeError);
    });

    it('should return a clone, not the original override object, when override is an object', () => {
      const overrideData = { current: 10 };
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': overrideData,
        },
        console
      );
      const health = instanceData.getComponentData('core:health');
      expect(health).not.toBe(overrideData); // Should be a new object due to merging or cloning
      health.current = 5;
      expect(instanceData.overrides['core:health'].current).toBe(10); // Original override unchanged
    });

    it('should return a clone, not the original definition object, when no override and definition data is an object', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      const nameComp = instanceData.getComponentData('core:name');
      expect(nameComp).not.toBe(entityDef.components['core:name']);
      nameComp.name = 'Changed Name';
      expect(entityDef.components['core:name'].name).toBe('Default Name'); // Definition unchanged
    });
  });

  describe('setComponentOverride', () => {
    it('should add a new override', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      const inventoryData = { items: ['sword'] };
      instanceData.setComponentOverride('custom:inventory', inventoryData);
      expect(instanceData.overrides['custom:inventory']).toEqual(inventoryData);
      expect(instanceData.overrides['custom:inventory']).not.toBe(
        inventoryData
      ); // Should be a clone
    });

    it('should update an existing override', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': { current: 30 },
        },
        console
      );
      instanceData.setComponentOverride('core:health', {
        current: 20,
        max: 40,
      });
      expect(instanceData.overrides['core:health']).toEqual({
        current: 20,
        max: 40,
      });
    });

    it('should throw if componentTypeId is invalid', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(() => instanceData.setComponentOverride('', {})).toThrow(
        'Invalid componentTypeId for setComponentOverride.'
      );
    });

    it('should throw a TypeError if componentData is not an object', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(() =>
        instanceData.setComponentOverride('core:health', 42)
      ).toThrow(TypeError);
    });
  });

  describe('removeComponentOverride', () => {
    it('should remove an existing override', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': { current: 30 },
        },
        console
      );
      expect(instanceData.removeComponentOverride('core:health')).toBe(true);
      expect(instanceData.overrides['core:health']).toBeUndefined();
    });

    it('should return false if override does not exist', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(instanceData.removeComponentOverride('core:health')).toBe(false);
    });

    it('getComponentData should fall back to definition after override removal', () => {
      const instanceData = new EntityInstanceData(validInstanceId, entityDef, {
        'core:health': { current: 30 },
      });
      instanceData.removeComponentOverride('core:health');
      const health = instanceData.getComponentData('core:health');
      expect(health).toEqual(definitionData.components['core:health']); // Back to definition's value
    });
  });

  describe('hasComponent', () => {
    it('should return true if component is in definition', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(instanceData.hasComponent('core:health')).toBe(true);
    });

    it('should return true if component is in overrides (even if not in definition)', () => {
      const instanceData = new EntityInstanceData(validInstanceId, entityDef, {
        'custom:status': { effect: 'haste' },
      });
      expect(instanceData.hasComponent('custom:status')).toBe(true);
    });

    it('should return false if component is in neither', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(instanceData.hasComponent('non:existent')).toBe(false);
    });

    it('should throw a TypeError when attempting to set a null override', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      expect(() =>
        instanceData.setComponentOverride('core:health', null)
      ).toThrow(TypeError);
    });
  });

  describe('allComponentTypeIds', () => {
    it('should return keys from definition if no overrides', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {},
        console
      );
      const ids = instanceData.allComponentTypeIds;
      expect(ids).toEqual(
        expect.arrayContaining(['core:health', 'core:name', 'custom:mana'])
      );
      expect(ids.length).toBe(3);
    });

    it('should return a combined set of keys from definition and overrides', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:health': { current: 10 }, // Overlap
          'new:ability': { name: 'fly' }, // New
        },
        console
      );
      const ids = instanceData.allComponentTypeIds;
      expect(ids).toEqual(
        expect.arrayContaining([
          'core:health',
          'core:name',
          'custom:mana',
          'new:ability',
        ])
      );
      expect(ids.length).toBe(4);
    });

    it('should include keys of overrides that are set to null', () => {
      const instanceData = new EntityInstanceData(
        validInstanceId,
        entityDef,
        {
          'core:name': null, // Nullify existing
          'new:aura': null, // New but nullified
        },
        console
      );
      const ids = instanceData.allComponentTypeIds;
      expect(ids).toEqual(
        expect.arrayContaining([
          'core:health',
          'core:name',
          'custom:mana',
          'new:aura',
        ])
      );
      expect(ids.length).toBe(4);
    });
  });
});
