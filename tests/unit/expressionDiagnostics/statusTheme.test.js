/**
 * @file Unit tests for statusTheme.js - Single source of truth for status colors
 * @description Tests that emoji indicators are visually consistent with fill colors
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  STATUS_THEME,
  STATUS_KEYS,
  STATUS_PRIORITY,
  NON_PROBLEMATIC_STATUSES,
  RARITY_CATEGORIES,
  getStatusFillColor,
  getStatusBackgroundColor,
  getStatusTextColor,
  getStatusThemeEntry,
  generateCssVariables,
  generateCssVariablesString,
  getStatusCircleCssClass,
} from '../../../src/expressionDiagnostics/statusTheme.js';

/**
 * Mapping of colorName to acceptable emojis for visual consistency.
 * Some color families have multiple valid emojis (e.g., 'red' can use 🔴 or ⛔).
 * This accounts for the three-tier classification where different severity levels
 * may share a color family but use different emojis for distinction.
 */
const ACCEPTABLE_EMOJIS_FOR_COLOR = Object.freeze({
  gray: ['⚪'],
  red: ['🔴', '⛔'], // Legacy 'impossible' uses 🔴, 'empirically_unreachable' uses ⛔
  'dark-red': ['🚫'], // 'theoretically_impossible' uses prohibition sign
  amber: ['🟡'],
  orange: ['🟠'],
  magenta: ['🟣'],
  cyan: ['🩵'],
  teal: ['🟢'],
  indigo: ['🔵'],
});

