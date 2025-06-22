import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../src/handlers/llmRequestController.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
  LOG_LLM_ID_REQUEST_VALIDATION_FAILED,
} from '../src/config/constants.js';

jest.mock('../src/utils/responseUtils.js', () => ({
  sendProxyError: jest.fn(),
}));
import { sendProxyError } from '../src/utils/responseUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseConfig = {
  displayName: 'MockLLM',
  apiType: 'openai',
  endpointUrl: 'http://example.com',
  defaultParameters: {},
};

describe('LlmRequestController flow', () => {
  let logger;
  let llmConfigService;
  let apiKeyService;
  let llmRequestService;
  let controller;
  let req;
  let res;

  beforeEach(() => {
    logger = createLogger();
    llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => baseConfig),
    };
    apiKeyService = {
      isApiKeyRequired: jest.fn(() => false),
      getApiKey: jest.fn(() => ({
        apiKey: null,
        errorDetails: null,
        source: '',
      })),
    };
    llmRequestService = { forwardRequest: jest.fn() };
    controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService
    );
    req = {
      ip: '1.1.1.1',
      body: { llmId: 'llm1', targetPayload: {}, targetHeaders: {} },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test('returns 400 on validation failure', async () => {
    req.body = { targetPayload: {} };
    await controller.handleLlmRequest(req, res);
    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      400,
      'request_validation_llmid_missing',
      expect.any(String),
      expect.any(Object),
      LOG_LLM_ID_REQUEST_VALIDATION_FAILED,
      logger
    );
  });

  test('returns 400 when configuration missing', async () => {
    llmConfigService.getLlmById.mockReturnValue(null);
    await controller.handleLlmRequest(req, res);
    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      400,
      'llm_config_lookup_failed',
      expect.any(String),
      expect.any(Object),
      'llm1',
      logger
    );
  });

  test('returns 500 when api key retrieval fails', async () => {
    apiKeyService.isApiKeyRequired.mockReturnValue(true);
    apiKeyService.getApiKey.mockResolvedValue({
      apiKey: null,
      errorDetails: { stage: 'key_error', message: 'bad', details: {} },
      source: 'env',
    });
    await controller.handleLlmRequest(req, res);
    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      500,
      'key_error',
      'bad',
      {},
      'llm1',
      logger
    );
  });

  test('sends successful response on happy path', async () => {
    apiKeyService.isApiKeyRequired.mockReturnValue(false);
    llmRequestService.forwardRequest.mockResolvedValue({
      success: true,
      data: { ok: true },
      statusCode: 201,
      contentTypeIfSuccess: CONTENT_TYPE_JSON,
    });
    await controller.handleLlmRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.set).toHaveBeenCalledWith(
      HTTP_HEADER_CONTENT_TYPE,
      CONTENT_TYPE_JSON
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(sendProxyError).not.toHaveBeenCalled();
  });

  test('uses sendProxyError when request service reports failure', async () => {
    llmRequestService.forwardRequest.mockResolvedValue({
      success: false,
      statusCode: 502,
      errorStage: 'service_fail',
      errorMessage: 'oops',
      errorDetailsForClient: { fail: true },
    });
    await controller.handleLlmRequest(req, res);
    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      502,
      'service_fail',
      'oops',
      { fail: true },
      'llm1',
      logger
    );
  });

  test('handles exception from request service', async () => {
    llmRequestService.forwardRequest.mockRejectedValue(new Error('boom'));
    await controller.handleLlmRequest(req, res);
    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      500,
      'internal_llm_service_exception',
      expect.any(String),
      expect.objectContaining({ originalErrorMessage: 'boom' }),
      'llm1',
      logger
    );
  });
});
