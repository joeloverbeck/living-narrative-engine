// src/llms/services/llmConfigLoader.js
// --- FILE START ---

import { Workspace_retry } from '../../utils/apiUtils.js';
import { performSemanticValidations } from '../../validation/llmConfigSemanticValidator.js'; // Assuming this path is correct

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
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
     * @private
  #logger;
     * @private
  #schemaValidator;
     * @private
  #configuration;
     * @private
  #defaultConfigPath = 'config/llm-configs.json';
     * @private
  #defaultMaxRetries = 3;
     * @private
  #defaultBaseDelayMs = 500;
     * @private
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
      dependencies.defaultConfigPath &&
      typeof dependencies.defaultConfigPath === 'string'
    ) {
      this.#defaultConfigPath = dependencies.defaultConfigPath;
    }
  }

  /**
   * Transforms an Ajv error object into a standardized format.
   * @private
   * @param {import('ajv').ErrorObject} ajvError - The error object from Ajv.
   * @param {LLMRootConfiguration | any} parsedRootData - The root parsed data.
   * @returns {StandardizedValidationError} The standardized error object.
   */
  #formatAjvErrorToStandardizedError(ajvError, parsedRootData) {
    let standardizedConfigId = 'N/A';
    let standardizedPath = ajvError.instancePath || '';

    const instancePathStr = ajvError.instancePath || '';
    const parts = instancePathStr.split('/').filter((p) => p.length > 0);

    if (instancePathStr === '') {
      standardizedConfigId = 'N/A (root data)';
      standardizedPath = '(root)';
    } else if (parts[0] === 'configs') {
      if (parts.length === 1) {
        standardizedConfigId = 'N/A (configs property)';
        standardizedPath = 'configs';
      } else if (parts.length > 1) {
        standardizedConfigId = parts[1];
        const relativePathParts = parts.slice(2);
        standardizedPath =
          `configs.${parts[1]}${relativePathParts.length > 0 ? '.' : ''}${relativePathParts.join('.')}`.replace(
            /\.(\d+)(?=\.|$)/g,
            '[$1]'
          );
      }
    } else if (
      parts.length > 0 &&
      (parts[0] === 'defaultConfigId' ||
        !parsedRootData ||
        !parsedRootData.configs ||
        parts[0] !== 'configs')
    ) {
      standardizedConfigId = 'N/A (root property)';
      standardizedPath = parts.join('.').replace(/\.(\d+)(?=\.|$)/g, '[$1]');
    } else {
      standardizedConfigId = 'N/A (unknown path structure)';
      standardizedPath = instancePathStr
        .substring(1)
        .replace(/\//g, '.')
        .replace(/\.(\d+)(?=\.|$)/g, '[$1]');
    }

    standardizedPath = standardizedPath.replace(/^\.+|\.+$/g, '');

    const standardizedError = {
      errorType: 'SCHEMA_VALIDATION',
      configId: standardizedConfigId,
      path:
        standardizedPath ||
        (instancePathStr === '/' ? '(root)' : instancePathStr),
      message: ajvError.message || 'Unknown schema validation error',
      details: { ...ajvError },
    };

    if (ajvError.params) {
      if (ajvError.params.allowedValues) {
        standardizedError.expected = ajvError.params.allowedValues;
      }
      // @ts-ignore
      if (ajvError.keyword === 'type' && ajvError.params.type) {
        // @ts-ignore
        standardizedError.expected = ajvError.params.type;
      }
      if (ajvError.keyword === 'additionalProperties') {
        standardizedError.message =
          `Object has an unexpected property: '${ajvError.params.additionalProperty}'. ${ajvError.message || ''}`.trim();
      }
    }
    return standardizedError;
  }

  /**
   * Transforms an original semantic error object from performSemanticValidations into a standardized format.
   * @private
   * @param {OriginalSemanticValidationError} semanticError - The original semantic error.
   * @returns {StandardizedValidationError} The standardized error object.
   */
  #formatSemanticErrorToStandardizedError(semanticError) {
    let standardizedConfigId = semanticError.configId;
    let standardizedPath = '';

    const relativeSemanticPath = semanticError.path || '';

    if (
      semanticError.errorType ===
      'SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE'
    ) {
      standardizedConfigId = 'N/A (root property)';
      standardizedPath = 'configs';
    } else if (
      standardizedConfigId &&
      !standardizedConfigId.startsWith('N/A') &&
      standardizedConfigId !== 'N/A - Root "configs" property'
    ) {
      standardizedPath = `configs.${standardizedConfigId}`;
      if (
        relativeSemanticPath &&
        relativeSemanticPath !== '(config object root)'
      ) {
        standardizedPath += `.${relativeSemanticPath}`;
      }
    } else {
      standardizedConfigId = semanticError.configId || 'N/A';
      standardizedPath = relativeSemanticPath || '(path not specified)';
    }

    standardizedPath = standardizedPath
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');

    return {
      errorType: semanticError.errorType || 'SEMANTIC_VALIDATION',
      configId: standardizedConfigId,
      path: standardizedPath,
      message: semanticError.message,
      details: { ...semanticError },
    };
  }

  /**
   * Loads, parses, and validates the LLM Prompt configuration file.
   * @async
   * @param {string} [filePathValue] - The path to the llm-configs.json file.
   * @returns {Promise<LLMRootConfiguration | LoadConfigsErrorResult>}
   */
  async loadConfigs(filePathValue) {
    const currentPath =
      typeof filePathValue === 'string' && filePathValue.trim() !== ''
        ? filePathValue.trim()
        : this.#defaultConfigPath;
    this.#logger.info(
      `LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${currentPath}`
    );

    /** @type {any} */
    let parsedResponse;
    try {
      parsedResponse = await Workspace_retry(
        currentPath,
        { method: 'GET', headers: { Accept: 'application/json' } },
        this.#defaultMaxRetries,
        this.#defaultBaseDelayMs,
        this.#defaultMaxDelayMs
      );
      this.#logger.info(
        `LlmConfigLoader: Successfully fetched and parsed LLM Prompt configurations from ${currentPath}.`
      );

      const schemaId =
        this.#configuration.getContentTypeSchemaId('llm-configs');
      if (!schemaId) {
        // Corrected logger message for schema ID retrieval failure
        this.#logger.error(
          `LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration.`
        );
        // @ts-ignore
        return {
          error: true,
          message:
            "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate.",
          stage: 'validation_setup',
          path: currentPath,
        };
      }

      this.#logger.info(
        `LlmConfigLoader: Validating against schema ID: ${schemaId}`
      );
      const validationResult = this.#schemaValidator.validate(
        schemaId,
        parsedResponse
      );

      if (!validationResult.isValid) {
        const standardizedSchemaErrors = (validationResult.errors || []).map(
          (err) => this.#formatAjvErrorToStandardizedError(err, parsedResponse)
        );
        // Corrected logger message for schema validation failure
        this.#logger.error(
          `LlmConfigLoader: LLM Prompt configuration file from ${currentPath} failed schema validation. Count: ${standardizedSchemaErrors.length}`,
          {
            path: currentPath,
            schemaId,
            validationErrors: standardizedSchemaErrors, // Changed 'errors' to 'validationErrors' to match test
          }
        );
        standardizedSchemaErrors.forEach((sError) =>
          this.#logger.error(
            `Schema Validation Error: Config ID: '${sError.configId}', Path: '${sError.path}', Message: ${sError.message}`,
            { details: sError.details }
          )
        );
        // @ts-ignore
        return {
          error: true,
          message: 'LLM Prompt configuration schema validation failed.',
          stage: 'validation',
          path: currentPath,
          validationErrors: standardizedSchemaErrors,
        };
      }
      this.#logger.info(
        `LlmConfigLoader: LLM Prompt configuration file from ${currentPath} passed schema validation.`
      );
      const validatedRootConfig = /** @type {LLMRootConfiguration} */ (
        parsedResponse
      );

      this.#logger.info(
        `LlmConfigLoader: Performing semantic validation for ${currentPath}.`
      ); // Test uses "on LLM Prompt configurations from"
      const originalSemanticErrors = performSemanticValidations(
        validatedRootConfig.configs
      );

      if (originalSemanticErrors.length > 0) {
        const standardizedSemanticErrors = originalSemanticErrors.map((err) =>
          this.#formatSemanticErrorToStandardizedError(err)
        );
        // Corrected logger message for semantic validation failure
        this.#logger.error(
          `LlmConfigLoader: LLM Prompt configuration file from ${currentPath} failed semantic validation. Count: ${standardizedSemanticErrors.length}`,
          {
            path: currentPath,
            semanticErrors: standardizedSemanticErrors, // Changed 'errors' to 'semanticErrors'
          }
        );
        standardizedSemanticErrors.forEach((sError) =>
          this.#logger.error(
            `Semantic Validation Error: Config ID: '${sError.configId}', Type: ${sError.errorType}, Path: '${sError.path}', Message: ${sError.message}`,
            { details: sError.details }
          )
        );
        // @ts-ignore
        return {
          error: true,
          message: 'LLM Prompt configuration semantic validation failed.',
          stage: 'semantic_validation',
          path: currentPath,
          semanticErrors: standardizedSemanticErrors,
        };
      }
      this.#logger.info(
        `LlmConfigLoader: Semantic validation passed for ${currentPath}.`
      ); // This should be "LLM Prompt configuration file from ${currentPath} passed semantic validation." for the other test suite.
      // Let's keep "Semantic validation passed for..." for now as per LlmConfigLoader.extended.test.js passing.

      this.#logger.info(
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

      // @ts-ignore
      return {
        error: true,
        message: `Failed to load, parse, or validate LLM Prompt configurations from ${currentPath}: ${originalCaughtError.message}`,
        stage,
        originalError: originalCaughtError,
        path: currentPath,
        // @ts-ignore
        validationErrors: error.validationErrors,
        // @ts-ignore
        semanticErrors: error.semanticErrors,
      };
    }
  }
}

// --- FILE END ---
