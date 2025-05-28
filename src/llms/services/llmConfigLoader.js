// src/services/llmConfigLoader.js
// --- FILE START ---

import {Workspace_retry} from '../../utils/apiUtils.js';
import {performSemanticValidations} from '../../validation/llmConfigSemanticValidator.js';

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

/**
 * @typedef {import('../../core/validators/llmConfigSemanticValidator.js').SemanticValidationError} OriginalSemanticValidationError
 * @description Original structure of a semantic error from llmConfigSemanticValidator.
 * @property {string} config_id - The ID of the configuration where the error occurred.
 * @property {string} path - Path to the problematic element (e.g., "prompt_assembly_order[2]").
 * @property {string} message - Description of the error.
 * @property {string} [errorType="SEMANTIC_VALIDATION"] - General type of error.
 * @property {string} [keyInvolved] - The specific key that caused the error, if applicable.
 */

/**
 * @typedef {object} StandardizedValidationError
 * @description Defines a common structure for validation error objects/messages.
 * @property {string} errorType - The type of error (e.g., "SCHEMA_VALIDATION", "SEMANTIC_VALIDATION_MISSING_KEY", "SEMANTIC_VALIDATION_INVALID_ORDER_KEY").
 * @property {string} configId - The config_id of the configuration object where the error occurred. Can be "N/A" if the error is global to the array or config_id is missing.
 * @property {string} path - A JSON path-like string indicating the location of the error (e.g., "prompt_elements[0].prefix", "prompt_assembly_order[2]"). For schema errors, this path is relative to the config object if applicable.
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
 * @typedef {import('../../core/validators/llmConfigSemanticValidator.js').LLMConfigObject} LLMConfigObject
 */

/**
 * @typedef {LLMConfigObject[]} LLMConfigObjectArray
 */


/**
 * @class LlmConfigLoader
 * @description Service responsible for loading, parsing, and validating LLM prompt configuration files (e.g. llm-configs.json).
 * It fetches the configuration file, validates it against a JSON schema, performs semantic validation,
 * and provides the parsed configurations.
 * Schema validation is performed using an injected ISchemaValidator. [Sub-Ticket 1.6.2]
 * Semantic validation is performed by custom logic. [Sub-Ticket 1.6.3]
 * Error reporting is standardized. [Sub-Ticket 1.6.5]
 */
export class LlmConfigLoader {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {ISchemaValidator}
     */
    #schemaValidator;

    /**
     * @private
     * @type {IConfiguration}
     */
    #configuration;

    /**
     * @private
     * @type {string} - Default path to the LLM prompt configuration file.
     */
    #defaultConfigPath = "config/llm-configs.json";

    /**
     * @private
     * @type {number}
     */
    #defaultMaxRetries = 3;

    /**
     * @private
     * @type {number}
     */
    #defaultBaseDelayMs = 500;

    /**
     * @private
     * @type {number}
     */
    #defaultMaxDelayMs = 5000;

    /**
     * Creates an instance of LlmConfigLoader.
     * @param {object} dependencies - Dependencies.
     * @param {ILogger} dependencies.logger - A logger instance.
     * @param {ISchemaValidator} dependencies.schemaValidator - An ISchemaValidator instance.
     * @param {IConfiguration} dependencies.configuration - An IConfiguration instance.
     * @param {string} [dependencies.defaultConfigPath] - Optional override for the default config file path.
     * @throws {Error} If critical dependencies like logger, schemaValidator, or configuration are missing.
     */
    constructor(dependencies = {}) {
        if (!dependencies.logger) {
            throw new Error("LlmConfigLoader: Constructor requires a valid ILogger instance.");
        }
        this.#logger = dependencies.logger;

        if (!dependencies.schemaValidator) {
            this.#logger.error("LlmConfigLoader: Constructor requires a valid ISchemaValidator instance.");
            throw new Error("LlmConfigLoader: Constructor requires a valid ISchemaValidator instance.");
        }
        this.#schemaValidator = dependencies.schemaValidator;

        if (!dependencies.configuration) {
            this.#logger.error("LlmConfigLoader: Constructor requires a valid IConfiguration instance.");
            throw new Error("LlmConfigLoader: Constructor requires a valid IConfiguration instance.");
        }
        this.#configuration = dependencies.configuration;


        if (dependencies.defaultConfigPath && typeof dependencies.defaultConfigPath === 'string') {
            this.#defaultConfigPath = dependencies.defaultConfigPath;
        }
    }

