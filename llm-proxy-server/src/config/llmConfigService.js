// llm-proxy-server/src/config/llmConfigService.js

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY,
    DEFAULT_ENCODING_UTF8
} from './constants.js';

/**
 * @typedef {import('../interfaces/IFileSystemReader.js').IFileSystemReader} IFileSystemReader
 */

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('./appConfig.js').AppConfigService} AppConfigService
 */

/**
 * @typedef {object} LLMModelConfig
 * @description Configuration for a specific LLM model.
 * @property {string} displayName - A user-friendly name for the LLM.
 * @property {string} endpointUrl - The URL for the LLM API endpoint.
 * @property {string} [modelIdentifier] - The specific model identifier for the provider (e.g., "gpt-3.5-turbo").
 * @property {string} [apiKeyEnvVar] - The name of the environment variable holding the API key.
 * @property {string} [apiKeyFileName] - The name of the file containing the API key.
 * @property {string} apiType - The type of API (e.g., "openai", "ollama", "openrouter").
 * @property {object} [providerSpecificHeaders] - Headers specific to the LLM provider.
 * @property {object} [defaultParameters] - Default parameters for requests to this LLM (e.g., maxRetries).
 */

/**
 * @typedef {object} LLMConfigurationFileForProxy
 * @description Represents the structure of the parsed llm-configs.json file.
 * @property {string} [defaultLlmId] - The ID of the default LLM configuration.
 * @property {Object<string, LLMModelConfig>} llms - A dictionary of LLM configurations, keyed by llmId.
 */

