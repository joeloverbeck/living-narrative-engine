// llm-proxy-server/src/handlers/llmRequestController.js

// Import sendProxyError utility
import { sendProxyError } from '../utils/responseUtils.js';
import {
  CONTENT_TYPE_JSON,
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
  LOG_LLM_ID_REQUEST_VALIDATION_FAILED,
  LOG_LLM_ID_NOT_APPLICABLE,
  HTTP_HEADER_CONTENT_TYPE,
} from '../config/constants.js'; // MODIFIED: Import constants

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../config/llmConfigService.js').LlmConfigService} LlmConfigService
 */
/**
 * @typedef {import('../config/llmConfigService.js').LLMModelConfig} LLMModelConfig
 */
/**
 * @typedef {import('../config/llmConfigService.js').StandardizedErrorObject} LlmConfigErrorObject
 */
/**
 * @typedef {import('../services/apiKeyService.js').ApiKeyService} ApiKeyService
 */
/**
 * @typedef {import('../services/apiKeyService.js').ApiKeyResult} ApiKeyResult
 */
/**
 * @typedef {import('../services/apiKeyService.js').StandardizedErrorObject} ApiKeyErrorObject
 */
/**
 * @typedef {import('../services/llmRequestService.js').LlmRequestService} LlmRequestService
 */
/**
 * @typedef {import('../services/llmRequestService.js').LlmServiceResponse} LlmServiceResponse
 */
/**
 * @typedef {import('express').Request} ExpressRequest
 */
/**
 * @typedef {import('express').Response} ExpressResponse
 */

/**
 *
 */
export class LlmRequestController {
  /** @type {ILogger} */
  #logger;
  /** @type {LlmConfigService} */
  #llmConfigService;
  /** @type {ApiKeyService} */
  #apiKeyService;
  /** @type {LlmRequestService} */
  #llmRequestService;

  /**
   * Constructs an LlmRequestController instance.
   * @param {ILogger} logger - An ILogger instance.
   * @param {LlmConfigService} llmConfigService - Service for LLM configurations.
   * @param {ApiKeyService} apiKeyService - Service for API key management.
   * @param {LlmRequestService} llmRequestService - Service for forwarding requests to LLMs.
   */
  constructor(logger, llmConfigService, apiKeyService, llmRequestService) {
    if (!logger) throw new Error('LlmRequestController: logger is required.');
    if (!llmConfigService)
      throw new Error('LlmRequestController: llmConfigService is required.');
    if (!apiKeyService)
      throw new Error('LlmRequestController: apiKeyService is required.');
    if (!llmRequestService)
      throw new Error('LlmRequestController: llmRequestService is required.');

    this.#logger = logger;
    this.#llmConfigService = llmConfigService;
    this.#apiKeyService = apiKeyService;
    this.#llmRequestService = llmRequestService;

    this.#logger.debug('LlmRequestController: Instance created.');
  }

  /**
   * Validates the incoming request parameters.
   * @private
   * @param {string} llmId - The LLM ID from the request.
   * @param {any} targetPayload - The target payload from the request.
   * @returns {{ message: string, stage: string, details: object} | null} Error object or null if valid.
   */
  _validateRequest(llmId, targetPayload) {
    if (!llmId || typeof llmId !== 'string') {
      return {
        message:
          'Client request validation failed: llmId is required and must be a string.',
        stage: 'request_validation_llmid_missing',
        details: {
          receivedLlmId: llmId,
          problem: 'llmId is missing or not a string',
        },
      };
    }
    if (!targetPayload || typeof targetPayload !== 'object') {
      return {
        message: `Client request validation failed: targetPayload is required and must be an object.`,
        stage: 'request_validation_payload_missing',
        details: {
          llmId,
          receivedTargetPayloadType: typeof targetPayload,
          problem: 'targetPayload is missing or not an object',
        },
      };
    }
    return null;
  }

