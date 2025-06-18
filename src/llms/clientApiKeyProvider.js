// src/llms/clientApiKeyProvider.js
// --- FILE START ---

import { IApiKeyProvider } from './interfaces/IApiKeyProvider.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from '../utils/dispatcherUtils.js';
import { initLogger } from '../utils/index.js';
import { CLOUD_API_TYPES } from './constants/llmConstants.js';

/**
 * @typedef {import('./environmentContext.js').EnvironmentContext} EnvironmentContext
 * @typedef {import('./services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 */

/**
 * @class ClientApiKeyProvider
 * @implements {IApiKeyProvider}
 * @description Validates LLM configuration for client-side execution where API keys are handled by a proxy.
 * This provider does not fetch or expose API keys directly in the client environment. Instead, it ensures
 * that the necessary identifiers (apiKeyEnvVar or apiKeyFileName) are present in the LLMModelConfig,
 * which a backend proxy server would use to retrieve the actual API key.
 */
export class ClientApiKeyProvider extends IApiKeyProvider {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher}
   */
  #dispatcher;

  /**
   * Creates an instance of ClientApiKeyProvider.
   *
   * @param {object} params - The parameters for the ClientApiKeyProvider.
   * @param {ILogger} params.logger - An instance conforming to ILogger for internal logging.
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} params.safeEventDispatcher
   *        - Dispatcher used for error reporting.
   * @throws {Error} If logger or dispatcher is invalid.
   */
  constructor({ logger, safeEventDispatcher }) {
    super();

    this.#logger = initLogger('ClientApiKeyProvider', logger);
    this.#dispatcher = resolveSafeDispatcher(
      null,
      safeEventDispatcher,
      this.#logger
    );
    if (!this.#dispatcher) {
      console.warn(
        'ClientApiKeyProvider: safeEventDispatcher resolution failed; errors may not be reported.'
      );
    }
    this.#logger.debug('ClientApiKeyProvider: Instance created.');
  }

  /**
   * Validates LLM configuration for client-side proxy setup.
   * This method does NOT return an API key. It always returns null.
   * Its primary purpose is to check if cloud service LLM configurations
   * contain the necessary pointers (apiKeyEnvVar or apiKeyFileName)
   * for a backend proxy to retrieve the actual key.
   *
   * @async
   * @param {LLMModelConfig} llmConfig - Configuration for the LLM.
   * @param {EnvironmentContext} environmentContext - Context about the execution environment.
   * @returns {Promise<string | null>} A Promise that always resolves to null.
   */
  async getKey(llmConfig, environmentContext) {
    // MODIFICATION START: Use llmConfig.configId
    const llmId = llmConfig?.configId || 'UnknownLLM'; // For logging context
    // MODIFICATION END

    if (
      !environmentContext ||
      typeof environmentContext.isClient !== 'function'
    ) {
      safeDispatchError(
        this.#dispatcher,
        `ClientApiKeyProvider.getKey (${llmId}): Invalid environmentContext provided.`,
        { providedValue: environmentContext }
      );
      return null;
    }

    if (!environmentContext.isClient()) {
      this.#logger.warn(
        `ClientApiKeyProvider.getKey (${llmId}): Attempted to use in a non-client environment. This provider is only for client-side execution. Environment: ${environmentContext.getExecutionEnvironment()}`
      );
      return null;
    }

    if (!llmConfig) {
      safeDispatchError(
        this.#dispatcher,
        `ClientApiKeyProvider.getKey (${llmId}): llmConfig is null or undefined.`,
        { providedValue: llmConfig }
      );
      return null;
    }

    const apiType = llmConfig.apiType;

    if (
      apiType &&
      typeof apiType === 'string' &&
      CLOUD_API_TYPES.includes(apiType.toLowerCase())
    ) {
      const hasApiKeyEnvVar =
        llmConfig.apiKeyEnvVar &&
        typeof llmConfig.apiKeyEnvVar === 'string' &&
        llmConfig.apiKeyEnvVar.trim() !== '';
      const hasApiKeyFileName =
        llmConfig.apiKeyFileName &&
        typeof llmConfig.apiKeyFileName === 'string' &&
        llmConfig.apiKeyFileName.trim() !== '';

      if (!hasApiKeyEnvVar && !hasApiKeyFileName) {
        safeDispatchError(
          this.#dispatcher,
          `ClientApiKeyProvider.getKey (${llmId}): Configuration for cloud service '${apiType}' is missing both 'apiKeyEnvVar' and 'apiKeyFileName'. The proxy server will be unable to retrieve the API key. This is a configuration issue.`,
          { apiType }
        );
      } else {
        this.#logger.debug(
          `ClientApiKeyProvider.getKey (${llmId}): Configuration for cloud service '${apiType}' has required key identifier(s) for proxy usage (apiKeyEnvVar: '${llmConfig.apiKeyEnvVar || 'N/A'}', apiKeyFileName: '${llmConfig.apiKeyFileName || 'N/A'}').`
        );
      }
    } else if (apiType && typeof apiType === 'string') {
      this.#logger.debug(
        `ClientApiKeyProvider.getKey (${llmId}): LLM apiType '${apiType}' is not listed as a cloud service requiring proxy key identifier validation. Skipping checks.`
      );
    } else {
      // This case implies llmConfig.apiType is missing or invalid, which might be an issue itself,
      // but the primary role here is to check cloud services.
      // A more general dependencyInjection validation might catch missing/invalid apiType elsewhere.
      this.#logger.debug(
        `ClientApiKeyProvider.getKey (${llmId}): LLM apiType is missing or not a string. Assuming non-cloud or misconfigured. Skipping key identifier checks.`
      );
    }

    return null; // Always returns null as per requirements.
  }
}

// --- FILE END ---