    /**
     * Transforms an Ajv error object into a standardized format.
     * @private
     * @param {import('ajv').ErrorObject} ajvError - The error object from Ajv.
     * @param {LLMConfigObjectArray | any} allConfigs - The array of all loaded configuration objects, or the root data if not an array.
     * @returns {StandardizedValidationError} The standardized error object.
     */
    #formatAjvErrorToStandardizedError(ajvError, allConfigs) {
        let configId = "N/A";
        const instancePathStr = typeof ajvError.instancePath === 'string' ? ajvError.instancePath : "";
        let relativePath = instancePathStr; // Initialize with a guaranteed string

        if (instancePathStr.startsWith('/')) {
            const parts = instancePathStr.split('/'); // parts will be like ["", "0", "prompt_elements", "0", "key"]
            if (parts.length > 1 && /^\d+$/.test(parts[1])) { // Path like "/0/..." referring to an item in the root array
                const index = parseInt(parts[1], 10);
                if (Array.isArray(allConfigs) && index < allConfigs.length && allConfigs[index] != null) { // check allConfigs[index] is not null/undefined
                    configId = allConfigs[index].config_id || `N/A (config @ index ${index} lacks ID)`;
                    // Construct path relative to the config object
                    relativePath = parts.slice(2).join('/');
                    if (relativePath === '') relativePath = "config_root"; // Error is on the config object itself
                } else {
                    configId = `N/A (invalid index ${index} or data not array/item missing)`;
                    // relativePath is already instancePathStr, which is the full path
                }
            } else { // Path like "/some_property_at_root_array_level" or other non-indexed root path
                configId = "N/A (root array issue)";
                relativePath = instancePathStr.substring(1); // Remove leading '/'
                if (relativePath === '') relativePath = "(root array itself)";
            }
        } else if (instancePathStr === "") { // Error on the root data itself (e.g. not an array when it should be)
            configId = "N/A (root data)";
            relativePath = "(root)";
        }
        // At this point, relativePath should be a string.
        // Ensure it is, for safety, before calling string methods.
        const pathSegmentToFormat = typeof relativePath === 'string' ? relativePath : "";

        const formattedPath = pathSegmentToFormat
            .replace(/\/(\d+)(?=\/|$)/g, '[$1]') // /digits/ or /digits$ -> [digits]
            .replace(/\//g, '.'); // / -> . (convert remaining slashes to dots)

        const standardizedError = {
            errorType: "SCHEMA_VALIDATION",
            configId: configId,
            path: formattedPath || pathSegmentToFormat, // Fallback if formattedPath is empty but pathSegmentToFormat was not
            message: ajvError.message || "Unknown schema validation error",
            details: {...ajvError} // Clone details
        };

        if (ajvError.params) {
            if (ajvError.params.allowedValues) {
                standardizedError.expected = ajvError.params.allowedValues;
            }
            if (ajvError.keyword === 'type') {
                // @ts-ignore
                standardizedError.expected = ajvError.params.type;
            }
            if (ajvError.keyword === 'additionalProperties') {
                standardizedError.message = `Object has an unexpected property: '${ajvError.params.additionalProperty}'. ${ajvError.message || ''}`.trim();
            }
        }
        return standardizedError;
    }

    /**
     * Transforms an original semantic error object into a standardized format.
     * @private
     * @param {OriginalSemanticValidationError} semanticError - The original semantic error.
     * @returns {StandardizedValidationError} The standardized error object.
     */
    #formatSemanticErrorToStandardizedError(semanticError) {
        let finalConfigId = semanticError.config_id;
        let finalPath = typeof semanticError.path === 'string' ? semanticError.path : "(path not specified)";