  /**
   * Handles the /api/llm-request route.
   * Orchestrates request validation, configuration lookup, API key retrieval,
   * and forwarding the request to the appropriate LLM provider.
   * @param {ExpressRequest} req - The Express request object.
   * @param {ExpressResponse} res - The Express response object.
   * @returns {Promise<void>}
   */
  async handleLlmRequest(req, res) {
    const clientPayloadSummary = {
      llmId: req.body?.llmId,
      hasTargetPayload: !!req.body?.targetPayload,
      hasTargetHeaders: !!req.body?.targetHeaders,
    };
    this.#logger.info(
      `LlmRequestController: Received POST request on /api/llm-request from ${req.ip}.`,
      { payloadSummary: clientPayloadSummary }
    );

    // 1. Proxy Operational Check
    if (!this.#llmConfigService.isOperational()) {
      /** @type {LlmConfigErrorObject | null} */
      const initError = this.#llmConfigService.getInitializationErrorDetails();
      const message =
        initError?.message ||
        'Proxy server is not operational due to unknown configuration issues.';
      const stage = initError?.stage || 'initialization_failure_unknown';
      const details = initError?.details || {};
      this.#logger.warn(
        `LlmRequestController: Proxy not operational. Stage: ${stage}, Message: ${message}`,
        { details }
      );
      // MODIFIED: Use imported constant
      sendProxyError(
        res,
        503,
        stage,
        message,
        details,
        LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
        this.#logger
      );
      return;
    }

    const { llmId, targetPayload, targetHeaders } = req.body;

    // 2. Request Validation
    const validationError = this._validateRequest(llmId, targetPayload);
    if (validationError) {
      this.#logger.warn(
        `LlmRequestController: Request validation failed. Stage: ${validationError.stage}, Message: ${validationError.message}`,
        {
          details: validationError.details,
          llmId: llmId || LOG_LLM_ID_NOT_APPLICABLE,
        }
      );
      // MODIFIED: Use imported constant
      sendProxyError(
        res,
        400,
        validationError.stage,
        validationError.message,
        validationError.details,
        llmId || LOG_LLM_ID_REQUEST_VALIDATION_FAILED,
        this.#logger
      );
      return;
    }

    // 3. LLM Configuration
    const llmModelConfig = this.#llmConfigService.getLlmById(llmId);
    if (!llmModelConfig) {
      const message = `LLM configuration not found for the provided llmId.`;
      const stage = 'llm_config_lookup_failed';
      const details = {
        requestedLlmId: llmId,
        reason:
          "No configuration found for this llmId in the proxy's settings.",
      };
      this.#logger.warn(
        `LlmRequestController: ${message} llmId: '${llmId}'.`,
        details
      );
      sendProxyError(res, 400, stage, message, details, llmId, this.#logger);
      return;
    }
    this.#logger.info(
      `LlmRequestController: Retrieved LLMModelConfig for llmId '${llmId}': DisplayName: ${llmModelConfig.displayName}.`,
      { llmId }
    );
    this.#logger.debug(`LlmRequestController: Config details for '${llmId}':`, {
      llmId,
      endpointUrl: llmModelConfig.endpointUrl,
      modelIdentifier: llmModelConfig.modelIdentifier,
      apiKeyEnvVar: llmModelConfig.apiKeyEnvVar ? 'Present' : 'Not Present',
      apiKeyFileName: llmModelConfig.apiKeyFileName ? 'Present' : 'Not Present',
      apiType: llmModelConfig.apiType,
    });

    // 4. API Key Retrieval
    let actualApiKey = null;
    let apiKeySourceForLog = 'N/A (default)';
    const requiresKey = this.#apiKeyService.isApiKeyRequired(llmModelConfig);

    if (requiresKey) {
      this.#logger.info(
        `LlmRequestController: API key is required for llmId '${llmId}'. Invoking ApiKeyService.`,
        { llmId }
      );
      const apiKeyResult = await this.#apiKeyService.getApiKey(
        llmModelConfig,
        llmId
      );

      if (apiKeyResult.errorDetails) {
        /** @type {ApiKeyErrorObject} */
        const keyError = apiKeyResult.errorDetails;
        let statusCode = 500;
        if (
          keyError.stage?.includes('config') ||
          keyError.stage?.includes('file_root_path_missing') ||
          keyError.stage?.includes('sources_missing')
        ) {
          statusCode = 400;
        } else if (
          keyError.stage?.includes('not_set_or_empty') ||
          keyError.stage?.includes('file_empty') ||
          keyError.stage?.includes('not_found_or_unreadable')
        ) {
          statusCode = 500;
        }

        this.#logger.error(
          `LlmRequestController: ApiKeyService reported an error for llmId '${llmId}'. Status Code for client: ${statusCode}, Stage: ${keyError.stage}, Message: ${keyError.message}`,
          { details: keyError.details, llmId }
        );
        sendProxyError(
          res,
          statusCode,
          keyError.stage,
          keyError.message,
          keyError.details,
          llmId,
          this.#logger
        );
        return;
      }

      actualApiKey = apiKeyResult.apiKey;
      apiKeySourceForLog = apiKeyResult.source;

      if (!actualApiKey) {
        const message = `Critical internal error: API key for cloud service LLM '${llmId}' could not be obtained, and ApiKeyService did not provide specific error details. This indicates an unexpected state.`;
        const stage = 'internal_api_key_service_state_error';
        const details = {
          llmId,
          reason:
            'ApiKeyService returned no key and no error for a required key.',
        };
        this.#logger.error(`LlmRequestController: ${message}`, {
          details,
          llmId,
        });
        sendProxyError(res, 500, stage, message, details, llmId, this.#logger);
        return;
      }
      this.#logger.info(
        `LlmRequestController: API key successfully obtained for llmId '${llmId}' from source: ${apiKeySourceForLog}.`,
        { llmId }
      );
    } else {
      this.#logger.info(
        `LlmRequestController: LLM '${llmId}' (apiType: ${llmModelConfig.apiType}) does not require a proxy-managed API key.`,
        { llmId }
      );
      apiKeySourceForLog = 'Not applicable (local LLM or no key needed)';
    }
    this.#logger.debug(
      `LlmRequestController: API Key Status after retrieval for '${llmId}': Source: ${apiKeySourceForLog}, Required: ${requiresKey}, KeyPresent: ${!!actualApiKey}`,
      { llmId }
    );

    // 5. Forward Request to LLM Provider
    try {
      this.#logger.info(
        `LlmRequestController: Handing off request for llmId '${llmId}' to LlmRequestService.`,
        { llmId }
      );
      const result = await this.#llmRequestService.forwardRequest(
        llmId,
        llmModelConfig,
        targetPayload,
        targetHeaders,
        actualApiKey
      );

      // 6. Process Service Response
      if (result.success) {
        this.#logger.info(
          `LlmRequestController: LlmRequestService returned success for llmId '${llmId}'. Relaying to client with status ${result.statusCode}.`,
          { llmId }
        );
        res
          .status(result.statusCode)
          // MODIFIED: Use imported constant for fallback Content-Type
          .set(
            HTTP_HEADER_CONTENT_TYPE,
            result.contentTypeIfSuccess || CONTENT_TYPE_JSON
          )
          .json(result.data);
      } else {
        this.#logger.warn(
          `LlmRequestController: LlmRequestService returned failure for llmId '${llmId}'. Status: ${result.statusCode}, Stage: ${result.errorStage}, Message: ${result.errorMessage}`,
          { errorDetails: result.errorDetailsForClient, llmId }
        );

        sendProxyError(
          res,
          result.statusCode,
          result.errorStage || 'llm_service_unknown_error_stage',
          result.errorMessage ||
            'An unspecified error occurred in the LLM request service.',
          result.errorDetailsForClient || {
            llmId,
            reason: 'LlmRequestService did not provide error details.',
          },
          llmId,
          this.#logger
        );
      }
    } catch (serviceException) {
      const message = `A critical internal error occurred within the LLM request service while processing llmId '${llmId}'.`;
      const stage = 'internal_llm_service_exception';
      const details = {
        llmId,
        originalErrorMessage: serviceException.message,
        errorName: serviceException.name,
        reason: 'LlmRequestService threw an unexpected exception.',
      };
      this.#logger.error(
        `LlmRequestController: CRITICAL - LlmRequestService threw an unexpected exception for llmId '${llmId}'. Error: ${serviceException.message}`,
        {
          details,
          stack: serviceException.stack,
          llmId,
        }
      );
      sendProxyError(res, 500, stage, message, details, llmId, this.#logger);
    }
  }
}
