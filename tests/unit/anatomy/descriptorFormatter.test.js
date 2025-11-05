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
