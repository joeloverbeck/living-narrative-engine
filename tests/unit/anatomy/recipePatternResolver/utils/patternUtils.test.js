import { describe, it, expect } from '@jest/globals';
import { detectMatcherType, hasMatcher } from '../../../../../src/anatomy/recipePatternResolver/utils/patternUtils.js';

describe('patternUtils', () => {
  describe('hasMatcher', () => {
    it('returns true when matches array contains entries', () => {
      expect(hasMatcher({ matches: ['foo'] })).toBe(true);
    });

    it('returns true when matchesGroup is defined', () => {
      expect(hasMatcher({ matches: [], matchesGroup: 'group-id' })).toBe(true);
    });

    it('returns true when matchesPattern is defined', () => {
      expect(hasMatcher({ matchesPattern: 'pattern-id' })).toBe(true);
    });

    it('returns true when matchesAll is defined', () => {
      expect(hasMatcher({ matchesAll: true })).toBe(true);
    });

    it('returns false when no matcher fields are present', () => {
      expect(hasMatcher({})).toBe(false);
    });
  });

  describe('detectMatcherType', () => {
    it('detects matches arrays first', () => {
      expect(detectMatcherType({ matches: ['foo', 'bar'] })).toBe('matches');
    });

    it('detects matchesGroup when defined', () => {
      expect(detectMatcherType({ matches: [], matchesGroup: 'group-id' })).toBe('matchesGroup');
    });

    it('detects matchesPattern when present', () => {
      expect(detectMatcherType({ matchesPattern: 'pattern-id' })).toBe('matchesPattern');
    });

    it('detects matchesAll fallback', () => {
      expect(detectMatcherType({ matchesAll: true })).toBe('matchesAll');
    });

    it('returns null when no matcher is defined', () => {
      expect(detectMatcherType({})).toBeNull();
    });
  });
});
