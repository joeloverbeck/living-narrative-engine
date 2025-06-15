import { describe, it, expect } from '@jest/globals';
import {
  validateSaveName,
  validateSaveIdentifier,
} from '../../src/persistence/saveInputValidators.js';

describe('save input validators', () => {
  describe('validateSaveName', () => {
    it('returns true for non-empty strings', () => {
      expect(validateSaveName('slot1')).toBe(true);
    });

    it('returns false for empty or non-string values', () => {
      expect(validateSaveName('')).toBe(false);
      expect(validateSaveName('   ')).toBe(false);
      expect(validateSaveName(null)).toBe(false);
      expect(validateSaveName(undefined)).toBe(false);
    });
  });

  describe('validateSaveIdentifier', () => {
    it('returns true for non-empty strings', () => {
      expect(validateSaveIdentifier('path/file.sav')).toBe(true);
    });

    it('returns false for empty or non-string values', () => {
      expect(validateSaveIdentifier('')).toBe(false);
      expect(validateSaveIdentifier('   ')).toBe(false);
      expect(validateSaveIdentifier(0)).toBe(false);
      expect(validateSaveIdentifier(null)).toBe(false);
    });
  });
});
