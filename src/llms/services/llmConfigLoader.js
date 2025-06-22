// src/llms/services/llmConfigLoader.js
// --- FILE START ---

import { fetchWithRetry } from '../../utils/index.js';
import { performSemanticValidations } from '../../validation/llmConfigSemanticValidator.js';
import {
  formatAjvErrorToStandardizedError,
  formatSemanticErrorToStandardizedError,
} from './llmConfigErrorFormatter.js';
import { isNonBlankString } from '../../utils/textUtils.js';

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration
 */

// --- NEW JSDoc Type Definitions based on schema ---

/**
 * @typedef {object} LLMConfigPromptElement
 * @description Defines a named prompt part and its wrappers.
 * As defined in llm-configs.schema.json.
 * @property {string} key - Unique key for the prompt element (e.g., 'system_prompt').
 * @property {string} prefix - String to prepend to this part's content.
 * @property {string} suffix - String to append to this part's content.
 */

/**
 * @typedef {object} LLMJsonOutputStrategy
 * @description Defines the strategy for ensuring JSON output from the LLM.
 * As defined in llm-configs.schema.json.
 * @property {string} method - The method to use for enforcing JSON output.
 * @property {string} [toolName] - Required if 'method' is 'tool_calling'.
 * @property {string} [grammar] - Required if 'method' is 'gbnf_grammar'.
 * @property {object} [jsonSchema] - Required if 'method' is 'openrouter_json_schema'.
 */

/**
 * @typedef {object} LLMPromptFrame
 * @description Defines a framing structure for the prompt.
 * As defined in llm-configs.schema.json.
 * @property {string} [system] - A system-level message or instruction for the LLM.
 */

/**
 * @typedef {object} LLMConfiguration
 * @description A self-contained LLM configuration, including properties for prompt engineering and API interaction.
 * Matches the `llmConfiguration` definition in `llm-configs.schema.json`.
 * @property {string} configId - Unique identifier for this LLM configuration.
 * @property {string} displayName - A user-friendly name for this configuration.
 * @property {string} modelIdentifier - The specific model ID or family identifier.
 * @property {string} endpointUrl - The base API endpoint URL.
 * @property {string} apiType - Identifier for the API type or provider.
 * @property {string} [apiKeyEnvVar] - Optional: Environment variable for the API key.
 * @property {string} [apiKeyFileName] - Optional: File name for the API key.
 * @property {LLMJsonOutputStrategy} jsonOutputStrategy - Strategy for JSON output.
 * @property {object} [defaultParameters] - Optional: Default parameters for LLM requests.
 * @property {Record<string, string>} [providerSpecificHeaders] - Optional: HTTP headers specific to the provider.
 * @property {LLMConfigPromptElement[]} promptElements - Defines named prompt parts.
 * @property {string[]} promptAssemblyOrder - Ordered list of 'promptElements' keys.
 * @property {number} [contextTokenLimit] - Optional: Maximum context tokens.
 * @property {LLMPromptFrame} [promptFrame] - Optional: Prompt framing structure.
 */

/**
 * @typedef {object} LLMRootConfiguration
 * @description Defines the root structure for the llm-configs.json file.
 * Matches the main structure of `llm-configs.schema.json`.
 * @property {string} defaultConfigId - The ID of the default LLM configuration.
 * @property {Record<string, LLMConfiguration>} configs - A map of LLM configurations.
 */

// --- End of NEW JSDoc Type Definitions ---

/**
 * @typedef {import('../../validation/llmConfigSemanticValidator.js').SemanticValidationError} OriginalSemanticValidationError
 */

/**
 * @typedef {object} StandardizedValidationError
 * @description Defines a common structure for validation error objects/messages.
 * @property {string} errorType - The type of error (e.g., "SCHEMA_VALIDATION", "SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY").
 * @property {string} configId - The configId of the configuration object where the error occurred. Can be "N/A (root property)" or the actual configId.
 * @property {string} path - A JSON path-like string indicating the location of the error (e.g., "configs.myConfig.promptElements[0].prefix", "defaultConfigId").
 * @property {string} message - A human-readable description of the error.
 * @property {any} [expected] - What was expected (optional, typically for schema errors, derived from params).
 * @property {any} [actual] - What was found (optional, typically for schema errors, e.g. type errors).
 * @property {object} [details] - Original error details from Ajv (ErrorObject) or the semantic validator (OriginalSemanticValidationError).
 */

/**
 * @typedef {object} LoadConfigsErrorResult
 * @description Represents the structure of a failed configuration load attempt.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - A description of the error.
 * @property {string} [stage] - The stage where the error occurred (e.g., 'fetch', 'parse', 'validation', 'semantic_validation').
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [path] - The file path that was attempted.
 * @property {Array<StandardizedValidationError>} [validationErrors] - Array of standardized schema validation errors.
 * @property {Array<StandardizedValidationError>} [semanticErrors] - Array of standardized semantic validation errors.
 */

