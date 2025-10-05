/**
 * @file Unit tests for items mod marker components
 */

import { describe, it, expect } from '@jest/globals';
import itemComponent from '../../../../../data/mods/items/components/item.component.json';
import portableComponent from '../../../../../data/mods/items/components/portable.component.json';

describe('Items - Marker Components', () => {
  describe('items:item component', () => {
    it('has correct id', () => {
      expect(itemComponent.id).toBe('items:item');
    });

    it('has appropriate description', () => {
      expect(itemComponent.description).toContain('Marker component');
      expect(itemComponent.description).toContain('item');
    });

    it('has correct schema reference', () => {
      expect(itemComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should be a valid marker component with no data properties', () => {
      expect(itemComponent.dataSchema.type).toBe('object');
      expect(itemComponent.dataSchema.properties).toEqual({});
    });

    it('should reject additional properties', () => {
      expect(itemComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('items:portable component', () => {
    it('has correct id', () => {
      expect(portableComponent.id).toBe('items:portable');
    });

    it('has appropriate description', () => {
      expect(portableComponent.description).toContain('Marker component');
      expect(portableComponent.description).toContain('carried');
    });

    it('has correct schema reference', () => {
      expect(portableComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should be a valid marker component with no data properties', () => {
      expect(portableComponent.dataSchema.type).toBe('object');
      expect(portableComponent.dataSchema.properties).toEqual({});
    });

    it('should reject additional properties', () => {
      expect(portableComponent.dataSchema.additionalProperties).toBe(false);
    });
  });
});
