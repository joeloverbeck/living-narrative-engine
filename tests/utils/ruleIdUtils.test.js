// tests/utils/ruleIdUtils.test.js

import { describe, it, expect } from '@jest/globals';
import { deriveBaseRuleIdFromFilename } from '../../src/utils/ruleIdUtils.js';

describe('deriveBaseRuleIdFromFilename', () => {
  it('removes rule suffixes and extensions', () => {
    expect(deriveBaseRuleIdFromFilename('test.rule.json')).toBe('test');
    expect(deriveBaseRuleIdFromFilename('example.rule.yml')).toBe('example');
    expect(deriveBaseRuleIdFromFilename('demo.rule.yaml')).toBe('demo');
    expect(deriveBaseRuleIdFromFilename('sample.rule')).toBe('sample');
  });

  it('handles nested paths and different separators', () => {
    expect(deriveBaseRuleIdFromFilename('dir/sub/test.rule.json')).toBe('test');
    expect(deriveBaseRuleIdFromFilename('dir\\sub\\other.rule.yaml')).toBe(
      'other'
    );
  });

  it('returns filename without suffix when none present', () => {
    expect(deriveBaseRuleIdFromFilename('basic.json')).toBe('basic');
    expect(deriveBaseRuleIdFromFilename('sub/inner/simple')).toBe('simple');
  });

  it('gracefully handles empty or invalid input', () => {
    expect(deriveBaseRuleIdFromFilename('')).toBe('');
    expect(deriveBaseRuleIdFromFilename('   ')).toBe('');
    // @ts-ignore Testing invalid input type
    expect(deriveBaseRuleIdFromFilename(null)).toBe('');
  });
});
