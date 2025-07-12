// llm-proxy-server/src/services/llmRequestService.js

import { RetryManager } from '../utils/proxyApiUtils.js';
import { sanitizeErrorForClient } from '../utils/errorFormatter.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_HEADER_AUTHORIZATION,
  AUTH_SCHEME_BEARER_PREFIX,
  HTTP_METHOD_POST,
  PAYLOAD_SANITIZATION_MAX_LENGTH,
  PAYLOAD_SANITIZATION_ELLIPSIS,
} from '../config/constants.js'; // MODIFIED: Import constants
import HttpAgentService from './httpAgentService.js';

/**
 * @typedef {import('../config/llmConfigService.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} ErrorDetailsForClient
 * @description Structured details about an error, intended for the client via sendProxyError.
 * @property {string} llmId - The ID of the LLM involved.
 * @property {string} targetUrl - The target URL of the LLM provider.
 * @property {string} [originalErrorMessage] - The message from an underlying error.
 * @property {number} [llmApiStatusCode] - HTTP status code from the LLM API, if applicable.
 * @property {string} [llmApiResponseBodyPreview] - A preview of the LLM API's response body, if applicable.
 * @property {string} [originalProxiedErrorMessage] - Specific message if error is from proxy's attempt to call LLM.
 */

/**
 * @typedef {object} LlmServiceResponse
 * @description Represents the structured response from the LlmRequestService.
 * @property {boolean} success - Indicates whether the overall operation was successful.
 * @property {any} [data] - The response data from the LLM provider (on success).
 * @property {number} statusCode - The HTTP status code to be relayed to the client.
 * @property {string} [contentTypeIfSuccess] - The content type of the successful response data (e.g., 'application/json').
 * // Fields for error responses:
 * @property {string} [errorMessage] - Human-readable error message for the client (maps to 'message' in sendProxyError).
 * @property {string} [errorStage] - Machine-readable stage of the error (maps to 'stage' in sendProxyError).
 * @property {ErrorDetailsForClient} [errorDetailsForClient] - Structured details for the client (maps to 'details' in sendProxyError).
 */

/**
 *
 */
export class LlmRequestService {
  /** @type {ILogger} */
  #logger;
  /** @type {HttpAgentService} */
  #httpAgentService;
  /** @type {import('../config/appConfig.js').AppConfigService} */
  #appConfigService;
  /** @type {typeof RetryManager} */
  #RetryManager;

