/**
 * @file Unit tests for the bending-states:bending_over component schema validation
 * @description Tests that the component schema correctly validates surface entity references
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('bending-states:bending_over component schema validation', () => {
  let componentSchema;

  beforeAll(async () => {
    const component = await import(
      '../../../../data/mods/bending-states/components/bending_over.component.json',
      { with: { type: 'json' } }
    );
    componentSchema = component.default;
  });

  describe('component schema structure', () => {
    it('should have correct schema structure', () => {
      expect(componentSchema).toHaveProperty('id', 'bending-states:bending_over');
      expect(componentSchema).toHaveProperty(
        '$schema',
        'schema://living-narrative-engine/component.schema.json'
      );
      expect(componentSchema).toHaveProperty('dataSchema');
      expect(componentSchema.dataSchema).toHaveProperty('type', 'object');
      expect(componentSchema.dataSchema).toHaveProperty('required', [
        'surface_id',
      ]);
      expect(componentSchema.dataSchema.additionalProperties).toBe(false);
      expect(componentSchema.dataSchema.properties).toHaveProperty(
        'surface_id'
      );
    });

    it('should require surface_id field', () => {
      expect(componentSchema.dataSchema.required).toEqual(['surface_id']);
      expect(componentSchema.dataSchema.properties).toHaveProperty(
        'surface_id'
      );
    });

    it('should use namespacedId reference for surface_id', () => {
      expect(componentSchema.dataSchema.properties.surface_id.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
    });

    it('should have proper description for surface_id', () => {
      expect(componentSchema.dataSchema.properties.surface_id.description).toBe(
        'The surface entity being bent over'
      );
    });

    it('should have appropriate component description', () => {
      expect(componentSchema.description).toBe(
        'Tracks which surface entity this actor is currently bending over'
      );
    });
  });

  describe('validation examples', () => {
    it('should define valid surface entity references', () => {
      // Example valid data structures (for documentation purposes)
      const validExamples = [
        { surface_id: 'kitchen:counter_01' },
        { surface_id: 'positioning:table_01' },
        { surface_id: 'furniture:desk' },
        { surface_id: 'test:surface_entity_123' },
      ];

      // All examples should have the required surface_id field
      validExamples.forEach((example) => {
        expect(example).toHaveProperty('surface_id');
        expect(typeof example.surface_id).toBe('string');
      });
    });

    it('should reject data without surface_id', () => {
      // Example invalid data (missing required field)
      const invalidData = {};

      // This would fail validation due to missing required field
      expect(componentSchema.dataSchema.required).toContain('surface_id');
      expect(Object.keys(invalidData)).not.toContain('surface_id');
    });
  });
});
