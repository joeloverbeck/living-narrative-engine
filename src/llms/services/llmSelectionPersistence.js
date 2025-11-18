/**
 * @file Utility class for persisting LLM selection to localStorage
 * @description Provides methods to save, load, and clear the selected LLM ID
 * @see src/llms/services/llmSelectionPersistence.js
 */

/**
 * @class LLMSelectionPersistence
 * @description Manages persistence of LLM selection using localStorage
 * Follows the existing localStorage pattern used in the codebase
 */
export class LLMSelectionPersistence {
  /**
   * Storage key for LLM selection
   *
   * @constant {string}
   */
  static STORAGE_KEY = 'living-narrative-engine:selected-llm-id';

  /**
   * Save the selected LLM ID to localStorage
   *
   * @param {string} llmId - The LLM configuration ID to save
   * @returns {boolean} True if save was successful, false otherwise
   */
  static save(llmId) {
    if (typeof llmId !== 'string' || llmId.trim() === '') {
      console.warn('LLMSelectionPersistence: Invalid llmId provided for save');
      return false;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, llmId);
      return true;
    } catch (error) {
      console.warn(
        'LLMSelectionPersistence: Failed to save LLM selection:',
        error
      );
      return false;
    }
  }

  /**
   * Load the selected LLM ID from localStorage
   *
   * @returns {string|null} The saved LLM ID or null if not found/error
   */
  static load() {
    try {
      const savedId = localStorage.getItem(this.STORAGE_KEY);
      if (savedId && typeof savedId === 'string' && savedId.trim() !== '') {
        return savedId;
      }
      return null;
    } catch (error) {
      console.warn(
        'LLMSelectionPersistence: Failed to load LLM selection:',
        error
      );
      return null;
    }
  }

  /**
   * Clear the saved LLM selection from localStorage
   *
   * @returns {boolean} True if clear was successful, false otherwise
   */
  static clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn(
        'LLMSelectionPersistence: Failed to clear LLM selection:',
        error
      );
      return false;
    }
  }

  /**
   * Check if a saved LLM selection exists
   *
   * @returns {boolean} True if a saved selection exists, false otherwise
   */
  static exists() {
    try {
      const savedId = localStorage.getItem(this.STORAGE_KEY);
      return savedId !== null && savedId !== undefined && savedId.trim() !== '';
    } catch (error) {
      console.warn(
        'LLMSelectionPersistence: Failed to check LLM selection existence:',
        error
      );
      return false;
    }
  }
}

export default LLMSelectionPersistence;
