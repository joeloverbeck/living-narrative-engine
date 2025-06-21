// src/llms/strategies/base/baseOpenRouterStrategy.js
// --- FILE START ---
import { BaseChatLLMStrategy } from './baseChatLLMStrategy.js';
import { ConfigurationError } from '../../../errors/configurationError';
import { LLMStrategyError } from '../../errors/llmStrategyError.js';
import { logPreview } from '../../../utils/index.js';
// Assuming HttpClientError might be a specific type, if not, general Error is caught.
// For actual HttpClientError type, it would be imported from its definition:
// import { HttpClientError } from '../../retryHttpClient.js'; // Example path

/**
 * @typedef {import('../../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../../interfaces/ILLMStrategy.js').LLMStrategyExecuteParams} LLMStrategyExecuteParams
 * @typedef {import('../../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @class BaseOpenRouterStrategy
 * @augments {BaseChatLLMStrategy}
 * @description Abstract base strategy for OpenRouter compatible APIs.
 * Concrete strategies (e.g., for JSON Schema mode or Tool Calling mode) will extend this class.
 * This class handles the common logic for interacting with OpenRouter, including
 * API key management, request payload construction, and basic error handling.
 */
export class BaseOpenRouterStrategy extends BaseChatLLMStrategy {
  /**
   * @private
   * @type {IHttpClient}
   */
  #httpClient;

  /**
   * Constructs an instance of BaseOpenRouterStrategy.
   *
   * @param {object} deps - The dependencies object.
   * @param {IHttpClient} deps.httpClient - The HTTP client for making API requests.
   * @param {ILogger} deps.logger - The logger instance.
   * @throws {Error} If httpClient dependency is not provided.
   * (Logger validity is ensured by BaseLLMStrategy's constructor via super(logger) call)
   */
  constructor({ httpClient, logger }) {
    super(logger); // Pass logger to the BaseChatLLMStrategy constructor (which passes to BaseLLMStrategy)

    if (!httpClient) {
      const errorMsg = `${this.constructor.name}: httpClient dependency is required.`;
      // this.logger is guaranteed to be valid here if super(logger) didn't throw.
      this.logger.error(errorMsg);
      throw new Error(errorMsg); // Consider ConfigurationError if appropriate for missing core deps
    }
    this.#httpClient = httpClient;
    this.logger.debug(`${this.constructor.name} initialized.`);
  }