describe('statusTheme.js', () => {
  describe('STATUS_THEME structure', () => {
    it('should export all required status keys', () => {
      const expectedKeys = [
        'unknown',
        'impossible',
        'theoretically_impossible',
        'empirically_unreachable',
        'unobserved',
        'extremely_rare',
        'rare',
        'uncommon',
        'normal',
        'frequent',
      ];
      expect(STATUS_KEYS).toEqual(expect.arrayContaining(expectedKeys));
      expect(STATUS_KEYS).toHaveLength(expectedKeys.length);
    });

    it('should have all required properties for each status', () => {
      const requiredProps = [
        'fill',
        'background',
        'text',
        'emoji',
        'label',
        'colorName',
      ];

      for (const key of STATUS_KEYS) {
        const entry = STATUS_THEME[key];
        for (const prop of requiredProps) {
          expect(entry).toHaveProperty(prop);
          expect(entry[prop]).toBeDefined();
        }
      }
    });

    it('should have frozen entries', () => {
      expect(Object.isFrozen(STATUS_THEME)).toBe(true);
      for (const key of STATUS_KEYS) {
        expect(Object.isFrozen(STATUS_THEME[key])).toBe(true);
      }
    });
  });

  describe('Emoji-to-ColorName Consistency', () => {
    it.each(STATUS_KEYS)(
      'status "%s" emoji should visually match its colorName',
      (statusKey) => {
        const entry = STATUS_THEME[statusKey];
        const acceptableEmojis = ACCEPTABLE_EMOJIS_FOR_COLOR[entry.colorName];

        expect(acceptableEmojis).toBeDefined();
        expect(acceptableEmojis).toContain(entry.emoji);
      }
    );

    it('rare status should use purple emoji (🟣) to match magenta fill color', () => {
      const rare = STATUS_THEME.rare;
      expect(rare.colorName).toBe('magenta');
      expect(rare.emoji).toBe('🟣');
    });

    it('all statuses should have consistent emoji-color pairings', () => {
      // This test documents the expected mapping
      expect(STATUS_THEME.unknown.emoji).toBe('⚪'); // gray
      expect(STATUS_THEME.impossible.emoji).toBe('🔴'); // red (legacy)
      expect(STATUS_THEME.theoretically_impossible.emoji).toBe('🚫'); // dark-red (static impossibility)
      expect(STATUS_THEME.empirically_unreachable.emoji).toBe('⛔'); // red (ceiling effect)
      expect(STATUS_THEME.unobserved.emoji).toBe('🟡'); // amber → yellow
      expect(STATUS_THEME.extremely_rare.emoji).toBe('🟠'); // orange
      expect(STATUS_THEME.rare.emoji).toBe('🟣'); // magenta → purple
      expect(STATUS_THEME.uncommon.emoji).toBe('🩵'); // cyan → light blue heart
      expect(STATUS_THEME.normal.emoji).toBe('🟢'); // teal → green
      expect(STATUS_THEME.frequent.emoji).toBe('🔵'); // indigo → blue
    });
  });

  describe('Fill colors', () => {
    it('should have valid hex color codes for fill', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      for (const key of STATUS_KEYS) {
        expect(STATUS_THEME[key].fill).toMatch(hexColorRegex);
      }
    });

    it('rare fill color should be magenta (#EE3377)', () => {
      expect(STATUS_THEME.rare.fill).toBe('#EE3377');
    });
  });

  describe('getStatusFillColor()', () => {
    it('should return correct fill color for valid status', () => {
      expect(getStatusFillColor('rare')).toBe('#EE3377');
      expect(getStatusFillColor('impossible')).toBe('#CC3311');
    });

    it('should return unknown fill color for invalid status', () => {
      expect(getStatusFillColor('invalid')).toBe('#BBBBBB');
      expect(getStatusFillColor(null)).toBe('#BBBBBB');
      expect(getStatusFillColor(undefined)).toBe('#BBBBBB');
    });
  });

  describe('getStatusBackgroundColor()', () => {
    it('should return correct background color for valid status', () => {
      expect(getStatusBackgroundColor('rare')).toBe('#FDE7EF');
    });

    it('should return unknown background color for invalid status', () => {
      expect(getStatusBackgroundColor('invalid')).toBe('#F7F7F7');
    });
  });

  describe('getStatusTextColor()', () => {
    it('should return correct text color for valid status', () => {
      expect(getStatusTextColor('rare')).toBe('#6B1736');
    });

    it('should return unknown text color for invalid status', () => {
      expect(getStatusTextColor('invalid')).toBe('#545454');
    });
  });

  describe('getStatusThemeEntry()', () => {
    it('should return full entry for valid status', () => {
      const entry = getStatusThemeEntry('rare');
      expect(entry).toEqual(STATUS_THEME.rare);
    });

    it('should return unknown entry for invalid status', () => {
      const entry = getStatusThemeEntry('invalid');
      expect(entry).toEqual(STATUS_THEME.unknown);
    });
  });

  describe('generateCssVariables()', () => {
    it('should generate CSS variables for all statuses', () => {
      const vars = generateCssVariables();

      expect(vars['--status-rare-fill']).toBe('#EE3377');
      expect(vars['--status-rare-bg']).toBe('#FDE7EF');
      expect(vars['--status-rare-text']).toBe('#6B1736');
    });

    it('should normalize underscores to hyphens in CSS variable names', () => {
      const vars = generateCssVariables();

      expect(vars['--status-extremely-rare-fill']).toBeDefined();
      expect(vars['--status-extremely_rare-fill']).toBeUndefined();
    });
  });

  describe('generateCssVariablesString()', () => {
    it('should generate valid CSS :root declaration', () => {
      const css = generateCssVariablesString();

      expect(css).toContain(':root {');
      expect(css).toContain('--status-rare-fill: #EE3377;');
      expect(css).toContain('}');
    });
  });

  describe('getStatusCircleCssClass()', () => {
    it('should return correct CSS class for valid status', () => {
      expect(getStatusCircleCssClass('rare')).toBe('status-rare');
      expect(getStatusCircleCssClass('impossible')).toBe('status-impossible');
      expect(getStatusCircleCssClass('normal')).toBe('status-normal');
      expect(getStatusCircleCssClass('frequent')).toBe('status-frequent');
      expect(getStatusCircleCssClass('unknown')).toBe('status-unknown');
    });

    it('should normalize underscores to hyphens', () => {
      expect(getStatusCircleCssClass('extremely_rare')).toBe(
        'status-extremely-rare'
      );
    });

    it('should handle case insensitivity', () => {
      expect(getStatusCircleCssClass('RARE')).toBe('status-rare');
      expect(getStatusCircleCssClass('Impossible')).toBe('status-impossible');
      expect(getStatusCircleCssClass('EXTREMELY_RARE')).toBe(
        'status-extremely-rare'
      );
    });

    it('should return status-unknown for null/undefined', () => {
      expect(getStatusCircleCssClass(null)).toBe('status-unknown');
      expect(getStatusCircleCssClass(undefined)).toBe('status-unknown');
    });

    it('should return status-unknown for empty string', () => {
      expect(getStatusCircleCssClass('')).toBe('status-unknown');
    });

    it('should return status-unknown for invalid status', () => {
      expect(getStatusCircleCssClass('invalid')).toBe('status-unknown');
      expect(getStatusCircleCssClass('not-a-status')).toBe('status-unknown');
      expect(getStatusCircleCssClass('foo_bar')).toBe('status-unknown');
    });

    it('should log warning for invalid status when logger provided', () => {
      const mockLogger = { warn: jest.fn() };
      getStatusCircleCssClass('invalid-status', mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unrecognized status')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid-status')
      );
    });

    it('should not throw when no logger provided', () => {
      expect(() => getStatusCircleCssClass('invalid', null)).not.toThrow();
      expect(() => getStatusCircleCssClass('invalid')).not.toThrow();
    });

    it('should not log for valid statuses', () => {
      const mockLogger = { warn: jest.fn() };
      getStatusCircleCssClass('rare', mockLogger);
      getStatusCircleCssClass('extremely_rare', mockLogger);
      getStatusCircleCssClass('unknown', mockLogger);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle hyphenated input (already CSS-formatted)', () => {
      expect(getStatusCircleCssClass('extremely-rare')).toBe(
        'status-extremely-rare'
      );
    });

    it('should include valid statuses in warning message', () => {
      const mockLogger = { warn: jest.fn() };
      getStatusCircleCssClass('invalid', mockLogger);

      const warningMessage = mockLogger.warn.mock.calls[0][0];
      expect(warningMessage).toContain('unknown');
      expect(warningMessage).toContain('impossible');
      expect(warningMessage).toContain('theoretically_impossible');
      expect(warningMessage).toContain('empirically_unreachable');
      expect(warningMessage).toContain('unobserved');
      expect(warningMessage).toContain('extremely_rare');
      expect(warningMessage).toContain('rare');
      expect(warningMessage).toContain('uncommon');
      expect(warningMessage).toContain('normal');
      expect(warningMessage).toContain('frequent');
    });
  });

  describe('STATUS_PRIORITY', () => {
    it('should have all status keys with numeric priority values', () => {
      for (const key of STATUS_KEYS) {
        expect(STATUS_PRIORITY).toHaveProperty(key);
        expect(typeof STATUS_PRIORITY[key]).toBe('number');
      }
    });

    it('should have theoretically_impossible as highest priority (0)', () => {
      expect(STATUS_PRIORITY.theoretically_impossible).toBe(0);
    });

    it('should have legacy impossible at priority 1', () => {
      expect(STATUS_PRIORITY.impossible).toBe(1);
    });

    it('should have empirically_unreachable at priority 2', () => {
      expect(STATUS_PRIORITY.empirically_unreachable).toBe(2);
    });

    it('should have frequent as lowest priority (9)', () => {
      expect(STATUS_PRIORITY.frequent).toBe(9);
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(STATUS_PRIORITY)).toBe(true);
    });

    it('should have unobserved before unknown in priority', () => {
      expect(STATUS_PRIORITY.unobserved).toBe(3);
      expect(STATUS_PRIORITY.unknown).toBe(4);
    });

    it('should have uncommon in correct position', () => {
      expect(STATUS_PRIORITY.uncommon).toBe(7);
    });
  });

  describe('NON_PROBLEMATIC_STATUSES', () => {
    it('should be a frozen Set', () => {
      expect(NON_PROBLEMATIC_STATUSES).toBeInstanceOf(Set);
      expect(Object.isFrozen(NON_PROBLEMATIC_STATUSES)).toBe(true);
    });

    it('should contain normal, frequent, and uncommon', () => {
      expect(NON_PROBLEMATIC_STATUSES.has('normal')).toBe(true);
      expect(NON_PROBLEMATIC_STATUSES.has('frequent')).toBe(true);
      expect(NON_PROBLEMATIC_STATUSES.has('uncommon')).toBe(true);
    });

    it('should not contain problematic statuses', () => {
      expect(NON_PROBLEMATIC_STATUSES.has('impossible')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('theoretically_impossible')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('empirically_unreachable')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('unknown')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('unobserved')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('extremely_rare')).toBe(false);
      expect(NON_PROBLEMATIC_STATUSES.has('rare')).toBe(false);
    });
  });

  describe('RARITY_CATEGORIES', () => {
    it('should have uppercase keys mapping to lowercase values', () => {
      for (const key of STATUS_KEYS) {
        const upperKey = key.toUpperCase();
        expect(RARITY_CATEGORIES).toHaveProperty(upperKey);
        expect(RARITY_CATEGORIES[upperKey]).toBe(key);
      }
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(RARITY_CATEGORIES)).toBe(true);
    });

    it('should have EXTREMELY_RARE mapping to extremely_rare', () => {
      expect(RARITY_CATEGORIES.EXTREMELY_RARE).toBe('extremely_rare');
    });
  });
});
