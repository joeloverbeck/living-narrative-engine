/**
 * @file Unit tests for bodyDescriptorConstants
 * Tests that constants are correctly derived from the registry
 * and maintain backward compatibility
 */

import { describe, it, expect } from '@jest/globals';
import {
  BODY_BUILD_TYPES,
  BODY_HAIR_DENSITY,
  BODY_COMPOSITION_TYPES,
  HEIGHT_CATEGORIES,
  DESCRIPTOR_METADATA,
  SUPPORTED_DESCRIPTOR_PROPERTIES,
  BODY_DESCRIPTOR_REGISTRY,
} from '../../../../src/anatomy/constants/bodyDescriptorConstants.js';
import { BODY_DESCRIPTOR_REGISTRY as DIRECT_REGISTRY } from '../../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('bodyDescriptorConstants - Registry Derivation', () => {
  describe('Constants derived correctly from registry', () => {
    it('should derive BODY_BUILD_TYPES object from registry', () => {
      const registryValues = DIRECT_REGISTRY.build.validValues;

      // Should be an object, not an array
      expect(typeof BODY_BUILD_TYPES).toBe('object');
      expect(Array.isArray(BODY_BUILD_TYPES)).toBe(false);

      // Should contain all values from registry
      expect(Object.values(BODY_BUILD_TYPES)).toEqual(registryValues);

      // Check specific mappings (value → UPPERCASE_KEY)
      expect(BODY_BUILD_TYPES.ATHLETIC).toBe('athletic');
      expect(BODY_BUILD_TYPES.SLIM).toBe('slim');
      expect(BODY_BUILD_TYPES.MUSCULAR).toBe('muscular');
      expect(BODY_BUILD_TYPES.HOURGLASS).toBe('hourglass');
    });

    it('should derive BODY_HAIR_DENSITY object from registry', () => {
      const registryValues = DIRECT_REGISTRY.hairDensity.validValues;

      expect(typeof BODY_HAIR_DENSITY).toBe('object');
      expect(Array.isArray(BODY_HAIR_DENSITY)).toBe(false);

      expect(Object.values(BODY_HAIR_DENSITY)).toEqual(registryValues);

      // Check hyphenated value conversion
      expect(BODY_HAIR_DENSITY.VERY_HAIRY).toBe('very-hairy');
      expect(BODY_HAIR_DENSITY.MODERATE).toBe('moderate');
      expect(BODY_HAIR_DENSITY.HAIRLESS).toBe('hairless');
    });

    it('should derive BODY_COMPOSITION_TYPES object from registry', () => {
      const registryValues = DIRECT_REGISTRY.composition.validValues;

      expect(typeof BODY_COMPOSITION_TYPES).toBe('object');
      expect(Array.isArray(BODY_COMPOSITION_TYPES)).toBe(false);

      expect(Object.values(BODY_COMPOSITION_TYPES)).toEqual(registryValues);

      expect(BODY_COMPOSITION_TYPES.LEAN).toBe('lean');
      expect(BODY_COMPOSITION_TYPES.AVERAGE).toBe('average');
      expect(BODY_COMPOSITION_TYPES.OVERWEIGHT).toBe('overweight');
    });

    it('should derive HEIGHT_CATEGORIES object from registry', () => {
      const registryValues = DIRECT_REGISTRY.height.validValues;

      expect(typeof HEIGHT_CATEGORIES).toBe('object');
      expect(Array.isArray(HEIGHT_CATEGORIES)).toBe(false);

      expect(Object.values(HEIGHT_CATEGORIES)).toEqual(registryValues);

      // Check hyphenated values
      expect(HEIGHT_CATEGORIES.VERY_TALL).toBe('very-tall');
      expect(HEIGHT_CATEGORIES.TALL).toBe('tall');
      expect(HEIGHT_CATEGORIES.AVERAGE).toBe('average');
      expect(HEIGHT_CATEGORIES.PETITE).toBe('petite');
    });

    it('should derive DESCRIPTOR_METADATA from registry', () => {
      // Should have entries for all descriptors in registry
      const registryKeys = Object.keys(DIRECT_REGISTRY);
      const metadataKeys = Object.keys(DESCRIPTOR_METADATA);

      expect(metadataKeys.sort()).toEqual(registryKeys.sort());

      // Check structure matches expected format
      expect(DESCRIPTOR_METADATA.build).toEqual({
        label: 'Build',
        validValues: DIRECT_REGISTRY.build.validValues,
        description: 'Build descriptor',
      });

      expect(DESCRIPTOR_METADATA.hairDensity).toEqual({
        label: 'Body hair density',
        validValues: DIRECT_REGISTRY.hairDensity.validValues,
        description: 'Body hair density descriptor',
      });

      // Check free-form descriptors have null validValues
      expect(DESCRIPTOR_METADATA.skinColor.validValues).toBeNull();
      expect(DESCRIPTOR_METADATA.smell.validValues).toBeNull();
    });
  });

  describe('Backward compatibility maintained', () => {
    it('should export all expected constants', () => {
      expect(BODY_BUILD_TYPES).toBeDefined();
      expect(BODY_HAIR_DENSITY).toBeDefined();
      expect(BODY_COMPOSITION_TYPES).toBeDefined();
      expect(HEIGHT_CATEGORIES).toBeDefined();
      expect(DESCRIPTOR_METADATA).toBeDefined();
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toBeDefined();
    });

    it('should maintain object structure (not arrays)', () => {
      expect(Array.isArray(BODY_BUILD_TYPES)).toBe(false);
      expect(Array.isArray(BODY_HAIR_DENSITY)).toBe(false);
      expect(Array.isArray(BODY_COMPOSITION_TYPES)).toBe(false);
      expect(Array.isArray(HEIGHT_CATEGORIES)).toBe(false);
    });

    it('should support expected usage patterns', () => {
      // Object property access patterns that existing code uses
      expect(BODY_BUILD_TYPES.ATHLETIC).toBe('athletic');
      expect(BODY_BUILD_TYPES.SLIM).toBe('slim');
      expect(BODY_HAIR_DENSITY.MODERATE).toBe('moderate');
      expect(BODY_HAIR_DENSITY.HAIRY).toBe('hairy');
      expect(BODY_COMPOSITION_TYPES.LEAN).toBe('lean');
      expect(HEIGHT_CATEGORIES.TALL).toBe('tall');
      expect(HEIGHT_CATEGORIES.SHORT).toBe('short');
    });

    it('should export SUPPORTED_DESCRIPTOR_PROPERTIES', () => {
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toBeDefined();
      expect(Array.isArray(SUPPORTED_DESCRIPTOR_PROPERTIES)).toBe(true);

      // Should contain all descriptor keys
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('height');
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('skinColor');
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('build');
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('composition');
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('hairDensity');
      expect(SUPPORTED_DESCRIPTOR_PROPERTIES).toContain('smell');
    });

    it('should have same values as current registry', () => {
      // These values match the current registry state
      const expectedBuildTypes = ['skinny', 'slim', 'lissom', 'toned', 'athletic',
                                   'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky',
                                   'frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous',
                                   'massive', 'willowy', 'barrel-chested', 'lanky'];
      const expectedHairDensity = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
        'furred',
      ];
      const expectedComposition = ['underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese',
                                   'atrophied', 'emaciated', 'skeletal', 'malnourished', 'dehydrated',
                                   'wasted', 'desiccated', 'bloated', 'rotting'];
      const expectedHeight = ['microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average',
                              'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'];

      expect(Object.values(BODY_BUILD_TYPES)).toEqual(expectedBuildTypes);
      expect(Object.values(BODY_HAIR_DENSITY)).toEqual(expectedHairDensity);
      expect(Object.values(BODY_COMPOSITION_TYPES)).toEqual(expectedComposition);
      expect(Object.values(HEIGHT_CATEGORIES)).toEqual(expectedHeight);
    });
  });

  describe('Registry re-export works', () => {
    it('should re-export BODY_DESCRIPTOR_REGISTRY', () => {
      expect(BODY_DESCRIPTOR_REGISTRY).toBeDefined();
      expect(BODY_DESCRIPTOR_REGISTRY).toBe(DIRECT_REGISTRY);
    });

    it('should have same content as direct import', () => {
      expect(Object.keys(BODY_DESCRIPTOR_REGISTRY).sort()).toEqual(
        Object.keys(DIRECT_REGISTRY).sort()
      );

      // Verify a few entries are identical
      expect(BODY_DESCRIPTOR_REGISTRY.height).toBe(DIRECT_REGISTRY.height);
      expect(BODY_DESCRIPTOR_REGISTRY.build).toBe(DIRECT_REGISTRY.build);
    });
  });

  describe('Object constant access patterns work', () => {
    it('should support BODY_BUILD_TYPES.ATHLETIC pattern', () => {
      expect(BODY_BUILD_TYPES.ATHLETIC).toBe('athletic');
      expect(BODY_BUILD_TYPES.SKINNY).toBe('skinny');
      expect(BODY_BUILD_TYPES.SLIM).toBe('slim');
      expect(BODY_BUILD_TYPES.LISSOM).toBe('lissom');
      expect(BODY_BUILD_TYPES.TONED).toBe('toned');
      expect(BODY_BUILD_TYPES.SHAPELY).toBe('shapely');
      expect(BODY_BUILD_TYPES.HOURGLASS).toBe('hourglass');
      expect(BODY_BUILD_TYPES.THICK).toBe('thick');
      expect(BODY_BUILD_TYPES.MUSCULAR).toBe('muscular');
      expect(BODY_BUILD_TYPES.HULKING).toBe('hulking');
      expect(BODY_BUILD_TYPES.STOCKY).toBe('stocky');
    });

    it('should support BODY_HAIR_DENSITY.MODERATE pattern', () => {
      expect(BODY_HAIR_DENSITY.HAIRLESS).toBe('hairless');
      expect(BODY_HAIR_DENSITY.SPARSE).toBe('sparse');
      expect(BODY_HAIR_DENSITY.LIGHT).toBe('light');
      expect(BODY_HAIR_DENSITY.MODERATE).toBe('moderate');
      expect(BODY_HAIR_DENSITY.HAIRY).toBe('hairy');
    });

    it('should convert hyphens to underscores in keys', () => {
      // very-hairy → VERY_HAIRY
      expect(BODY_HAIR_DENSITY.VERY_HAIRY).toBe('very-hairy');

      // very-tall → VERY_TALL
      expect(HEIGHT_CATEGORIES.VERY_TALL).toBe('very-tall');
    });

    it('should support HEIGHT_CATEGORIES access patterns', () => {
      expect(HEIGHT_CATEGORIES.GIGANTIC).toBe('gigantic');
      expect(HEIGHT_CATEGORIES.VERY_TALL).toBe('very-tall');
      expect(HEIGHT_CATEGORIES.TALL).toBe('tall');
      expect(HEIGHT_CATEGORIES.AVERAGE).toBe('average');
      expect(HEIGHT_CATEGORIES.SHORT).toBe('short');
      expect(HEIGHT_CATEGORIES.PETITE).toBe('petite');
      expect(HEIGHT_CATEGORIES.TINY).toBe('tiny');
    });

    it('should support BODY_COMPOSITION_TYPES access patterns', () => {
      expect(BODY_COMPOSITION_TYPES.UNDERWEIGHT).toBe('underweight');
      expect(BODY_COMPOSITION_TYPES.LEAN).toBe('lean');
      expect(BODY_COMPOSITION_TYPES.AVERAGE).toBe('average');
      expect(BODY_COMPOSITION_TYPES.SOFT).toBe('soft');
      expect(BODY_COMPOSITION_TYPES.CHUBBY).toBe('chubby');
      expect(BODY_COMPOSITION_TYPES.OVERWEIGHT).toBe('overweight');
      expect(BODY_COMPOSITION_TYPES.OBESE).toBe('obese');
    });
  });
});
