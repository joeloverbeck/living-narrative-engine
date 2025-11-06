/**
 * @file Integration tests for body descriptor constants migration
 * Tests complete integration with registry and backward compatibility
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BODY_BUILD_TYPES,
  BODY_HAIR_DENSITY,
  BODY_COMPOSITION_TYPES,
  HEIGHT_CATEGORIES,
  DESCRIPTOR_METADATA,
  SUPPORTED_DESCRIPTOR_PROPERTIES,
} from '../../../src/anatomy/constants/bodyDescriptorConstants.js';
import {
  BODY_DESCRIPTOR_REGISTRY as DIRECT_REGISTRY,
  validateDescriptorValue,
  getAllDescriptorNames,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('Body Descriptor Constants Migration - Integration', () => {
  describe('Integration with Registry', () => {
    it('should maintain synchronization with registry', () => {
      // All constants should reflect current registry state
      const registryDescriptors = Object.keys(DIRECT_REGISTRY);
      const metadataDescriptors = Object.keys(DESCRIPTOR_METADATA);

      expect(metadataDescriptors.sort()).toEqual(registryDescriptors.sort());
    });

    it('should work with registry validation functions', () => {
      // Validate using constants derived from registry
      const buildValue = BODY_BUILD_TYPES.ATHLETIC;
      const result = validateDescriptorValue('build', buildValue);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should work with getAllDescriptorNames', () => {
      const registryNames = getAllDescriptorNames();

      expect(SUPPORTED_DESCRIPTOR_PROPERTIES.sort()).toEqual(registryNames.sort());
    });

    it('should validate all constant values against registry', () => {
      // All values from constants should be valid in registry
      Object.values(BODY_BUILD_TYPES).forEach((value) => {
        const result = validateDescriptorValue('build', value);
        expect(result.valid).toBe(true);
      });

      Object.values(BODY_HAIR_DENSITY).forEach((value) => {
        const result = validateDescriptorValue('hairDensity', value);
        expect(result.valid).toBe(true);
      });

      Object.values(BODY_COMPOSITION_TYPES).forEach((value) => {
        const result = validateDescriptorValue('composition', value);
        expect(result.valid).toBe(true);
      });

      Object.values(HEIGHT_CATEGORIES).forEach((value) => {
        const result = validateDescriptorValue('height', value);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Backward Compatibility with Existing Code', () => {
    it('should support old constant usage patterns', () => {
      // Simulate existing code patterns
      const selectedBuild = BODY_BUILD_TYPES.ATHLETIC;
      const selectedHair = BODY_HAIR_DENSITY.MODERATE;
      const selectedComposition = BODY_COMPOSITION_TYPES.LEAN;
      const selectedHeight = HEIGHT_CATEGORIES.TALL;

      expect(selectedBuild).toBe('athletic');
      expect(selectedHair).toBe('moderate');
      expect(selectedComposition).toBe('lean');
      expect(selectedHeight).toBe('tall');
    });

    it('should work with DESCRIPTOR_METADATA access patterns', () => {
      // Existing code accessing metadata
      const buildMetadata = DESCRIPTOR_METADATA.build;

      expect(buildMetadata).toBeDefined();
      expect(buildMetadata.label).toBe('Build');
      expect(buildMetadata.validValues).toBeDefined();
      expect(Array.isArray(buildMetadata.validValues)).toBe(true);
    });

    it('should work with Object.values() pattern', () => {
      // Existing pattern: Object.values(BODY_BUILD_TYPES)
      const buildValues = Object.values(BODY_BUILD_TYPES);

      expect(Array.isArray(buildValues)).toBe(true);
      expect(buildValues).toContain('athletic');
      expect(buildValues).toContain('slim');
      expect(buildValues.length).toBeGreaterThan(0);
    });

    it('should maintain descriptor metadata structure', () => {
      // Check that structure matches what existing code expects
      Object.entries(DESCRIPTOR_METADATA).forEach(([, metadata]) => {
        expect(metadata).toHaveProperty('label');
        expect(metadata).toHaveProperty('validValues');
        expect(metadata).toHaveProperty('description');

        expect(typeof metadata.label).toBe('string');
        expect(typeof metadata.description).toBe('string');
        expect(metadata.validValues === null || Array.isArray(metadata.validValues)).toBe(true);
      });
    });
  });

  describe('No Breaking Changes', () => {
    let testBodyComponent;

    beforeEach(() => {
      // Create a test body component with old constant usage
      testBodyComponent = {
        body: {
          descriptors: {
            build: BODY_BUILD_TYPES.ATHLETIC,
            hairDensity: BODY_HAIR_DENSITY.MODERATE,
            composition: BODY_COMPOSITION_TYPES.LEAN,
            height: HEIGHT_CATEGORIES.TALL,
            skinColor: 'olive',
            smell: 'pleasant',
          },
        },
      };
    });

    it('should work with body component creation', () => {
      expect(testBodyComponent.body.descriptors.build).toBe('athletic');
      expect(testBodyComponent.body.descriptors.hairDensity).toBe('moderate');
      expect(testBodyComponent.body.descriptors.composition).toBe('lean');
      expect(testBodyComponent.body.descriptors.height).toBe('tall');
    });

    it('should validate descriptor values correctly', () => {
      const { build, hairDensity, composition, height } = testBodyComponent.body.descriptors;

      expect(validateDescriptorValue('build', build).valid).toBe(true);
      expect(validateDescriptorValue('hairDensity', hairDensity).valid).toBe(true);
      expect(validateDescriptorValue('composition', composition).valid).toBe(true);
      expect(validateDescriptorValue('height', height).valid).toBe(true);
    });

    it('should support iteration over valid values', () => {
      // Common pattern: iterate over all valid values
      const allBuilds = DESCRIPTOR_METADATA.build.validValues;

      expect(allBuilds).toBeDefined();
      expect(Array.isArray(allBuilds)).toBe(true);
      expect(allBuilds.length).toBeGreaterThan(0);

      // Should be able to validate each
      allBuilds.forEach((build) => {
        const result = validateDescriptorValue('build', build);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Registry and Constants Consistency', () => {
    it('should have matching valid values', () => {
      // Direct comparison of values
      expect(DESCRIPTOR_METADATA.build.validValues).toEqual(
        DIRECT_REGISTRY.build.validValues
      );
      expect(DESCRIPTOR_METADATA.hairDensity.validValues).toEqual(
        DIRECT_REGISTRY.hairDensity.validValues
      );
      expect(DESCRIPTOR_METADATA.composition.validValues).toEqual(
        DIRECT_REGISTRY.composition.validValues
      );
      expect(DESCRIPTOR_METADATA.height.validValues).toEqual(
        DIRECT_REGISTRY.height.validValues
      );
    });

    it('should have matching labels', () => {
      expect(DESCRIPTOR_METADATA.build.label).toBe(DIRECT_REGISTRY.build.displayLabel);
      expect(DESCRIPTOR_METADATA.hairDensity.label).toBe(
        DIRECT_REGISTRY.hairDensity.displayLabel
      );
      expect(DESCRIPTOR_METADATA.composition.label).toBe(
        DIRECT_REGISTRY.composition.displayLabel
      );
      expect(DESCRIPTOR_METADATA.height.label).toBe(DIRECT_REGISTRY.height.displayLabel);
      expect(DESCRIPTOR_METADATA.skinColor.label).toBe(DIRECT_REGISTRY.skinColor.displayLabel);
      expect(DESCRIPTOR_METADATA.smell.label).toBe(DIRECT_REGISTRY.smell.displayLabel);
    });

    it('should handle null validValues (free-form descriptors)', () => {
      // skinColor and smell are free-form
      expect(DESCRIPTOR_METADATA.skinColor.validValues).toBeNull();
      expect(DESCRIPTOR_METADATA.smell.validValues).toBeNull();

      // Should match registry
      expect(DESCRIPTOR_METADATA.skinColor.validValues).toBe(
        DIRECT_REGISTRY.skinColor.validValues
      );
      expect(DESCRIPTOR_METADATA.smell.validValues).toBe(DIRECT_REGISTRY.smell.validValues);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should support dropdown population pattern', () => {
      // Common UI pattern: populate dropdown with valid values
      const buildOptions = DESCRIPTOR_METADATA.build.validValues;

      expect(buildOptions).toBeDefined();
      expect(Array.isArray(buildOptions)).toBe(true);
      expect(buildOptions.length).toBeGreaterThan(0);

      // Should be able to create option elements
      const options = buildOptions.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      }));

      expect(options.length).toBe(buildOptions.length);
      expect(options[0]).toHaveProperty('value');
      expect(options[0]).toHaveProperty('label');
    });

    it('should support validation pattern', () => {
      // Common pattern: validate user input
      const userInput = 'athletic';
      const isValid = DESCRIPTOR_METADATA.build.validValues.includes(userInput);

      expect(isValid).toBe(true);

      // Also validate against registry
      const result = validateDescriptorValue('build', userInput);
      expect(result.valid).toBe(true);
    });

    it('should support constant comparison pattern', () => {
      // Common pattern: compare with constant
      const selectedValue = 'athletic';
      const isAthletic = selectedValue === BODY_BUILD_TYPES.ATHLETIC;

      expect(isAthletic).toBe(true);
    });

    it('should support metadata lookup pattern', () => {
      // Common pattern: look up label for display
      const descriptorKey = 'build';
      const displayLabel = DESCRIPTOR_METADATA[descriptorKey].label;

      expect(displayLabel).toBe('Build');
    });

    it('should support property enumeration pattern', () => {
      // Common pattern: check all supported properties
      const hasRequiredDescriptors = ['build', 'height'].every((prop) =>
        SUPPORTED_DESCRIPTOR_PROPERTIES.includes(prop)
      );

      expect(hasRequiredDescriptors).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid descriptor gracefully', () => {
      const result = validateDescriptorValue('nonexistent', 'value');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown descriptor');
    });

    it('should handle invalid value gracefully', () => {
      const result = validateDescriptorValue('build', 'invalid-build-type');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid value');
    });

    it('should handle case sensitivity correctly', () => {
      // Constants use lowercase values
      expect(BODY_BUILD_TYPES.ATHLETIC).toBe('athletic');
      expect(BODY_BUILD_TYPES.ATHLETIC).not.toBe('ATHLETIC');
      expect(BODY_BUILD_TYPES.ATHLETIC).not.toBe('Athletic');
    });

    it('should handle hyphenated values correctly', () => {
      // Hyphens in values, underscores in keys
      expect(BODY_HAIR_DENSITY.VERY_HAIRY).toBe('very-hairy');
      expect(HEIGHT_CATEGORIES.VERY_TALL).toBe('very-tall');

      // Should validate correctly
      expect(validateDescriptorValue('hairDensity', 'very-hairy').valid).toBe(true);
      expect(validateDescriptorValue('height', 'very-tall').valid).toBe(true);
    });
  });
});
