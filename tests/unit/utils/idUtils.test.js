import { describe, it, expect } from '@jest/globals';
import {
  extractBaseIdFromFilename,
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
