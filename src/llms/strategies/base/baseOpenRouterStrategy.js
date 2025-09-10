// src/llms/strategies/base/baseOpenRouterStrategy.js
// --- FILE START ---
import { BaseChatLLMStrategy } from './baseChatLLMStrategy.js';
import { ConfigurationError } from '../../../errors/configurationError.js';
import { LLMStrategyError } from '../../errors/LLMStrategyError.js';
import { logPreview } from '../../../utils/index.js';
import { getLlmId, validateEnvironmentContext } from '../../utils/llmUtils.js';
import { DefaultToolSchemaHandler } from '../toolSchemaHandlers/defaultToolSchemaHandler.js';
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
   * @private
   * @type {DefaultToolSchemaHandler}
   */
  #toolSchemaHandler;

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

    // Initialize the default tool schema handler
    this.#toolSchemaHandler = new DefaultToolSchemaHandler({ logger });

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
   * @param {object} [_requestOptions] - Optional request-specific options.
   * @returns {object} An object containing the strategy-specific additions to be merged
   * into the main request payload.
   * @throws {Error} This base implementation throws an error if not overridden by a subclass.
   */
  _buildProviderRequestPayloadAdditions(
    baseMessagesPayload,
    llmConfig,
    _requestOptions = {}
  ) {
    const errorMessage = `${this.constructor.name}._buildProviderRequestPayloadAdditions: Method not implemented. Subclasses must override this method.`;
    const llmId = getLlmId(llmConfig);
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
    const llmId = getLlmId(llmConfig);
    this.logger.error(errorMessage, { llmId });
    throw new Error(errorMessage); // Or potentially an LLMStrategyError
  }

  /**
   * Default implementation of buildToolSchema for OpenRouter strategies.
   * Uses the default tool schema handler to provide backward compatibility.
   * Strategies that need custom tool schema logic should override this method.
   *
   * @param {Array<object>} tools - Array of tool definitions to generate schema for
   * @param {object} [requestOptions] - Optional request-specific options that may affect schema generation
   * @returns {object|null} Tool schema object using default handler, or null if no tools provided
   */
  buildToolSchema(tools, requestOptions = {}) {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return null;
    }

    // For OpenRouter strategies, we typically use a single tool
    // Use the first tool or default to game AI action
    const llmId = 'unknown'; // This would be provided by the calling context in practice

    try {
      return this.#toolSchemaHandler.buildDefaultToolSchema(
        llmId,
        requestOptions
      );
    } catch (error) {
      this.logger.error(
        `${this.constructor.name}: Error building default tool schema: ${error.message}`,
        { error: error.message }
      );
      return null;
    }
  }

  /**
   * Default implementation indicates OpenRouter strategies support tool schema customization.
   * Subclasses can override this to indicate if they support custom schema generation.
   *
   * @returns {boolean} True by default for OpenRouter strategies
   */
  requiresCustomToolSchema() {
    return true;
  }

  /**
   * Protected method to access the tool schema handler.
   * Allows subclasses to use the handler for custom tool schema logic.
   *
   * @protected
   * @returns {DefaultToolSchemaHandler} The tool schema handler instance
   */
  _getToolSchemaHandler() {
    return this.#toolSchemaHandler;
  }

  /**
   * Validates parameters passed to {@link BaseOpenRouterStrategy#execute} and returns the LLM id.
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

    const llmId = getLlmId(llmConfig);

    if (!environmentContext) {
      const errorMsg = `${this.constructor.name} (${llmId}): Missing environmentContext. Cannot proceed.`;
      this.logger.error(errorMsg, { llmId });
      throw new ConfigurationError(errorMsg, { llmId });
    }

    validateEnvironmentContext(
      environmentContext,
      `${this.constructor.name} (${llmId})`,
      null,
      this.logger
    );

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
   * @param {object} [requestOptions] - Optional request-specific options.
   * @returns {{ providerRequestPayload: object }} The payload sent to the provider.
   */
  #buildProviderPayload(gameSummary, llmConfig, llmId, requestOptions = {}) {
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
        llmConfig,
        requestOptions
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
      // Merge request-specific LLM parameters (e.g., temperature, max_tokens)
      // These override any defaults from llmConfig.defaultParameters
      ...(requestOptions.temperature !== undefined && {
        temperature: requestOptions.temperature,
      }),
      ...(requestOptions.maxTokens !== undefined && {
        max_tokens: requestOptions.maxTokens,
      }),
      ...(requestOptions.topP !== undefined && { top_p: requestOptions.topP }),
      ...(requestOptions.topK !== undefined && { top_k: requestOptions.topK }),
      ...(requestOptions.frequencyPenalty !== undefined && {
        frequency_penalty: requestOptions.frequencyPenalty,
      }),
      ...(requestOptions.presencePenalty !== undefined && {
        presence_penalty: requestOptions.presencePenalty,
      }),
    };

    // Log if request-specific parameters were applied
    if (
      requestOptions.temperature !== undefined ||
      requestOptions.maxTokens !== undefined
    ) {
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Applied request-specific LLM parameters.`,
        {
          llmId,
          temperature: requestOptions.temperature,
          maxTokens: requestOptions.maxTokens,
          finalTemperature: providerRequestPayload.temperature,
          finalMaxTokens: providerRequestPayload.max_tokens,
        }
      );
    }

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
   * Sends the HTTP request to the provider.
   *
   * @private
   * @async
   * @param {string} targetUrl - The endpoint URL.
   * @param {object} finalPayload - Payload to send.
   * @param {object} headers - Request headers.
   * @param {string} llmId - Identifier of the LLM for logging.
   * @param {AbortSignal} [abortSignal] - Optional abort signal for request cancellation.
   * @returns {Promise<any>} The raw response data.
   */
  async #sendRequest(targetUrl, finalPayload, headers, llmId, abortSignal) {
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

    const responseData = await this.#httpClient.request(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(finalPayload),
      abortSignal,
    });

    logPreview(
      this.logger,
      `${this.constructor.name} (${llmId}): Raw API response received. Preview: `,
      JSON.stringify(responseData),
      250
    );

    return responseData;
  }

  /**
   * Extracts JSON using the subclass implementation.
   *
   * @private
   * @async
   * @param {any} responseData - The raw provider response.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {object} providerPayload - The original provider payload.
   * @returns {Promise<string|null>} Extracted JSON string or null.
   */
  async #extractJson(responseData, llmConfig, providerPayload) {
    return this._extractJsonOutput(responseData, llmConfig, providerPayload);
  }

  /**
   * Logs and wraps unexpected errors.
   *
   * @private
   * @param {Error} error - The thrown error.
   * @param {string} llmId - Identifier of the LLM for logging.
   * @param {string} targetUrl - The endpoint URL.
   * @param {object} providerRequestPayload - Payload used for the request.
   * @throws {LLMStrategyError|Error} Mapped error for the caller.
   */
  #logAndWrapError(error, llmId, targetUrl, providerRequestPayload) {
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
      throw error;
    }

    const errMsg = `${this.constructor.name} (${llmId}): An unexpected error occurred during API call or response processing for endpoint '${targetUrl}'. Original message: ${error.message}`;
    this.logger.error(errMsg, {
      llmId,
      originalErrorName: error.name,
      originalErrorMessage: error.message,
      requestUrl: targetUrl,
      payloadPreview:
        JSON.stringify(providerRequestPayload)?.substring(0, 200) + '...',
    });
    throw new LLMStrategyError(errMsg, llmId, error, {
      requestUrl: targetUrl,
      payloadPreview:
        JSON.stringify(providerRequestPayload)?.substring(0, 200) + '...',
    });
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
   * @param {AbortSignal} [abortSignal] - Optional abort signal for request cancellation.
   * @returns {Promise<string>} Extracted JSON string.
   * @throws {LLMStrategyError|ConfigurationError} On request or processing failure.
   */
  async #handleResponse(
    targetUrl,
    finalPayload,
    headers,
    providerRequestPayload,
    llmConfig,
    llmId,
    abortSignal
  ) {
    let responseData;
    try {
      responseData = await this.#sendRequest(
        targetUrl,
        finalPayload,
        headers,
        llmId,
        abortSignal
      );

      const extractedJsonString = await this.#extractJson(
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
      this.#logAndWrapError(error, llmId, targetUrl, providerRequestPayload);
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
    const {
      gameSummary,
      llmConfig,
      apiKey,
      environmentContext,
      abortSignal,
      requestOptions = {},
    } = params;

    const { llmId } = this.#validateExecuteParams({
      llmConfig,
      environmentContext,
    });

    const { providerRequestPayload } = this.#buildProviderPayload(
      gameSummary,
      llmConfig,
      llmId,
      requestOptions
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
      llmId,
      abortSignal
    );
  }
}

// --- FILE END ---
