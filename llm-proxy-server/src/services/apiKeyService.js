// llm-proxy-server/src/services/apiKeyService.js

import * as path from 'node:path';
import {
  LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY,
  DEFAULT_ENCODING_UTF8,
} from '../config/constants.js'; // MODIFIED: Import constants

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../interfaces/IFileSystemReader.js').IFileSystemReader} IFileSystemReader
 */

/**
 * @typedef {import('../config/appConfig.js').AppConfigService} AppConfigService
 */

/**
 * @typedef {import('../config/llmConfigService.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {object} StandardizedErrorObject
 * @description Standardized structure for error information returned by services.
 * @property {string} message - A human-readable description of the error.
 * @property {string} stage - A machine-readable string indicating the stage or component where the error occurred.
 * @property {object} details - An object containing additional structured details about the error.
 * @property {string} [details.llmId] - The ID of the LLM for which the API key was being retrieved.
 * @property {string} [details.attemptedEnvVar] - The environment variable name that was checked.
 * @property {string} [details.attemptedFile] - The file name that was attempted for API key retrieval.
 * @property {string} [details.reason] - A more specific reason for the failure.
 * @property {string} [details.originalErrorMessage] - The message from an underlying original error, if applicable.
 */

/**
 * @typedef {object} ApiKeyResult
 * @property {string|null} apiKey - The retrieved API key, or null if not applicable or not found.
 * @property {StandardizedErrorObject|null} errorDetails - A standardized error object if retrieval failed, otherwise null.
 * @property {string} source - A string indicating the source of the API key or status.
 */

/**
 *
 */
export class ApiKeyService {
  /** @type {ILogger} */
  #logger;
  /** @type {IFileSystemReader} */
  #fileSystemReader;
  /** @type {AppConfigService} */
  #appConfigService;

  // REMOVED: Static private field as it's now imported from constants.js
  // static #LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY = [
  // 'ollama',
  // 'llama_cpp_server_openai_compatible',
  // 'tgi_openai_compatible',
  // ];

  /**
   * Constructs an ApiKeyService instance.
   * @param {ILogger} logger - An ILogger instance.
   * @param {IFileSystemReader} fileSystemReader - An IFileSystemReader instance.
   * @param {AppConfigService} appConfigService - An AppConfigService instance.
   */
  constructor(logger, fileSystemReader, appConfigService) {
    if (!logger) {
      throw new Error('ApiKeyService: logger is required.');
    }
    if (!fileSystemReader) {
      throw new Error('ApiKeyService: fileSystemReader is required.');
    }
    if (!appConfigService) {
      throw new Error('ApiKeyService: appConfigService is required.');
    }

    this.#logger = logger;
    this.#fileSystemReader = fileSystemReader;
    this.#appConfigService = appConfigService;

    this.#logger.debug('ApiKeyService: Instance created.');
  }

  /**
   * Creates a standardized error object.
   * @private
   * @param {string} message - The primary error message.
   * @param {string} stage - The stage code for the error.
   * @param {object} detailsContext - Contextual details for the error, including llmId and other specifics.
   * @param {Error} [originalError] - The original error object, if any, for internal logging.
   * @returns {StandardizedErrorObject} The created standardized error object.
   */
  _createErrorDetails(message, stage, detailsContext, originalError = null) {
    // Ensure originalErrorMessage is populated if originalError is provided
    if (
      originalError &&
      originalError.message &&
      !detailsContext.originalErrorMessage
    ) {
      detailsContext.originalErrorMessage = originalError.message;
    }

    const errorObject = {
      message,
      stage,
      details: detailsContext,
    };

    // Log the detailed error internally
    this.#logger.warn(
      `ApiKeyService: Error condition encountered. Stage: ${stage}, Message: ${message}, LLM ID: ${detailsContext.llmId || 'N/A'}.`,
      {
        details: detailsContext,
        originalError: originalError
          ? {
              message: originalError.message,
              name: originalError.name,
              stack: originalError.stack,
            }
          : undefined,
      }
    );

