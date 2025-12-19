/**
 * @file Integration tests for ModEntityBuilder validation enhancements
 * @description Tests real-world entity structure bugs that the enhanced validation should catch
 */

import { describe, it, expect } from '@jest/globals';
import ModEntityBuilder from '../../../common/mods/ModEntityBuilder.js';

describe('ModEntityBuilder Validation - Integration Tests', () => {
  describe('Entity Double-Nesting Detection', () => {
    it('should catch entity object passed to closeToEntity', () => {
      // Simulate real-world bug: passing entire entity instead of ID
      const targetEntity = new ModEntityBuilder('target1')
        .withName('Target')
        .build();

      const builder = new ModEntityBuilder('actor1').withName('Actor');

      // This should fail validation
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: [targetEntity], // BUG: should be targetEntity.id
      };

      expect(() => builder.validate()).toThrow('entity double-nesting');
      expect(() => builder.validate()).toThrow('Closeness partner at index 0');
      expect(() => builder.validate()).toThrow(
        '✅ builder.closeToEntity(targetEntity.id)'
      );
    });

    it('should catch entity object passed to kneelingBefore', () => {
      // Simulate real-world bug: kneeling before entity object
      const targetEntity = new ModEntityBuilder('target1')
        .withName('Target')
        .build();

      const builder = new ModEntityBuilder('actor1').withName('Actor');

      // This should fail validation
      builder.entityData.components['positioning:kneeling_before'] = {
        entityId: targetEntity, // BUG: should be targetEntity.id
      };

      expect(() => builder.validate()).toThrow('entity double-nesting');
      expect(() => builder.validate()).toThrow(
        'Kneeling entityId must be string'
      );
      expect(() => builder.validate()).toThrow(
        '✅ builder.kneelingBefore(targetEntity.id)'
      );
    });

    it('should catch nested entity in builder construction', () => {
      // Simulate bug where entire entity is used as ID
      const nestedEntity = new ModEntityBuilder('nested')
        .withName('Nested')
        .build();

      const builder = new ModEntityBuilder('outer');
      builder.entityData.id = nestedEntity; // BUG: should be string

      expect(() => builder.validate()).toThrow(
        '❌ ENTITY DOUBLE-NESTING DETECTED!'
      );
      expect(() => builder.validate()).toThrow('entity.id should be STRING');
    });

    it('should catch multiple entity objects in closeness partners array', () => {
      const target1 = new ModEntityBuilder('target1').withName('T1').build();
      const target2 = new ModEntityBuilder('target2').withName('T2').build();

      const builder = new ModEntityBuilder('actor1').withName('Actor');
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: [target1, target2], // BUG: should be IDs
      };

      // Should fail on first partner
      expect(() => builder.validate()).toThrow('Closeness partner at index 0');
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should validate entity with all correct positioning components', () => {
      const builder = new ModEntityBuilder('actor1')
        .withName('Actor')
        .atLocation('room1')
        .closeToEntity(['target1', 'target2']) // Correct: string IDs
        .kneelingBefore('target3'); // Correct: string ID

      expect(() => builder.validate()).not.toThrow();
    });

    it('should provide helpful context when closeness has wrong structure', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: 'single-string-not-array', // Should be array
      };

      expect(() => builder.validate()).toThrow("'partners' must be array");
      expect(() => builder.validate()).toThrow('Closeness component data:');
      expect(() => builder.validate()).toThrow(
        'builder.closeToEntity("target-id")'
      );
    });

    it('should validate complex entity with multiple components', () => {
      const builder = new ModEntityBuilder('complex_entity')
        .withName('Complex')
        .atLocation('room1')
        .closeToEntity(['partner1', 'partner2', 'partner3'])
        .withComponent('core:actor', {})
        .withComponent('positioning:facing_direction', { direction: 'north' });

      expect(() => builder.validate()).not.toThrow();
      const entity = builder.build();
      expect(entity.id).toBe('complex_entity');
    });

    it('should detect mixed valid and invalid partner IDs', () => {
      const invalidEntity = { id: 'wrong', components: {} };

      const builder = new ModEntityBuilder('actor1');
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: ['valid1', invalidEntity, 'valid2'], // Middle one is wrong
      };

      expect(() => builder.validate()).toThrow('Closeness partner at index 1');
      expect(() => builder.validate()).toThrow('must be string, got: object');
    });
  });

  describe('Error Message Quality in Real Scenarios', () => {
    it('should provide actionable fix for missing position locationId', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.components['core:position'] = {
        // Missing locationId
        someOtherField: 'value',
      };

      expect(() => builder.validate()).toThrow("missing 'locationId'");
      expect(() => builder.validate()).toThrow('Position component data:');
      expect(() => builder.validate()).toThrow('someOtherField');
      expect(() => builder.validate()).toThrow(
        'builder.atLocation("location-id")'
      );
    });

    it('should provide actionable fix for missing name text', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.components['core:name'] = {
        // Missing text
        wrongField: 'value',
      };

      expect(() => builder.validate()).toThrow("missing 'text'");
      expect(() => builder.validate()).toThrow('Name component data:');
      expect(() => builder.validate()).toThrow('wrongField');
      expect(() => builder.validate()).toThrow('builder.withName("name-text")');
    });

    it('should explain common cause of blank entity ID', () => {
      const builder = new ModEntityBuilder('valid_id');
      builder.entityData.id = '   '; // Set blank after construction

      expect(() => builder.validate()).toThrow('cannot be blank');
      expect(() => builder.validate()).toThrow('non-empty strings');
      expect(() => builder.validate()).toThrow('"actor1"');
      expect(() => builder.validate()).toThrow('"room-library"');
    });
  });

  describe('Chainability with Enhanced Validation', () => {
    it('should maintain chainability after validation', () => {
      const entity = new ModEntityBuilder('actor1')
        .withName('Actor')
        .atLocation('room1')
        .validate() // Should return this
        .build(); // Should work after validate

      expect(entity.id).toBe('actor1');
      expect(entity.components['core:name'].text).toBe('Actor');
    });

    it('should allow multiple validations in chain', () => {
      const builder = new ModEntityBuilder('actor1')
        .withName('Actor')
        .validate() // First validation
        .atLocation('room1')
        .validate() // Second validation
        .closeToEntity('target1');

      expect(() => builder.validate()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with no components', () => {
      const builder = new ModEntityBuilder('minimal_entity');

      expect(() => builder.validate()).not.toThrow();
      const entity = builder.build();
      expect(entity.id).toBe('minimal_entity');
      expect(entity.components).toEqual({});
    });

    it('should handle empty partners array in closeness', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: [], // Empty but valid array
      };

      expect(() => builder.validate()).not.toThrow();
    });

    it('should reject null entity ID', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.id = null;

      expect(() => builder.validate()).toThrow('Entity ID is required');
    });

    it('should reject undefined entity ID', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.id = undefined;

      expect(() => builder.validate()).toThrow('Entity ID is required');
    });

    it('should reject numeric entity ID', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.id = 12345;

      expect(() => builder.validate()).toThrow(
        'entity.id should be STRING but is number'
      );
    });

    it('should reject boolean entity ID', () => {
      const builder = new ModEntityBuilder('actor1');
      builder.entityData.id = true;

      expect(() => builder.validate()).toThrow(
        'entity.id should be STRING but is boolean'
      );
    });
  });

  describe('Regression Prevention', () => {
    it('should prevent action discovery bugs from entity double-nesting', () => {
      // This test documents a real bug that occurred:
      // Entity objects were passed to closeness, causing action discovery to fail
      const targetEntity = {
        id: 'target1',
        components: {
          'core:name': { text: 'Target' },
          'core:position': { locationId: 'room1' },
        },
      };

      const builder = new ModEntityBuilder('actor1')
        .withName('Actor')
        .atLocation('room1');

      // Simulate the bug
      builder.entityData.components['personal-space-states:closeness'] = {
        partners: [targetEntity],
      };

      // Should catch this IMMEDIATELY during test setup
      expect(() => builder.validate()).toThrow('entity double-nesting');
      expect(() => builder.validate()).toThrow('✅');
      expect(() => builder.validate()).toThrow('❌');
    });

    it('should prevent kneeling bugs from entity double-nesting', () => {
      // Another real bug: entity objects in kneeling component
      const targetEntity = {
        id: 'target1',
        components: { 'core:name': { text: 'Target' } },
      };

      const builder = new ModEntityBuilder('actor1').withName('Actor');
      builder.entityData.components['positioning:kneeling_before'] = {
        entityId: targetEntity,
      };

      // Should catch immediately
      expect(() => builder.validate()).toThrow('entity double-nesting');
      expect(() => builder.validate()).toThrow('Use entity ID, not entity');
    });
  });
});
