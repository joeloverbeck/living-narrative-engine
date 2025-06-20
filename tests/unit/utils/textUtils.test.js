// tests/utils/textUtils.test.js
// --- FILE START ---

import { describe, test, expect } from '@jest/globals';
import { ensureTerminalPunctuation } from '../../../src/utils/textUtils.js';

describe('ensureTerminalPunctuation', () => {
  test('should return an empty string for null input', () => {
    expect(ensureTerminalPunctuation(null)).toBe('');
  });

  test('should return an empty string for undefined input', () => {
    expect(ensureTerminalPunctuation(undefined)).toBe('');
  });

  test('should return an empty string for an empty string input', () => {
    expect(ensureTerminalPunctuation('')).toBe('');
  });

  test('should return an empty string for a string with spaces only', () => {
    expect(ensureTerminalPunctuation('   ')).toBe('');
  });

  test('should return the same string if it already ends with a period', () => {
    const text = 'This is a sentence.';
    expect(ensureTerminalPunctuation(text)).toBe(text);
  });

  test('should return the same string if it already ends with an exclamation mark', () => {
    const text = 'This is exciting!';
    expect(ensureTerminalPunctuation(text)).toBe(text);
  });

  test('should return the same string if it already ends with a question mark', () => {
    const text = 'Is this correct?';
    expect(ensureTerminalPunctuation(text)).toBe(text);
  });

  test('should append a period if the string does not end with punctuation', () => {
    const text = 'This is a sentence';
    expect(ensureTerminalPunctuation(text)).toBe('This is a sentence.');
  });

  test('should trim leading/trailing spaces and append a period if needed', () => {
    const text = '  This needs punctuation   ';
    expect(ensureTerminalPunctuation(text)).toBe('This needs punctuation.');
  });

  test('should trim leading/trailing spaces and not append if punctuation exists', () => {
    const text = '  Already punctuated!   ';
    expect(ensureTerminalPunctuation(text)).toBe('Already punctuated!');
  });

  test('should handle non-string input gracefully (e.g. number), returning empty string', () => {
    // @ts-ignore // Testing invalid input type
    expect(ensureTerminalPunctuation(123)).toBe('');
  });

  test('should handle non-string input gracefully (e.g. object), returning empty string', () => {
    // @ts-ignore // Testing invalid input type
    expect(ensureTerminalPunctuation({ message: 'hello' })).toBe('');
  });

  test('should handle non-string input gracefully (e.g. boolean), returning empty string', () => {
    // @ts-ignore // Testing invalid input type
    expect(ensureTerminalPunctuation(true)).toBe('');
  });

  test('should not append a period if the string is just punctuation (though unlikely)', () => {
    expect(ensureTerminalPunctuation('.')).toBe('.');
    expect(ensureTerminalPunctuation('!')).toBe('!');
    expect(ensureTerminalPunctuation('?')).toBe('?');
  });

  test('should append a period to a single word', () => {
    expect(ensureTerminalPunctuation('Word')).toBe('Word.');
  });

  test('should correctly handle string "null" and "undefined"', () => {
    expect(ensureTerminalPunctuation('null')).toBe('null.');
    expect(ensureTerminalPunctuation('undefined')).toBe('undefined.');
  });
});

// --- FILE END ---