/**
 * @class LlmConfigLoader
 * @description Service responsible for loading, parsing, and validating LLM prompt configuration files (e.g. llm-configs.json).
 */
export class LlmConfigLoader {
  #logger;
  #schemaValidator;
  #configuration;
  #safeEventDispatcher;
  #defaultConfigPath = 'config/llm-configs.json';
  #defaultMaxRetries = 3;
  #defaultBaseDelayMs = 500;
  #defaultMaxDelayMs = 5000;

  constructor(dependencies = {}) {
    // Corrected error messages to include "valid"
    if (!dependencies.logger)
      throw new Error(
        'LlmConfigLoader: Constructor requires a valid ILogger instance.'
      );
    this.#logger = dependencies.logger;
    if (!dependencies.schemaValidator)
      throw new Error(
        'LlmConfigLoader: Constructor requires a valid ISchemaValidator instance.'
      );
    this.#schemaValidator = dependencies.schemaValidator;
    if (!dependencies.configuration)
      throw new Error(
        'LlmConfigLoader: Constructor requires a valid IConfiguration instance.'
      );
    this.#configuration = dependencies.configuration;

    if (
      !dependencies.safeEventDispatcher ||
      typeof dependencies.safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'LlmConfigLoader: Constructor requires a valid ISafeEventDispatcher instance.'
      );
    }
    this.#safeEventDispatcher = dependencies.safeEventDispatcher;

