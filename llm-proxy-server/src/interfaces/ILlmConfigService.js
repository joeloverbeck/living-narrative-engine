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
 * @typedef {object} InterfaceMethodMetadata
 * @property {string} name - Method identifier within the interface contract.
 * @property {string} description - Summary of the method responsibility.
 * @property {Array<{name: string, type: string}>} [params] - Expected parameters.
 * @property {string} returns - Description of the return value.
 */

/**
 * @typedef {object} InterfaceMetadata
 * @property {string} name - Interface identifier.
 * @property {string} description - High-level purpose of the interface.
 * @property {InterfaceMethodMetadata[]} methods - Contracted methods.
 */

/**
 * Runtime metadata describing the ILlmConfigService contract.
 * @type {Readonly<InterfaceMetadata>}
 */
export const ILlmConfigServiceMetadata = Object.freeze({
  name: 'ILlmConfigService',
  description:
    'Defines initialization, lookup, and diagnostic capabilities for LLM configuration management.',
  methods: [
    {
      name: 'initialize',
      description:
        'Loads and validates configuration data before the service is used.',
      returns: 'Promise<void>',
    },
    {
      name: 'isOperational',
      description: 'Indicates whether configurations were successfully loaded.',
      returns: 'boolean',
    },
    {
      name: 'getLlmConfigs',
      description: 'Retrieves the fully parsed configuration document.',
      returns: 'LLMConfigurationFileForProxy | null',
    },
    {
      name: 'getLlmById',
      description:
        'Looks up a single LLM model configuration by its identifier.',
      params: [{ name: 'id', type: 'string' }],
      returns: 'LLMModelConfig | null',
    },
    {
      name: 'getResolvedConfigPath',
      description: 'Returns the resolved path used for the configuration file.',
      returns: 'string | null',
    },
    {
      name: 'getInitializationErrorDetails',
      description:
        'Provides information about initialization failures when present.',
      returns: 'StandardizedErrorObject | null',
    },
    {
      name: 'hasFileBasedApiKeys',
      description: 'Checks whether any model relies on API keys from files.',
      returns: 'boolean',
    },
  ],
});
