import { describe, it, expect } from '@jest/globals';
import { isValidSaveString } from '../../../src/persistence/saveInputValidators.js';

describe('save input validators', () => {
  describe('validate save names via isValidSaveString', () => {
    it('returns true for non-empty strings', () => {
      expect(isValidSaveString('slot1')).toBe(true);
    });

    it('returns false for empty or non-string values', () => {
      expect(isValidSaveString('')).toBe(false);
      expect(isValidSaveString('   ')).toBe(false);
      expect(isValidSaveString(null)).toBe(false);
      expect(isValidSaveString(undefined)).toBe(false);
    });
  });

  describe('validate save identifiers via isValidSaveString', () => {
    it('returns true for non-empty strings', () => {
      expect(isValidSaveString('path/file.sav')).toBe(true);
    });

    it('returns false for empty or non-string values', () => {
      expect(isValidSaveString('')).toBe(false);
      expect(isValidSaveString('   ')).toBe(false);
      expect(isValidSaveString(0)).toBe(false);
      expect(isValidSaveString(null)).toBe(false);
    });
  });
});
