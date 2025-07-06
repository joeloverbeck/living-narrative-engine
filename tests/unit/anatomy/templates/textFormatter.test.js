import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TextFormatter } from '../../../../src/anatomy/templates/textFormatter.js';

describe('TextFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new TextFormatter();
  });

  describe('capitalize', () => {
    it('should capitalize first letter of string', () => {
      expect(formatter.capitalize('hello')).toBe('Hello');
      expect(formatter.capitalize('world')).toBe('World');
      expect(formatter.capitalize('arm')).toBe('Arm');
    });

    it('should handle single character strings', () => {
      expect(formatter.capitalize('a')).toBe('A');
      expect(formatter.capitalize('z')).toBe('Z');
    });

    it('should handle empty string', () => {
      expect(formatter.capitalize('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(formatter.capitalize(null)).toBe('');
      expect(formatter.capitalize(undefined)).toBe('');
    });

    it('should handle already capitalized strings', () => {
      expect(formatter.capitalize('Hello')).toBe('Hello');
      expect(formatter.capitalize('WORLD')).toBe('WORLD');
    });

    it('should handle strings with spaces', () => {
      expect(formatter.capitalize('hello world')).toBe('Hello world');
      expect(formatter.capitalize(' hello')).toBe(' hello');
    });

    it('should replace underscores with spaces', () => {
      expect(formatter.capitalize('pubic_hair')).toBe('Pubic hair');
      expect(formatter.capitalize('body_part')).toBe('Body part');
      expect(formatter.capitalize('test_with_multiple_underscores')).toBe(
        'Test with multiple underscores'
      );
    });

    it('should handle strings with both spaces and underscores', () => {
      expect(formatter.capitalize('hello_world test')).toBe('Hello world test');
      expect(formatter.capitalize('pubic_hair area')).toBe('Pubic hair area');
    });

    it('should handle strings starting with underscore', () => {
      expect(formatter.capitalize('_test')).toBe(' test');
      expect(formatter.capitalize('_pubic_hair')).toBe(' pubic hair');
    });

    it('should handle strings ending with underscore', () => {
      expect(formatter.capitalize('test_')).toBe('Test ');
      expect(formatter.capitalize('pubic_hair_')).toBe('Pubic hair ');
    });
  });

  describe('getPartLabel', () => {
    let mockPluralizerFn;
    let pairedPartsSet;

    beforeEach(() => {
      mockPluralizerFn = jest.fn().mockImplementation((type) => {
        if (type === 'foot') return 'feet';
        if (type === 'eye') return 'eyes';
        if (type === 'arm') return 'arms';
        return `${type}s`;
      });

      pairedPartsSet = new Set(['eye', 'arm', 'foot']);
    });

    it('should return capitalized singular for single part', () => {
      const result = formatter.getPartLabel(
        'arm',
        1,
        mockPluralizerFn,
        pairedPartsSet
      );
      expect(result).toBe('Arm');
      expect(mockPluralizerFn).not.toHaveBeenCalled();
    });

    it('should return capitalized plural for multiple paired parts', () => {
      const result = formatter.getPartLabel(
        'arm',
        2,
        mockPluralizerFn,
        pairedPartsSet
      );
      expect(result).toBe('Arms');
      expect(mockPluralizerFn).toHaveBeenCalledWith('arm');
    });

    it('should return singular for multiple non-paired parts', () => {
      const nonPairedSet = new Set();
      const result = formatter.getPartLabel(
        'tail',
        3,
        mockPluralizerFn,
        nonPairedSet
      );
      expect(result).toBe('Tail');
      expect(mockPluralizerFn).not.toHaveBeenCalled();
    });

    it('should handle irregular plurals', () => {
      const result = formatter.getPartLabel(
        'foot',
        2,
        mockPluralizerFn,
        pairedPartsSet
      );
      expect(result).toBe('Feet');
      expect(mockPluralizerFn).toHaveBeenCalledWith('foot');
    });

    it('should handle empty part type', () => {
      const result = formatter.getPartLabel(
        '',
        2,
        mockPluralizerFn,
        pairedPartsSet
      );
      expect(result).toBe('');
    });
  });

  describe('joinDescriptors', () => {
    it('should join multiple descriptors with commas', () => {
      expect(formatter.joinDescriptors(['red', 'large', 'round'])).toBe(
        'red, large, round'
      );
    });

    it('should handle single descriptor', () => {
      expect(formatter.joinDescriptors(['blue'])).toBe('blue');
    });

    it('should handle empty array', () => {
      expect(formatter.joinDescriptors([])).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(formatter.joinDescriptors(null)).toBe('');
      expect(formatter.joinDescriptors(undefined)).toBe('');
    });

    it('should filter out empty values', () => {
      expect(
        formatter.joinDescriptors(['red', '', 'blue', null, 'green'])
      ).toBe('red, blue, green');
    });

    it('should handle all empty values', () => {
      expect(formatter.joinDescriptors(['', null, undefined])).toBe('');
    });
  });

  describe('formatLabelValue', () => {
    it('should format label and value with colon separator', () => {
      expect(formatter.formatLabelValue('Hair', 'long black hair')).toBe(
        'Hair: long black hair'
      );
      expect(formatter.formatLabelValue('Eyes', 'blue eyes')).toBe(
        'Eyes: blue eyes'
      );
    });

    it('should handle empty values', () => {
      expect(formatter.formatLabelValue('Hair', '')).toBe('Hair: ');
      expect(formatter.formatLabelValue('', 'value')).toBe(': value');
    });
  });

  describe('formatIndexedItem', () => {
    it('should format indexed items correctly', () => {
      expect(formatter.formatIndexedItem('arm', 1, 'strong arm')).toBe(
        'Arm 1: strong arm'
      );
      expect(formatter.formatIndexedItem('wing', 2, 'feathered wing')).toBe(
        'Wing 2: feathered wing'
      );
    });

    it('should capitalize the type', () => {
      expect(formatter.formatIndexedItem('tentacle', 3, 'slimy tentacle')).toBe(
        'Tentacle 3: slimy tentacle'
      );
    });

    it('should handle empty description', () => {
      expect(formatter.formatIndexedItem('arm', 1, '')).toBe('Arm 1: ');
    });
  });

  describe('formatSidedItem', () => {
    it('should format left/right items correctly', () => {
      expect(formatter.formatSidedItem('Left', 'eye', 'blue eye')).toBe(
        'Left eye: blue eye'
      );
      expect(formatter.formatSidedItem('Right', 'arm', 'strong arm')).toBe(
        'Right arm: strong arm'
      );
    });

    it('should preserve case of side', () => {
      expect(formatter.formatSidedItem('LEFT', 'eye', 'blue eye')).toBe(
        'LEFT eye: blue eye'
      );
      expect(formatter.formatSidedItem('left', 'eye', 'blue eye')).toBe(
        'left eye: blue eye'
      );
    });

    it('should handle empty description', () => {
      expect(formatter.formatSidedItem('Left', 'eye', '')).toBe('Left eye: ');
    });
  });

  describe('joinLines', () => {
    it('should join multiple lines with newlines', () => {
      const lines = ['Line 1', 'Line 2', 'Line 3'];
      expect(formatter.joinLines(lines)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should filter out empty lines', () => {
      const lines = ['Line 1', '', 'Line 2', null, 'Line 3'];
      expect(formatter.joinLines(lines)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle single line', () => {
      expect(formatter.joinLines(['Only line'])).toBe('Only line');
    });

    it('should handle empty array', () => {
      expect(formatter.joinLines([])).toBe('');
    });

    it('should handle all empty values', () => {
      expect(formatter.joinLines(['', null, undefined])).toBe('');
    });
  });
});
