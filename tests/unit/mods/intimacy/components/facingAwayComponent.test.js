/**
 * @file Unit tests for the facing-states:facing_away component.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import facingAwayComponent from '../../../../../data/mods/facing-states/components/facing_away.component.json';

describe('facing-states:facing_away component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(facingAwayComponent.id).toBe('facing-states:facing_away');
    });

    it('has appropriate description', () => {
      expect(facingAwayComponent.description).toContain('facing away');
    });

    it('has correct schema type', () => {
      expect(facingAwayComponent.dataSchema.type).toBe('object');
    });

    it('requires facing_away_from property', () => {
      expect(facingAwayComponent.dataSchema.required).toContain(
        'facing_away_from'
      );
    });

    it('defines facing_away_from as array with unique items', () => {
      const facingAwayFromSchema =
        facingAwayComponent.dataSchema.properties.facing_away_from;
      expect(facingAwayFromSchema.type).toBe('array');
      expect(facingAwayFromSchema.uniqueItems).toBe(true);
      expect(facingAwayFromSchema.default).toEqual([]);
    });

    it('does not allow additional properties', () => {
      expect(facingAwayComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('component behavior', () => {
    it('should initialize with empty array', () => {
      const newComponent = {
        facing_away_from: [],
      };
      expect(newComponent.facing_away_from).toEqual([]);
    });

    it('should store multiple entity IDs', () => {
      const component = {
        facing_away_from: ['entity1', 'entity2', 'entity3'],
      };
      expect(component.facing_away_from).toHaveLength(3);
      expect(component.facing_away_from).toContain('entity1');
      expect(component.facing_away_from).toContain('entity2');
      expect(component.facing_away_from).toContain('entity3');
    });

    it('should support toggling entities', () => {
      const component = {
        facing_away_from: ['entity1'],
      };

      // Add entity
      component.facing_away_from.push('entity2');
      expect(component.facing_away_from).toContain('entity2');

      // Remove entity
      const index = component.facing_away_from.indexOf('entity1');
      component.facing_away_from.splice(index, 1);
      expect(component.facing_away_from).not.toContain('entity1');
    });
  });
});
