// src/llms/ServerApiKeyProvider.js
// --- MODIFIED FILE START ---

import { IApiKeyProvider } from './interfaces/IApiKeyProvider.js';
import * as path from 'node:path'; // Corrected import style
import {
  IFileSystemReader,
  IEnvironmentVariableReader,
} from '../../llm-proxy-server/src/utils/IServerUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from '../utils/dispatcherUtils.js';
import { initLogger } from '../utils/index.js';
import { isValidEnvironmentContext } from './environmentContext.js';

/**
 * @typedef {import('./environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('./services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

export class ServerApiKeyProvider extends IApiKeyProvider {
  #logger;
  #fileSystemReader;
  #environmentVariableReader;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @private
   * Reads an API key from an environment variable.
   * @param {string} varName - The name of the environment variable.
   * @param {string} llmId - The identifier of the LLM for logging.
   * @returns {string | null} The trimmed API key if found and non-empty; otherwise null.
   */
  #readKeyFromEnv(varName, llmId) {
    this.#logger.debug(
      `ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from environment variable '${varName}'.`
    );
    try {
      const keyFromEnv = this.#environmentVariableReader.getEnv(varName);
      if (keyFromEnv !== undefined) {
        if (keyFromEnv.trim() !== '') {
          this.#logger.debug(
            `ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from environment variable '${varName}'.`
          );
          return keyFromEnv.trim();
        }
        this.#logger.warn(
          `ServerApiKeyProvider.getKey (${llmId}): Environment variable '${varName}' found but is empty or contains only whitespace.`
        );
      } else {
        this.#logger.debug(
          `ServerApiKeyProvider.getKey (${llmId}): Environment variable '${varName}' not found or not set.`
        );
      }
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `ServerApiKeyProvider.getKey (${llmId}): Error while reading environment variable '${varName}'. Error: ${error.message}`,
        { error }
      );
    }
    return null;
  }

  /**
   * @private
   * Reads an API key from a file on disk.
   * @param {string} fileName - The file name configured in the model config.
   * @param {string} projectRoot - The absolute project root path.
   * @param {string} llmId - The identifier of the LLM for logging.
   * @returns {Promise<string | null>} The trimmed API key if retrieved, otherwise null.
   */
  async #readKeyFromFile(fileName, projectRoot, llmId) {
    this.#logger.debug(
      `ServerApiKeyProvider.getKey (${llmId}): Attempting to retrieve API key from file '${fileName}'.`
    );

    if (
      !projectRoot ||
      typeof projectRoot !== 'string' ||
      projectRoot.trim() === ''
    ) {
      safeDispatchError(
        this.#dispatcher,
        `ServerApiKeyProvider.getKey (${llmId}): Cannot retrieve key from file '${fileName}' because projectRootPath is missing or invalid in EnvironmentContext.`
      );
      return null;
    }

    const safeBaseName = path.basename(fileName);
    if (safeBaseName !== fileName) {
      this.#logger.warn(
        `ServerApiKeyProvider.getKey (${llmId}): Provided apiKeyFileName '${fileName}' was sanitized to '${safeBaseName}' to prevent path traversal. Ensure apiKeyFileName is just the file's name.`
      );
    }
    const fullPath = path.join(projectRoot, safeBaseName);

    try {
      const keyFromFile = await this.#fileSystemReader.readFile(
        fullPath,
        'utf-8'
      );
      if (keyFromFile.trim() !== '') {
        this.#logger.debug(
          `ServerApiKeyProvider.getKey (${llmId}): Successfully retrieved API key from file '${fullPath}'.`
        );
        return keyFromFile.trim();
      }
      this.#logger.warn(
        `ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' found but is empty or contains only whitespace.`
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.#logger.warn(
          `ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' not found. Error: ${error.message}`
        );
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        this.#logger.warn(
          `ServerApiKeyProvider.getKey (${llmId}): API key file '${fullPath}' not readable due to permissions. Error: ${error.message}`
        );
      } else {
        safeDispatchError(
          this.#dispatcher,
          `ServerApiKeyProvider.getKey (${llmId}): Unexpected error while reading API key file '${fullPath}'. Error: ${error.message}`,
          { errorCode: error.code, errorDetails: error }
        );
      }
    }
    return null;
  }

  constructor({
    logger,
    fileSystemReader,
    environmentVariableReader,
    safeEventDispatcher,
  }) {
    super();
    this.#logger = initLogger('ServerApiKeyProvider', logger);
    this.#dispatcher = resolveSafeDispatcher(
      null,
      safeEventDispatcher,
      this.#logger
    );
    if (!this.#dispatcher) {
      console.warn(
        'ServerApiKeyProvider: safeEventDispatcher resolution failed; key errors may not be reported.'
      );
    }
    if (!fileSystemReader || typeof fileSystemReader.readFile !== 'function') {
      const errorMsg =
        'ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance that implements IFileSystemReader (must have an async readFile method).';
      safeDispatchError(this.#dispatcher, errorMsg);
      throw new Error(errorMsg);
    }
    this.#fileSystemReader = fileSystemReader;
    if (
      !environmentVariableReader ||
      typeof environmentVariableReader.getEnv !== 'function'
    ) {
      const errorMsg =
        'ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance that implements IEnvironmentVariableReader (must have a getEnv method).';
      safeDispatchError(this.#dispatcher, errorMsg);
      throw new Error(errorMsg);
    }
    this.#environmentVariableReader = environmentVariableReader;
    this.#logger.debug(
      'ServerApiKeyProvider: Instance created and dependencies stored.'
    );
  }

  async getKey(llmConfig, environmentContext) {
    const llmId = llmConfig?.id || 'UnknownLLM';

    if (!isValidEnvironmentContext(environmentContext)) {
      safeDispatchError(
        this.#dispatcher,
        `ServerApiKeyProvider.getKey (${llmId}): Invalid environmentContext provided.`,
        { providedValue: environmentContext }
      );
      return null;
    }

    if (!environmentContext.isServer()) {
      this.#logger.warn(
        `ServerApiKeyProvider.getKey (${llmId}): Attempted to use in a non-server environment. This provider is only for server-side execution. Environment: ${environmentContext.getExecutionEnvironment()}`
      );
      return null;
    }

    const envVarName =
      typeof llmConfig?.apiKeyEnvVar === 'string' &&
      llmConfig.apiKeyEnvVar.trim()
        ? llmConfig.apiKeyEnvVar.trim()
        : null;
    const fileName =
      typeof llmConfig?.apiKeyFileName === 'string' &&
      llmConfig.apiKeyFileName.trim()
        ? llmConfig.apiKeyFileName.trim()
        : null;

    let retrievedApiKey = null;
    if (envVarName) {
      retrievedApiKey = this.#readKeyFromEnv(envVarName, llmId);
    } else {
      this.#logger.debug(
        `ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyEnvVar' specified in llmConfig or it's empty. Skipping environment variable retrieval.`
      );
    }

    if (!retrievedApiKey && fileName) {
      retrievedApiKey = await this.#readKeyFromFile(
        fileName,
        environmentContext.getProjectRootPath(),
        llmId
      );
    } else if (!retrievedApiKey && !fileName) {
      this.#logger.debug(
        `ServerApiKeyProvider.getKey (${llmId}): No 'apiKeyFileName' specified in llmConfig or it's empty. Skipping file retrieval.`
      );
    } else if (retrievedApiKey && fileName) {
      this.#logger.debug(
        `ServerApiKeyProvider.getKey (${llmId}): API key already found from environment variable. Skipping file retrieval for '${fileName}'.`
      );
    }

    if (retrievedApiKey) {
      return retrievedApiKey;
    }

    if (!envVarName && !fileName) {
      this.#logger.warn(
        `ServerApiKeyProvider.getKey (${llmId}): Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified in the LLM configuration. Unable to retrieve API key.`
      );
    } else {
      this.#logger.debug(
        `ServerApiKeyProvider.getKey (${llmId}): API key not found through any configured method (environment variable or file).`
      );
    }
    return null;
  }
}

// --- MODIFIED FILE END ---
