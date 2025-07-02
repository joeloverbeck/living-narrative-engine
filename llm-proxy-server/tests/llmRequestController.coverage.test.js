import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../src/handlers/llmRequestController.js';
import { sendProxyError } from '../src/utils/responseUtils.js';

jest.mock('../src/utils/responseUtils.js', () => ({
  sendProxyError: jest.fn(),
}));

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseConfig = {
  displayName: 'TestLLM',
  apiType: 'openai',
  endpointUrl: 'http://example.com',
  defaultParameters: {},
};

describe('LlmRequestController - Branch Coverage', () => {
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
      isApiKeyRequired: jest.fn(() => true),
      getApiKey: jest.fn(),
    };
    llmRequestService = {
      forwardRequest: jest.fn(() => ({
        success: true,
        data: { result: 'success' },
        statusCode: 200,
      })),
    };
    controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService
    );
    req = {
      ip: '127.0.0.1',
      body: { llmId: 'test-llm', targetPayload: {}, targetHeaders: {} },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('API Key Error Status Code Determination', () => {
    test('returns 500 for API key error with stage "not_set_or_empty"', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'env_not_set_or_empty',
          message: 'Environment variable is not set or empty',
          details: { envVar: 'TEST_API_KEY' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'env_not_set_or_empty',
        'Environment variable is not set or empty',
        { envVar: 'TEST_API_KEY' },
        'test-llm',
        logger
      );
    });

    test('returns 500 for API key error with stage "file_empty"', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'file_empty',
          message: 'API key file is empty',
          details: { fileName: 'api-key.txt' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'file_empty',
        'API key file is empty',
        { fileName: 'api-key.txt' },
        'test-llm',
        logger
      );
    });

    test('returns 500 for API key error with stage "not_found_or_unreadable"', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'file_not_found_or_unreadable',
          message: 'API key file not found or unreadable',
          details: { path: '/keys/api-key.txt' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'file_not_found_or_unreadable',
        'API key file not found or unreadable',
        { path: '/keys/api-key.txt' },
        'test-llm',
        logger
      );
    });

    test('returns 400 for API key error with stage "file_root_path_missing"', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'file_root_path_missing',
          message: 'File root path is missing in configuration',
          details: { config: 'apiKeyFileName' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'file_root_path_missing',
        'File root path is missing in configuration',
        { config: 'apiKeyFileName' },
        'test-llm',
        logger
      );
    });

    test('returns 400 for API key error with stage "sources_missing"', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'sources_missing',
          message: 'No API key sources configured',
          details: { llmId: 'test-llm' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'sources_missing',
        'No API key sources configured',
        { llmId: 'test-llm' },
        'test-llm',
        logger
      );
    });

    test('returns 500 for API key error with unrecognized stage', async () => {
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'unknown_error_stage',
          message: 'An unknown error occurred',
          details: { error: 'unknown' },
        },
        source: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'unknown_error_stage',
        'An unknown error occurred',
        { error: 'unknown' },
        'test-llm',
        logger
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles null llmId in validation error', async () => {
      req.body = { targetPayload: {} };

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'request_validation_llmid_missing',
        expect.any(String),
        expect.any(Object),
        'N/A_VALIDATION',
        logger
      );
    });

    test('handles missing error stage in service response', async () => {
      // Mock apiKeyService to not require a key for this test
      apiKeyService.isApiKeyRequired.mockReturnValue(false);

      llmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorMessage: 'Service error occurred',
        errorDetailsForClient: { llmId: 'test-llm' },
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        502,
        'llm_service_unknown_error_stage',
        'Service error occurred',
        { llmId: 'test-llm' },
        'test-llm',
        logger
      );
    });

    test('handles missing error message in service response', async () => {
      // Mock apiKeyService to not require a key for this test
      apiKeyService.isApiKeyRequired.mockReturnValue(false);

      llmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorStage: 'service_error',
        errorDetailsForClient: null,
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        502,
        'service_error',
        'An unspecified error occurred in the LLM request service.',
        {
          llmId: 'test-llm',
          reason: 'LlmRequestService did not provide error details.',
        },
        'test-llm',
        logger
      );
    });
  });
});