    return errorObject;
  }

  /**
   * Checks if an API key is required for the given LLM configuration.
   * @param {LLMModelConfig | null | undefined} llmModelConfig - The LLM model configuration.
   * @returns {boolean} True if an API key is required, false otherwise.
   */
  isApiKeyRequired(llmModelConfig) {
    if (!llmModelConfig || !llmModelConfig.apiType) {
      this.#logger.debug(
        'ApiKeyService.isApiKeyRequired: llmModelConfig or apiType is missing, assuming key not required.'
      );
      return false;
    }
    const apiTypeLower = llmModelConfig.apiType.toLowerCase();
    // MODIFIED: Use imported constant
    const isLocalType =
      LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY.includes(apiTypeLower);

    this.#logger.debug(
      `ApiKeyService.isApiKeyRequired: For apiType='${llmModelConfig.apiType}', isLocalType=${isLocalType}. Key required: ${!isLocalType}`
    );
    return !isLocalType;
  }

  /**
   * Reads an API key from a specified file.
   * @private
   * @param {string} fileName - The name of the file (e.g., "api_key.txt").
   * @param {string} projectRootPath - The root path where the key file is located.
   * @param {string} llmId - The LLM ID, for logging and error context.
   * @returns {Promise<{key: string|null, error: StandardizedErrorObject|null}>} Result object.
   */
  async _readApiKeyFromFile(fileName, projectRootPath, llmId) {
    const safeFileName = path.basename(fileName);
    if (safeFileName !== fileName) {
      this.#logger.warn(
        `ApiKeyService._readApiKeyFromFile: Original fileName '${fileName}' for llmId '${llmId}' was normalized to '${safeFileName}'. Ensure the provided fileName is just the file's name.`
      );
    }

    const fullPath = path.join(projectRootPath, safeFileName);
    this.#logger.debug(
      `ApiKeyService._readApiKeyFromFile: Attempting to read API key from '${fullPath}' for llmId '${llmId}'.`
    );

    try {
      // MODIFIED: Use imported constant for encoding
      const apiKey = await this.#fileSystemReader.readFile(
        fullPath,
        DEFAULT_ENCODING_UTF8
      );
      const trimmedKey = apiKey.trim();

      if (trimmedKey === '') {
        this.#logger.warn(
          `ApiKeyService._readApiKeyFromFile: API key file '${fullPath}' for llmId '${llmId}' is empty or contains only whitespace.`
        );
        return {
          key: null,
          error: this._createErrorDetails(
            `API key file is empty or contains only whitespace.`,
            'api_key_file_empty',
            {
              llmId,
              attemptedFile: fullPath,
              reason: 'File is empty or whitespace only.',
            }
          ),
        };
      }

      this.#logger.info(
        `ApiKeyService._readApiKeyFromFile: Successfully retrieved API key for llmId '${llmId}' from '${fullPath}'.`
      );
      return { key: trimmedKey, error: null };
    } catch (error) {
      if (
        error.code === 'ENOENT' ||
        error.code === 'EACCES' ||
        error.code === 'EPERM'
      ) {
        const message = `API key file not found or not readable.`;
        this.#logger.warn(
          `ApiKeyService._readApiKeyFromFile: ${message} Path: '${fullPath}', Code: ${error.code}, for llmId '${llmId}'.`
        );
        return {
          key: null,
          error: this._createErrorDetails(
            message,
            'api_key_file_not_found_or_unreadable',
            {
              llmId,
              attemptedFile: fullPath,
              reason: `File system error code: ${error.code}`,
            },
            error
          ),
        };
      } else {
        const message = `Unexpected error reading API key file.`;
        this.#logger.error(
          `ApiKeyService._readApiKeyFromFile: ${message} Path: '${fullPath}', for llmId '${llmId}'. Error: ${error.message}`,
          {
            errorCode: error.code,
            errorName: error.name,
            llmId,
            originalError: error,
          }
        );
        return {
          key: null,
          error: this._createErrorDetails(
            message,
            'api_key_file_read_exception',
            {
              llmId,
              attemptedFile: fullPath,
              reason: 'Unexpected file system/read error.',
            },
            error
          ),
        };
      }
    }
  }

  /**
   * Retrieves the API key for a given LLM configuration and ID.
   * @param {LLMModelConfig} llmModelConfig - The configuration for the LLM.
   * @param {string} llmId - The ID of the LLM.
   * @returns {Promise<ApiKeyResult>} An object containing the API key, error details (if any), and the source of the key.
   */
  async getApiKey(llmModelConfig, llmId) {
    if (!this.isApiKeyRequired(llmModelConfig)) {
      this.#logger.info(
        `ApiKeyService.getApiKey: API key not required for llmId '${llmId}' (apiType: ${llmModelConfig?.apiType}).`
      );
      return {
        apiKey: null,
        errorDetails: null,
        source: 'Not applicable (local LLM or no key needed)',
      };
    }

    this.#logger.info(
      `ApiKeyService.getApiKey: Attempting API key retrieval for cloud service llmId '${llmId}'.`
    );

    let actualApiKey = null;
    let apiKeySource = 'N/A';
    /** @type {StandardizedErrorObject|null} */
    let finalErrorDetails = null;

    const { apiKeyEnvVar, apiKeyFileName } = llmModelConfig;
    const envVarName = apiKeyEnvVar?.trim();
    const fileName = apiKeyFileName?.trim();

    // 1. Environment Variable Check
    if (envVarName) {
      this.#logger.debug(
        `ApiKeyService.getApiKey: Checking environment variable '${envVarName}' for llmId '${llmId}'.`
      );
      const envValue = process.env[envVarName];
      if (envValue && envValue.trim() !== '') {
        actualApiKey = envValue.trim();
        apiKeySource = `environment variable '${envVarName}'`;
        this.#logger.info(
          `ApiKeyService.getApiKey: Successfully retrieved API key for llmId '${llmId}' from ${apiKeySource}.`
        );
      } else {
        this.#logger.warn(
          `ApiKeyService.getApiKey: Environment variable '${envVarName}' for llmId '${llmId}' is not set or is empty.`
        );
        // Do not set finalErrorDetails yet, file might be a fallback.
        // But we can prepare a potential error if this ends up being the only source.
        finalErrorDetails = this._createErrorDetails(
          `Environment variable for API key not set or empty.`,
          'api_key_env_var_not_set_or_empty',
          { llmId, attemptedEnvVar: envVarName }
        );
      }
    }

    // 2. File-Based Key Check (if no key from env var and apiKeyFileName is configured)
    if (!actualApiKey && fileName) {
      this.#logger.debug(
        `ApiKeyService.getApiKey: Attempting to retrieve key from file '${fileName}' for llmId '${llmId}' (env var '${envVarName || 'N/A'}' failed or not configured).`
      );
      const projectRootPath =
        this.#appConfigService.getProxyProjectRootPathForApiKeyFiles();

      if (!projectRootPath || projectRootPath.trim() === '') {
        const message = `PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set. Cannot access API key file.`;
        this.#logger.error(
          `ApiKeyService.getApiKey: ${message} For llmId '${llmId}', attempted file '${fileName}'.`
        );
        finalErrorDetails = this._createErrorDetails(
          message,
          'api_key_retrieval_file_root_path_missing',
          {
            llmId,
            attemptedFile: fileName,
            reason:
              'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable not set.',
          }
        );
        // This is a terminal error for file-based retrieval path.
      } else {
        const fileReadResult = await this._readApiKeyFromFile(
          fileName,
          projectRootPath,
          llmId
        );
        if (fileReadResult.key) {
          actualApiKey = fileReadResult.key;
          apiKeySource = `file '${fileName}'`;
          this.#logger.info(
            `ApiKeyService.getApiKey: Successfully retrieved API key for llmId '${llmId}' from ${apiKeySource}.`
          );
          finalErrorDetails = null; // Clear previous error (like env var not found) if file succeeds
        } else {
          // _readApiKeyFromFile returned an error.
          // It also logs its own specific errors, so here we just assign its error object.
          // The error from _readApiKeyFromFile already includes llmId.
          finalErrorDetails = fileReadResult.error; // This will be one of api_key_file_empty, api_key_file_not_found_or_unreadable, or api_key_file_read_exception
        }
      }
    }

    // 3. Result Consolidation
    if (actualApiKey) {
      return { apiKey: actualApiKey, errorDetails: null, source: apiKeySource };
    }

    // If no API key, determine the final error message and stage
    // finalErrorDetails might be set from env var failure (if no file fallback) or file failure.

    const noEnvVarConfigured = !envVarName;
    const noFileConfigured = !fileName;

    if (noEnvVarConfigured && noFileConfigured) {
      // This case should ideally be caught by a schema validation of llmModelConfig earlier,
      // but as a safeguard for ApiKeyService:
      finalErrorDetails = this._createErrorDetails(
        `No API key source (apiKeyEnvVar or apiKeyFileName) configured for cloud LLM.`,
        'api_key_config_sources_missing',
        {
          llmId,
          reason:
            'LLM configuration for this cloud service does not specify how to obtain an API key.',
        }
      );
    } else if (envVarName && !actualApiKey && noFileConfigured) {
      // Env var was the only source, and it failed. finalErrorDetails should already be set from env var check.
      // If finalErrorDetails is somehow null, create a generic one.
      if (!finalErrorDetails) {
        finalErrorDetails = this._createErrorDetails(
          `Failed to retrieve API key from environment variable, and no file fallback was configured.`,
          'api_key_env_var_fail_no_fallback',
          { llmId, attemptedEnvVar: envVarName }
        );
      }
    } else if (fileName && !actualApiKey && noEnvVarConfigured) {
      // File was the only source, and it failed. finalErrorDetails should be set from file read attempt.
      // If finalErrorDetails is somehow null (e.g., _readApiKeyFromFile had an issue not returning an error object), create one.
      if (!finalErrorDetails) {
        finalErrorDetails = this._createErrorDetails(
          `Failed to retrieve API key from file, and no environment variable fallback was configured.`,
          'api_key_file_fail_no_env_fallback',
          {
            llmId,
            attemptedFile: fileName,
            reason:
              'File retrieval failed (specific reason might be in earlier logs from _readApiKeyFromFile).',
          }
        );
      }
    } else if (envVarName && fileName && !actualApiKey) {
      // Both env var and file were configured, and both failed.
      // finalErrorDetails would be from the file attempt (the last attempt).
      // We'll make the message more comprehensive.
      const combinedReason = `Environment variable '${envVarName}' was not set or empty. File '${fileName}' retrieval also failed (Reason: ${finalErrorDetails?.details?.reason || finalErrorDetails?.message || 'see previous logs'}).`;
      finalErrorDetails = this._createErrorDetails(
        `Failed to retrieve API key. All configured sources (environment variable and file) failed.`,
        'api_key_all_sources_failed',
        {
          llmId,
          attemptedEnvVar: envVarName,
          attemptedFile: fileName,
          reason: combinedReason,
          originalErrorMessage:
            finalErrorDetails?.details?.originalErrorMessage,
        }
      );
    } else if (!finalErrorDetails) {
      // Fallback for any unhandled case where key is still null but no specific error was set.
      // This case indicates a logic flaw if reached.
      this.#logger.error(
        `ApiKeyService.getApiKey: Reached unexpected state for llmId '${llmId}'. API key is null, but no specific error was set. This should not happen.`
      );
      finalErrorDetails = this._createErrorDetails(
        `API key for LLM could not be retrieved due to an unknown internal error.`,
        'api_key_retrieval_unknown_error',
        {
          llmId,
          attemptedEnvVar: envVarName || 'N/A',
          attemptedFile: fileName || 'N/A',
        }
      );
    }

    // Log the final consolidated error before returning (if not already logged by _createErrorDetails in the exact same way)
    // _createErrorDetails now handles its own logging, so an additional log here might be redundant unless context changes.
    // For now, relying on logging within _createErrorDetails and _readApiKeyFromFile.

    return { apiKey: null, errorDetails: finalErrorDetails, source: 'N/A' };
  }
}
