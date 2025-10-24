import { describe, it, expect, jest } from '@jest/globals';
import {
  ensureTerminalPunctuation,
  snakeToCamel,
  isNonBlankString,
  formatPlaytime,
  formatTimestamp,
} from '../../../src/utils/textUtils.js';

/**
 * These tests exercise the text utility helpers in conditions that mirror how
 * higher level modules use them during integration scenarios. By validating the
 * behavioural guarantees here we gain confidence that downstream formatting,
 * validation and logging logic built on top of these helpers will remain
 * stable.
 */
describe('textUtils integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ensureTerminalPunctuation', () => {
    it('returns an empty string for nullish or blank input', () => {
      expect(ensureTerminalPunctuation(null)).toBe('');
      expect(ensureTerminalPunctuation(undefined)).toBe('');
      expect(ensureTerminalPunctuation('   ')).toBe('');
    });

    it('preserves punctuation when already present', () => {
      expect(ensureTerminalPunctuation('Ready!')).toBe('Ready!');
      expect(ensureTerminalPunctuation(' Are you sure?  ')).toBe('Are you sure?');
    });

    it('appends a period when terminal punctuation is missing', () => {
      expect(ensureTerminalPunctuation('Hello there')).toBe('Hello there.');
      expect(ensureTerminalPunctuation('  Trim me please  ')).toBe('Trim me please.');
    });
  });

  describe('snakeToCamel', () => {
    it('returns an empty string for falsy input or non-string values', () => {
      expect(snakeToCamel('')).toBe('');
      expect(snakeToCamel(42)).toBe('');
      expect(snakeToCamel(null)).toBe('');
    });

    it('transforms snake_case tokens to camelCase', () => {
      expect(snakeToCamel('system_prompt')).toBe('systemPrompt');
      expect(snakeToCamel('multi_part_identifier')).toBe('multiPartIdentifier');
      expect(snakeToCamel('alreadyCamel')).toBe('alreadyCamel');
    });
  });

  describe('isNonBlankString', () => {
    it('recognises meaningful string content', () => {
      expect(isNonBlankString(' Narrative ')).toBe(true);
      expect(isNonBlankString('')).toBe(false);
      expect(isNonBlankString('    ')).toBe(false);
      expect(isNonBlankString(10)).toBe(false);
    });
  });

  describe('formatPlaytime', () => {
    it('returns a formatted clock string for valid durations', () => {
      expect(formatPlaytime(0)).toBe('00:00:00');
      expect(formatPlaytime(61)).toBe('00:01:01');
      expect(formatPlaytime(3661)).toBe('01:01:01');
      expect(formatPlaytime(600)).toBe('00:10:00');
    });

    it('handles invalid values gracefully', () => {
      expect(formatPlaytime(-1)).toBe('N/A');
      expect(formatPlaytime(Number.NaN)).toBe('N/A');
      expect(formatPlaytime('not-a-number')).toBe('N/A');
      expect(formatPlaytime(Number.POSITIVE_INFINITY)).toBe('N/A');
      expect(formatPlaytime(Number.NEGATIVE_INFINITY)).toBe('N/A');
    });
  });

  describe('formatTimestamp', () => {
    it('formats ISO timestamps through Date#toLocaleString', () => {
      const toLocaleSpy = jest
        .spyOn(Date.prototype, 'toLocaleString')
        .mockReturnValue('mocked-locale');
      const result = formatTimestamp('2024-01-15T12:34:56.000Z');
      expect(result).toBe('mocked-locale');
      expect(toLocaleSpy).toHaveBeenCalledTimes(1);
      toLocaleSpy.mockRestore();
    });

    it('returns the provided fallback when the timestamp cannot be parsed', () => {
      const toLocaleSpy = jest.spyOn(Date.prototype, 'toLocaleString');
      expect(formatTimestamp('invalid timestamp', 'fallback')).toBe('fallback');
      expect(toLocaleSpy).not.toHaveBeenCalled();
      toLocaleSpy.mockRestore();
    });

    it('uses the fallback when Date construction throws', () => {
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => {
        throw new TypeError('boom');
      });
      expect(formatTimestamp(Symbol('bad-input'), 'error-fallback')).toBe(
        'error-fallback',
      );
      expect(dateSpy).toHaveBeenCalled();
      dateSpy.mockRestore();
    });

    it('defaults to "Invalid Date" when no fallback is supplied', () => {
      expect(formatTimestamp('not-a-real-date')).toBe('Invalid Date');
    });
  });
});
