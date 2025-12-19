/**
 * @file Unit tests for ModEntityBuilder and ModEntityScenarios
 * @description Comprehensive test coverage for the fluent entity builder API
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../../tests/common/mods/ModEntityBuilder.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('ModEntityBuilder', () => {
  describe('constructor', () => {
    it('should create builder with entity ID', () => {
      const builder = new ModEntityBuilder('test_entity');

      expect(builder.entityData).toEqual({
        id: 'test_entity',
        components: {},
      });
    });

    it('should allow method chaining from constructor', () => {
      const result = new ModEntityBuilder('test_entity').withName('Test');

      expect(result).toBeInstanceOf(ModEntityBuilder);
      expect(result.entityData.components[NAME_COMPONENT_ID]).toEqual({
        text: 'Test',
      });
    });

    it('should handle various entity ID formats', () => {
      const formats = [
        'simple',
        'test:namespaced',
        'actor1',
        'p_erotica:character_instance',
      ];

      formats.forEach((id) => {
        const builder = new ModEntityBuilder(id);
        expect(builder.entityData.id).toBe(id);
      });
    });

    it('should throw error for blank entity ID', () => {
      expect(() => new ModEntityBuilder('')).toThrow('Entity ID');
      expect(() => new ModEntityBuilder(null)).toThrow('Entity ID');
      expect(() => new ModEntityBuilder(undefined)).toThrow('Entity ID');
    });
  });

  describe('withName', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should set NAME_COMPONENT_ID with text property', () => {
      const result = builder.withName('Alice');

      expect(result.entityData.components[NAME_COMPONENT_ID]).toEqual({
        text: 'Alice',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.withName('Alice');

      expect(result).toBe(builder);
    });

    it('should handle various name formats', () => {
      const names = [
        'Alice',
        'Bob the Builder',
        'Character-With-Hyphens',
        'Unicode名前',
      ];

      names.forEach((name) => {
        const testBuilder = new ModEntityBuilder('test');
        testBuilder.withName(name);
        expect(testBuilder.entityData.components[NAME_COMPONENT_ID].text).toBe(
          name
        );
      });
    });

    it('should overwrite existing name when called multiple times', () => {
      builder.withName('First Name').withName('Second Name');

      expect(builder.entityData.components[NAME_COMPONENT_ID].text).toBe(
        'Second Name'
      );
    });

    it('should throw error for blank name', () => {
      expect(() => builder.withName('')).toThrow('Entity name');
      expect(() => builder.withName(null)).toThrow('Entity name');
      expect(() => builder.withName(undefined)).toThrow('Entity name');
    });
  });

  describe('withDescription', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should set DESCRIPTION_COMPONENT_ID with text property', () => {
      const result = builder.withDescription('Test description');

      expect(result.entityData.components[DESCRIPTION_COMPONENT_ID]).toEqual({
        text: 'Test description',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.withDescription('Test description');

      expect(result).toBe(builder);
    });

    it('should throw error for blank description', () => {
      expect(() => builder.withDescription('')).toThrow('Entity description');
      expect(() => builder.withDescription(null)).toThrow('Entity description');
      expect(() => builder.withDescription(undefined)).toThrow(
        'Entity description'
      );
    });
  });

  describe('atLocation', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should set POSITION_COMPONENT_ID with locationId', () => {
      const result = builder.atLocation('room1');

      expect(result.entityData.components[POSITION_COMPONENT_ID]).toEqual({
        locationId: 'room1',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.atLocation('room1');

      expect(result).toBe(builder);
    });

    it('should handle various location ID formats', () => {
      const locations = [
        'room1',
        'core:bedroom',
        'test:location_instance',
        'kitchen_area',
      ];

      locations.forEach((location) => {
        const testBuilder = new ModEntityBuilder('test');
        testBuilder.atLocation(location);
        expect(
          testBuilder.entityData.components[POSITION_COMPONENT_ID].locationId
        ).toBe(location);
      });
    });

    it('should overwrite existing location when called multiple times', () => {
      builder.atLocation('room1').atLocation('room2');

      expect(
        builder.entityData.components[POSITION_COMPONENT_ID].locationId
      ).toBe('room2');
    });

    it('should throw error for blank location ID', () => {
      expect(() => builder.atLocation('')).toThrow('Location ID');
      expect(() => builder.atLocation(null)).toThrow('Location ID');
      expect(() => builder.atLocation(undefined)).toThrow('Location ID');
    });
  });

  describe('inSameLocationAs', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should set location to match another entity', () => {
      const otherEntity = {
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'shared_room' },
        },
      };

      const result = builder.inSameLocationAs(otherEntity);

      expect(result.entityData.components[POSITION_COMPONENT_ID]).toEqual({
        locationId: 'shared_room',
      });
    });

    it('should return this for method chaining', () => {
      const otherEntity = {
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'shared_room' },
        },
      };

      const result = builder.inSameLocationAs(otherEntity);

      expect(result).toBe(builder);
    });

    it('should throw error for missing other entity', () => {
      expect(() => builder.inSameLocationAs(null)).toThrow();
      expect(() => builder.inSameLocationAs(undefined)).toThrow();
    });

    it('should throw error if other entity has no position component', () => {
      const otherEntity = { components: {} };

      expect(() => builder.inSameLocationAs(otherEntity)).toThrow(
        'must have a position component'
      );
    });

    it('should throw error if other entity has no components', () => {
      const otherEntity = {};

      expect(() => builder.inSameLocationAs(otherEntity)).toThrow(
        'must have a position component'
      );
    });
  });

  describe('closeToEntity', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should create personal-space-states:closeness component with single partner', () => {
      const result = builder.closeToEntity('partner1');

      expect(result.entityData.components['personal-space-states:closeness']).toEqual({
        partners: ['partner1'],
      });
    });

    it('should handle array of partner IDs', () => {
      const result = builder.closeToEntity(['partner1', 'partner2']);

      expect(result.entityData.components['personal-space-states:closeness']).toEqual({
        partners: ['partner1', 'partner2'],
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.closeToEntity('partner1');

      expect(result).toBe(builder);
    });

    it('should overwrite existing partners when called multiple times', () => {
      builder.closeToEntity('partner1').closeToEntity(['partner2', 'partner3']);

      expect(
        builder.entityData.components['personal-space-states:closeness'].partners
      ).toEqual(['partner2', 'partner3']);
    });
  });

  describe('withComponent', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add component with provided data', () => {
      const componentData = { value: 42, text: 'test' };
      const result = builder.withComponent('test:component', componentData);

      expect(result.entityData.components['test:component']).toEqual(
        componentData
      );
    });

    it('should return this for method chaining', () => {
      const result = builder.withComponent('test:component', { data: true });

      expect(result).toBe(builder);
    });

    it('should handle various component types', () => {
      const components = [
        ['core:actor', { isActor: true }],
        ['positioning:facing', { direction: 'north' }],
        ['anatomy:part', { subType: 'torso' }],
        ['custom:component', { customData: 'value' }],
      ];

      components.forEach(([componentId, data]) => {
        const testBuilder = new ModEntityBuilder('test');
        testBuilder.withComponent(componentId, data);
        expect(testBuilder.entityData.components[componentId]).toEqual(data);
      });
    });

    it('should overwrite existing component when called with same ID', () => {
      const firstData = { value: 1 };
      const secondData = { value: 2 };

      builder
        .withComponent('test:component', firstData)
        .withComponent('test:component', secondData);

      expect(builder.entityData.components['test:component']).toEqual(
        secondData
      );
    });

    it('should throw error for blank component ID', () => {
      expect(() => builder.withComponent('', { data: true })).toThrow(
        'Component ID'
      );
      expect(() => builder.withComponent(null, { data: true })).toThrow(
        'Component ID'
      );
      expect(() => builder.withComponent(undefined, { data: true })).toThrow(
        'Component ID'
      );
    });

    it('should throw error for missing component data', () => {
      expect(() => builder.withComponent('test:component', null)).toThrow();
      expect(() =>
        builder.withComponent('test:component', undefined)
      ).toThrow();
    });
  });

  describe('withBody', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add anatomy:body component with root part', () => {
      const result = builder.withBody('torso1');

      expect(result.entityData.components['anatomy:body']).toEqual({
        body: { root: 'torso1' },
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.withBody('torso1');

      expect(result).toBe(builder);
    });

    it('should handle various root part IDs', () => {
      const rootParts = ['torso1', 'core:torso', 'body_root', 'main_body_part'];

      rootParts.forEach((rootPart) => {
        const testBuilder = new ModEntityBuilder('test');
        testBuilder.withBody(rootPart);
        expect(
          testBuilder.entityData.components['anatomy:body'].body.root
        ).toBe(rootPart);
      });
    });
  });

  describe('asBodyPart', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('body_part');
    });

    it('should create anatomy:part component with all options', () => {
      const options = {
        parent: 'torso1',
        children: ['arm1', 'arm2'],
        subType: 'torso',
      };

      const result = builder.asBodyPart(options);

      expect(result.entityData.components['anatomy:part']).toEqual({
        parent: 'torso1',
        children: ['arm1', 'arm2'],
        subType: 'torso',
      });
    });

    it('should handle default options', () => {
      const result = builder.asBodyPart({ subType: 'arm' });

      expect(result.entityData.components['anatomy:part']).toEqual({
        parent: null,
        children: [],
        subType: 'arm',
      });
    });

    it('should handle empty options object', () => {
      const result = builder.asBodyPart({});

      expect(result.entityData.components['anatomy:part']).toEqual({
        parent: null,
        children: [],
        subType: undefined,
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.asBodyPart({ subType: 'arm' });

      expect(result).toBe(builder);
    });
  });

  describe('kneelingBefore', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add positioning:kneeling_before component', () => {
      const result = builder.kneelingBefore('target1');

      expect(
        result.entityData.components['positioning:kneeling_before']
      ).toEqual({
        entityId: 'target1',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.kneelingBefore('target1');

      expect(result).toBe(builder);
    });
  });

  describe('facing', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add positioning:facing component', () => {
      const result = builder.facing('north');

      expect(result.entityData.components['positioning:facing']).toEqual({
        direction: 'north',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.facing('south');

      expect(result).toBe(builder);
    });

    it('should handle various directions', () => {
      const directions = ['north', 'south', 'east', 'west', 'away', 'towards'];

      directions.forEach((direction) => {
        const testBuilder = new ModEntityBuilder('test');
        testBuilder.facing(direction);
        expect(
          testBuilder.entityData.components['positioning:facing'].direction
        ).toBe(direction);
      });
    });
  });

  describe('withClothing', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add clothing:items component', () => {
      const clothingData = { items: ['shirt', 'pants'] };
      const result = builder.withClothing(clothingData);

      expect(result.entityData.components['clothing:items']).toEqual(
        clothingData
      );
    });

    it('should return this for method chaining', () => {
      const result = builder.withClothing({ items: [] });

      expect(result).toBe(builder);
    });
  });

  describe('asRoom', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('room1');
    });

    it('should set room name and return builder', () => {
      const result = builder.asRoom('Test Room');

      expect(result.entityData.components[NAME_COMPONENT_ID]).toEqual({
        text: 'Test Room',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.asRoom('Test Room');

      expect(result).toBe(builder);
    });
  });

  describe('withComponents', () => {
    let builder;

    beforeEach(() => {
      builder = new ModEntityBuilder('test_entity');
    });

    it('should add multiple components at once', () => {
      const components = {
        'test:component1': { data: 'value1' },
        'test:component2': { data: 'value2' },
        'core:actor': { isActor: true },
      };

      const result = builder.withComponents(components);

      expect(result.entityData.components).toEqual(
        expect.objectContaining(components)
      );
    });

    it('should merge with existing components', () => {
      builder.withName('Alice');

      const additionalComponents = {
        'test:component': { data: 'value' },
      };

      builder.withComponents(additionalComponents);

      expect(builder.entityData.components).toEqual({
        [NAME_COMPONENT_ID]: { text: 'Alice' },
        'test:component': { data: 'value' },
      });
    });

    it('should overwrite existing components with same ID', () => {
      builder.withName('Alice');

      const overrideComponents = {
        [NAME_COMPONENT_ID]: { text: 'Bob' },
      };

      builder.withComponents(overrideComponents);

      expect(builder.entityData.components[NAME_COMPONENT_ID]).toEqual({
        text: 'Bob',
      });
    });

    it('should return this for method chaining', () => {
      const result = builder.withComponents({});

      expect(result).toBe(builder);
    });
  });

  describe('validate', () => {
    it('should pass validation for valid entity', () => {
      const builder = new ModEntityBuilder('test_entity')
        .withName('Alice')
        .atLocation('room1');

      expect(() => builder.validate()).not.toThrow();
    });

    it('should return this for method chaining', () => {
      const builder = new ModEntityBuilder('test_entity');
      const result = builder.validate();

      expect(result).toBe(builder);
    });

    it('should throw error for invalid position component', () => {
      const builder = new ModEntityBuilder('test_entity');
      builder.entityData.components[POSITION_COMPONENT_ID] = {}; // Missing locationId

      expect(() => builder.validate()).toThrow("missing 'locationId' property");
    });

    it('should throw error for invalid name component', () => {
      const builder = new ModEntityBuilder('test_entity');
      builder.entityData.components[NAME_COMPONENT_ID] = {}; // Missing text

      expect(() => builder.validate()).toThrow("missing 'text' property");
    });

    it('should pass validation with minimal entity', () => {
      const builder = new ModEntityBuilder('test_entity');

      expect(() => builder.validate()).not.toThrow();
    });

    // Entity ID validation tests
    describe('entity ID validation', () => {
      it('should throw error when ID is not a string', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.id = 123; // Non-string ID

        expect(() => builder.validate()).toThrow(
          'entity.id should be STRING but is number'
        );
      });

      it('should detect entity double-nesting with detailed error', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.id = {
          id: 'nested_entity',
          components: { 'core:name': { text: 'Nested' } },
        }; // Entity object instead of string

        expect(() => builder.validate()).toThrow(
          '❌ ENTITY DOUBLE-NESTING DETECTED!'
        );
        expect(() => builder.validate()).toThrow(
          'entity.id should be STRING but is object'
        );
        expect(() => builder.validate()).toThrow(
          '❌ entityManager.addComponent(entity, componentId, data)'
        );
        expect(() => builder.validate()).toThrow(
          '✅ entityManager.addComponent(entity.id, componentId, data)'
        );
      });

      it('should throw error for blank string ID when set after construction', () => {
        const builder = new ModEntityBuilder('valid_id');
        builder.entityData.id = '   '; // Set blank ID after construction

        expect(() => builder.validate()).toThrow('Entity ID cannot be blank');
        expect(() => builder.validate()).toThrow(
          'Entity IDs must be non-empty strings'
        );
      });

      it('should include helpful examples in blank ID error', () => {
        const builder = new ModEntityBuilder('valid_id');
        builder.entityData.id = '  '; // Set whitespace-only ID after construction

        expect(() => builder.validate()).toThrow('"actor1"');
        expect(() => builder.validate()).toThrow('"room-library"');
      });
    });

    // Component structure validation tests
    describe('component structure validation', () => {
      it('should validate closeness component partners array', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components['personal-space-states:closeness'] = {
          partners: 'not-an-array', // Should be array
        };

        expect(() => builder.validate()).toThrow(
          "Closeness component 'partners' must be array"
        );
        expect(() => builder.validate()).toThrow(
          'builder.closeToEntity("target-id")'
        );
      });

      it('should detect entity double-nesting in closeness partners', () => {
        const builder = new ModEntityBuilder('test_entity');
        const nestedEntity = {
          id: 'target1',
          components: { 'core:name': { text: 'Target' } },
        };
        builder.entityData.components['personal-space-states:closeness'] = {
          partners: [nestedEntity], // Should be string ID
        };

        expect(() => builder.validate()).toThrow(
          'Closeness partner at index 0 must be string, got: object'
        );
        expect(() => builder.validate()).toThrow(
          'This indicates entity double-nesting'
        );
        expect(() => builder.validate()).toThrow(
          '❌ builder.closeToEntity(targetEntity)'
        );
        expect(() => builder.validate()).toThrow(
          '✅ builder.closeToEntity(targetEntity.id)'
        );
      });

      it('should validate kneeling component structure', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components['positioning:kneeling_before'] = {};

        expect(() => builder.validate()).toThrow(
          "Kneeling component missing 'entityId' property"
        );
        expect(() => builder.validate()).toThrow(
          'builder.kneelingBefore("target-id")'
        );
      });

      it('should detect entity double-nesting in kneeling entityId', () => {
        const builder = new ModEntityBuilder('test_entity');
        const nestedEntity = {
          id: 'target1',
          components: { 'core:name': { text: 'Target' } },
        };
        builder.entityData.components['positioning:kneeling_before'] = {
          entityId: nestedEntity, // Should be string ID
        };

        expect(() => builder.validate()).toThrow(
          'Kneeling entityId must be string, got: object'
        );
        expect(() => builder.validate()).toThrow(
          'This indicates entity double-nesting'
        );
        expect(() => builder.validate()).toThrow(
          '❌ builder.kneelingBefore(targetEntity)'
        );
        expect(() => builder.validate()).toThrow(
          '✅ builder.kneelingBefore(targetEntity.id)'
        );
      });

      it('should validate position locationId is string', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components[POSITION_COMPONENT_ID] = {
          locationId: 123, // Should be string
        };

        expect(() => builder.validate()).toThrow(
          'Position component locationId must be string'
        );
        expect(() => builder.validate()).toThrow(
          'entity double-nesting in location references'
        );
      });

      it('should validate name text is string', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components[NAME_COMPONENT_ID] = {
          text: 123, // Should be string
        };

        expect(() => builder.validate()).toThrow(
          'Name component text must be string'
        );
      });
    });

    // Error message quality tests
    describe('error message quality', () => {
      it('should include code examples in position error', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components[POSITION_COMPONENT_ID] = {};

        expect(() => builder.validate()).toThrow(
          'builder.atLocation("location-id")'
        );
        expect(() => builder.validate()).toThrow(
          'builder.withComponent("core:position", { locationId: "location-id" })'
        );
      });

      it('should include code examples in name error', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components[NAME_COMPONENT_ID] = {};

        expect(() => builder.validate()).toThrow(
          'builder.withName("name-text")'
        );
        expect(() => builder.validate()).toThrow(
          'builder.withComponent("core:name", { text: "name-text" })'
        );
      });

      it('should show actual component data in error messages', () => {
        const builder = new ModEntityBuilder('test_entity');
        builder.entityData.components[POSITION_COMPONENT_ID] = {
          wrongField: 'value',
        };

        expect(() => builder.validate()).toThrow('Position component data:');
        expect(() => builder.validate()).toThrow('"wrongField"');
      });
    });
  });

  describe('build', () => {
    it('should return complete entity object', () => {
      const entity = new ModEntityBuilder('test_entity')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .build();

      expect(entity).toEqual({
        id: 'test_entity',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['target1'] },
        },
      });
    });

    it('should return a copy of entity data', () => {
      const builder = new ModEntityBuilder('test_entity').withName('Alice');
      const entity1 = builder.build();
      const entity2 = builder.build();

      expect(entity1).toEqual(entity2);
      expect(entity1).not.toBe(entity2);
    });

    it('should handle empty components', () => {
      const entity = new ModEntityBuilder('test_entity').build();

      expect(entity).toEqual({
        id: 'test_entity',
        components: {},
      });
    });
  });

  describe('method chaining integration', () => {
    it('should support complex method chaining', () => {
      const entity = new ModEntityBuilder('complex_entity')
        .withName('Complex Character')
        .atLocation('complex_room')
        .closeToEntity(['partner1', 'partner2'])
        .withBody('torso1')
        .kneelingBefore('target1')
        .facing('north')
        .withComponent('custom:trait', { value: 'special' })
        .build();

      expect(entity).toEqual({
        id: 'complex_entity',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Complex Character' },
          [POSITION_COMPONENT_ID]: { locationId: 'complex_room' },
          'personal-space-states:closeness': { partners: ['partner1', 'partner2'] },
          'anatomy:body': { body: { root: 'torso1' } },
          'positioning:kneeling_before': { entityId: 'target1' },
          'positioning:facing': { direction: 'north' },
          'custom:trait': { value: 'special' },
        },
      });
    });

    it('should allow method order independence', () => {
      const entity1 = new ModEntityBuilder('test')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .build();

      const entity2 = new ModEntityBuilder('test')
        .closeToEntity('target1')
        .atLocation('room1')
        .withName('Alice')
        .build();

      expect(entity1).toEqual(entity2);
    });
  });
});

describe('ModEntityScenarios', () => {
  describe('createActorTargetPair', () => {
    it('should create basic actor-target pair with defaults', () => {
      const { actor, target } = ModEntityScenarios.createActorTargetPair();

      expect(actor).toEqual({
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'core:location': { location: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      });

      expect(target).toEqual({
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'core:location': { location: 'room1' },
          [ACTOR_COMPONENT_ID]: {},
        },
      });
    });

    it('should create pair with custom names', () => {
      const { actor, target } = ModEntityScenarios.createActorTargetPair({
        names: ['Charlie', 'Diana'],
      });

      expect(actor.components[NAME_COMPONENT_ID].text).toBe('Charlie');
      expect(target.components[NAME_COMPONENT_ID].text).toBe('Diana');
    });

    it('should create pair with custom location', () => {
      const { actor, target } = ModEntityScenarios.createActorTargetPair({
        location: 'custom_room',
      });

      expect(actor.components[POSITION_COMPONENT_ID].locationId).toBe(
        'custom_room'
      );
      expect(target.components[POSITION_COMPONENT_ID].locationId).toBe(
        'custom_room'
      );
    });

    it('should add closeness when closeProximity is true', () => {
      const { actor, target } = ModEntityScenarios.createActorTargetPair({
        closeProximity: true,
      });

      expect(actor.components['personal-space-states:closeness']).toEqual({
        partners: ['target1'],
      });
      expect(target.components['personal-space-states:closeness']).toEqual({
        partners: ['actor1'],
      });
    });

    it('should not add closeness when closeProximity is false', () => {
      const { actor, target } = ModEntityScenarios.createActorTargetPair({
        closeProximity: false,
      });

      expect(actor.components['personal-space-states:closeness']).toBeUndefined();
      expect(target.components['personal-space-states:closeness']).toBeUndefined();
    });
  });

  describe('createMultiActorScenario', () => {
    it('should create scenario with default names', () => {
      const result = ModEntityScenarios.createMultiActorScenario();

      expect(result.actor.components[NAME_COMPONENT_ID].text).toBe('Alice');
      expect(result.target.components[NAME_COMPONENT_ID].text).toBe('Bob');
      expect(result.observers).toHaveLength(2);
      expect(result.observers[0].components[NAME_COMPONENT_ID].text).toBe(
        'Charlie'
      );
      expect(result.observers[1].components[NAME_COMPONENT_ID].text).toBe(
        'Diana'
      );
      expect(result.allEntities).toHaveLength(4);
    });

    it('should create scenario with custom names', () => {
      const result = ModEntityScenarios.createMultiActorScenario({
        names: ['John', 'Jane', 'Jack'],
      });

      expect(result.actor.components[NAME_COMPONENT_ID].text).toBe('John');
      expect(result.target.components[NAME_COMPONENT_ID].text).toBe('Jane');
      expect(result.observers).toHaveLength(1);
      expect(result.observers[0].components[NAME_COMPONENT_ID].text).toBe(
        'Jack'
      );
    });

    it('should place all entities in same location', () => {
      const result = ModEntityScenarios.createMultiActorScenario({
        location: 'multi_room',
      });

      const allEntities = [result.actor, result.target, ...result.observers];
      allEntities.forEach((entity) => {
        expect(entity.components[POSITION_COMPONENT_ID].locationId).toBe(
          'multi_room'
        );
      });
    });

    it('should set up closeness relationships based on closeToMain', () => {
      const result = ModEntityScenarios.createMultiActorScenario({
        closeToMain: 2,
      });

      // Actor should be close to target and first observer (closeToMain >= 1 and index + 2 = 2 <= closeToMain)
      expect(result.actor.components['personal-space-states:closeness'].partners).toEqual(
        ['target1', 'observer1']
      );

      // Target should be close to actor (closeToMain >= 1)
      expect(
        result.target.components['personal-space-states:closeness'].partners
      ).toEqual(['actor1']);

      // First observer should be close to actor (index + 2 = 2, which <= closeToMain)
      expect(
        result.observers[0].components['personal-space-states:closeness'].partners
      ).toEqual(['actor1']);
    });
  });

  describe('createAnatomyScenario', () => {
    it('should create anatomy scenario with default configuration', () => {
      const result = ModEntityScenarios.createAnatomyScenario();

      expect(result.actor.components[NAME_COMPONENT_ID].text).toBe('Alice');
      expect(result.target.components[NAME_COMPONENT_ID].text).toBe('Bob');
      expect(result.target.components['anatomy:body']).toEqual({
        body: { root: 'torso1' },
      });
      expect(result.bodyParts).toHaveLength(3);
      expect(result.allEntities).toHaveLength(5); // actor + target + 3 body parts
    });

    it('should create anatomy scenario with custom body parts', () => {
      const result = ModEntityScenarios.createAnatomyScenario({
        bodyParts: ['torso', 'arm'],
      });

      expect(result.bodyParts).toHaveLength(2);
      expect(result.bodyParts[0].components['anatomy:part'].subType).toBe(
        'torso'
      );
      expect(result.bodyParts[1].components['anatomy:part'].subType).toBe(
        'arm'
      );
    });

    it('should set up proper body part hierarchy', () => {
      const result = ModEntityScenarios.createAnatomyScenario({
        bodyParts: ['torso', 'arm', 'leg'],
      });

      // Root part (torso) should have no parent
      const rootPart = result.bodyParts.find(
        (part) => part.components['anatomy:part'].subType === 'torso'
      );
      expect(rootPart.components['anatomy:part'].parent).toBeNull();

      // Non-root parts should have torso as parent
      const nonRootParts = result.bodyParts.filter(
        (part) => part.components['anatomy:part'].subType !== 'torso'
      );
      nonRootParts.forEach((part) => {
        expect(part.components['anatomy:part'].parent).toBe('torso1');
      });
    });
  });

  describe('createRoom', () => {
    it('should create room with default values', () => {
      const room = ModEntityScenarios.createRoom();

      expect(room).toEqual({
        id: 'room1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Test Room' },
        },
      });
    });

    it('should create room with custom ID and name', () => {
      const room = ModEntityScenarios.createRoom(
        'custom_room',
        'Custom Room Name'
      );

      expect(room).toEqual({
        id: 'custom_room',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Custom Room Name' },
        },
      });
    });
  });

  describe('createPositioningScenario', () => {
    it('should create standing positioning scenario by default', () => {
      const result = ModEntityScenarios.createPositioningScenario();

      expect(result.actor.components[NAME_COMPONENT_ID].text).toBe('Alice');
      expect(result.target.components[NAME_COMPONENT_ID].text).toBe('Bob');
      expect(result.actor.components['personal-space-states:closeness']).toBeDefined();
      expect(result.target.components['personal-space-states:closeness']).toBeDefined();
    });

    it('should create kneeling positioning scenario', () => {
      const result = ModEntityScenarios.createPositioningScenario({
        positioning: 'kneeling',
      });

      expect(result.actor.components['positioning:kneeling_before']).toEqual({
        entityId: 'target1',
      });
    });

    it('should create facing_away positioning scenario', () => {
      const result = ModEntityScenarios.createPositioningScenario({
        positioning: 'facing_away',
      });

      expect(result.target.components['positioning:facing']).toEqual({
        direction: 'away',
      });
    });

    it('should use custom names and location', () => {
      const result = ModEntityScenarios.createPositioningScenario({
        names: ['John', 'Jane'],
        location: 'position_room',
      });

      expect(result.actor.components[NAME_COMPONENT_ID].text).toBe('John');
      expect(result.target.components[NAME_COMPONENT_ID].text).toBe('Jane');
      expect(result.actor.components[POSITION_COMPONENT_ID].locationId).toBe(
        'position_room'
      );
      expect(result.target.components[POSITION_COMPONENT_ID].locationId).toBe(
        'position_room'
      );
    });
  });
});
