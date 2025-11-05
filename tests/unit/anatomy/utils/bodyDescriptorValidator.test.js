/**
 * @file Unit tests for BodyDescriptorValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptorValidator } from '../../../../src/anatomy/utils/bodyDescriptorValidator.js';
import { BodyDescriptorValidationError } from '../../../../src/anatomy/errors/bodyDescriptorValidationError.js';
import {
  BODY_BUILD_TYPES,
  BODY_HAIR_DENSITY,
  BODY_COMPOSITION_TYPES,
  SUPPORTED_DESCRIPTOR_PROPERTIES,
} from '../../../../src/anatomy/constants/bodyDescriptorConstants.js';

describe('BodyDescriptorValidator', () => {
  describe('validate', () => {
    it('should pass validation for null/undefined body descriptors', () => {
      expect(() => BodyDescriptorValidator.validate(null)).not.toThrow();
      expect(() => BodyDescriptorValidator.validate(undefined)).not.toThrow();
    });

    it('should pass validation for empty body descriptors object', () => {
      expect(() => BodyDescriptorValidator.validate({})).not.toThrow();
    });

    it('should pass validation for valid descriptor combinations', () => {
      const validDescriptors = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: BODY_HAIR_DENSITY.MODERATE,
        composition: BODY_COMPOSITION_TYPES.LEAN,
        skinColor: 'pale',
      };
      expect(() =>
        BodyDescriptorValidator.validate(validDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should pass validation for partial descriptor objects', () => {
      expect(() =>
        BodyDescriptorValidator.validate(
          { build: BODY_BUILD_TYPES.SLIM },
          'test-recipe'
        )
      ).not.toThrow();
      expect(() =>
        BodyDescriptorValidator.validate({ skinColor: 'tan' }, 'test-recipe')
      ).not.toThrow();
    });

    it('should throw error for non-object body descriptors', () => {
      expect(() =>
        BodyDescriptorValidator.validate('not-an-object', 'test-recipe')
      ).toThrow(BodyDescriptorValidationError);
      expect(() =>
        BodyDescriptorValidator.validate(123, 'test-recipe')
      ).toThrow(BodyDescriptorValidationError);
      expect(() => BodyDescriptorValidator.validate([], 'test-recipe')).toThrow(
        BodyDescriptorValidationError
      );
    });

    it('should throw error for invalid build values', () => {
      expect(() =>
        BodyDescriptorValidator.validate(
          { build: 'invalid-build' },
          'test-recipe'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for invalid density values', () => {
      expect(() =>
        BodyDescriptorValidator.validate(
          { hairDensity: 'invalid-density' },
          'test-recipe'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for invalid composition values', () => {
      expect(() =>
        BodyDescriptorValidator.validate(
          { composition: 'invalid-composition' },
          'test-recipe'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for unknown properties', () => {
      expect(() =>
        BodyDescriptorValidator.validate(
          { unknownProperty: 'value' },
          'test-recipe'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for non-string descriptor values', () => {
      expect(() =>
        BodyDescriptorValidator.validate({ build: 123 }, 'test-recipe')
      ).toThrow(BodyDescriptorValidationError);
      expect(() =>
        BodyDescriptorValidator.validate({ hairDensity: {} }, 'test-recipe')
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should include context in error messages', () => {
      try {
        BodyDescriptorValidator.validate(
          { build: 'invalid-build' },
          'test-recipe'
        );
      } catch (error) {
        expect(error.message).toContain('test-recipe');
      }
    });
  });

  describe('validateDescriptorProperty', () => {
    it('should validate known properties with valid values', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorProperty(
          'build',
          BODY_BUILD_TYPES.ATHLETIC,
          'test-context'
        )
      ).not.toThrow();
    });

    it('should throw error for unknown properties', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorProperty(
          'unknown',
          'value',
          'test-context'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for non-string values', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorProperty(
          'build',
          123,
          'test-context'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should throw error for invalid enum values', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorProperty(
          'build',
          'invalid-value',
          'test-context'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should allow any string value for skinColor', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorProperty(
          'skinColor',
          'any-color-value',
          'test-context'
        )
      ).not.toThrow();
    });
  });

  describe('validateNoUnknownProperties', () => {
    it('should pass for objects with only known properties', () => {
      const validDescriptors = {
        build: BODY_BUILD_TYPES.SLIM,
        skinColor: 'fair',
      };
      expect(() =>
        BodyDescriptorValidator.validateNoUnknownProperties(
          validDescriptors,
          'test-context'
        )
      ).not.toThrow();
    });

    it('should throw error for objects with unknown properties', () => {
      const invalidDescriptors = {
        build: BODY_BUILD_TYPES.SLIM,
        unknownProp: 'value',
      };
      expect(() =>
        BodyDescriptorValidator.validateNoUnknownProperties(
          invalidDescriptors,
          'test-context'
        )
      ).toThrow(BodyDescriptorValidationError);
    });

    it('should list all unknown properties in error message', () => {
      const invalidDescriptors = {
        unknownProp1: 'value1',
        unknownProp2: 'value2',
      };
      try {
        BodyDescriptorValidator.validateNoUnknownProperties(
          invalidDescriptors,
          'test-context'
        );
      } catch (error) {
        expect(error.message).toContain('unknownProp1');
        expect(error.message).toContain('unknownProp2');
      }
    });
  });

  describe('validateDescriptorType', () => {
    it('should validate specific descriptor types', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorType(
          'build',
          BODY_BUILD_TYPES.MUSCULAR,
          'test-context'
        )
      ).not.toThrow();
    });

    it('should throw error for invalid descriptor type values', () => {
      expect(() =>
        BodyDescriptorValidator.validateDescriptorType(
          'build',
          'invalid-build',
          'test-context'
        )
      ).toThrow(BodyDescriptorValidationError);
    });
  });

  describe('getDescriptorLabel', () => {
    it('should return correct labels for known properties', () => {
      expect(BodyDescriptorValidator.getDescriptorLabel('build')).toBe('Build');
      expect(BodyDescriptorValidator.getDescriptorLabel('hairDensity')).toBe(
        'Body hair density'
      );
      expect(BodyDescriptorValidator.getDescriptorLabel('composition')).toBe(
        'Body composition'
      );
      expect(BodyDescriptorValidator.getDescriptorLabel('skinColor')).toBe(
        'Skin color'
      );
    });

    it('should return property name for unknown properties', () => {
      expect(BodyDescriptorValidator.getDescriptorLabel('unknown')).toBe(
        'unknown'
      );
    });
  });

  describe('getValidValues', () => {
    it('should return valid values for enum properties', () => {
      const buildValues = BodyDescriptorValidator.getValidValues('build');
      expect(buildValues).toEqual(Object.values(BODY_BUILD_TYPES));

      const densityValues = BodyDescriptorValidator.getValidValues('hairDensity');
      expect(densityValues).toEqual(Object.values(BODY_HAIR_DENSITY));

      const compositionValues =
        BodyDescriptorValidator.getValidValues('composition');
      expect(compositionValues).toEqual(Object.values(BODY_COMPOSITION_TYPES));
    });

    it('should return null for free-form properties', () => {
      expect(BodyDescriptorValidator.getValidValues('skinColor')).toBeNull();
    });

    it('should return null for unknown properties', () => {
      expect(BodyDescriptorValidator.getValidValues('unknown')).toBeNull();
    });
  });

  describe('hasEnumValidation', () => {
    it('should return true for enum-validated properties', () => {
      expect(BodyDescriptorValidator.hasEnumValidation('build')).toBe(true);
      expect(BodyDescriptorValidator.hasEnumValidation('hairDensity')).toBe(true);
      expect(BodyDescriptorValidator.hasEnumValidation('composition')).toBe(
        true
      );
    });

    it('should return false for free-form properties', () => {
      expect(BodyDescriptorValidator.hasEnumValidation('skinColor')).toBe(
        false
      );
    });

    it('should return false for unknown properties', () => {
      expect(BodyDescriptorValidator.hasEnumValidation('unknown')).toBe(false);
    });
  });
});
