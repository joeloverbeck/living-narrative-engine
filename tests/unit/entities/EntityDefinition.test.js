import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { expectErrorWithMessage } from '../../common/entities/index.js';

describe('EntityDefinition', () => {
  const validDefinitionData = {
    description: 'A simple test goblin',
    components: {
      'core:health': { current: 10, max: 10 },
      'core:name': { name: 'Gobbo' },
    },
  };

  const validDefinitionId = 'test:goblin';

  it('should be creatable with valid ID and data', () => {
    const definition = new EntityDefinition(
      validDefinitionId,
      validDefinitionData
    );
    expect(definition).toBeInstanceOf(EntityDefinition);
    expect(definition.id).toBe(validDefinitionId);
    expect(definition.description).toBe(validDefinitionData.description);
  });

  it('should throw an error if ID is invalid', () => {
    expectErrorWithMessage(
      () => new EntityDefinition(null, validDefinitionData),
      Error,
      'EntityDefinition requires a valid string id.'
    );
    expectErrorWithMessage(
      () => new EntityDefinition('', validDefinitionData),
      Error,
      'EntityDefinition requires a valid string id.'
    );
    expectErrorWithMessage(
      () => new EntityDefinition('  ', validDefinitionData),
      Error,
      'EntityDefinition requires a valid string id.'
    );
  });

  describe('definitionData and components handling', () => {
    it('should throw an error if definitionData itself is invalid', () => {
      expectErrorWithMessage(
        () => new EntityDefinition(validDefinitionId, null),
        Error,
        'EntityDefinition requires definitionData to be an object.'
      );
      expectErrorWithMessage(
        () => new EntityDefinition(validDefinitionId, undefined),
        Error,
        'EntityDefinition requires definitionData to be an object.'
      );
      expectErrorWithMessage(
        () => new EntityDefinition(validDefinitionId, 'not-an-object-at-all'),
        Error,
        'EntityDefinition requires definitionData to be an object.'
      );
    });

    it('should default to empty components if definitionData.components is missing', () => {
      const definition = new EntityDefinition(validDefinitionId, {
        description: 'No components property',
      });
      expect(definition.components).toEqual({});
      expect(Object.isFrozen(definition.components)).toBe(true);
    });

    it('should default to empty components if definitionData.components is null', () => {
      const definition = new EntityDefinition(validDefinitionId, {
        components: null,
      });
      expect(definition.components).toEqual({});
      expect(Object.isFrozen(definition.components)).toBe(true);
    });

    it('should default to empty components if definitionData.components is not an object (e.g., a string)', () => {
      // This covers cases where components might be an invalid type but not null/undefined
      const definition = new EntityDefinition(validDefinitionId, {
        components: 'not-an-object',
      });
      expect(definition.components).toEqual({});
      expect(Object.isFrozen(definition.components)).toBe(true);
    });
  });

  it('should have deeply frozen components', () => {
    const definition = new EntityDefinition(
      validDefinitionId,
      validDefinitionData
    );
    expect(Object.isFrozen(definition.components)).toBe(true);
    expect(Object.isFrozen(definition.components['core:health'])).toBe(true);

    // Attempt to modify a component property (should fail silently or throw in strict mode)
    // Jest tests often run in strict mode implicitly or can be configured.
    expect(() => {
      definition.components['core:health'].max = 20;
    }).toThrow(TypeError); // Or expect it not to change if no throw
    expect(definition.components['core:health'].max).toBe(10);

    expect(() => {
      definition.components['new:comp'] = { data: 'test' };
    }).toThrow(TypeError);
    expect(definition.components['new:comp']).toBeUndefined();
  });

  it('should correctly return modId', () => {
    const definition1 = new EntityDefinition(
      'core:player',
      validDefinitionData
    );
    expect(definition1.modId).toBe('core');

    const definition2 = new EntityDefinition(
      'myMod:creature',
      validDefinitionData
    );
    expect(definition2.modId).toBe('myMod');

    const definition3 = new EntityDefinition('noPrefix', validDefinitionData);
    expect(definition3.modId).toBeUndefined(); // Or potentially 'noPrefix' if that's the desired behavior for single-token IDs

    const definition4 = new EntityDefinition(
      'foo:bar:baz',
      validDefinitionData
    );
    expect(definition4.modId).toBe('foo');

    const definition5 = new EntityDefinition(
      ':startsWithColon',
      validDefinitionData
    );
    expect(definition5.modId).toBeUndefined();
  });

  describe('getComponentSchema', () => {
    it('should return component data if it exists', () => {
      const definition = new EntityDefinition(
        validDefinitionId,
        validDefinitionData
      );
      const healthData = definition.getComponentTemplate('core:health');
      expect(healthData).toEqual({ current: 10, max: 10 });
    });

    it('should return undefined if component data does not exist', () => {
      const definition = new EntityDefinition(
        validDefinitionId,
        validDefinitionData
      );
      const nonExistentData = definition.getComponentTemplate('core:mana');
      expect(nonExistentData).toBeUndefined();
    });
  });

  describe('hasComponent', () => {
    it('should return true if component exists', () => {
      const definition = new EntityDefinition(
        validDefinitionId,
        validDefinitionData
      );
      expect(definition.hasComponent('core:health')).toBe(true);
    });

    it('should return false if component does not exist', () => {
      const definition = new EntityDefinition(
        validDefinitionId,
        validDefinitionData
      );
      expect(definition.hasComponent('core:mana')).toBe(false);
    });
  });
});
