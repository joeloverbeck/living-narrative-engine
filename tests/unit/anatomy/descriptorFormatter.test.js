import { describe, it, expect, beforeEach } from '@jest/globals';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

/**
 * Helper to create a formatter instance for tests.
 *
 * @param {object|null} service Optional mock formatting service
 * @returns {DescriptorFormatter} Formatter instance
 */
function createFormatter(service = null) {
  return new DescriptorFormatter({ anatomyFormattingService: service });
}

describe('DescriptorFormatter', () => {
  describe('formatDescriptors', () => {
    it('sorts descriptors using default order and joins them', () => {
      const formatter = createFormatter();
      const descriptors = [
        { componentId: 'descriptors:shape_general', value: 'curvy' },
        { componentId: 'descriptors:color_basic', value: 'red' },
        { componentId: 'descriptors:size_category', value: 'large' },
      ];

      const result = formatter.formatDescriptors(descriptors);
      // default order: size_category before color_basic before shape_general
      expect(result).toBe('large, red, curvy');
    });

    it('uses descriptor order from service when provided', () => {
      const mockService = {
        getDescriptorOrder: () => [
          'descriptors:shape_general',
          'descriptors:color_basic',
          'descriptors:size_category',
        ],
      };
      const formatter = createFormatter(mockService);
      const descriptors = [
        { componentId: 'descriptors:size_category', value: 'big' },
        { componentId: 'descriptors:shape_general', value: 'round' },
        { componentId: 'descriptors:color_basic', value: 'blue' },
      ];

      const result = formatter.formatDescriptors(descriptors);
      expect(result).toBe('round, blue, big');
    });

    it('returns empty string for no descriptors', () => {
      const formatter = createFormatter();
      expect(formatter.formatDescriptors([])).toBe('');
      expect(formatter.formatDescriptors(null)).toBe('');
    });
  });

  describe('formatSingleDescriptor', () => {
    it('formats embellishment descriptors with "embellished with" prefix', () => {
      const formatter = createFormatter();
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:embellishment',
          value: 'crystals',
        })
      ).toBe('embellished with crystals');
    });

    it('formats digit_count descriptors with "digits" suffix', () => {
      const formatter = createFormatter();
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:digit_count',
          value: '4',
        })
      ).toBe('4 digits');
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:digit_count',
          value: '5',
        })
      ).toBe('5 digits');
    });

    it('keeps hyphenated values intact', () => {
      const formatter = createFormatter();
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:shape_general',
          value: 'top-notch',
        })
      ).toBe('top-notch');
    });

    it('converts eye shape underscores to hyphen', () => {
      const formatter = createFormatter();
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:shape_eye',
          value: 'almond_shaped',
        })
      ).toBe('almond-shaped');
    });

    it('uses format rules from service when provided', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:custom_type': { prefix: 'has ', suffix: ' feature' },
        }),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:custom_type',
          value: 'amazing',
        })
      ).toBe('has amazing feature');
    });

    it('service rules override default rules', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:embellishment': { suffix: ' added' },
        }),
      };
      const formatter = createFormatter(mockService);
      // Service rule overrides the default "embellished with " prefix
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:embellishment',
          value: 'glitter',
        })
      ).toBe('glitter added');
    });

    it('applies transform before prefix/suffix', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:test': {
            transform: 'underscore_to_hyphen',
            prefix: '(',
            suffix: ')',
          },
        }),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:test',
          value: 'some_test_value',
        })
      ).toBe('(some-test-value)');
    });

    it('handles rules with only prefix', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:only_prefix': { prefix: 'the ' },
        }),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:only_prefix',
          value: 'value',
        })
      ).toBe('the value');
    });

    it('handles rules with only suffix', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:only_suffix': { suffix: '-ish' },
        }),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:only_suffix',
          value: 'red',
        })
      ).toBe('red-ish');
    });

    it('handles rules with only transform', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({
          'descriptors:only_transform': { transform: 'underscore_to_hyphen' },
        }),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:only_transform',
          value: 'a_b_c',
        })
      ).toBe('a-b-c');
    });

    it('falls back to default behavior when no rule matches', () => {
      const mockService = {
        getDescriptorFormatRules: () => ({}),
      };
      const formatter = createFormatter(mockService);
      expect(
        formatter.formatSingleDescriptor({
          componentId: 'descriptors:unknown',
          value: 'plain',
        })
      ).toBe('plain');
    });
  });

  describe('joinDescriptors', () => {
    it('joins values with commas', () => {
      const formatter = createFormatter();
      expect(formatter.joinDescriptors(['a', 'b', 'c'])).toBe('a, b, c');
    });

    it('returns empty string for empty array', () => {
      const formatter = createFormatter();
      expect(formatter.joinDescriptors([])).toBe('');
    });
  });

  describe('extractDescriptors & extractDescriptorValue', () => {
    let mockService;
    let formatter;
    beforeEach(() => {
      mockService = {
        getDescriptorValueKeys: () => ['value', 'alt'],
      };
      formatter = createFormatter(mockService);
    });

    it('extracts descriptor objects from components', () => {
      const components = {
        'descriptors:color_basic': { value: 'red' },
        'descriptors:size_category': { alt: 'small' },
        'core:name': { text: 'ignored' },
      };
      const result = formatter.extractDescriptors(components);
      expect(result).toEqual([
        { componentId: 'descriptors:color_basic', value: 'red' },
        { componentId: 'descriptors:size_category', value: 'small' },
      ]);
    });

    it('falls back to first string property when no keys match', () => {
      const components = {
        'descriptors:shape_general': { foo: 'bar', other: 1 },
      };
      const result = formatter.extractDescriptors(components);
      expect(result).toEqual([
        { componentId: 'descriptors:shape_general', value: 'bar' },
      ]);
    });

    it('returns empty array for invalid input', () => {
      expect(formatter.extractDescriptors(null)).toEqual([]);
      expect(formatter.extractDescriptors(undefined)).toEqual([]);
      expect(formatter.extractDescriptors('x')).toEqual([]);
    });

    it('extractDescriptorValue returns null when nothing found', () => {
      const value = formatter.extractDescriptorValue('descriptors:shape', {
        num: 1,
      });
      expect(value).toBeNull();
    });
  });
});
