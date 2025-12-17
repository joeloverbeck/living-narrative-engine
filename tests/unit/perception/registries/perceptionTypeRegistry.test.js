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
  getPrimarySense,
  getFallbackSenses,
  requiresVisual,
  isOmniscient,
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
        'primarySense',
        'fallbackSenses',
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

  describe('Sense metadata', () => {
    const validSenses = [
      'visual',
      'auditory',
      'olfactory',
      'tactile',
      'proprioceptive',
      'omniscient',
    ];

    it('should have valid primarySense for all 34 types', () => {
      for (const [typeName, metadata] of Object.entries(
        PERCEPTION_TYPE_REGISTRY
      )) {
        expect(validSenses).toContain(
          metadata.primarySense,
          `Type '${typeName}' has invalid primarySense: ${metadata.primarySense}`
        );
      }
    });

    it('should have valid fallbackSenses arrays for all types', () => {
      for (const [typeName, metadata] of Object.entries(
        PERCEPTION_TYPE_REGISTRY
      )) {
        expect(Array.isArray(metadata.fallbackSenses)).toBe(true);
        for (const sense of metadata.fallbackSenses) {
          expect(validSenses).toContain(
            sense,
            `Type '${typeName}' has invalid fallbackSense: ${sense}`
          );
        }
      }
    });

    it('should have correct sense mappings per spec', () => {
      // Sample key mappings from the spec
      const expectedMappings = {
        'communication.speech': { primary: 'auditory', fallback: ['tactile'] },
        'communication.thought': { primary: 'proprioceptive', fallback: [] },
        'communication.notes': { primary: 'visual', fallback: ['tactile'] },
        'movement.arrival': {
          primary: 'visual',
          fallback: ['auditory', 'tactile'],
        },
        'item.drop': { primary: 'auditory', fallback: ['visual'] },
        'item.examine': { primary: 'visual', fallback: [] },
        'connection.lock': { primary: 'auditory', fallback: ['visual'] },
        'intimacy.sexual': {
          primary: 'tactile',
          fallback: ['visual', 'auditory'],
        },
        'performance.music': { primary: 'auditory', fallback: ['tactile'] },
        'magic.spell': {
          primary: 'visual',
          fallback: ['auditory', 'olfactory'],
        },
        'error.system_error': { primary: 'omniscient', fallback: [] },
        'error.action_failed': { primary: 'omniscient', fallback: [] },
      };

      for (const [type, expected] of Object.entries(expectedMappings)) {
        const metadata = PERCEPTION_TYPE_REGISTRY[type];
        expect(metadata.primarySense).toBe(expected.primary);
        expect(metadata.fallbackSenses).toEqual(expected.fallback);
      }
    });
  });

  describe('getPrimarySense', () => {
    it('should return primary sense for new types', () => {
      expect(getPrimarySense('communication.speech')).toBe('auditory');
      expect(getPrimarySense('movement.arrival')).toBe('visual');
      expect(getPrimarySense('intimacy.sexual')).toBe('tactile');
      expect(getPrimarySense('communication.thought')).toBe('proprioceptive');
      expect(getPrimarySense('error.system_error')).toBe('omniscient');
    });

    it('should return primary sense for legacy types', () => {
      expect(getPrimarySense('speech_local')).toBe('auditory');
      expect(getPrimarySense('character_enter')).toBe('visual');
      expect(getPrimarySense('entity_died')).toBe('visual');
    });

    it('should return null for invalid types', () => {
      expect(getPrimarySense('invalid_type')).toBeNull();
      expect(getPrimarySense('')).toBeNull();
      expect(getPrimarySense(null)).toBeNull();
      expect(getPrimarySense(undefined)).toBeNull();
    });
  });

  describe('getFallbackSenses', () => {
    it('should return fallback senses array for new types', () => {
      expect(getFallbackSenses('communication.speech')).toEqual(['tactile']);
      expect(getFallbackSenses('movement.arrival')).toEqual([
        'auditory',
        'tactile',
      ]);
      expect(getFallbackSenses('item.examine')).toEqual([]);
      expect(getFallbackSenses('magic.spell')).toEqual([
        'auditory',
        'olfactory',
      ]);
    });

    it('should return fallback senses for legacy types', () => {
      expect(getFallbackSenses('speech_local')).toEqual(['tactile']);
      expect(getFallbackSenses('character_enter')).toEqual([
        'auditory',
        'tactile',
      ]);
    });

    it('should return empty array for invalid types', () => {
      expect(getFallbackSenses('invalid_type')).toEqual([]);
      expect(getFallbackSenses('')).toEqual([]);
      expect(getFallbackSenses(null)).toEqual([]);
    });
  });

  describe('requiresVisual', () => {
    it('should return true for visual-primary types', () => {
      expect(requiresVisual('movement.arrival')).toBe(true);
      expect(requiresVisual('combat.attack')).toBe(true);
      expect(requiresVisual('social.gesture')).toBe(true);
      expect(requiresVisual('performance.dance')).toBe(true);
    });

    it('should return false for non-visual-primary types', () => {
      expect(requiresVisual('communication.speech')).toBe(false);
      expect(requiresVisual('communication.thought')).toBe(false);
      expect(requiresVisual('intimacy.sexual')).toBe(false);
      expect(requiresVisual('error.system_error')).toBe(false);
      expect(requiresVisual('performance.music')).toBe(false);
    });

    it('should return false for invalid types', () => {
      expect(requiresVisual('invalid_type')).toBe(false);
      expect(requiresVisual('')).toBe(false);
    });
  });

  describe('isOmniscient', () => {
    it('should return true only for error category types', () => {
      expect(isOmniscient('error.system_error')).toBe(true);
      expect(isOmniscient('error.action_failed')).toBe(true);
    });

    it('should return false for all non-error types', () => {
      // Test representative types from each category
      expect(isOmniscient('communication.speech')).toBe(false);
      expect(isOmniscient('movement.arrival')).toBe(false);
      expect(isOmniscient('combat.attack')).toBe(false);
      expect(isOmniscient('item.pickup')).toBe(false);
      expect(isOmniscient('social.gesture')).toBe(false);
      expect(isOmniscient('intimacy.sexual')).toBe(false);
      expect(isOmniscient('magic.spell')).toBe(false);
    });

    it('should return false for invalid types', () => {
      expect(isOmniscient('invalid_type')).toBe(false);
      expect(isOmniscient('')).toBe(false);
    });

    it('should return true for legacy error types', () => {
      // 'error' is a legacy type that maps to 'error.system_error'
      expect(isOmniscient('error')).toBe(true);
    });
  });

  describe('Legacy type normalization with sense fields', () => {
    it('should correctly resolve legacy types to get sense metadata', () => {
      // Verify that legacy types work correctly with new helper functions
      const legacyTypes = [
        { legacy: 'speech_local', expectedPrimary: 'auditory' },
        { legacy: 'thought_internal', expectedPrimary: 'proprioceptive' },
        { legacy: 'character_enter', expectedPrimary: 'visual' },
        { legacy: 'entity_died', expectedPrimary: 'visual' },
        { legacy: 'error', expectedPrimary: 'omniscient' },
      ];

      for (const { legacy, expectedPrimary } of legacyTypes) {
        expect(getPrimarySense(legacy)).toBe(expectedPrimary);
      }
    });
  });
});