  /**
   * Abstract method to construct the provider-specific parts of the request payload
   * that are unique to the OpenRouter strategy variant (e.g., JSON schema or tool calling).
   * Subclasses MUST override this method.
   *
   * @protected
   * @abstract
   * @param {object} baseMessagesPayload - The payload containing the 'messages' array,
   * as constructed by _constructPromptPayload from BaseChatLLMStrategy.
   * @param {LLMModelConfig} llmConfig - The full LLM configuration object.
   * @returns {object} An object containing the strategy-specific additions to be merged
   * into the main request payload.
   * @throws {Error} This base implementation throws an error if not overridden by a subclass.
   */
  _buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig) {
    const errorMessage = `${this.constructor.name}._buildProviderRequestPayloadAdditions: Method not implemented. Subclasses must override this method.`;
    const llmId = llmConfig?.configId || 'UnknownLLM';
    this.logger.error(errorMessage, { llmId });
    throw new Error(errorMessage); // Or potentially an LLMStrategyError
  }

  /**
   * Abstract method to extract the JSON string from the LLM's response based on
   * the specific OpenRouter strategy's expectations (e.g., from message.content or tool_calls).
   * Subclasses MUST override this method.
   *
   * @protected
   * @abstract
   * @async
   * @param {any} responseData - The raw response data from the HTTP client.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {object} [_providerRequestPayload] - The full request payload sent to the provider.
   * @returns {Promise<string | null>} A promise that resolves to the extracted JSON string or null.
   * @throws {Error} This base implementation throws an error if not overridden by a subclass.
   */
  async _extractJsonOutput(responseData, llmConfig, _providerRequestPayload) {
    const errorMessage = `${this.constructor.name}._extractJsonOutput: Method not implemented. Subclasses must override this method.`;
    const llmId = llmConfig?.configId || 'UnknownLLM';
    this.logger.error(errorMessage, { llmId });
    throw new Error(errorMessage); // Or potentially an LLMStrategyError
  }

  /**
   * Validates parameters passed to {@link execute} and returns the LLM id.
   *
   * @private
   * @param {LLMStrategyExecuteParams} params - The execution parameters.
   * @returns {{ llmId: string }} The resolved LLM identifier.
   * @throws {ConfigurationError} If required parameters are missing or invalid.
   */
  #validateExecuteParams({ llmConfig, environmentContext }) {
    if (!llmConfig) {
      const errorMsg = `${this.constructor.name}: Missing llmConfig. Cannot proceed.`;
      this.logger.error(errorMsg);
      throw new ConfigurationError(errorMsg, {
        llmId: 'Unknown (llmConfig missing)',
      });
    }

    const llmId = llmConfig.configId || 'UnknownLLM';

    if (!environmentContext) {
      const errorMsg = `${this.constructor.name} (${llmId}): Missing environmentContext. Cannot proceed.`;
      this.logger.error(errorMsg, { llmId });
      throw new ConfigurationError(errorMsg, { llmId });
    }

    this.logger.debug(
      `${this.constructor.name}.execute called for LLM ID: ${llmId}.`
    );

    if (llmConfig.apiType !== 'openrouter') {
      const errorMsg = `${this.constructor.name} (${llmId}): Invalid apiType '${llmConfig.apiType}'. This strategy is specific to 'openrouter'.`;
      this.logger.error(errorMsg, {
        llmId,
        problematicField: 'apiType',
        fieldValue: llmConfig.apiType,
      });
      throw new ConfigurationError(errorMsg, {
        llmId,
        problematicField: 'apiType',
        fieldValue: llmConfig.apiType,
      });
    }

    return { llmId };
  }

  /**
   * Builds the provider payload from the prompt payload and strategy additions.
   *
   * @private
   * @param {string} gameSummary - The game summary text.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {string} llmId - Identifier of the LLM for logging.
   * @returns {{ providerRequestPayload: object }} The payload sent to the provider.
   */
  #buildProviderPayload(gameSummary, llmConfig, llmId) {
    const baseMessagesPayload = this._constructPromptPayload(
      gameSummary,
      llmConfig
    );

    this.logger.debug(
      `${this.constructor.name} (${llmId}): Constructed base prompt payload:`,
      {
        llmId,
        messagesPreview: baseMessagesPayload.messages.map((m) => ({
          role: m.role,
          contentPreview:
            typeof m.content === 'string'
              ? m.content.substring(0, 70) +
                (m.content.length > 70 ? '...' : '')
              : m.content === null || m.content === undefined
                ? '[content is null/undefined]'
                : Array.isArray(m.content)
                  ? '[content is an array (e.g., vision input)]'
                  : '[content not a simple string]',
        })),
      }
    );

    const providerSpecificPayloadAdditions =
      this._buildProviderRequestPayloadAdditions(
        baseMessagesPayload,
        llmConfig
      );
    this.logger.debug(
      `${this.constructor.name} (${llmId}): Received provider-specific payload additions.`,
      {
        llmId,
        providerSpecificPayloadAdditions,
      }
    );

    const providerRequestPayload = {
      ...(llmConfig.defaultParameters || {}),
      model: llmConfig.modelIdentifier,
      ...baseMessagesPayload,
      ...providerSpecificPayloadAdditions,
    };
    this.logger.debug(
      `${this.constructor.name} (${llmId}): Assembled provider request payload.`,
      {
        llmId,
        keys: Object.keys(providerRequestPayload),
      }
    );

    return { providerRequestPayload };
  }

  /**
   * Prepares HTTP request details for the provider call.
   *
   * @private
   * @param {object} providerRequestPayload - The payload for the provider.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {string} apiKey - API key for direct calls.
   * @param {EnvironmentContext} environmentContext - The environment context.
   * @param {string} llmId - Identifier of the LLM for logging.
   * @returns {{ targetUrl: string, finalPayload: object, headers: object }}
   * The URL, payload, and headers for the HTTP request.
   * @throws {ConfigurationError} If the API key is missing when required.
   */
  #prepareHttpRequest(
    providerRequestPayload,
    llmConfig,
    apiKey,
    environmentContext,
    llmId
  ) {
    let targetUrl = llmConfig.endpointUrl;
    let finalPayload = providerRequestPayload;
    const headers = {
      'Content-Type': 'application/json',
      ...(llmConfig.providerSpecificHeaders || {}),
    };

    if (environmentContext.isClient()) {
      targetUrl = environmentContext.getProxyServerUrl();
      finalPayload = {
        llmId: llmConfig.configId,
        targetPayload: providerRequestPayload,
        targetHeaders: llmConfig.providerSpecificHeaders || {},
      };
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Client-side execution. Using proxy URL: ${targetUrl}. Payload prepared according to proxy API contract.`,
        { llmId }
      );
    } else {
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        this.logger.debug(
          `${this.constructor.name} (${llmId}): Server-side/direct execution. Authorization header set using provided API key.`,
          { llmId }
        );
      } else {
        const errorMsg = `${this.constructor.name} (${llmId}): API key is missing for server-side/direct OpenRouter call. An API key must be configured and provided.`;
        this.logger.error(errorMsg, { llmId, problematicField: 'apiKey' });
        throw new ConfigurationError(errorMsg, {
          llmId,
          problematicField: 'apiKey',
        });
      }
    }

    return { targetUrl, finalPayload, headers };
  }

  /**
   * Handles the HTTP request/response cycle and JSON extraction.
   *
   * @private
   * @async
   * @param {string} targetUrl - The request URL.
   * @param {object} finalPayload - Payload to send.
   * @param {object} headers - Request headers.
   * @param {object} providerRequestPayload - Original provider payload for logging.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {string} llmId - Identifier of the LLM for logging.
   * @returns {Promise<string>} Extracted JSON string.
   * @throws {LLMStrategyError|ConfigurationError} On request or processing failure.
   */
  async #handleResponse(
    targetUrl,
    finalPayload,
    headers,
    providerRequestPayload,
    llmConfig,
    llmId
  ) {
    let responseData;
    try {
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Making API call to '${targetUrl}'. Payload length: ${JSON.stringify(finalPayload)?.length}`,
        { llmId }
      );
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Final prompt to be sent to '${targetUrl}':`,
        {
          llmId,
          payload: JSON.stringify(finalPayload, null, 2),
        }
      );

      responseData = await this.#httpClient.request(targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(finalPayload),
      });

      logPreview(
        this.logger,
        `${this.constructor.name} (${llmId}): Raw API response received. Preview: `,
        JSON.stringify(responseData),
        250
      );

      const extractedJsonString = await this._extractJsonOutput(
        responseData,
        llmConfig,
        providerRequestPayload
      );

      if (
        extractedJsonString !== null &&
        typeof extractedJsonString === 'string' &&
        extractedJsonString.trim() !== ''
      ) {
        this.logger.debug(
          `${this.constructor.name} (${llmId}): Successfully extracted JSON string. Length: ${extractedJsonString.length}.`,
          { llmId }
        );
        return extractedJsonString;
      }

      const errorMsg = `${this.constructor.name} (${llmId}): Failed to extract usable JSON content from OpenRouter response. _extractJsonOutput returned null, empty, or non-string.`;
      this.logger.error(errorMsg, {
        llmId,
        responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
        returnedValue: extractedJsonString,
      });
      throw new LLMStrategyError(errorMsg, llmId, null, {
        responsePreview: JSON.stringify(responseData)?.substring(0, 500),
      });
    } catch (error) {
      if (
        error instanceof ConfigurationError ||
        error instanceof LLMStrategyError
      ) {
        throw error;
      }

      const isHttpClientError =
        error.name === 'HttpClientError' ||
        (Object.prototype.hasOwnProperty.call(error, 'status') &&
          Object.prototype.hasOwnProperty.call(error, 'response') &&
          Object.prototype.hasOwnProperty.call(error, 'url'));

      let finalError;
      if (isHttpClientError) {
        this.logger.error(
          `${this.constructor.name} (${llmId}): HttpClientError occurred during API call to '${targetUrl}'. Status: ${error.status || 'N/A'}. Message: ${error.message}`,
          {
            llmId,
            originalErrorName: error.name,
            originalErrorMessage: error.message,
            status: error.status,
            responseBody: error.response,
            url: targetUrl,
          }
        );
        finalError = error;
      } else {
        const errMsg = `${this.constructor.name} (${llmId}): An unexpected error occurred during API call or response processing for endpoint '${targetUrl}'. Original message: ${error.message}`;
        this.logger.error(errMsg, {
          llmId,
          originalErrorName: error.name,
          originalErrorMessage: error.message,
          requestUrl: targetUrl,
          payloadPreview:
            JSON.stringify(providerRequestPayload)?.substring(0, 200) + '...',
        });
        finalError = new LLMStrategyError(errMsg, llmId, error, {
          requestUrl: targetUrl,
          payloadPreview:
            JSON.stringify(providerRequestPayload)?.substring(0, 200) + '...',
        });
      }
      throw finalError;
    }
  }

  /**
   * Executes the OpenRouter strategy.
   *
   * @param {LLMStrategyExecuteParams} params - The parameters for LLM execution.
   * @returns {Promise<string>} A promise that resolves to the extracted JSON string.
   * @throws {ConfigurationError} If there's a configuration issue.
   * @throws {LLMStrategyError} If there's an error during strategy execution.
   */
  async execute(params) {
    const { gameSummary, llmConfig, apiKey, environmentContext } = params;

    const { llmId } = this.#validateExecuteParams({
      llmConfig,
      environmentContext,
    });

    const { providerRequestPayload } = this.#buildProviderPayload(
      gameSummary,
      llmConfig,
      llmId
    );

    const { targetUrl, finalPayload, headers } = this.#prepareHttpRequest(
      providerRequestPayload,
      llmConfig,
      apiKey,
      environmentContext,
      llmId
    );

    return this.#handleResponse(
      targetUrl,
      finalPayload,
      headers,
      providerRequestPayload,
      llmConfig,
      llmId
    );
  }
}

// --- FILE END ---
