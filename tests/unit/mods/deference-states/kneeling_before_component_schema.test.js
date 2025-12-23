/**
 * @file Unit tests for the deference-states:kneeling_before component schema validation
 * @description Tests that the component schema correctly validates entity IDs in various formats
 */

import { describe, it, expect } from '@jest/globals';

describe('deference-states:kneeling_before component schema validation', () => {
  let componentSchema;

  beforeAll(async () => {
    // Import the component schema
    const component = await import(
      '../../../../data/mods/deference-states/components/kneeling_before.component.json',
      {
        with: { type: 'json' },
      }
    );
    componentSchema = component.default;
  });

  describe('entityId pattern validation', () => {
    it('should accept namespaced entity IDs', () => {
      const pattern = new RegExp(
        componentSchema.dataSchema.properties.entityId.pattern
      );

      // Test various valid namespaced entity IDs
      expect(pattern.test('core:actor1')).toBe(true);
      expect(pattern.test('test:target_entity')).toBe(true);
      expect(pattern.test('p_erotica:amaia_castillo_instance')).toBe(true);
      expect(pattern.test('mod_name:entity_123')).toBe(true);
      expect(pattern.test('violence:weapon-sword')).toBe(true);
    });

    it('should reject non-namespaced entity IDs', () => {
      const pattern = new RegExp(
        componentSchema.dataSchema.properties.entityId.pattern
      );

      // Test invalid formats that caused the production error
      expect(pattern.test('simple_entity')).toBe(false);
      expect(pattern.test('actor1')).toBe(false);
      expect(pattern.test('target')).toBe(false);
      expect(pattern.test('123')).toBe(false);
    });

    it('should reject malformed entity IDs', () => {
      const pattern = new RegExp(
        componentSchema.dataSchema.properties.entityId.pattern
      );

      // Test malformed IDs
      expect(pattern.test('mod:')).toBe(false); // Empty identifier
      expect(pattern.test(':entity')).toBe(false); // Empty mod
      expect(pattern.test('mod:entity:extra')).toBe(false); // Too many colons
      expect(pattern.test('mod@entity')).toBe(false); // Wrong separator
      expect(pattern.test('mod entity')).toBe(false); // Spaces not allowed
      expect(pattern.test('')).toBe(false); // Empty string
    });

    it('should match the expected format from error logs', () => {
      const pattern = new RegExp(
        componentSchema.dataSchema.properties.entityId.pattern
      );

      // The exact entity ID from the production error that should now work
      const problematicEntityId = 'p_erotica:amaia_castillo_instance';
      expect(pattern.test(problematicEntityId)).toBe(true);
    });
  });

  describe('component schema structure', () => {
    it('should have correct schema structure', () => {
      expect(componentSchema).toHaveProperty(
        'id',
        'deference-states:kneeling_before'
      );
      expect(componentSchema).toHaveProperty('dataSchema');
      expect(componentSchema.dataSchema).toHaveProperty('required', [
        'entityId',
      ]);
      expect(componentSchema.dataSchema.properties).toHaveProperty('entityId');
    });

    it('should require entityId field', () => {
      expect(componentSchema.dataSchema.required).toEqual(['entityId']);
      expect(componentSchema.dataSchema.properties.entityId.type).toBe(
        'string'
      );
    });

    it('should have proper description', () => {
      expect(componentSchema.dataSchema.properties.entityId.description).toBe(
        'The ID of the entity that the component holder is kneeling before'
      );
    });
  });
});