        // Handle specific root-level error for non-array data to align with test expectations
        if (semanticError.message && semanticError.message.includes("The provided llmConfigsData is not an array as expected")) {
            finalConfigId = "N/A"; // As expected by the test for this specific root error
            finalPath = "(root)";  // Provide a sensible path for this root error
        }

        return {
            errorType: semanticError.errorType || "SEMANTIC_VALIDATION", // Default if not more specific
            configId: finalConfigId,
            path: finalPath,
            message: semanticError.message,
            details: {...semanticError} // Clone details, original field names like config_id, keyInvolved will be here
        };
    }


    /**
     * Loads, parses, and validates the LLM Prompt configuration file.
     *
     * @async
     * @param {string} [filePath] - The path to the llm-configs.json file.
     * If not provided, the configured default path will be used.
     * @returns {Promise<LLMConfigObjectArray | LoadConfigsErrorResult>} A promise that resolves with the parsed
     * array of LLM prompt configurations, or an error object if loading/parsing/validation fails.
     */
    async loadConfigs(filePath) {
        const path = (typeof filePath === 'string' && filePath.trim() !== '') ? filePath.trim() : this.#defaultConfigPath;
        this.#logger.info(`LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${path}`);

        let parsedResponse;
        try {
            parsedResponse = await Workspace_retry(
                path,
                {method: 'GET', headers: {'Accept': 'application/json'}},
                this.#defaultMaxRetries,
                this.#defaultBaseDelayMs,
                this.#defaultMaxDelayMs
            );
            this.#logger.info(`LlmConfigLoader: Successfully fetched and parsed LLM Prompt configurations from ${path}.`);

            // --- SCHEMA VALIDATION START ---
            const schemaId = this.#configuration.getContentTypeSchemaId('llm-configs');
            if (!schemaId) {
                this.#logger.error(`LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration.`);
                const errorResult = {
                    error: true,
                    message: "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate.",
                    stage: 'validation_setup',
                    path: path,
                };
                // @ts-ignore
                return errorResult;
            }

            this.#logger.info(`LlmConfigLoader: Validating parsed LLM Prompt configurations against schema ID: ${schemaId}`);
            const validationResult = this.#schemaValidator.validate(schemaId, parsedResponse);

            if (!validationResult.isValid) {
                const standardizedSchemaErrors = (validationResult.errors || []).map(err =>
                    this.#formatAjvErrorToStandardizedError(err, /** @type {LLMConfigObjectArray | any} */ (parsedResponse))
                );

                this.#logger.error(`LlmConfigLoader: LLM Prompt configuration file from ${path} failed schema validation. Count: ${standardizedSchemaErrors.length}`, {
                    path,
                    schemaId,
                    validationErrors: standardizedSchemaErrors
                });
                standardizedSchemaErrors.forEach(sError => {
                    this.#logger.error(`Schema Validation Error: Config ID: '${sError.configId}', Path: '${sError.path}', Message: ${sError.message}`, {details: sError.details});
                });

                const errorResult = {
                    error: true,
                    message: 'LLM Prompt configuration schema validation failed.',
                    stage: 'validation',
                    path: path,
                    validationErrors: standardizedSchemaErrors
                };
                // @ts-ignore
                return errorResult;
            }
            this.#logger.info(`LlmConfigLoader: LLM Prompt configuration file from ${path} passed schema validation.`);
            // --- SCHEMA VALIDATION END ---

            // --- SEMANTIC VALIDATION START ---
            this.#logger.info(`LlmConfigLoader: Performing semantic validation on LLM Prompt configurations from ${path}.`);
            if (!Array.isArray(parsedResponse)) {
                this.#logger.error(`LlmConfigLoader: Data from ${path} is not an array after schema validation. This implies a schema issue or unexpected data override. Semantic validation expects an array.`);
                // If schema guarantees an array, this block might be theoretically unreachable.
                // However, if it's reached, semantic validation on a non-array will likely also report an error.
            }
            const originalSemanticErrors = performSemanticValidations(/** @type {LLMConfigObjectArray} */ (parsedResponse));

            if (originalSemanticErrors.length > 0) {
                const standardizedSemanticErrors = originalSemanticErrors.map(err =>
                    this.#formatSemanticErrorToStandardizedError(err)
                );

                this.#logger.error(`LlmConfigLoader: LLM Prompt configuration file from ${path} failed semantic validation. Count: ${standardizedSemanticErrors.length}`, {
                    path,
                    semanticErrors: standardizedSemanticErrors
                });
                standardizedSemanticErrors.forEach(sError => {
                    this.#logger.error(`Semantic Validation Error: Config ID: '${sError.configId}', Type: ${sError.errorType}, Path: '${sError.path}', Message: ${sError.message}`, {
                        details: sError.details
                    });
                });
                const errorResult = {
                    error: true,
                    message: 'LLM Prompt configuration semantic validation failed.',
                    stage: 'semantic_validation',
                    path: path,
                    semanticErrors: standardizedSemanticErrors
                };
                // @ts-ignore
                return errorResult;
            }
            this.#logger.info(`LlmConfigLoader: LLM Prompt configuration file from ${path} passed semantic validation.`);
            // --- SEMANTIC VALIDATION END ---

            this.#logger.info(`LlmConfigLoader: LLM Prompt configurations from ${path} processed successfully.`);
            return /** @type {LLMConfigObjectArray} */ (parsedResponse);

        } catch (error) {
            // @ts-ignore
            if (error && error.error === true && error.stage) { // If it's already our structured error, re-throw
                // @ts-ignore
                return error;
            }

            this.#logger.error(`LlmConfigLoader: Failed to load, parse, or validate LLM Prompt configurations from ${path}. Error: ${error.message}`, {
                path,
                // @ts-ignore
                originalErrorDetails: error.originalError || error, // Log the original error if it's wrapped
                // @ts-ignore
                stack: error.stack
            });

            let stage = 'fetch_parse_or_validate';
            let originalCaughtError = error;

            // @ts-ignore
            if (error.originalError) { // If error is already a wrapped one from Workspace_retry
                // @ts-ignore
                originalCaughtError = error.originalError;
            }


            if (originalCaughtError.message) {
                const lowerCaseMessage = originalCaughtError.message.toLowerCase();
                if (lowerCaseMessage.includes('failed to fetch') || lowerCaseMessage.includes('network request failed')) {
                    stage = 'fetch_network_error';
                } else if (lowerCaseMessage.includes('status 404') || lowerCaseMessage.includes('not found')) {
                    stage = 'fetch_not_found';
                } else if (lowerCaseMessage.match(/status (5\d\d)/)) {
                    stage = 'fetch_server_error';
                } else if (lowerCaseMessage.match(/status (4\d\d)/)) {
                    stage = 'fetch_client_error';
                } else if (lowerCaseMessage.includes('json') || lowerCaseMessage.includes('parse') || lowerCaseMessage.includes('unexpected token') || lowerCaseMessage.includes('lexical error')) {
                    stage = 'parse';
                } else if (lowerCaseMessage.includes('schema id') && lowerCaseMessage.includes('undefined')) {
                    stage = 'validation_setup';
                    // @ts-ignore
                } else if (error.message && error.message.toLowerCase().includes('failed after') && error.message.toLowerCase().includes('attempt(s)')) { // Check outer error message for retry failure
                    stage = 'fetch_max_retries_exceeded';
                }
            }

            const errorResult = {
                error: true,
                // @ts-ignore
                message: `Failed to load, parse, or validate LLM Prompt configurations from ${path}: ${error.message}`, // Main error message
                stage: stage,
                originalError: originalCaughtError, // Store the most relevant original error
                path: path,
                // @ts-ignore // These might be undefined if error came from fetch/parse
                validationErrors: error.validationErrors,
                // @ts-ignore
                semanticErrors: error.semanticErrors
            };
            // @ts-ignore
            return errorResult;
        }
    }
}

// --- FILE END ---