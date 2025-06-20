import { describe, it, expect } from '@jest/globals';
import { extractBaseIdFromFilename } from '../../../src/utils/idUtils.js';

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
