/**
 * @file Custom error for action index validation failures with preserved LLM data
 * @description Error thrown when LLM provides invalid action index but otherwise valid response data.
 *              Preserves speech, thoughts, and notes to maintain character immersion during fallback.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an LLM returns an invalid action index while other data remains valid.
 * This error carries the preserved LLM-generated content (speech, thoughts, notes) to enable
 * graceful fallback that maintains character voice and immersion.
 *
 * @class
 * @augments {BaseError}
 */
export class ActionIndexValidationError extends BaseError {
  /**
   * Creates a new ActionIndexValidationError instance with preserved LLM data.
   *
   * @param {string} message - The error message describing the validation failure.
   * @param {object} options - Error context and preserved data.
   * @param {number} options.index - The invalid action index that was provided.
   * @param {number} options.actionsLength - The number of valid actions available.
   * @param {string|null} [options.speech] - LLM-generated speech to preserve.
   * @param {string|null} [options.thoughts] - LLM-generated thoughts to preserve.
   * @param {Array|null} [options.notes] - LLM-generated notes to preserve.
   */
  constructor(message, { index, actionsLength, speech = null, thoughts = null, notes = null }) {
    super(message, 'ACTION_INDEX_VALIDATION_ERROR', {
      index,
      actionsLength,
    });

    this.name = 'ActionIndexValidationError';

    // Store preserved LLM data for fallback recovery
    this.llmData = {
      speech,
      thoughts,
      notes,
    };

    // Backward compatibility: expose index and actionsLength directly
    this.index = index;
    this.actionsLength = actionsLength;
  }

  /**
   * Check if this error has preserved LLM data that can be used for fallback.
   *
   * @returns {boolean} True if any LLM data (speech, thoughts, or notes) is preserved.
   */
  hasPreservedData() {
    return Boolean(
      this.llmData &&
        (this.llmData.speech || this.llmData.thoughts || this.llmData.notes)
    );
  }

  /**
   * Get the preserved speech, if available.
   *
   * @returns {string|null} The preserved speech or null.
   */
  getPreservedSpeech() {
    return this.llmData?.speech ?? null;
  }

  /**
   * Get the preserved thoughts, if available.
   *
   * @returns {string|null} The preserved thoughts or null.
   */
  getPreservedThoughts() {
    return this.llmData?.thoughts ?? null;
  }

  /**
   * Get the preserved notes, if available.
   *
   * @returns {Array|null} The preserved notes or null.
   */
  getPreservedNotes() {
    return this.llmData?.notes ?? null;
  }

  /**
   * @returns {string} Severity level for action index validation errors.
   */
  getSeverity() {
    return 'warning'; // Warning because we can recover with preserved data
  }

  /**
   * @returns {boolean} Action index validation errors are recoverable.
   */
  isRecoverable() {
    return true; // Recoverable via fallback action with preserved speech
  }
}
