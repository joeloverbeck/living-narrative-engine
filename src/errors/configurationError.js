// src/errors/configurationError.js

/**
 * Custom error class for configuration-related issues within the ConfigurableLLMAdapter.
 */
export class ConfigurationError extends Error {
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
    super(message);
    this.name = 'ConfigurationError';
    this.llmId = details.llmId;
    this.problematicField = details.problematicField; // Kept for backward compatibility if some old code uses it
    this.fieldValue = details.fieldValue; // Kept for backward compatibility
    this.problematicFields = details.problematicFields; // New field for multiple validation errors
    // Add any other relevant details if needed
  }
}
