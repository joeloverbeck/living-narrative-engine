/**
 * @file Unit tests for LLMSelectionPersistence utility
 * @see src/llms/services/llmSelectionPersistence.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LLMSelectionPersistence } from '../../../../src/llms/services/llmSelectionPersistence.js';

describe('LLMSelectionPersistence', () => {
  const STORAGE_KEY = 'living-narrative-engine:selected-llm-id';
  const TEST_LLM_ID = 'test-llm-config-id';

  let consoleWarnSpy;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    consoleWarnSpy.mockRestore();
  });

  describe('save', () => {
    it('should save a valid LLM ID to localStorage', () => {
      const result = LLMSelectionPersistence.save(TEST_LLM_ID);

      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(TEST_LLM_ID);
    });

    it('should return false for empty string', () => {
      const result = LLMSelectionPersistence.save('');

      expect(result).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Invalid llmId provided for save'
      );
    });

    it('should return false for whitespace-only string', () => {
      const result = LLMSelectionPersistence.save('   ');

      expect(result).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Invalid llmId provided for save'
      );
    });

    it('should return false for non-string values', () => {
      const result = LLMSelectionPersistence.save(123);

      expect(result).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Invalid llmId provided for save'
      );
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const setItemSpy = jest
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Storage quota exceeded');
        });

      const result = LLMSelectionPersistence.save(TEST_LLM_ID);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Failed to save LLM selection:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
    });
  });

  describe('load', () => {
    it('should load a saved LLM ID from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, TEST_LLM_ID);

      const result = LLMSelectionPersistence.load();

      expect(result).toBe(TEST_LLM_ID);
    });

    it('should return null when no value is saved', () => {
      const result = LLMSelectionPersistence.load();

      expect(result).toBeNull();
    });

    it('should return null for empty string value', () => {
      localStorage.setItem(STORAGE_KEY, '');

      const result = LLMSelectionPersistence.load();

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only value', () => {
      localStorage.setItem(STORAGE_KEY, '   ');

      const result = LLMSelectionPersistence.load();

      expect(result).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const getItemSpy = jest
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('Storage access denied');
        });

      const result = LLMSelectionPersistence.load();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Failed to load LLM selection:',
        expect.any(Error)
      );

      getItemSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear the saved LLM ID from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, TEST_LLM_ID);

      const result = LLMSelectionPersistence.clear();

      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should return true even when no value is saved', () => {
      const result = LLMSelectionPersistence.clear();

      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.removeItem to throw an error
      const removeItemSpy = jest
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new Error('Storage access denied');
        });

      const result = LLMSelectionPersistence.clear();

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Failed to clear LLM selection:',
        expect.any(Error)
      );

      removeItemSpy.mockRestore();
    });
  });

  describe('exists', () => {
    it('should return true when a valid LLM ID is saved', () => {
      localStorage.setItem(STORAGE_KEY, TEST_LLM_ID);

      const result = LLMSelectionPersistence.exists();

      expect(result).toBe(true);
    });

    it('should return false when no value is saved', () => {
      const result = LLMSelectionPersistence.exists();

      expect(result).toBe(false);
    });

    it('should return false for empty string value', () => {
      localStorage.setItem(STORAGE_KEY, '');

      const result = LLMSelectionPersistence.exists();

      expect(result).toBe(false);
    });

    it('should return false for whitespace-only value', () => {
      localStorage.setItem(STORAGE_KEY, '   ');

      const result = LLMSelectionPersistence.exists();

      expect(result).toBe(false);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const getItemSpy = jest
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('Storage access denied');
        });

      const result = LLMSelectionPersistence.exists();

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLMSelectionPersistence: Failed to check LLM selection existence:',
        expect.any(Error)
      );

      getItemSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should support save, load, and clear workflow', () => {
      // Initially nothing saved
      expect(LLMSelectionPersistence.exists()).toBe(false);
      expect(LLMSelectionPersistence.load()).toBeNull();

      // Save an LLM ID
      expect(LLMSelectionPersistence.save(TEST_LLM_ID)).toBe(true);
      expect(LLMSelectionPersistence.exists()).toBe(true);
      expect(LLMSelectionPersistence.load()).toBe(TEST_LLM_ID);

      // Update to a different LLM ID
      const NEW_LLM_ID = 'new-llm-config-id';
      expect(LLMSelectionPersistence.save(NEW_LLM_ID)).toBe(true);
      expect(LLMSelectionPersistence.load()).toBe(NEW_LLM_ID);

      // Clear the saved selection
      expect(LLMSelectionPersistence.clear()).toBe(true);
      expect(LLMSelectionPersistence.exists()).toBe(false);
      expect(LLMSelectionPersistence.load()).toBeNull();
    });

    it('should use correct storage key', () => {
      LLMSelectionPersistence.save(TEST_LLM_ID);

      // Verify the exact key being used
      expect(
        localStorage.getItem('living-narrative-engine:selected-llm-id')
      ).toBe(TEST_LLM_ID);

      // Verify no other keys are created
      expect(localStorage.length).toBe(1);
    });
  });
});