/**
 * @typedef {object} StandardizedErrorObject
 * @description Standardized structure for error information.
 * @property {string} message - A human-readable description of the error.
 * @property {string} stage - A machine-readable string indicating the stage or component where the error occurred.
 * @property {object} details - An object containing additional structured details about the error.
 * @property {string} [details.pathAttempted] - The configuration file path that was attempted (for LlmConfigService).
 * @property {string} [details.originalErrorMessage] - The message from the original error, if any.
 * @property {Error} [originalError] - The original error object (primarily for internal logging, not direct client exposure).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LlmConfigService {
    /** @type {IFileSystemReader} */
    #fileSystemReader;
    /** @type {ILogger} */
    #logger;
    /** @type {AppConfigService} */
    #appConfig;

    /** @type {string} */
    #_defaultLlmConfigPath;
    /** @type {string | null} */
    #resolvedConfigPath = null;
    /** @type {LLMConfigurationFileForProxy | null} */
    #loadedLlmConfigs = null;
    /** @type {boolean} */
    #isProxyOperational = false;
    /** @type {StandardizedErrorObject | null} */
    #initializationError = null;

    /**
     * Constructs an LlmConfigService instance.
     * @param {IFileSystemReader} fileSystemReader - An IFileSystemReader instance.
     * @param {ILogger} logger - An ILogger instance.
     * @param {AppConfigService} appConfig - An AppConfigService instance.
     */
    constructor(fileSystemReader, logger, appConfig) {
        if (!fileSystemReader) {
            throw new Error("LlmConfigService: fileSystemReader is required.");
        }
        if (!logger) {
            throw new Error("LlmConfigService: logger is required.");
        }
        if (!appConfig) {
            throw new Error("LlmConfigService: appConfig is required.");
        }

        this.#fileSystemReader = fileSystemReader;
        this.#logger = logger;
        this.#appConfig = appConfig;

        this.#_defaultLlmConfigPath = path.resolve(__dirname, '../../../config/llm-configs.json');

        this.#logger.debug('LlmConfigService: Instance created.');
    }

    /**
     * Sets the initialization error details and logs the error.
     * Also sets the proxy operational status to false.
     * @private
     * @param {string} message - The human-readable error message.
     * @param {string} stage - The machine-readable stage of the error.
     * @param {Error | null} [originalError=null] - The original error object, if any.
     * @param {object} [additionalDetails={}] - Additional details to merge into the error's details property.
     */
    _setInitializationError(message, stage, originalError = null, additionalDetails = {}) {
        this.#isProxyOperational = false; // Ensure proxy is marked not operational
        this.#initializationError = {
            message,
            stage,
            details: {
                pathAttempted: this.#resolvedConfigPath, // Common detail for all init errors
                ...additionalDetails,
            },
        };

        if (originalError && originalError.message && !this.#initializationError.details.originalErrorMessage) {
            this.#initializationError.details.originalErrorMessage = originalError.message;
        }
        // Store the full originalError object internally for detailed logging/debugging
        // This won't be directly exposed via getInitializationErrorDetails unless explicitly handled by the caller
        if (originalError) {
            this.#initializationError.originalError = originalError;
        }

        const logMessage = `LlmConfigService: CRITICAL ERROR - ${message}. Stage: ${stage}.`;
        const logContext = {
            pathAttempted: this.#resolvedConfigPath, // Duplicate pathAttempted in log for easy viewing
            errorStage: stage,
            additionalDetails, // Log any specific additional details
            originalError: originalError ? {
                message: originalError.message,
                name: originalError.name,
                // stack: originalError.stack // Stack can be very verbose for logs, consider if needed
            } : undefined
        };

        this.#logger.error(logMessage, logContext);
    }


    /**
     * Initializes the service by loading and validating the LLM configurations.
     * This method should be called once during application startup.
     * @returns {Promise<void>}
     */
    async initialize() {
        this.#logger.info('LlmConfigService: Initialization started.');
        this.#isProxyOperational = false; // Default to not operational until success

        const customPath = this.#appConfig.getLlmConfigPath();
        this.#resolvedConfigPath = (customPath && customPath.trim() !== '')
            ? path.resolve(customPath)
            : this.#_defaultLlmConfigPath;

        this.#logger.info(`LlmConfigService: Attempting to load LLM configurations from: ${this.#resolvedConfigPath}`);

        try {
            // Step 1: Read file content
            let fileContent;
            try {
                fileContent = await this.#fileSystemReader.readFile(this.#resolvedConfigPath, DEFAULT_ENCODING_UTF8);
                this.#logger.debug(`LlmConfigService: Successfully read file content from ${this.#resolvedConfigPath}. Length: ${fileContent.length}`);
            } catch (readError) {
                this._setInitializationError(
                    `Failed to read LLM configuration file`,
                    'config_load_file_read_error',
                    readError
                );
                return; // Stop initialization
            }

            // Step 2: Parse JSON
            let parsedConfigs;
            try {
                parsedConfigs = JSON.parse(fileContent);
                this.#logger.debug(`LlmConfigService: Successfully parsed JSON content from ${this.#resolvedConfigPath}.`);
            } catch (parseError) {
                this._setInitializationError(
                    `Failed to parse LLM configuration file as JSON`,
                    'config_load_json_parse_error',
                    parseError
                );
                return; // Stop initialization
            }

            // Step 3: Basic Validation
            if (typeof parsedConfigs !== 'object' || parsedConfigs === null) {
                this._setInitializationError(
                    'LLM configuration content is not a valid object',
                    'config_load_validation_not_object',
                    null,
                    { parsedContentType: typeof parsedConfigs }
                );
                return; // Stop initialization
            }

            if (typeof parsedConfigs.llms !== 'object' || parsedConfigs.llms === null) {
                this._setInitializationError(
                    "LLM configuration content is missing the required 'llms' object property",
                    'config_load_validation_missing_llms',
                    null,
                    { llmsPropertyType: typeof parsedConfigs.llms }
                );
                return; // Stop initialization
            }
            // TODO: Consider adding more detailed schema validation for each LLM entry in a future ticket.

            // Success
            this.#loadedLlmConfigs = /** @type {LLMConfigurationFileForProxy} */ (parsedConfigs);
            this.#isProxyOperational = true;
            this.#initializationError = null; // Clear any potential error state if successful

            const llmCount = Object.keys(this.#loadedLlmConfigs.llms).length;
            const defaultLlmId = this.#loadedLlmConfigs.defaultLlmId || 'Not set';
            this.#logger.info(`LlmConfigService: Initialization successful. Loaded ${llmCount} LLM configurations. Default LLM ID: ${defaultLlmId}. Proxy is operational.`);

        } catch (unexpectedError) {
            // This catch handles any other unforeseen errors during the try block.
            this._setInitializationError(
                `An unexpected error occurred during LLM configuration loading`,
                'config_load_unexpected_error',
                unexpectedError
            );
            // this.#isProxyOperational = false; // Handled by _setInitializationError
        }
    }

    /**
     * Checks if the proxy is operational based on configuration loading success.
     * @returns {boolean} True if operational, false otherwise.
     */
    isOperational() {
        return this.#isProxyOperational;
    }

    /**
     * Gets all loaded LLM configurations.
     * @returns {LLMConfigurationFileForProxy | null} The loaded configurations, or null if not loaded/failed.
     */
    getLlmConfigs() {
        return this.#loadedLlmConfigs;
    }

    /**
     * Gets a specific LLM configuration by its ID.
     * @param {string} llmId - The ID of the LLM to retrieve.
     * @returns {LLMModelConfig | null} The LLM configuration, or null if not found or not loaded.
     */
    getLlmById(llmId) {
        if (!this.#loadedLlmConfigs || !this.#loadedLlmConfigs.llms) {
            this.#logger.warn(`LlmConfigService.getLlmById: Attempted to get LLM '${llmId}' but configurations are not loaded.`);
            return null;
        }
        const config = this.#loadedLlmConfigs.llms[llmId];
        if (!config) {
            this.#logger.warn(`LlmConfigService.getLlmById: LLM configuration for ID '${llmId}' not found.`);
            return null;
        }
        return config;
    }

    /**
     * Gets the actual resolved path used for loading the LLM configuration file.
     * @returns {string | null} The resolved path, or null if not yet determined.
     */
    getResolvedConfigPath() {
        return this.#resolvedConfigPath;
    }

    /**
     * Gets the details of the initialization error, if one occurred.
     * The returned object conforms to { message: string, stage: string, details: object }.
     * The `originalError` property from the internal error object is not directly exposed here
     * to avoid leaking potentially large or sensitive error objects to less controlled contexts.
     * The error log within `_setInitializationError` handles logging necessary details from `originalError`.
     * @returns {StandardizedErrorObject | null} Error details, or null if initialization was successful.
     */
    getInitializationErrorDetails() {
        if (this.#initializationError) {
            // Return a structure that's safe for external use, omitting the direct originalError object.
            const { originalError, ...safeErrorDetails } = this.#initializationError;
            return safeErrorDetails;
        }
        return null;
    }

    /**
     * Checks if any configured cloud LLM uses apiKeyFileName.
     * This is useful for displaying startup warnings if PROXY_PROJECT_ROOT_PATH is not set.
     * @returns {boolean} True if any cloud LLM is configured to use an API key file, false otherwise.
     */
    hasFileBasedApiKeys() {
        if (!this.#isProxyOperational || !this.#loadedLlmConfigs || !this.#loadedLlmConfigs.llms) {
            return false;
        }

        for (const llmId in this.#loadedLlmConfigs.llms) {
            // Ensure it's a direct property and not from the prototype chain
            if (Object.prototype.hasOwnProperty.call(this.#loadedLlmConfigs.llms, llmId)) {
                const config = this.#loadedLlmConfigs.llms[llmId];
                const isCloudService = config.apiType && !LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY.includes(config.apiType.toLowerCase());
                if (isCloudService && config.apiKeyFileName && config.apiKeyFileName.trim() !== '') {
                    return true;
                }
            }
        }
        return false;
    }
}