    if (
      dependencies.defaultConfigPath &&
      typeof dependencies.defaultConfigPath === 'string'
    ) {
      this.#defaultConfigPath = dependencies.defaultConfigPath;
    }
  }

  /**
   * Fetches the configuration file using {@link fetchWithRetry}.
   *
   * @private
   * @param {string} path - Location of the configuration file.
   * @returns {Promise<any>} Parsed JSON response.
   */
  async #_fetchConfigFile(path) {
    this.#logger.debug(
      `LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${path}`
    );
    const result = await fetchWithRetry(
      path,
      { method: 'GET', headers: { Accept: 'application/json' } },
      this.#defaultMaxRetries,
      this.#defaultBaseDelayMs,
      this.#defaultMaxDelayMs,
      this.#safeEventDispatcher,
      this.#logger
    );
    this.#logger.debug(
      `LlmConfigLoader: Successfully fetched and parsed LLM Prompt configurations from ${path}.`
    );
    return result;
  }

  /**
   * Validates configuration data against the registered schema.
   *
   * @private
   * @param {any} data - Parsed configuration data.
   * @param {string} path - File path for logging.
   * @returns {{error?: LoadConfigsErrorResult, config?: LLMRootConfiguration}}
   */
  #_validateSchema(data, path) {
    const schemaId = this.#configuration.getContentTypeSchemaId('llm-configs');
    if (!schemaId) {
      this.#logger.error(
        `LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration.`
      );
      return {
        error: this.#_buildErrorResult(
          "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate.",
          'validation_setup',
          path
        ),
      };
    }

    this.#logger.debug(
      `LlmConfigLoader: Validating against schema ID: ${schemaId}`
    );
    const validationResult = this.#schemaValidator.validate(schemaId, data);

    if (!validationResult.isValid) {
      const standardizedSchemaErrors = (validationResult.errors || []).map(
        (err) => formatAjvErrorToStandardizedError(err, data)
      );
      this.#logger.error(
        `LlmConfigLoader: LLM Prompt configuration file from ${path} failed schema validation. Count: ${standardizedSchemaErrors.length}`,
        {
          path,
          schemaId,
          validationErrors: standardizedSchemaErrors,
        }
      );
      standardizedSchemaErrors.forEach((sError) =>
        this.#logger.error(
          `Schema Validation Error: Config ID: '${sError.configId}', Path: '${sError.path}', Message: ${sError.message}`,
          { details: sError.details }
        )
      );
      return {
        error: this.#_buildErrorResult(
          'LLM Prompt configuration schema validation failed.',
          'validation',
          path,
          { validationErrors: standardizedSchemaErrors }
        ),
      };
    }
    this.#logger.debug(
      `LlmConfigLoader: LLM Prompt configuration file from ${path} passed schema validation.`
    );
    return { config: /** @type {LLMRootConfiguration} */ (data) };
  }

  /**
   * Runs semantic validation on the already schema-validated configuration.
   *
   * @private
   * @param {LLMRootConfiguration} cfg - Validated configuration.
   * @param {string} path - File path for logging.
   * @returns {{error?: LoadConfigsErrorResult}}
   */
  #_validateSemantics(cfg, path) {
    this.#logger.debug(
      `LlmConfigLoader: Performing semantic validation for ${path}.`
    );
    const originalSemanticErrors = performSemanticValidations(cfg.configs);
    if (originalSemanticErrors.length > 0) {
      const standardizedSemanticErrors = originalSemanticErrors.map((err) =>
        formatSemanticErrorToStandardizedError(err)
      );
      this.#logger.error(
        `LlmConfigLoader: LLM Prompt configuration file from ${path} failed semantic validation. Count: ${standardizedSemanticErrors.length}`,
        {
          path,
          semanticErrors: standardizedSemanticErrors,
        }
      );
      standardizedSemanticErrors.forEach((sError) =>
        this.#logger.error(
          `Semantic Validation Error: Config ID: '${sError.configId}', Type: ${sError.errorType}, Path: '${sError.path}', Message: ${sError.message}`,
          { details: sError.details }
        )
      );
      return {
        error: this.#_buildErrorResult(
          'LLM Prompt configuration semantic validation failed.',
          'semantic_validation',
          path,
          { semanticErrors: standardizedSemanticErrors }
        ),
      };
    }
    this.#logger.debug(
      `LlmConfigLoader: Semantic validation passed for ${path}.`
    );
    return {};
  }

  /**
   * Builds an error result object.
   *
   * @private
   * @param {string} message - Error description.
   * @param {string} stage - Stage where the error occurred.
   * @param {string} path - Source file path.
   * @param {object} [extras] - Additional error details.
   * @returns {LoadConfigsErrorResult}
   */
  #_buildErrorResult(message, stage, path, extras = {}) {
    return { error: true, message, stage, path, ...extras };
  }

  /**
   * Loads, parses, and validates the LLM Prompt configuration file.
   *
   * @async
   * @param {string} [filePathValue] - The path to the llm-configs.json file.
   * @returns {Promise<LLMRootConfiguration | LoadConfigsErrorResult>}
   */
  async loadConfigs(filePathValue) {
    const currentPath = isNonBlankString(filePathValue)
      ? filePathValue.trim()
      : this.#defaultConfigPath;
    try {
      const parsedResponse = await this.#_fetchConfigFile(currentPath);

      const schemaResult = this.#_validateSchema(parsedResponse, currentPath);
      if (schemaResult.error) return schemaResult.error;
      const validatedRootConfig = schemaResult.config;

      const semanticResult = this.#_validateSemantics(
        validatedRootConfig,
        currentPath
      );
      if (semanticResult.error) return semanticResult.error;

      this.#logger.debug(
        `LlmConfigLoader: LLM Prompt configurations from ${currentPath} processed successfully.`
      );
      return validatedRootConfig;
    } catch (error) {
      // @ts-ignore
      if (error && error.error === true && error.stage) return error;

      const originalCaughtError = /** @type {Error} */ (
        error.originalError || error
      );
      // Corrected main logger error message format
      this.#logger.error(
        `LlmConfigLoader: Failed to load, parse, or validate LLM Prompt configurations from ${currentPath}. Error: ${originalCaughtError.message}`,
        {
          path: currentPath,
          originalErrorDetails: originalCaughtError, // Matching test expectation for key 'originalErrorDetails'
          // @ts-ignore
          stack: error.stack,
        }
      );
      let stage = 'fetch_parse_or_validate';
      const lowerMsg = originalCaughtError.message?.toLowerCase() || '';
      // @ts-ignore
      const outerErrorMessage = error.message || '';

      if (
        lowerMsg.includes('failed to fetch') ||
        lowerMsg.includes('network request failed')
      )
        stage = 'fetch_network_error';
      else if (
        lowerMsg.includes('status 404') ||
        lowerMsg.includes('not found')
      )
        stage = 'fetch_not_found';
      else if (lowerMsg.match(/status (5\d\d)/)) stage = 'fetch_server_error';
      else if (lowerMsg.match(/status (4\d\d)/)) stage = 'fetch_client_error';
      else if (
        lowerMsg.includes('json') ||
        lowerMsg.includes('parse') ||
        lowerMsg.includes('unexpected token') ||
        lowerMsg.includes('lexical error')
      )
        stage = 'parse';
      else if (lowerMsg.includes('schema id') && lowerMsg.includes('undefined'))
        stage = 'validation_setup';
      else if (
        outerErrorMessage.toLowerCase().includes('failed after') &&
        outerErrorMessage.toLowerCase().includes('attempt(s)')
      )
        stage = 'fetch_max_retries_exceeded';

      return this.#_buildErrorResult(
        `Failed to load, parse, or validate LLM Prompt configurations from ${currentPath}: ${originalCaughtError.message}`,
        stage,
        currentPath,
        {
          originalError: originalCaughtError,
          // @ts-ignore
          validationErrors: error.validationErrors,
          // @ts-ignore
          semanticErrors: error.semanticErrors,
        }
      );
    }
  }
}

// --- FILE END ---
