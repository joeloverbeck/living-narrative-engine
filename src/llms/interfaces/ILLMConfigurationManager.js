/**
 * @file Interface for LLM configuration management
 * @see src/llms/interfaces/ILLMConfigurationManager.js
 */

/**
 * @typedef {import('../llmConfigTypes.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../llmConfigTypes.js').LLMConfigurationFile} LLMConfigurationFile
 */

/**
 * @interface ILLMConfigurationManager
 * @description Manages LLM configurations including loading, validation, and selection
 */
export class ILLMConfigurationManager {
  /**
   * Loads configuration from the specified ID
   *
   * @async
   * @param {string} configId - The configuration ID to load
   * @returns {Promise<LLMModelConfig|null>} The loaded configuration or null if not found
   * @throws {Error} If configuration loading fails
   */
  async loadConfiguration(configId) {
    throw new Error('Not implemented');
  }

  /**
   * Gets the currently active LLM configuration
   *
   * @async
   * @returns {Promise<LLMModelConfig|null>} The active configuration or null if none
   */
  async getActiveConfiguration() {
    throw new Error('Not implemented');
  }

  /**
   * Sets the active LLM configuration by ID
   *
   * @async
   * @param {string} configId - The configuration ID to set as active
   * @returns {Promise<boolean>} True if successfully set, false otherwise
   * @throws {Error} If configuration is invalid or not found
   */
  async setActiveConfiguration(configId) {
    throw new Error('Not implemented');
  }

  /**
   * Validates a configuration object
   *
   * @param {LLMModelConfig} config - The configuration to validate
   * @returns {Array<{field: string, reason: string}>} Array of validation errors
   */
  validateConfiguration(config) {
    throw new Error('Not implemented');
  }

  /**
   * Gets all available LLM configurations
   *
   * @async
   * @returns {Promise<LLMConfigurationFile|null>} The complete configuration file
   */
  async getAllConfigurations() {
    throw new Error('Not implemented');
  }

  /**
   * Gets available LLM options for UI selection
   *
   * @async
   * @returns {Promise<Array<{configId: string, displayName: string}>>} Array of available options
   */
  async getAvailableOptions() {
    throw new Error('Not implemented');
  }

  /**
   * Gets the current active LLM ID
   *
   * @async
   * @returns {Promise<string|null>} The active LLM ID or null
   */
  async getActiveConfigId() {
    throw new Error('Not implemented');
  }

  /**
   * Checks if the configuration manager is operational
   *
   * @returns {boolean} True if operational, false otherwise
   */
  isOperational() {
    throw new Error('Not implemented');
  }
}

export default ILLMConfigurationManager;