  /**
   * Constructs an LlmRequestService instance.
   * @param {ILogger} logger - An ILogger instance.
   * @param {HttpAgentService} httpAgentService - An HttpAgentService instance.
   * @param {import('../config/appConfig.js').AppConfigService} appConfigService - An AppConfigService instance.
   * @param {typeof RetryManager} RetryManagerClass - The RetryManager class for dependency injection.
   */
  constructor(logger, httpAgentService, appConfigService, RetryManagerClass) {
    if (!logger) {
      throw new Error('LlmRequestService: logger is required.');
    }
    if (!httpAgentService) {
      throw new Error('LlmRequestService: httpAgentService is required.');
    }
    if (!appConfigService) {
      throw new Error('LlmRequestService: appConfigService is required.');
    }
    if (!RetryManagerClass) {
      throw new Error('LlmRequestService: RetryManagerClass is required.');
    }
    this.#logger = logger;
    this.#httpAgentService = httpAgentService;
    this.#appConfigService = appConfigService;
    this.#RetryManager = RetryManagerClass;
    this.#logger.debug(
      'LlmRequestService: Instance created with HTTP agent pooling support.'
    );
  }

  /**
   * Constructs the headers for the LLM API request.
   * @private
   * @param {LLMModelConfig} llmModelConfig - The configuration for the LLM model.
   * @param {object} clientTargetHeaders - Headers provided by the client, to be selectively forwarded.
   * @param {string | null} apiKey - The API key for authorization.
   * @returns {object} The constructed headers object.
   */
  _constructHeaders(llmModelConfig, clientTargetHeaders, apiKey) {
    const headers = {};
    // MODIFIED: Use imported constants
    headers[HTTP_HEADER_CONTENT_TYPE] = CONTENT_TYPE_JSON; // Default

    const authorizationHeaderLower = HTTP_HEADER_AUTHORIZATION.toLowerCase();
    const contentTypeHeaderLower = HTTP_HEADER_CONTENT_TYPE.toLowerCase();

    if (clientTargetHeaders && typeof clientTargetHeaders === 'object') {
      for (const key in clientTargetHeaders) {
        if (Object.prototype.hasOwnProperty.call(clientTargetHeaders, key)) {
          const keyLower = key.toLowerCase();
          // MODIFIED: Use imported constants (via their lowercase versions)
          if (
            keyLower !== authorizationHeaderLower &&
            keyLower !== contentTypeHeaderLower
          ) {
            headers[key] = clientTargetHeaders[key];
          }
        }
      }
    }

    if (
      llmModelConfig.providerSpecificHeaders &&
      typeof llmModelConfig.providerSpecificHeaders === 'object'
    ) {
      for (const key in llmModelConfig.providerSpecificHeaders) {
        if (
          Object.prototype.hasOwnProperty.call(
            llmModelConfig.providerSpecificHeaders,
            key
          )
        ) {
          const keyLower = key.toLowerCase();
          // MODIFIED: Use imported constants (via their lowercase versions)
          if (
            keyLower !== authorizationHeaderLower &&
            keyLower !== contentTypeHeaderLower
          ) {
            headers[key] = llmModelConfig.providerSpecificHeaders[key];
          }
        }
      }
    }

    if (apiKey) {
      // MODIFIED: Use imported constants
      headers[HTTP_HEADER_AUTHORIZATION] =
        `${AUTH_SCHEME_BEARER_PREFIX}${apiKey}`;
    }
    return headers;
  }

  /**
   * Sanitizes the payload for logging purposes by truncating long string content.
   * @private
   * @param {object} targetPayload - The payload to be sent to the LLM.
   * @returns {object} A sanitized copy of the payload.
   */
  _sanitizePayloadForLogging(targetPayload) {
    const sanitizedPayload = { ...targetPayload }; // Shallow copy
    const maxLength = PAYLOAD_SANITIZATION_MAX_LENGTH;
    const ellipsis = PAYLOAD_SANITIZATION_ELLIPSIS;

    if (sanitizedPayload.messages && Array.isArray(sanitizedPayload.messages)) {
      sanitizedPayload.messages = sanitizedPayload.messages.map((m) => {
        if (m && typeof m.content === 'string') {
          return {
            ...m,
            content:
              m.content.length > maxLength
                ? m.content.substring(0, maxLength) + ellipsis
                : m.content,
          };
        }
        return m;
      });
    } else if (typeof sanitizedPayload.prompt === 'string') {
      sanitizedPayload.prompt =
        sanitizedPayload.prompt.length > maxLength
          ? sanitizedPayload.prompt.substring(0, maxLength) + ellipsis
          : sanitizedPayload.prompt;
    }
    return sanitizedPayload;
  }

  /**
   * Handles errors that occur during the forwarding process (typically from RetryManager).
   * This method populates statusCode, errorStage, errorMessage, and errorDetailsForClient.
   * @private
   * @param {Error} error - The error object caught from RetryManager.
   * @param {string} llmId - The ID of the LLM for which the request was made.
   * @param {string} targetUrl - The target URL that was called.
   * @returns {LlmServiceResponse} A structured error response.
   */
  _handleForwardingError(error, llmId, targetUrl) {
    this.#logger.error(
      `LlmRequestService: Error during forwarding to LLM provider for llmId '${llmId}'. Target: ${targetUrl}. Raw Error: ${error.message}`,
      {
        errorName: error.name,
        llmId,
        targetUrl,
        originalErrorStack: error.stack,
      }
    );

    let statusCodeToClient = 500;
    let errorStage = 'llm_forwarding_error_unknown';
    let errorMessageToClient = `Proxy failed to get a response from the LLM provider.`;
    // Sanitize error details for production environment
    const sanitizedError = sanitizeErrorForClient(
      error,
      'llm_forwarding_error_unknown'
    );

    /** @type {ErrorDetailsForClient} */
    let detailsForClient = {
      llmId,
      targetUrl,
      originalErrorMessage: sanitizedError.details.originalErrorMessage,
    };

    const httpErrorMatch = error.message.match(
      /API request to .* failed after \d+ attempt\(s\) with status (\d{3}):\s*(.*)/s
    );
    const networkOrOtherErrorMatch = error.message.match(
      /RetryManager: Failed for .* (?:due to persistent network error: |Unexpected error: )(.*)/s
    );

    if (httpErrorMatch && httpErrorMatch[1] && httpErrorMatch[2]) {
      const llmApiStatus = parseInt(httpErrorMatch[1], 10);
      const llmErrorBodyString = httpErrorMatch[2];

      detailsForClient.llmApiStatusCode = llmApiStatus;
      detailsForClient.llmApiResponseBodyPreview =
        llmErrorBodyString.substring(0, 200) +
        (llmErrorBodyString.length > 200 ? '...' : '');

      if (llmApiStatus >= 400 && llmApiStatus < 500) {
        statusCodeToClient = llmApiStatus;
        errorStage = 'llm_forwarding_client_error_relayed';
        errorMessageToClient = `The LLM provider reported a client-side error (status ${llmApiStatus}).`;
      } else if (llmApiStatus >= 500 && llmApiStatus < 600) {
        statusCodeToClient = 502;
        errorStage = 'llm_forwarding_server_error_bad_gateway';
        errorMessageToClient = `The LLM provider reported a server-side error (original status ${llmApiStatus}). The proxy is treating this as a Bad Gateway.`;
      } else {
        statusCodeToClient = 500;
        errorStage = 'llm_forwarding_unexpected_llm_status';
        errorMessageToClient = `Received an unexpected status (${llmApiStatus}) from the LLM provider.`;
      }
      this.#logger.warn(
        `LlmRequestService: LLM provider HTTP error for llmId '${llmId}'. LLM Status: ${llmApiStatus}. Proxy Status: ${statusCodeToClient}. Stage: ${errorStage}.`,
        {
          llmId,
          targetUrl,
          llmApiStatus,
          llmErrorBodyPreview: detailsForClient.llmApiResponseBodyPreview,
        }
      );
    } else if (networkOrOtherErrorMatch && networkOrOtherErrorMatch[1]) {
      const underlyingProxiedErrorMessage = networkOrOtherErrorMatch[1];
      statusCodeToClient = 504;
      errorStage = 'llm_forwarding_network_or_retry_exhausted';
      errorMessageToClient = `The proxy encountered a network issue or exhausted retries when trying to reach the LLM provider.`;
      detailsForClient.originalProxiedErrorMessage =
        underlyingProxiedErrorMessage;

      this.#logger.warn(
        `LlmRequestService: Network error or retries exhausted for llmId '${llmId}'. Proxy Status: ${statusCodeToClient}. Stage: ${errorStage}. Underlying: ${underlyingProxiedErrorMessage}`,
        { llmId, targetUrl, underlyingProxiedErrorMessage }
      );
    } else {
      this.#logger.warn(
        `LlmRequestService: Unrecognized error format from Workspace_retry for llmId '${llmId}'. Raw error: ${error.message}. Stage: ${errorStage}.`,
        { llmId, targetUrl, rawErrorMessage: error.message }
      );
    }

    this.#logger.debug(
      `LlmRequestService: Processed forwarding error for llmId '${llmId}'. Client Status: ${statusCodeToClient}, Stage: '${errorStage}', Message: '${errorMessageToClient}'.`,
      { detailsForClient }
    );

    return {
      success: false,
      statusCode: statusCodeToClient,
      errorStage: errorStage,
      errorMessage: errorMessageToClient,
      errorDetailsForClient: detailsForClient,
    };
  }

  /**
   * Forwards a request to the specified LLM provider.
   * @param {string} llmId - The ID of the LLM to target.
   * @param {LLMModelConfig} llmModelConfig - The configuration for the LLM model.
   * @param {object} targetPayload - The payload to send to the LLM.
   * @param {object} [clientTargetHeaders] - Headers from the client request to be selectively forwarded.
   * @param {string | null} apiKey - The API key for the LLM provider (if required).
   * @returns {Promise<LlmServiceResponse>} A promise that resolves with a structured response object.
   */
  async forwardRequest(
    llmId,
    llmModelConfig,
    targetPayload,
    clientTargetHeaders = {},
    apiKey = null
  ) {
    const initialLogContext = {
      llmId,
      apiType: llmModelConfig.apiType,
      displayName: llmModelConfig.displayName,
    };
    this.#logger.debug(
      `LlmRequestService: forwardRequest invoked.`,
      initialLogContext
    );

    const targetUrl = llmModelConfig.endpointUrl;
    if (
      !targetUrl ||
      typeof targetUrl !== 'string' ||
      targetUrl.trim() === ''
    ) {
      const errStage = 'llm_config_invalid_endpoint_url';
      const errMsg = `Proxy server configuration error: LLM endpoint URL is missing or invalid.`;
      // Sanitize configuration error for production
      const configError = new Error(
        'Endpoint URL in LLM configuration is empty or invalid.'
      );
      const sanitizedConfigError = sanitizeErrorForClient(
        configError,
        errStage,
        errMsg
      );

      /** @type {ErrorDetailsForClient} */
      const errDetails = {
        llmId,
        targetUrl: targetUrl || 'Not configured',
        originalErrorMessage: sanitizedConfigError.details.originalErrorMessage,
      };
      this.#logger.error(`LlmRequestService: ${errMsg}`, errDetails);
      return {
        success: false,
        statusCode: 500,
        errorStage: errStage,
        errorMessage: errMsg,
        errorDetailsForClient: errDetails,
      };
    }

    const headers = this._constructHeaders(
      llmModelConfig,
      clientTargetHeaders,
      apiKey
    );
    this.#logger.debug(
      `LlmRequestService: Constructed headers for llmId '${llmId}': ${JSON.stringify(Object.keys(headers))}. Auth included: ${!!apiKey}`,
      { llmId }
    );

    const retryParamsConfig = llmModelConfig.defaultParameters || {};
    const maxRetries =
      typeof retryParamsConfig.maxRetries === 'number'
        ? retryParamsConfig.maxRetries
        : 3;
    const baseDelayMs =
      typeof retryParamsConfig.baseDelayMs === 'number'
        ? retryParamsConfig.baseDelayMs
        : 1000;
    const maxDelayMs =
      typeof retryParamsConfig.maxDelayMs === 'number'
        ? retryParamsConfig.maxDelayMs
        : 10000;
    this.#logger.debug(
      `LlmRequestService: Retry parameters for llmId '${llmId}': maxRetries=${maxRetries}, baseDelayMs=${baseDelayMs}, maxDelayMs=${maxDelayMs}`,
      { llmId }
    );

    const sanitizedPayloadForLog =
      this._sanitizePayloadForLogging(targetPayload);

    this.#logger.debug(
      `LlmRequestService: Preparing to forward request to LLM provider '${llmModelConfig.displayName}'.`,
      {
        llmId,
        targetUrl,
        headerKeys: Object.keys(headers),
      }
    );
    this.#logger.debug(`   Sanitized Target Payload Preview for '${llmId}':`, {
      payload: sanitizedPayloadForLog,
      llmId,
    });

    try {
      this.#logger.debug(
        `LlmRequestService: Initiating call via RetryManager to ${targetUrl} for llmId '${llmId}'.`,
        { llmId }
      );

      // Get HTTP agent if enabled
      const httpAgentOptions = {};
      if (this.#appConfigService.isHttpAgentEnabled()) {
        const agent = this.#httpAgentService.getAgent(targetUrl);
        httpAgentOptions.agent = agent;
        this.#logger.debug(
          `LlmRequestService: Using HTTP agent with connection pooling for llmId '${llmId}' to ${targetUrl}.`
        );
      }

      // Create RetryManager instance and execute request with retry logic
      const retryManager = new this.#RetryManager(
        targetUrl,
        {
          // MODIFIED: Use imported constant
          method: HTTP_METHOD_POST,
          headers: headers,
          body: JSON.stringify(targetPayload),
          ...httpAgentOptions, // Include agent if available
        },
        maxRetries,
        baseDelayMs,
        maxDelayMs,
        this.#logger
      );

      const llmProviderParsedResponse = await retryManager.executeWithRetry();

      const responseBodyPreview =
        JSON.stringify(llmProviderParsedResponse)?.substring(0, 100) +
        (JSON.stringify(llmProviderParsedResponse)?.length > 100 ? '...' : '');
      this.#logger.info(
        `LlmRequestService: Successfully received response from LLM provider for llmId '${llmId}'. Status: 200 (assumed for RetryManager success).`,
        { llmId }
      );
      this.#logger.debug(
        `   LLM Provider Response Body (Preview for '${llmId}'): ${responseBodyPreview}`,
        { llmId }
      );

      return {
        success: true,
        data: llmProviderParsedResponse,
        statusCode: 200,
        // MODIFIED: Use imported constant
        contentTypeIfSuccess: CONTENT_TYPE_JSON,
      };
    } catch (error) {
      return this._handleForwardingError(error, llmId, targetUrl);
    }
  }
}
