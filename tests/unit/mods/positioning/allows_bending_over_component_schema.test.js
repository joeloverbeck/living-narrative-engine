/**
 * @file Unit tests for the positioning:allows_bending_over component schema validation
 * @description Tests that the component schema correctly validates as a simple marker component
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('positioning:allows_bending_over component schema validation', () => {
  let componentSchema;

  beforeAll(async () => {
    const component = await import(
      '../../../../data/mods/positioning/components/allows_bending_over.component.json',
      { with: { type: 'json' } }
    );
    componentSchema = component.default;
  });

  describe('component schema structure', () => {
    it('should have correct schema structure', () => {
      expect(componentSchema).toHaveProperty(
        'id',
        'positioning:allows_bending_over'
      );
      expect(componentSchema).toHaveProperty(
        '$schema',
        'schema://living-narrative-engine/component.schema.json'
      );
      expect(componentSchema).toHaveProperty('dataSchema');
      expect(componentSchema.dataSchema).toHaveProperty('type', 'object');
      expect(componentSchema.dataSchema).toHaveProperty('properties');
      expect(componentSchema.dataSchema.additionalProperties).toBe(false);
    });

    it('should be a simple marker component with no required fields', () => {
      expect(componentSchema.dataSchema.required).toBeUndefined();
      expect(Object.keys(componentSchema.dataSchema.properties)).toHaveLength(
        0
      );
    });

    it('should have appropriate description', () => {
      expect(componentSchema.description).toBe(
        'Indicates that this surface entity can be bent over by actors'
      );
    });

    it('should allow empty object as valid data', () => {
      // A marker component should accept an empty object
      // Since it has no required properties and no defined properties,
      // an empty object should be considered valid
      expect(componentSchema.dataSchema.properties).toEqual({});
      expect(componentSchema.dataSchema.required).toBeUndefined();
    });
  });
});
