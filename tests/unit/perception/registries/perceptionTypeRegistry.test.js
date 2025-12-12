/**
 * @file Unit tests for perceptionTypeRegistry
 * @see src/perception/registries/perceptionTypeRegistry.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  PERCEPTION_TYPE_REGISTRY,
  PERCEPTION_CATEGORIES,
  isValidPerceptionType,
  isLegacyType,
  getPerceptionTypeMetadata,
  getCategoryMetadata,
  getLegacyTypeMapping,
  getAllValidTypes,
  getTypesByCategory,
  suggestNearestType,
  normalizePerceptionType,
  getCssClasses,
} from '../../../../src/perception/registries/perceptionTypeRegistry.js';

describe('perceptionTypeRegistry', () => {
  describe('PERCEPTION_TYPE_REGISTRY', () => {
    it('should contain all perception types (34 total)', () => {
      const types = Object.keys(PERCEPTION_TYPE_REGISTRY);
      // 14 categories with varying types: 3+2+4+5+3+2+1+1+3+2+2+2+2+2 = 34
      expect(types.length).toBe(34);
    });

    it('should have all required properties for each type', () => {
      const requiredProps = [
        'type',
        'category',
        'displayLabel',
        'cssClass',
        'legacyTypes',
        'isFailure',
      ];

      for (const [typeName, metadata] of Object.entries(
        PERCEPTION_TYPE_REGISTRY
      )) {
        for (const prop of requiredProps) {
          expect(metadata).toHaveProperty(
            prop,
            expect.anything(),
            `Type '${typeName}' missing property '${prop}'`
          );
        }
      }
    });

    it('should have matching type key and type property', () => {
      for (const [typeName, metadata] of Object.entries(
        PERCEPTION_TYPE_REGISTRY
      )) {
        expect(metadata.type).toBe(typeName);
      }
    });

    it('should reference valid categories', () => {
      const categoryNames = Object.keys(PERCEPTION_CATEGORIES);

      for (const [, metadata] of Object.entries(PERCEPTION_TYPE_REGISTRY)) {
        expect(categoryNames).toContain(metadata.category);
      }
    });
  });

  describe('PERCEPTION_CATEGORIES', () => {
    it('should contain all 14 categories', () => {
      const categories = Object.keys(PERCEPTION_CATEGORIES);
      expect(categories.length).toBe(14);

      const expected = [
        'communication',
        'movement',
        'combat',
        'item',
        'container',
        'connection',
        'consumption',
        'state',
        'social',
        'physical',
        'intimacy',
        'performance',
        'magic',
        'error',
      ];

      for (const cat of expected) {
        expect(categories).toContain(cat);
      }
    });

    it('should have required properties for each category', () => {
      const requiredProps = ['displayLabel', 'cssClassPrefix', 'themeColor'];

      for (const [catName, metadata] of Object.entries(PERCEPTION_CATEGORIES)) {
        for (const prop of requiredProps) {
          expect(metadata).toHaveProperty(
            prop,
            expect.anything(),
            `Category '${catName}' missing property '${prop}'`
          );
        }
      }
    });

    it('should have valid hex color codes', () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;

      for (const [, metadata] of Object.entries(PERCEPTION_CATEGORIES)) {
        expect(metadata.themeColor).toMatch(hexPattern);
      }
    });
  });

  describe('Legacy Type Mappings', () => {
    it('should map legacy types to valid new types via getLegacyTypeMapping', () => {
      // Test that legacy mappings return valid new types
      const legacyMappings = {
        speech_local: 'communication.speech',
        thought_internal: 'communication.thought',
        entity_died: 'combat.death',
        item_pickup: 'item.pickup',
        item_picked_up: 'item.pickup',
        character_enter: 'movement.arrival',
        character_exit: 'movement.departure',
        action_self_general: 'physical.self_action',
        action_target_general: 'physical.target_action',
      };

      for (const [legacyType, expectedNewType] of Object.entries(
        legacyMappings
      )) {
        const newType = getLegacyTypeMapping(legacyType);
        expect(newType).toBe(expectedNewType);
        // Use bracket notation since keys contain dots
        expect(expectedNewType in PERCEPTION_TYPE_REGISTRY).toBe(true);
      }
    });

    it('should contain expected legacy mappings', () => {
      expect(getLegacyTypeMapping('speech_local')).toBe('communication.speech');
      expect(getLegacyTypeMapping('thought_internal')).toBe(
        'communication.thought'
      );
      expect(getLegacyTypeMapping('entity_died')).toBe('combat.death');
      expect(getLegacyTypeMapping('item_pickup')).toBe('item.pickup');
      expect(getLegacyTypeMapping('item_picked_up')).toBe('item.pickup');
    });
  });

  describe('isValidPerceptionType', () => {
    it('should return true for valid new types', () => {
      expect(isValidPerceptionType('communication.speech')).toBe(true);
      expect(isValidPerceptionType('combat.attack')).toBe(true);
      expect(isValidPerceptionType('error.action_failed')).toBe(true);
    });

    it('should return true for valid legacy types', () => {
      expect(isValidPerceptionType('speech_local')).toBe(true);
      expect(isValidPerceptionType('entity_died')).toBe(true);
      expect(isValidPerceptionType('item_pickup')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidPerceptionType('invalid_type')).toBe(false);
      expect(isValidPerceptionType('foo.bar')).toBe(false);
      expect(isValidPerceptionType('')).toBe(false);
      expect(isValidPerceptionType(null)).toBe(false);
      expect(isValidPerceptionType(undefined)).toBe(false);
    });
  });

  describe('isLegacyType', () => {
    it('should return true for legacy types', () => {
      expect(isLegacyType('speech_local')).toBe(true);
      expect(isLegacyType('thought_internal')).toBe(true);
      expect(isLegacyType('entity_died')).toBe(true);
    });

    it('should return false for new types', () => {
      expect(isLegacyType('communication.speech')).toBe(false);
      expect(isLegacyType('combat.death')).toBe(false);
    });

    it('should return false for invalid types', () => {
      expect(isLegacyType('invalid_type')).toBe(false);
      expect(isLegacyType('')).toBe(false);
    });
  });

  describe('getPerceptionTypeMetadata', () => {
    it('should return metadata for valid new type', () => {
      const metadata = getPerceptionTypeMetadata('communication.speech');

      expect(metadata).not.toBeNull();
      expect(metadata.type).toBe('communication.speech');
      expect(metadata.category).toBe('communication');
      expect(metadata.displayLabel).toBe('Speech');
      expect(metadata.cssClass).toBe('log-type-speech');
    });

    it('should return metadata for legacy type after normalization', () => {
      const metadata = getPerceptionTypeMetadata('speech_local');

      expect(metadata).not.toBeNull();
      expect(metadata.type).toBe('communication.speech');
    });

    it('should return null for invalid type', () => {
      expect(getPerceptionTypeMetadata('invalid_type')).toBeNull();
      expect(getPerceptionTypeMetadata('')).toBeNull();
    });
  });

  describe('getCategoryMetadata', () => {
    it('should return metadata for valid category', () => {
      const metadata = getCategoryMetadata('communication');

      expect(metadata).not.toBeNull();
      expect(metadata.displayLabel).toBe('Communication');
      expect(metadata.cssClassPrefix).toBe('log-cat-communication');
      expect(metadata.themeColor).toBe('#6a1b9a');
    });

    it('should return null for invalid category', () => {
      expect(getCategoryMetadata('invalid_category')).toBeNull();
      expect(getCategoryMetadata('')).toBeNull();
    });
  });

  describe('getLegacyTypeMapping', () => {
    it('should return new type for legacy type', () => {
      expect(getLegacyTypeMapping('speech_local')).toBe('communication.speech');
      expect(getLegacyTypeMapping('entity_died')).toBe('combat.death');
    });

    it('should return null for new types', () => {
      expect(getLegacyTypeMapping('communication.speech')).toBeNull();
      expect(getLegacyTypeMapping('combat.death')).toBeNull();
    });

    it('should return null for invalid types', () => {
      expect(getLegacyTypeMapping('invalid_type')).toBeNull();
    });
  });

  describe('getAllValidTypes', () => {
    it('should return all 34 valid types', () => {
      const types = getAllValidTypes();

      expect(types.length).toBe(34);
      expect(types).toContain('communication.speech');
      expect(types).toContain('combat.attack');
      expect(types).toContain('error.system_error');
    });

    it('should not include legacy types', () => {
      const types = getAllValidTypes();

      expect(types).not.toContain('speech_local');
      expect(types).not.toContain('entity_died');
    });
  });

  describe('getTypesByCategory', () => {
    it('should return all types for a category', () => {
      const commTypes = getTypesByCategory('communication');

      expect(commTypes.length).toBe(3);
      expect(commTypes).toContain('communication.speech');
      expect(commTypes).toContain('communication.thought');
      expect(commTypes).toContain('communication.notes');
    });

    it('should return empty array for invalid category', () => {
      expect(getTypesByCategory('invalid_category')).toEqual([]);
    });
  });

  describe('suggestNearestType', () => {
    it('should suggest correct type for misspellings', () => {
      // Close enough match
      expect(suggestNearestType('communication.speach')).toBe(
        'communication.speech'
      );
      expect(suggestNearestType('combat.atack')).toBe('combat.attack');
    });

    it('should suggest correct type for partial matches', () => {
      expect(suggestNearestType('speech')).toBe('communication.speech');
      expect(suggestNearestType('attack')).toBe('combat.attack');
    });

    it('should return null for very different strings', () => {
      expect(suggestNearestType('xyzabc123')).toBeNull();
    });
  });

  describe('normalizePerceptionType', () => {
    it('should return new type unchanged', () => {
      expect(normalizePerceptionType('communication.speech')).toBe(
        'communication.speech'
      );
    });

    it('should convert legacy type to new type', () => {
      expect(normalizePerceptionType('speech_local')).toBe(
        'communication.speech'
      );
      expect(normalizePerceptionType('entity_died')).toBe('combat.death');
    });

    it('should return null for unknown types', () => {
      expect(normalizePerceptionType('unknown_type')).toBeNull();
    });
  });

  describe('getCssClasses', () => {
    it('should return both type and category classes as object', () => {
      const classes = getCssClasses('communication.speech');

      expect(classes).toEqual({
        typeClass: 'log-type-speech',
        categoryClass: 'log-cat-communication',
      });
    });

    it('should handle legacy types', () => {
      const classes = getCssClasses('speech_local');

      expect(classes).toEqual({
        typeClass: 'log-type-speech',
        categoryClass: 'log-cat-communication',
      });
    });

    it('should return null values for invalid types', () => {
      expect(getCssClasses('invalid_type')).toEqual({
        typeClass: null,
        categoryClass: null,
      });
    });
  });

  describe('Type coverage', () => {
    it('should have types for all categories', () => {
      for (const category of Object.keys(PERCEPTION_CATEGORIES)) {
        const types = getTypesByCategory(category);
        expect(types.length).toBeGreaterThan(
          0,
          `Category '${category}' has no types`
        );
      }
    });

    it('should map all common legacy types', () => {
      const commonLegacyTypes = [
        'speech_local',
        'thought_internal',
        'character_enter',
        'character_exit',
        'combat_attack',
        'damage_received',
        'entity_died',
        'item_pickup',
        'item_drop',
        'container_opened',
        'state_change_observable',
      ];

      for (const legacyType of commonLegacyTypes) {
        const newType = getLegacyTypeMapping(legacyType);
        expect(newType).not.toBeNull();
      }
    });
  });
});
