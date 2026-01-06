import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChanceTextTranslator } from '../../../src/prompting/ChanceTextTranslator.js';

describe('ChanceTextTranslator', () => {
  let translator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    translator = new ChanceTextTranslator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('initializes with a valid logger', () => {
      expect(translator).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ChanceTextTranslator: Initialized'
      );
    });

    it('throws when logger is missing required methods', () => {
      expect(() => {
        new ChanceTextTranslator({ logger: {} });
      }).toThrow();
    });

    it('throws when logger is null', () => {
      expect(() => {
        new ChanceTextTranslator({ logger: null });
      }).toThrow();
    });
  });

  describe('getQualitativeLabel', () => {
    it.each([
      [100, 'certain'],
      [95, 'certain'],
      [94, 'excellent chance'],
      [85, 'excellent chance'],
      [84, 'very good chance'],
      [75, 'very good chance'],
      [74, 'good chance'],
      [65, 'good chance'],
      [64, 'decent chance'],
      [55, 'decent chance'],
      [54, 'fair chance'],
      [45, 'fair chance'],
      [44, 'uncertain chance'],
      [35, 'uncertain chance'],
      [34, 'poor chance'],
      [25, 'poor chance'],
      [24, 'unlikely'],
      [15, 'unlikely'],
      [14, 'very unlikely'],
      [5, 'very unlikely'],
      [4, 'desperate'],
      [1, 'desperate'],
      [0, 'impossible'],
    ])('returns "%s" for %d%%', (percentage, expected) => {
      expect(translator.getQualitativeLabel(percentage)).toBe(expected);
    });

    it('clamps values above 100 to certain', () => {
      expect(translator.getQualitativeLabel(150)).toBe('certain');
    });

    it('clamps negative values to impossible', () => {
      expect(translator.getQualitativeLabel(-10)).toBe('impossible');
    });

    it('rounds floating point values before mapping', () => {
      expect(translator.getQualitativeLabel(54.7)).toBe('decent chance');
      expect(translator.getQualitativeLabel(54.4)).toBe('fair chance');
    });

    it('returns fair chance with warning for NaN', () => {
      expect(translator.getQualitativeLabel(Number.NaN)).toBe('fair chance');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns fair chance with warning for non-number', () => {
      expect(translator.getQualitativeLabel('fifty')).toBe('fair chance');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns fair chance with warning for null and undefined', () => {
      expect(translator.getQualitativeLabel(null)).toBe('fair chance');
      expect(translator.getQualitativeLabel(undefined)).toBe('fair chance');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns fair chance when no matching level is found', () => {
      const originalLevels = ChanceTextTranslator.CHANCE_LEVELS;
      ChanceTextTranslator.CHANCE_LEVELS = [
        { min: 101, max: 200, label: 'out of range' },
      ];

      try {
        expect(translator.getQualitativeLabel(50)).toBe('fair chance');
        expect(mockLogger.warn).toHaveBeenCalled();
      } finally {
        ChanceTextTranslator.CHANCE_LEVELS = originalLevels;
      }
    });
  });

  describe('translateForLlm', () => {
    it.each([
      ['punch Goblin (55% chance)', 'punch Goblin (decent chance)'],
      ['attack target (95% chance)', 'attack target (certain)'],
      ['risky move (5% chance)', 'risky move (very unlikely)'],
      ['impossible action (0% chance)', 'impossible action (impossible)'],
      ['guaranteed hit (100% chance)', 'guaranteed hit (certain)'],
    ])('replaces "%s" with "%s"', (input, expected) => {
      expect(translator.translateForLlm(input)).toBe(expected);
    });

    it('preserves modifier tags after chance', () => {
      const input = 'attack (55% chance) [flanking] [weapon-bonus]';
      expect(translator.translateForLlm(input)).toBe(
        'attack (decent chance) [flanking] [weapon-bonus]'
      );
    });

    it('handles modifier tags with no space after chance', () => {
      const input = 'attack (55% chance)[flanking]';
      expect(translator.translateForLlm(input)).toBe(
        'attack (decent chance)[flanking]'
      );
    });

    it('preserves complex tag combinations', () => {
      const input = 'strike (75% chance) [critical] [backstab] [poisoned]';
      expect(translator.translateForLlm(input)).toBe(
        'strike (very good chance) [critical] [backstab] [poisoned]'
      );
    });

    it('handles multiple chance patterns in one string', () => {
      const input = 'attack (75% chance) or defend (45% chance)';
      expect(translator.translateForLlm(input)).toBe(
        'attack (very good chance) or defend (fair chance)'
      );
    });

    it('handles three or more chance patterns', () => {
      const input = 'a (95% chance), b (50% chance), c (5% chance)';
      expect(translator.translateForLlm(input)).toBe(
        'a (certain), b (fair chance), c (very unlikely)'
      );
    });

    it('keeps text unchanged when chance pattern is absent', () => {
      const input = 'walk to tavern';
      expect(translator.translateForLlm(input)).toBe('walk to tavern');
    });

    it('does not match chance without a space before "chance"', () => {
      const input = 'attack (55%chance)';
      expect(translator.translateForLlm(input)).toBe('attack (55%chance)');
    });

    it.each([
      ['attack (55% Chance)', 'attack (decent chance)'],
      ['attack (55% CHANCE)', 'attack (decent chance)'],
      ['attack (55% cHaNcE)', 'attack (decent chance)'],
    ])('handles case-insensitive chance text: "%s"', (input, expected) => {
      expect(translator.translateForLlm(input)).toBe(expected);
    });

    it('handles multiple spaces before "chance"', () => {
      expect(translator.translateForLlm('attack (55%  chance)')).toBe(
        'attack (decent chance)'
      );
      expect(translator.translateForLlm('attack (55%   chance)')).toBe(
        'attack (decent chance)'
      );
    });

    it('returns empty string for null input', () => {
      expect(translator.translateForLlm(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(translator.translateForLlm(undefined)).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(translator.translateForLlm(123)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(translator.translateForLlm('')).toBe('');
    });
  });

  describe('static properties', () => {
    describe('CHANCE_LEVELS', () => {
      it('has 12 levels', () => {
        expect(ChanceTextTranslator.CHANCE_LEVELS).toHaveLength(12);
      });

      it('covers 0 to 100 without gaps', () => {
        const levels = ChanceTextTranslator.CHANCE_LEVELS;
        const sorted = [...levels].sort((a, b) => a.min - b.min);

        expect(sorted[0].min).toBe(0);
        expect(sorted[sorted.length - 1].max).toBe(100);

        for (let i = 0; i <= 100; i += 1) {
          const matchingLevel = levels.find(
            (level) => i >= level.min && i <= level.max
          );
          expect(matchingLevel).toBeDefined();
        }
      });

      it('has unique labels for each level', () => {
        const labels = ChanceTextTranslator.CHANCE_LEVELS.map(
          (level) => level.label
        );
        const uniqueLabels = new Set(labels);
        expect(uniqueLabels.size).toBe(labels.length);
      });
    });

    describe('CHANCE_PATTERN', () => {
      it('is a RegExp with global and case-insensitive flags', () => {
        expect(ChanceTextTranslator.CHANCE_PATTERN).toBeInstanceOf(RegExp);
        expect(ChanceTextTranslator.CHANCE_PATTERN.flags).toContain('g');
        expect(ChanceTextTranslator.CHANCE_PATTERN.flags).toContain('i');
      });

      it('matches standard chance patterns', () => {
        const pattern = ChanceTextTranslator.CHANCE_PATTERN;
        expect('(55% chance)'.match(pattern)).toBeTruthy();
        expect('(100% chance)'.match(pattern)).toBeTruthy();
        expect('(0% chance)'.match(pattern)).toBeTruthy();
      });

      it('captures the percentage number', () => {
        const pattern = new RegExp(
          ChanceTextTranslator.CHANCE_PATTERN.source,
          'i'
        );
        const match = '(55% chance)'.match(pattern);
        expect(match[1]).toBe('55');
      });
    });
  });
});
