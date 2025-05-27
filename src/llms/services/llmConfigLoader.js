// src/services/llmConfigLoader.js
// --- FILE START ---

import {Workspace_retry} from '../../utils/apiUtils.js';

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {object} LoadConfigsErrorResult
 * @description Represents the structure of a failed configuration load attempt.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - A description of the error.
 * @property {string} [stage] - The stage where the error occurred (e.g., 'fetch', 'parse', 'validation').
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [path] - The file path that was attempted.
 */

/**
 * @typedef {object} LLMModelConfig
 * @description Represents the configuration for a single LLM model.
 * All fields are based on "Table 3: Key Parameters for External LLM Configuration File"
 * from the "Jira Epics for ILLMAdapter" document.
 * @property {string} id - Unique identifier for the LLM configuration. (Required)
 * @property {string} displayName - User-friendly name for logs or UI. (Required)
 * @property {string} [apiKeyEnvVar] - Name of the environment variable holding the API key (optional, for cloud services).
 * @property {string} endpointUrl - Base URL of the LLM API. (Required)
 * @property {string} modelIdentifier - Provider-specific model name. (Required)
 * @property {string} apiType - Enum indicating API family (e.g., "openai", "openrouter", "ollama", "llama_cpp_server_openai_compatible", "tgi_openai_compatible"). (Required)
 * @property {object | string} [promptFrame] - Model-specific system prompt or template for prompt construction (object or string).
 * @property {number} [contextTokenLimit] - Maximum context tokens (input + output) for the model.
 * @property {object} jsonOutputStrategy - Object defining the method for achieving JSON output. (Required)
 * @property {string} jsonOutputStrategy.method - Enum for JSON strategy (e.g., "tool_calling", "native_json_mode", "gbnf_grammar", "openrouter_json_schema"). (Required)
 * @property {string} [jsonOutputStrategy.toolName] - Name of the tool to invoke (if method is "tool_calling").
 * @property {string} [jsonOutputStrategy.grammar] - GBNF grammar string or path to grammar file (if method is "gbnf_grammar").
 * @property {object} [defaultParameters] - Default API parameters (e.g., temperature, max_tokens for output).
 * @property {object} [providerSpecificHeaders] - Additional HTTP headers required by the provider.
 */

/**
 * @typedef {object} LLMConfigurationFile
 * @description Represents the structure of the parsed llm-configs.json file.
 * Based on Section 5.1.1 of "Jira Epics for ILLMAdapter".
 * @property {string} [defaultLlmId] - Specifies the ID of the LLM configuration to use by default.
 * @property {Object<string, LLMModelConfig>} llms - A dictionary where each key is a unique LLM
 * configuration ID and its value is the detailed settings for that LLM.
 */

/**
 * @class LlmConfigLoader
 * @description Service responsible for loading and parsing the llm-configs.json file.
 * It fetches the configuration file, typically served as a static asset,
 * and provides the parsed LLM configurations. This implementation assumes
 * the `llm-configs.json` file is served as a static asset and can be fetched. [Ticket 1.4.2]
 */
export class LlmConfigLoader {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {string} - Default path to the LLM configuration file.
     */
    #defaultConfigPath = "config/llm-configs.json";

    /**
     * @private
     * @type {number} - Default maximum number of retries for fetching the config.
     */
    #defaultMaxRetries = 3;

    /**
     * @private
     * @type {number} - Default base delay in milliseconds for retries.
     */
    #defaultBaseDelayMs = 500;

    /**
     * @private
     * @type {number} - Default maximum delay in milliseconds for retries.
     */
    #defaultMaxDelayMs = 5000;

    /**
     * Creates an instance of LlmConfigLoader.
     * @param {object} [dependencies={}] - Optional dependencies.
     * @param {ILogger} [dependencies.logger] - An optional logger instance. If not provided, `console` will be used.
     * @param {string} [dependencies.defaultConfigPath] - Optional override for the default config file path.
     */
    constructor(dependencies = {}) {
        this.#logger = dependencies.logger || console;
        if (dependencies.defaultConfigPath && typeof dependencies.defaultConfigPath === 'string') {
            this.#defaultConfigPath = dependencies.defaultConfigPath;
        }
        // Retry parameters could also be made configurable via constructor if needed.
    }

