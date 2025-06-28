// llm-proxy-server/src/interfaces/ILlmConfigService.js
/**
 * @typedef {import('../config/llmConfigService.js').LLMConfigurationFileForProxy} LLMConfigurationFileForProxy
 * @typedef {import('../config/llmConfigService.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../config/llmConfigService.js').StandardizedErrorObject} StandardizedErrorObject
 */
/**
 * @interface ILlmConfigService
 * @description Defines an interface for working with LLM configuration data.
 */

/**
 * Initializes the service by loading and validating configuration data.
 * @function
 * @name ILlmConfigService#initialize
 * @returns {Promise<void>} A promise that resolves when initialization completes.
 */

/**
 * Checks if the service has successfully loaded configurations.
 * @function
 * @name ILlmConfigService#isOperational
 * @returns {boolean} True if operational, otherwise false.
 */

/**
 * Retrieves all loaded LLM configurations.
 * @function
 * @name ILlmConfigService#getLlmConfigs
 * @returns {LLMConfigurationFileForProxy | null} The configurations or null if unavailable.
 */

/**
 * Retrieves a specific LLM configuration by ID.
 * @function
 * @name ILlmConfigService#getLlmById
 * @param {string} id - The ID of the desired LLM.
 * @returns {LLMModelConfig | null} The configuration or null if not found.
 */

/**
 * Gets the resolved configuration file path that was used.
 * @function
 * @name ILlmConfigService#getResolvedConfigPath
 * @returns {string | null} The resolved path or null if not determined.
 */

/**
 * Provides details of initialization errors, if any.
 * @function
 * @name ILlmConfigService#getInitializationErrorDetails
 * @returns {StandardizedErrorObject | null} Error details or null if initialization succeeded.
 */

/**
 * Indicates whether any LLM configuration relies on a file-based API key.
 * @function
 * @name ILlmConfigService#hasFileBasedApiKeys
 * @returns {boolean} True if any configuration specifies an API key file.
 */

export {}; // Ensures this file is treated as an ES module
