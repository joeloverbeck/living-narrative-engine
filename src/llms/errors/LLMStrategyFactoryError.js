// src/llms/errors/LLMStrategyFactoryError.js
// --- NEW FILE START ---
/**
 * @class LLMStrategyFactoryError
 * @augments Error
 * @description Custom error class for errors originating from the LLMStrategyFactory.
 * This error is thrown when the factory encounters issues such as an unsupported
 * API type or an invalid combination of configuration parameters that prevent
 * it from creating a suitable LLM strategy instance.
 */
export class LLMStrategyFactoryError extends Error {
  /**
   * The API type (e.g., "openai", "anthropic") from the LLMModelConfig that was problematic.
   *
   * @type {string | undefined}
   */
  apiType;

  /**
   * The JSON output method (e.g., "tool_calling", "native_json_mode") from the
   * LLMModelConfig's jsonOutputStrategy that was problematic.
   *
   * @type {string | undefined}
   */
  jsonOutputMethod;

  /**
   * Creates an instance of LLMStrategyFactoryError.
   *
   * @param {string} message - The primary error message.
   * @param {object} [details] - Additional details about the error.
   * @param {string} [details.apiType] - The apiType that caused the error.
   * @param {string} [details.jsonOutputMethod] - The jsonOutputStrategy.method that caused the error.
   * @param {Error} [details.cause] - The original error that caused this error, if any.
   */
  constructor(message, { apiType, jsonOutputMethod, cause } = {}) {
    super(message);
    this.name = 'LLMStrategyFactoryError';
    this.apiType = apiType;
    this.jsonOutputMethod = jsonOutputMethod;
    if (cause) {
      this.cause = cause;
    }
    // Ensure the stack trace is captured correctly, especially in V8 environments.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMStrategyFactoryError);
    }
  }
}

// --- NEW FILE END ---