    /**
     * Loads and parses the LLM configuration file from the specified path,
     * or a default path if none is provided.
     * This method uses the Workspace API (simulated by `Workspace_retry` using `Workspace`)
     * to retrieve the content of the `llm-configs.json` file. [Ticket 1.4.2]
     * It now also ensures that optional fields like defaultParameters and
     * providerSpecificHeaders are initialized to empty objects ({}) if not present.
     *
     * @async
     * @param {string} [filePath] - The path to the llm-configs.json file (e.g., "config/llm-configs.json").
     * If not provided, the configured default path will be used. [Ticket 1.4.2]
     * @returns {Promise<LLMConfigurationFile | LoadConfigsErrorResult>} A promise that resolves with the parsed
     * JavaScript object representing the LLM configurations, or an error object if loading/parsing fails.
     */
    async loadConfigs(filePath) {
        const path = (typeof filePath === 'string' && filePath.trim() !== '') ? filePath.trim() : this.#defaultConfigPath;
        this.#logger.info(`LlmConfigLoader: Attempting to load LLM configurations from: ${path}`);

        let parsedResponse;
        try {
            // Use Workspace_retry to fetch the file content. [Ticket 1.4.2]
            // Workspace_retry handles retries and attempts to parse the response as JSON.
            parsedResponse = await Workspace_retry(
                path,
                {method: 'GET', headers: {'Accept': 'application/json'}}, // Standard options for fetching a JSON file
                this.#defaultMaxRetries,
                this.#defaultBaseDelayMs,
                this.#defaultMaxDelayMs
            );

            // Workspace_retry returns the parsed JSON object on success.
            this.#logger.info(`LlmConfigLoader: Successfully fetched and parsed LLM configurations from ${path}.`);

            // Basic validation of the overall structure.
            if (typeof parsedResponse !== 'object' || parsedResponse === null || typeof parsedResponse.llms !== 'object' || parsedResponse.llms === null) {
                this.#logger.error(`LlmConfigLoader: Configuration file from ${path} is malformed or missing 'llms' object.`, {
                    path,
                    parsedResponse // Log the actual parsedResponse for debugging
                });
                return {
                    error: true,
                    message: `Configuration file from ${path} is malformed (e.g., not an object or missing 'llms' property).`,
                    stage: 'validation',
                    path: path
                };
            }

            // Enhance configurations with default values for optional fields.
            // JSON.parse() will include all keys present in the JSON, so we just need to
            // handle the cases where optional fields that should default to {} are missing.
            for (const llmId in parsedResponse.llms) {
                if (Object.prototype.hasOwnProperty.call(parsedResponse.llms, llmId)) {
                    const config = parsedResponse.llms[llmId];

                    // Ensure config is an object before trying to access/set properties
                    if (typeof config === 'object' && config !== null) {
                        // Default 'defaultParameters' to {} if missing or explicitly undefined
                        if (config.defaultParameters === undefined) {
                            config.defaultParameters = {};
                            this.#logger.debug(`LlmConfigLoader: LLM config '${llmId}' missing 'defaultParameters'. Defaulted to {}.`);
                        }

                        // Default 'providerSpecificHeaders' to {} if missing or explicitly undefined
                        if (config.providerSpecificHeaders === undefined) {
                            config.providerSpecificHeaders = {};
                            this.#logger.debug(`LlmConfigLoader: LLM config '${llmId}' missing 'providerSpecificHeaders'. Defaulted to {}.`);
                        }

                        // Other optional fields like apiKeyEnvVar, promptFrame, contextTokenLimit,
                        // jsonOutputStrategy.toolName, and jsonOutputStrategy.grammar
                        // will naturally be undefined if not present in the JSON,
                        // which is the desired behavior per requirements.
                    } else {
                        // This case should ideally be caught by schema validation if one were in place here,
                        // but good to log if an llm entry isn't an object.
                        this.#logger.warn(`LlmConfigLoader: LLM configuration for ID '${llmId}' is not an object. Skipping default optional field processing for this entry.`, {config});
                    }
                }
            }
            this.#logger.info(`LlmConfigLoader: Processed optional fields for all LLM configurations from ${path}.`);
            return parsedResponse;

        } catch (error) {
            // This catch block handles errors propagated from Workspace_retry.
            // These errors could be due to:
            // 1. Network failures after all retries.
            // 2. HTTP errors (e.g., 404 Not Found, 500 Server Error) after all retries for retryable codes.
            // 3. JSON parsing failures if the fetched content was not valid JSON.
            this.#logger.error(`LlmConfigLoader: Failed to load or parse LLM configurations from ${path}. Error: ${error.message}`, {
                path,
                originalErrorDetails: error
            });

            let stage = 'fetch_or_parse'; // Default stage
            if (error.message) {
                const lowerCaseMessage = error.message.toLowerCase();
                // Prioritize network and specific HTTP status errors first
                if (lowerCaseMessage.includes('failed to fetch') || lowerCaseMessage.includes('network request failed')) {
                    stage = 'fetch_network_error';
                } else if (lowerCaseMessage.includes('status 404') || lowerCaseMessage.includes('not found')) {
                    stage = 'fetch_not_found';
                } else if (lowerCaseMessage.match(/status (5\d\d)/)) {
                    stage = 'fetch_server_error';
                } else if (lowerCaseMessage.match(/status (4\d\d)/)) { // General 4xx client errors not already caught
                    stage = 'fetch_client_error';
                }
                // Then check for parsing related terms if none of the above matched
                else if (lowerCaseMessage.includes('json') || lowerCaseMessage.includes('parse') || lowerCaseMessage.includes('unexpected token') || lowerCaseMessage.includes('lexical error')) {
                    stage = 'parse';
                }
                // If it's an error from Workspace_retry about max retries but not fitting above, it's likely a persistent fetch issue
                else if (lowerCaseMessage.includes('failed after') && lowerCaseMessage.includes('attempt(s)')) {
                    stage = 'fetch_max_retries_exceeded'; // More specific for unclassified retry failures
                }
            }


            return { // Fulfills AC 2.2 for error return
                error: true,
                message: `Failed to load or parse LLM configurations from ${path}: ${error.message}`,
                stage: stage,
                originalError: error, // Preserve original error for more details
                path: path
            };
        }
    }
}

// --- FILE END ---