import { describe, it, expect } from '@jest/globals';
import {
  extractBaseIdFromFilename,
  stripDirectories,
  removeFileExtension,
  stripSuffixes,
  extractModId,
} from '../../../src/utils/idUtils.js';

describe('extractBaseIdFromFilename', () => {
  it('strips directories and extension', () => {
    expect(extractBaseIdFromFilename('dir/sub/file.json', [])).toBe('file');
    expect(extractBaseIdFromFilename('dir\\sub\\file.yml', [])).toBe('file');
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
