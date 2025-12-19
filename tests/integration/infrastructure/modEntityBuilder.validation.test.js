/**
 * @file Deep validation tests for ModEntityBuilder
 * @description TSTAIMIG-002: Comprehensive validation of constructor, methods, and advanced scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../common/mods/ModEntityBuilder.js';

describe('ModEntityBuilder - Deep Validation (TSTAIMIG-002)', () => {
  describe('Constructor and Basic Methods', () => {
    it('should accept entity ID directly in constructor', () => {
      const builder = new ModEntityBuilder('test-entity-123');

      expect(builder).toBeDefined();
      expect(builder.entityData.id).toBe('test-entity-123');
      expect(builder.entityData.components).toEqual({});
    });

    it('should reject blank or invalid entity IDs', () => {
      expect(() => new ModEntityBuilder('')).toThrow();
      expect(() => new ModEntityBuilder(null)).toThrow();
      expect(() => new ModEntityBuilder(undefined)).toThrow();
      expect(() => new ModEntityBuilder('   ')).toThrow(); // whitespace only
    });

    it('should have withName(name) method that works correctly', () => {
      const builder = new ModEntityBuilder('test-entity');
      const result = builder.withName('Test Entity Name');

      // Should return builder for chaining
      expect(result).toBe(builder);

      // Should set name component correctly
      expect(builder.entityData.components['core:name']).toEqual({
        text: 'Test Entity Name',
      });
    });

    it('should validate withName method input', () => {
      const builder = new ModEntityBuilder('test-entity');

      expect(() => builder.withName('')).toThrow();
      expect(() => builder.withName(null)).toThrow();
      expect(() => builder.withName(undefined)).toThrow();
      expect(() => builder.withName('   ')).toThrow(); // whitespace only
    });

    it('should have build() method that returns proper entity structure', () => {
      const builder = new ModEntityBuilder('test-entity')
        .withName('Test Entity')
        .atLocation('test-location');

      const entity = builder.build();

      expect(entity).toEqual({
        id: 'test-entity',
        components: {
          'core:name': { text: 'Test Entity' },
          'core:position': { locationId: 'test-location' },
        },
      });

      // Should return a copy, not the original
      expect(entity).not.toBe(builder.entityData);
    });

    it('should support method chaining correctly', () => {
      const entity = new ModEntityBuilder('chaining-test')
        .withName('Chained Entity')
        .withDescription('Test Description')
        .atLocation('test-room')
        .asActor()
        .build();

      expect(entity.id).toBe('chaining-test');
      expect(entity.components['core:name']).toEqual({
        text: 'Chained Entity',
      });
      expect(entity.components['core:description']).toEqual({
        text: 'Test Description',
      });
      expect(entity.components['core:position']).toEqual({
        locationId: 'test-room',
      });
      expect(entity.components['core:actor']).toEqual({});
    });
  });

  describe('Positioning Methods', () => {
    it('should have atLocation(locationId) method that works correctly', () => {
      const builder = new ModEntityBuilder('test-entity');
      const result = builder.atLocation('test-location-123');

      expect(result).toBe(builder); // Returns builder for chaining
      expect(builder.entityData.components['core:position']).toEqual({
        locationId: 'test-location-123',
      });
    });

    it('should validate atLocation input', () => {
      const builder = new ModEntityBuilder('test-entity');

      expect(() => builder.atLocation('')).toThrow();
      expect(() => builder.atLocation(null)).toThrow();
      expect(() => builder.atLocation(undefined)).toThrow();
    });

    it('should have inSameLocationAs(otherEntity) method that works correctly', () => {
      const otherEntity = {
        components: {
          'core:position': { locationId: 'shared-location' },
        },
      };

      const builder = new ModEntityBuilder('test-entity');
      const result = builder.inSameLocationAs(otherEntity);

      expect(result).toBe(builder);
      expect(builder.entityData.components['core:position']).toEqual({
        locationId: 'shared-location',
      });
    });

    it('should validate inSameLocationAs input', () => {
      const builder = new ModEntityBuilder('test-entity');

      // Null entity
      expect(() => builder.inSameLocationAs(null)).toThrow(
        'Other entity is required'
      );

      // Entity without components
      expect(() => builder.inSameLocationAs({})).toThrow();

      // Entity without position component
      const invalidEntity = { components: {} };
      expect(() => builder.inSameLocationAs(invalidEntity)).toThrow();
    });

    it('should have closeToEntity(otherEntity) method that works correctly', () => {
      const builder = new ModEntityBuilder('test-entity');

      // Single partner
      builder.closeToEntity('partner1');
      expect(builder.entityData.components['personal-space-states:closeness']).toEqual({
        partners: ['partner1'],
      });

      // Multiple partners
      builder.closeToEntity(['partner1', 'partner2', 'partner3']);
      expect(builder.entityData.components['personal-space-states:closeness']).toEqual({
        partners: ['partner1', 'partner2', 'partner3'],
      });
    });

    it('should set positioning data correctly for complex scenarios', () => {
      const entity = new ModEntityBuilder('positioning-test')
        .withName('Positioned Entity')
        .atLocation('room1')
        .closeToEntity(['entity2', 'entity3'])
        .withLocationComponent('room1')
        .build();

      expect(entity.components['core:position']).toEqual({
        locationId: 'room1',
      });
      expect(entity.components['personal-space-states:closeness']).toEqual({
        partners: ['entity2', 'entity3'],
      });
      expect(entity.components['core:location']).toEqual({ location: 'room1' });
    });
  });

  describe('Component Management', () => {
    it('should have withComponent(componentId, data) method that works correctly', () => {
      const builder = new ModEntityBuilder('test-entity');
      const componentData = { value: 42, active: true };

      const result = builder.withComponent('test:component', componentData);

      expect(result).toBe(builder);
      expect(builder.entityData.components['test:component']).toEqual(
        componentData
      );
    });

    it('should validate withComponent input', () => {
      const builder = new ModEntityBuilder('test-entity');

      // Invalid component ID
      expect(() => builder.withComponent('', {})).toThrow();
      expect(() => builder.withComponent(null, {})).toThrow();

      // Invalid component data
      expect(() => builder.withComponent('test:component', null)).toThrow();
      expect(() =>
        builder.withComponent('test:component', undefined)
      ).toThrow();
    });

    it('should have withClothing(clothingData) method that works correctly', () => {
      const builder = new ModEntityBuilder('test-entity');
      const clothingData = {
        items: [
          { id: 'shirt1', type: 'shirt', equipped: true },
          { id: 'pants1', type: 'pants', equipped: true },
        ],
      };

      builder.withClothing(clothingData);
      expect(builder.entityData.components['clothing:items']).toEqual(
        clothingData
      );
    });

    it('should support multiple component addition', () => {
      const entity = new ModEntityBuilder('multi-component-test')
        .withComponent('test:component1', { value: 1 })
        .withComponent('test:component2', { value: 2 })
        .withComponent('test:component3', { value: 3 })
        .build();

      expect(entity.components['test:component1']).toEqual({ value: 1 });
      expect(entity.components['test:component2']).toEqual({ value: 2 });
      expect(entity.components['test:component3']).toEqual({ value: 3 });
    });

    it('should support withComponents for batch component addition', () => {
      const components = {
        'test:component1': { value: 1 },
        'test:component2': { value: 2 },
        'test:component3': { value: 3 },
      };

      const entity = new ModEntityBuilder('batch-test')
        .withComponents(components)
        .build();

      expect(entity.components).toMatchObject(components);
    });

    it('should properly structure component data', () => {
      const entity = new ModEntityBuilder('structure-test')
        .withName('Structured Entity')
        .withDescription('Test description')
        .withComponent('custom:data', {
          complex: { nested: { value: 'test' } },
        })
        .asActor({ actorType: 'player' })
        .build();

      expect(entity.components).toEqual({
        'core:name': { text: 'Structured Entity' },
        'core:description': { text: 'Test description' },
        'custom:data': { complex: { nested: { value: 'test' } } },
        'core:actor': { actorType: 'player' },
      });
    });
  });

  describe('Advanced Scenarios', () => {
    it('should create complex entity relationships', () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Main Actor')
        .atLocation('room1')
        .closeToEntity(['target1', 'observer1'])
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Target Entity')
        .atLocation('room1')
        .closeToEntity(['actor1'])
        .asActor()
        .build();

      expect(actor.components['personal-space-states:closeness'].partners).toContain(
        'target1'
      );
      expect(target.components['personal-space-states:closeness'].partners).toContain(
        'actor1'
      );
      expect(actor.components['core:position'].locationId).toBe(
        target.components['core:position'].locationId
      );
    });

    it('should support anatomy component setup', () => {
      const entity = new ModEntityBuilder('anatomy-test')
        .withName('Anatomy Entity')
        .withBody('torso1')
        .asBodyPart({
          parent: null,
          children: ['arm1', 'arm2'],
          subType: 'torso',
        })
        .build();

      expect(entity.components['anatomy:body']).toEqual({
        body: { root: 'torso1' },
      });
      expect(entity.components['anatomy:part']).toEqual({
        parent: null,
        children: ['arm1', 'arm2'],
        subType: 'torso',
      });
    });

    it('should handle clothing and equipment properly', () => {
      const entity = new ModEntityBuilder('clothing-test')
        .withName('Dressed Entity')
        .withClothing({
          equipped: [
            { slot: 'torso', item: 'shirt1' },
            { slot: 'legs', item: 'pants1' },
          ],
        })
        .withComponent('equipment:weapons', {
          primary: 'sword1',
          secondary: 'dagger1',
        })
        .build();

      expect(entity.components['clothing:items']).toBeDefined();
      expect(entity.components['equipment:weapons']).toBeDefined();
    });

    it('should provide error handling for invalid data', () => {
      const builder = new ModEntityBuilder('error-test');

      // Invalid body part configuration
      expect(() => {
        builder.asBodyPart({ subType: '' }); // Empty subType
      }).not.toThrow(); // ModEntityBuilder is permissive, validates at build time if needed

      // Invalid facing direction
      builder.facing('invalid-direction'); // Should not throw, allows any direction

      const entity = builder.build();
      expect(entity.components['positioning:facing']).toEqual({
        direction: 'invalid-direction',
      });
    });
  });

  describe('Specialized Builder Methods', () => {
    it('should support kneeling position setup', () => {
      const entity = new ModEntityBuilder('kneeler')
        .kneelingBefore('target-entity')
        .build();

      expect(entity.components['positioning:kneeling_before']).toEqual({
        entityId: 'target-entity',
      });
    });

    it('should support facing direction setup', () => {
      const entity = new ModEntityBuilder('facer').facing('north').build();

      expect(entity.components['positioning:facing']).toEqual({
        direction: 'north',
      });
    });

    it('should support room/location entity creation', () => {
      const room = new ModEntityBuilder('test-room')
        .asRoom('Test Room Name')
        .build();

      expect(room.components['core:name']).toEqual({
        text: 'Test Room Name',
      });
    });

    it('should support location component for proximity checks', () => {
      const entity = new ModEntityBuilder('proximity-test')
        .withLocationComponent('room1')
        .build();

      expect(entity.components['core:location']).toEqual({
        location: 'room1',
      });
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate entity structure before building', () => {
      const builder = new ModEntityBuilder('validation-test')
        .withName('Valid Entity')
        .atLocation('valid-location');

      // Should not throw for valid configuration
      expect(() => builder.validate()).not.toThrow();

      const entity = builder.validate().build();
      expect(entity).toBeDefined();
    });

    it('should catch validation errors during validate()', () => {
      // Create invalid entity with missing locationId in position component
      const builder = new ModEntityBuilder('invalid-test');
      builder.entityData.components['core:position'] = {}; // Missing locationId

      expect(() => builder.validate()).toThrow();
    });

    it('should validate name component structure', () => {
      const builder = new ModEntityBuilder('name-validation-test');
      builder.entityData.components['core:name'] = {}; // Missing text

      expect(() => builder.validate()).toThrow();
    });

    it('should handle edge cases gracefully', () => {
      // Empty components object
      const emptyBuilder = new ModEntityBuilder('empty-test');
      expect(() => emptyBuilder.validate()).not.toThrow();

      // Builder with only ID
      const minimalEntity = emptyBuilder.build();
      expect(minimalEntity.id).toBe('empty-test');
      expect(minimalEntity.components).toEqual({});
    });
  });

  describe('ModEntityScenarios Helper Class', () => {
    describe('createActorTargetPair scenarios', () => {
      it('should create basic actor-target pairs', () => {
        const scenario = ModEntityScenarios.createActorTargetPair({
          names: ['Alice', 'Bob'],
          location: 'test-room',
        });

        expect(scenario).toHaveProperty('actor');
        expect(scenario).toHaveProperty('target');
        expect(scenario.actor.components['core:name'].text).toBe('Alice');
        expect(scenario.target.components['core:name'].text).toBe('Bob');
        expect(scenario.actor.components['core:position'].locationId).toBe(
          'test-room'
        );
        expect(scenario.target.components['core:position'].locationId).toBe(
          'test-room'
        );
      });

      it('should create actor-target pairs with close proximity', () => {
        const scenario = ModEntityScenarios.createActorTargetPair({
          names: ['Alice', 'Bob'],
          location: 'test-room',
          closeProximity: true,
        });

        expect(
          scenario.actor.components['personal-space-states:closeness']
        ).toBeDefined();
        expect(
          scenario.target.components['personal-space-states:closeness']
        ).toBeDefined();
        expect(
          scenario.actor.components['personal-space-states:closeness'].partners
        ).toContain('target1');
        expect(
          scenario.target.components['personal-space-states:closeness'].partners
        ).toContain('actor1');
      });

      it('should support custom ID prefixes', () => {
        const scenario = ModEntityScenarios.createActorTargetPair({
          idPrefix: 'test_',
        });

        expect(scenario.actor.id).toBe('test_actor1');
        expect(scenario.target.id).toBe('test_target1');
      });
    });

    describe('createMultiActorScenario', () => {
      it('should create multi-actor scenarios with observers', () => {
        const scenario = ModEntityScenarios.createMultiActorScenario({
          names: ['Alice', 'Bob', 'Charlie', 'Diana'],
          location: 'test-room',
          closeToMain: 2,
        });

        expect(scenario).toHaveProperty('actor');
        expect(scenario).toHaveProperty('target');
        expect(scenario).toHaveProperty('observers');
        expect(scenario).toHaveProperty('allEntities');

        expect(scenario.observers).toHaveLength(2); // Charlie and Diana
        expect(scenario.allEntities).toHaveLength(4);

        // Main actor should be close to specified number of entities
        expect(
          scenario.actor.components['personal-space-states:closeness'].partners
        ).toHaveLength(2);
      });
    });

    describe('createAnatomyScenario', () => {
      it('should create anatomy scenarios with body parts', () => {
        const scenario = ModEntityScenarios.createAnatomyScenario({
          names: ['Alice', 'Bob'],
          bodyParts: ['torso', 'arm', 'arm'],
        });

        expect(scenario).toHaveProperty('actor');
        expect(scenario).toHaveProperty('target');
        expect(scenario).toHaveProperty('bodyParts');
        expect(scenario).toHaveProperty('allEntities');

        expect(scenario.bodyParts).toHaveLength(3);
        expect(scenario.target.components['anatomy:body']).toBeDefined();

        // Check body part structure
        const torsoPart = scenario.bodyParts.find(
          (part) => part.id === 'torso1'
        );
        expect(torsoPart).toBeDefined();
        expect(torsoPart.components['anatomy:part'].subType).toBe('torso');
      });
    });

    describe('createRoom helper', () => {
      it('should create room entities correctly', () => {
        const room = ModEntityScenarios.createRoom('room123', 'Test Room');

        expect(room.id).toBe('room123');
        expect(room.components['core:name'].text).toBe('Test Room');
      });

      it('should use defaults when parameters not provided', () => {
        const room = ModEntityScenarios.createRoom();

        expect(room.id).toBe('room1');
        expect(room.components['core:name'].text).toBe('Test Room');
      });
    });

    describe('createPositioningScenario', () => {
      it('should create positioning scenarios with different setups', () => {
        const standingScenario = ModEntityScenarios.createPositioningScenario({
          positioning: 'standing',
        });

        expect(standingScenario).toHaveProperty('actor');
        expect(standingScenario).toHaveProperty('target');

        const kneelingScenario = ModEntityScenarios.createPositioningScenario({
          positioning: 'kneeling',
        });

        expect(
          kneelingScenario.actor.components['positioning:kneeling_before']
        ).toBeDefined();

        const facingAwayScenario = ModEntityScenarios.createPositioningScenario(
          {
            positioning: 'facing_away',
          }
        );

        expect(
          facingAwayScenario.target.components['positioning:facing']
        ).toBeDefined();
        expect(
          facingAwayScenario.target.components['positioning:facing'].direction
        ).toBe('away');
      });
    });
  });

  describe('Integration with Test Infrastructure', () => {
    it('should integrate properly with ModTestFixture', () => {
      // This tests that entities built with ModEntityBuilder work with fixture methods
      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      // Should have all required components for test fixtures
      expect(actor.components['core:name']).toBeDefined();
      expect(actor.components['core:position']).toBeDefined();
      expect(actor.components['core:location']).toBeDefined();
      expect(actor.components['core:actor']).toBeDefined();
    });

    it('should create entities compatible with ModAssertionHelpers', () => {
      const entity = new ModEntityBuilder('assertion-test')
        .withName('Assertion Test Entity')
        .atLocation('room1')
        .withComponent('test:component', { value: 'test' })
        .build();

      // Entity structure should be compatible with assertion helpers
      expect(entity.id).toBeDefined();
      expect(entity.components).toBeDefined();
      expect(typeof entity.components).toBe('object');
    });

    it('should support all category-specific patterns', () => {
      // Exercise category
      const exerciseEntity = new ModEntityBuilder('exercise-entity')
        .withName('Exercise Entity')
        .withComponent('exercise:routine', { type: 'cardio' })
        .build();
      expect(exerciseEntity).toBeDefined();

      // Violence category
      const violenceEntity = new ModEntityBuilder('violence-entity')
        .withName('Violence Entity')
        .withComponent('combat:stats', { health: 100 })
        .build();
      expect(violenceEntity).toBeDefined();

      // Intimacy category
      const intimacyEntity = new ModEntityBuilder('intimacy-entity')
        .withName('Intimacy Entity')
        .closeToEntity(['partner1'])
        .build();
      expect(intimacyEntity.components['personal-space-states:closeness']).toBeDefined();

      // Sex category
      const sexEntity = new ModEntityBuilder('sex-entity')
        .withName('Sex Entity')
        .withBody('torso1')
        .withClothing({ items: [] })
        .build();
      expect(sexEntity.components['anatomy:body']).toBeDefined();

      // Positioning category
      const positioningEntity = new ModEntityBuilder('positioning-entity')
        .withName('Positioning Entity')
        .kneelingBefore('target1')
        .facing('north')
        .build();
      expect(
        positioningEntity.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(positioningEntity.components['positioning:facing']).toBeDefined();
    });
  });
});
