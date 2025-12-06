import { describe, it, expect } from '@jest/globals';
import {
  extractBaseId,
  extractBaseIdFromFilename,
  stripDirectories,
  removeFileExtension,
  stripSuffixes,
  extractModId,
} from '../../../src/utils/idUtils.js';

describe('extractBaseId', () => {
  it('returns null for non-string or empty ids', () => {
    // @ts-ignore testing invalid types
    expect(extractBaseId(null)).toBeNull();
    expect(extractBaseId('   ')).toBeNull();
  });

  it('returns the original id when no namespace provided', () => {
    expect(extractBaseId('simpleId')).toBe('simpleId');
  });

  it('extracts the base portion from namespaced ids', () => {
    expect(extractBaseId('mod:item')).toBe('item');
    expect(extractBaseId('mod:category:entry')).toBe('category:entry');
  });

  it('returns null when namespace or base component missing', () => {
    expect(extractBaseId('mod:')).toBeNull();
    expect(extractBaseId(':item')).toBeNull();
  });
});

describe('extractBaseIdFromFilename', () => {
  it('strips directories and extension', () => {
    expect(extractBaseIdFromFilename('dir/sub/file.json', [])).toBe('file');
    expect(extractBaseIdFromFilename('dir\\sub\\file.yml', [])).toBe('file');
  });

  it('strips directories and extension when suffix list omitted', () => {
    expect(extractBaseIdFromFilename('folder/nested/item.yaml')).toBe('item');
  });

  it('removes provided suffixes', () => {
    const suffixes = ['.rule', '.rule.json', '.rule.yml', '.rule.yaml'];
    expect(extractBaseIdFromFilename('test.rule.json', suffixes)).toBe('test');
    expect(extractBaseIdFromFilename('demo.rule', suffixes)).toBe('demo');
  });

  it('returns filename without suffix when none present', () => {
    expect(extractBaseIdFromFilename('basic.txt', ['.rule'])).toBe('basic');
  });

  it('gracefully handles empty or invalid input', () => {
    expect(extractBaseIdFromFilename('', ['.rule'])).toBe('');
    expect(extractBaseIdFromFilename('   ', ['.rule'])).toBe('');
    // @ts-ignore Testing invalid input type
    expect(extractBaseIdFromFilename(null, ['.rule'])).toBe('');
  });

  it('returns empty string when file is only an extension', () => {
    expect(extractBaseIdFromFilename('path/.gitignore', ['.gitignore'])).toBe(
      ''
    );
  });
});

describe('stripDirectories', () => {
  it('returns last path segment regardless of separators', () => {
    expect(stripDirectories('dir/sub/file.json')).toBe('file.json');
    expect(stripDirectories('dir\\sub\\another.yml')).toBe('another.yml');
  });

  it('handles invalid input gracefully', () => {
    // @ts-ignore
    expect(stripDirectories(null)).toBe('');
    expect(stripDirectories('')).toBe('');
  });
});

describe('removeFileExtension', () => {
  it('removes the last extension', () => {
    expect(removeFileExtension('test.rule.json')).toBe('test.rule');
    expect(removeFileExtension('demo.yml')).toBe('demo');
  });

  it('returns input when no extension present', () => {
    expect(removeFileExtension('file')).toBe('file');
  });

  it('returns empty string for invalid or blank input', () => {
    // @ts-ignore testing invalid type
    expect(removeFileExtension(undefined)).toBe('');
    expect(removeFileExtension('   ')).toBe('');
  });
});

describe('stripSuffixes', () => {
  const suffixes = ['.rule', '.json'];
  it('removes the first matching suffix, case-insensitive', () => {
    expect(stripSuffixes('test.rule', suffixes)).toBe('test');
    expect(stripSuffixes('demo.JSON', suffixes)).toBe('demo');
  });

  it('returns input when no suffix matches', () => {
    expect(stripSuffixes('sample.txt', suffixes)).toBe('sample.txt');
  });

  it('returns empty string when provided name is invalid', () => {
    // @ts-ignore testing invalid type
    expect(stripSuffixes(null, suffixes)).toBe('');
  });

  it('ignores non-string suffix entries', () => {
    const mixedSuffixes = ['.json', 123];
    expect(stripSuffixes('file.json', mixedSuffixes)).toBe('file');
  });

  it('returns input unchanged when suffix list omitted', () => {
    expect(stripSuffixes('value')).toBe('value');
  });
});

describe('extractModId', () => {
  it('returns the namespace portion of a namespaced id', () => {
    expect(extractModId('core:player')).toBe('core');
    expect(extractModId('myMod:item:variant')).toBe('myMod');
  });

  it('returns undefined for missing or invalid ids', () => {
    expect(extractModId('noColon')).toBeUndefined();
    expect(extractModId(':startsWithColon')).toBeUndefined();
    expect(extractModId('')).toBeUndefined();
    // @ts-ignore invalid type
    expect(extractModId(null)).toBeUndefined();
  });
});
