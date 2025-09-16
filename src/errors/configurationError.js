// src/errors/configurationError.js

import BaseError from './baseError.js';

/**
 * Custom error class for configuration-related issues within the ConfigurableLLMAdapter.
 */
export class ConfigurationError extends BaseError {
  /**
   * Creates an instance of ConfigurationError.
   *
   * @param {string} message - The error message.
   * @param {object} [details] - Additional details about the error.
   * @param {string} [details.llmId] - The ID of the LLM configuration that caused the error.
   * @param {string | string[]} [details.problematicField] - The name(s) of the configuration field(s) that are problematic.
   * @param {any} [details.fieldValue] - The value of the problematic field.
   * @param {object[]} [details.problematicFields] - Array of problematic fields {field, reason}.
   */
  constructor(message, details = {}) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
    // Backward compatibility: preserve all existing properties
    this.llmId = details.llmId;
    this.problematicField = details.problematicField; // Kept for backward compatibility if some old code uses it
    this.fieldValue = details.fieldValue; // Kept for backward compatibility
    this.problematicFields = details.problematicFields; // New field for multiple validation errors
    // Add any other relevant details if needed
  }

  /**
   * @returns {string} Severity level for configuration errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Configuration errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
