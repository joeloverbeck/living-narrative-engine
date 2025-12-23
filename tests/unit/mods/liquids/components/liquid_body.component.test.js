/**
 * @file Unit tests for the liquids:liquid_body component schema
 */

import { describe, it, expect } from '@jest/globals';
import liquidBodyComponent from '../../../../../data/mods/liquids/components/liquid_body.component.json';

describe('liquids:liquid_body component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(liquidBodyComponent.id).toBe('liquids:liquid_body');
    });

    it('has appropriate description', () => {
      expect(liquidBodyComponent.description).toContain('body of liquid');
    });

    it('has standard component schema reference', () => {
      expect(liquidBodyComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct dataSchema type', () => {
      expect(liquidBodyComponent.dataSchema.type).toBe('object');
    });

    it('has updated dataSchema description mentioning visibility', () => {
      expect(liquidBodyComponent.dataSchema.description).toContain(
        'visibility'
      );
      expect(liquidBodyComponent.dataSchema.description).toContain(
        'connection data'
      );
    });
  });

  describe('visibility property schema', () => {
    it('defines visibility property', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.visibility
      ).toBeDefined();
    });

    it('visibility is type string', () => {
      expect(liquidBodyComponent.dataSchema.properties.visibility.type).toBe(
        'string'
      );
    });

    it('visibility has correct enum values', () => {
      const enumValues =
        liquidBodyComponent.dataSchema.properties.visibility.enum;
      expect(enumValues).toEqual(['pristine', 'clear', 'murky', 'opaque']);
    });

    it('visibility has default value of "clear"', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.visibility.default
      ).toBe('clear');
    });

    it('visibility has description about surfacing difficulty', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.visibility.description
      ).toContain('surfacing difficulty');
    });

    it('visibility is a required property', () => {
      expect(liquidBodyComponent.dataSchema.required).toContain('visibility');
    });
  });

  describe('connected_liquid_body_ids property schema', () => {
    it('defines connected_liquid_body_ids property', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.connected_liquid_body_ids
      ).toBeDefined();
    });

    it('connected_liquid_body_ids is type array', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.connected_liquid_body_ids.type
      ).toBe('array');
    });

    it('connected_liquid_body_ids has uniqueItems constraint', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.connected_liquid_body_ids
          .uniqueItems
      ).toBe(true);
    });

    it('connected_liquid_body_ids has default of empty array', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.connected_liquid_body_ids
          .default
      ).toEqual([]);
    });

    it('connected_liquid_body_ids items reference namespacedId schema', () => {
      expect(
        liquidBodyComponent.dataSchema.properties.connected_liquid_body_ids
          .items.$ref
      ).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
    });
  });

  describe('schema constraints', () => {
    it('does not allow additional properties', () => {
      expect(liquidBodyComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('has exactly two defined properties', () => {
      const propertyNames = Object.keys(
        liquidBodyComponent.dataSchema.properties
      );
      expect(propertyNames).toHaveLength(2);
      expect(propertyNames).toContain('visibility');
      expect(propertyNames).toContain('connected_liquid_body_ids');
    });

    it('only visibility is required (connected_liquid_body_ids is optional)', () => {
      expect(liquidBodyComponent.dataSchema.required).toEqual(['visibility']);
    });
  });
});
