import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';

function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('EntityInstanceData integration', () => {
  let definition;
  let logger;

  beforeEach(() => {
    definition = new EntityDefinition('test:creature', {
      description: 'A test entity for integration coverage',
      components: {
        'movement:speed': { base: 4 },
        'appearance:palette': { primary: 'green' },
      },
    });
    logger = createTestLogger();
  });

  describe('constructor validation', () => {
    it('throws when the instance id is invalid', () => {
      expect(() => {
        new EntityInstanceData('', definition);
      }).toThrow('EntityInstanceData requires a valid string instanceId.');
    });

    it('throws when the definition dependency is invalid', () => {
      expect(() => {
        new EntityInstanceData('valid-id', { invalid: true });
      }).toThrow('EntityInstanceData requires a valid EntityDefinition object.');
    });
  });

  describe('component data retrieval semantics', () => {
    let instance;

    beforeEach(() => {
      instance = new EntityInstanceData(
        'instance-with-overrides',
        definition,
        {
          'appearance:palette': { primary: 'purple' },
          'interaction:custom': { enabled: true },
          'inventory:equipment': null,
        },
        logger
      );
    });

    it('returns a clone of override data when present and leaves the stored data frozen', () => {
      const data = instance.getComponentData('appearance:palette');
      expect(data).toEqual({ primary: 'purple' });
      data.primary = 'mutated';
      expect(instance.getComponentData('appearance:palette')).toEqual({
        primary: 'purple',
      });
    });

    it('returns definition data when overrides are absent and protects the frozen template', () => {
      const data = instance.getComponentData('movement:speed');
      expect(data).toEqual({ base: 4 });
      data.base = 999;
      expect(instance.getComponentData('movement:speed')).toEqual({ base: 4 });
    });

    it('returns null when an override explicitly nullifies the component', () => {
      expect(instance.getComponentData('inventory:equipment')).toBeNull();
    });

    it('returns undefined when the component is missing from definition and overrides', () => {
      expect(instance.getComponentData('nonexistent:component')).toBeUndefined();
    });
  });

  describe('override management', () => {
    let instance;

    beforeEach(() => {
      instance = new EntityInstanceData(
        'override-manager',
        definition,
        {
          'appearance:palette': { primary: 'yellow' },
        },
        logger
      );
    });

    it('rejects blank component identifiers when setting overrides', () => {
      expect(() =>
        instance.setComponentOverride('  ', { invalid: true })
      ).toThrow('Invalid componentTypeId for setComponentOverride.');
    });

    it('rejects non-object override payloads', () => {
      expect(() =>
        instance.setComponentOverride('appearance:palette', null)
      ).toThrow('componentData must be a non-null object.');
    });

    it('adds and removes overrides while keeping the overrides map immutable', () => {
      instance.setComponentOverride('interaction:custom', { enabled: true });
      expect(instance.hasComponentOverride('interaction:custom')).toBe(true);
      expect(instance.getComponentData('interaction:custom')).toEqual({
        enabled: true,
      });

      const overridesSnapshot = instance.overrides;
      expect(Object.isFrozen(overridesSnapshot)).toBe(true);

      expect(instance.removeComponentOverride('  ')).toBe(false);
      expect(instance.removeComponentOverride('missing:component')).toBe(false);

      expect(instance.removeComponentOverride('interaction:custom')).toBe(true);
      expect(instance.hasComponentOverride('interaction:custom')).toBe(false);
    });
  });

  describe('component presence queries', () => {
    let instance;

    beforeEach(() => {
      instance = new EntityInstanceData(
        'query-instance',
        definition,
        {
          'appearance:palette': { primary: 'cyan' },
          'inventory:equipment': null,
        },
        logger
      );
    });

    it('warns about the deprecated override check flag and delegates to hasComponentOverride', () => {
      const result = instance.hasComponent('appearance:palette', true);
      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'EntityInstanceData.hasComponent: The checkOverrideOnly flag is deprecated. Use hasComponentOverride(componentTypeId) instead.'
      );
    });

    it('considers explicit null overrides as present while validating inputs defensively', () => {
      expect(instance.hasComponent('inventory:equipment')).toBe(true);
      expect(instance.hasComponent('   ')).toBe(false);
      expect(instance.hasComponentOverride('   ')).toBe(false);
    });
  });
});
