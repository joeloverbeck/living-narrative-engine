/**
 * @file Unit tests for body descriptor utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatDescriptorForDisplay,
  filterValidDescriptors,
  mergeDescriptors,
  getActiveDescriptorProperties,
  descriptorsToDisplayArray,
} from '../../../../src/anatomy/utils/bodyDescriptorUtils.js';
import { BODY_BUILD_TYPES } from '../../../../src/anatomy/constants/bodyDescriptorConstants.js';

describe('bodyDescriptorUtils', () => {
  describe('formatDescriptorForDisplay', () => {
    it('should format known properties with correct labels', () => {
      expect(formatDescriptorForDisplay('build', 'athletic')).toBe(
        'Build: athletic'
      );
      expect(formatDescriptorForDisplay('hairDensity', 'moderate')).toBe(
        'Body hair density: moderate'
      );
      expect(formatDescriptorForDisplay('composition', 'lean')).toBe(
        'Body composition: lean'
      );
      expect(formatDescriptorForDisplay('skinColor', 'pale')).toBe(
        'Skin color: pale'
      );
    });

    it('should use property name as label for unknown properties', () => {
      expect(formatDescriptorForDisplay('unknown', 'value')).toBe(
        'unknown: value'
      );
    });
  });

  describe('filterValidDescriptors', () => {
    it('should return empty object for null/undefined input', () => {
      expect(filterValidDescriptors(null)).toEqual({});
      expect(filterValidDescriptors(undefined)).toEqual({});
    });

    it('should filter out empty and null values', () => {
      const input = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: '',
        composition: null,
        skinColor: 'pale',
        emptyString: '   ',
      };
      const result = filterValidDescriptors(input);
      expect(result).toEqual({
        build: BODY_BUILD_TYPES.ATHLETIC,
        skinColor: 'pale',
      });
    });

    it('should trim whitespace from valid values', () => {
      const input = {
        build: '  athletic  ',
        skinColor: '\tpale\n',
      };
      const result = filterValidDescriptors(input);
      expect(result).toEqual({
        build: 'athletic',
        skinColor: 'pale',
      });
    });

    it('should filter out non-string values', () => {
      const input = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        number: 123,
        object: {},
        array: [],
        skinColor: 'pale',
      };
      const result = filterValidDescriptors(input);
      expect(result).toEqual({
        build: BODY_BUILD_TYPES.ATHLETIC,
        skinColor: 'pale',
      });
    });
  });

  describe('mergeDescriptors', () => {
    it('should merge descriptor objects with override precedence', () => {
      const base = {
        build: BODY_BUILD_TYPES.SLIM,
        hairDensity: 'light',
        skinColor: 'fair',
      };
      const override = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        composition: 'lean',
      };
      const result = mergeDescriptors(base, override);
      expect(result).toEqual({
        build: BODY_BUILD_TYPES.ATHLETIC, // overridden
        hairDensity: 'light', // from base
        skinColor: 'fair', // from base
        composition: 'lean', // from override
      });
    });

    it('should filter invalid values during merge', () => {
      const base = {
        build: BODY_BUILD_TYPES.SLIM,
        hairDensity: '',
        skinColor: 'fair',
      };
      const override = {
        build: null,
        composition: 'lean',
        emptyProp: '   ',
      };
      const result = mergeDescriptors(base, override);
      expect(result).toEqual({
        build: BODY_BUILD_TYPES.SLIM, // from base (override was null)
        skinColor: 'fair',
        composition: 'lean',
      });
    });

    it('should handle null/undefined inputs', () => {
      const valid = { build: BODY_BUILD_TYPES.ATHLETIC };
      expect(mergeDescriptors(null, valid)).toEqual(valid);
      expect(mergeDescriptors(valid, null)).toEqual(valid);
      expect(mergeDescriptors(null, null)).toEqual({});
    });
  });

  describe('getActiveDescriptorProperties', () => {
    it('should return properties with valid values', () => {
      const descriptors = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: '',
        composition: 'lean',
        skinColor: null,
        validProp: 'value',
      };
      const result = getActiveDescriptorProperties(descriptors);
      expect(result.sort()).toEqual(['build', 'composition', 'validProp']);
    });

    it('should return empty array for null/undefined input', () => {
      expect(getActiveDescriptorProperties(null)).toEqual([]);
      expect(getActiveDescriptorProperties(undefined)).toEqual([]);
    });

    it('should return empty array for object with no valid values', () => {
      const descriptors = {
        emptyString: '',
        nullValue: null,
        whitespace: '   ',
      };
      expect(getActiveDescriptorProperties(descriptors)).toEqual([]);
    });
  });

  describe('descriptorsToDisplayArray', () => {
    it('should convert descriptors to formatted display array', () => {
      const descriptors = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: 'moderate',
        skinColor: 'pale',
      };
      const result = descriptorsToDisplayArray(descriptors);
      expect(result).toContain('Build: athletic');
      expect(result).toContain('Body hair density: moderate');
      expect(result).toContain('Skin color: pale');
      expect(result).toHaveLength(3);
    });

    it('should filter out invalid values before formatting', () => {
      const descriptors = {
        build: BODY_BUILD_TYPES.ATHLETIC,
        hairDensity: '',
        composition: null,
        skinColor: 'pale',
      };
      const result = descriptorsToDisplayArray(descriptors);
      expect(result).toEqual(['Build: athletic', 'Skin color: pale']);
    });

    it('should return empty array for null/undefined input', () => {
      expect(descriptorsToDisplayArray(null)).toEqual([]);
      expect(descriptorsToDisplayArray(undefined)).toEqual([]);
    });

    it('should return empty array for object with no valid descriptors', () => {
      const descriptors = {
        empty: '',
        nullValue: null,
        whitespace: '   ',
      };
      expect(descriptorsToDisplayArray(descriptors)).toEqual([]);
    });
  });
});
