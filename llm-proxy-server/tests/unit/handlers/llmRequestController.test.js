import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../../../src/handlers/llmRequestController.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
  LOG_LLM_ID_REQUEST_VALIDATION_FAILED,
} from '../../../src/config/constants.js';

jest.mock('../../../src/utils/responseUtils.js', () => ({
  sendProxyError: jest.fn(),
}));
import { sendProxyError } from '../../../src/utils/responseUtils.js';

jest.mock('../../../src/middleware/requestTracking.js', () => ({
  createResponseGuard: jest.fn((req, res, logger) => ({
    sendSuccess: jest.fn((statusCode, data, contentType) => {
      if (!res.headersSent && res.commitResponse('success')) {
        res.status(statusCode).set('Content-Type', contentType).json(data);
        return true;
      }
      return false;
    }),
    sendError: jest.fn(),
    canSendResponse: jest.fn(() => ({ canSend: true })),
  })),
}));

// Test utilities
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

/**
 * Creates a controller instance with mocked dependencies.
 * @param {object} [opts] - Optional overrides for default mocks.
 * @param {object} [opts.logger] - Logger implementation.
 * @param {object} [opts.llmConfigService] - Service providing LLM configs.
 * @param {object} [opts.apiKeyService] - API key service mock.
 * @param {object} [opts.llmRequestService] - Request service mock.
 * @returns {LlmRequestController} Configured controller instance.
 */
const makeController = (opts = {}) => {
  const logger = opts.logger ?? createLogger();
  const llmConfigService = opts.llmConfigService ?? {
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
    getLlmById: jest.fn(() => baseConfig),
  };
  const apiKeyService = opts.apiKeyService ?? {
    isApiKeyRequired: jest.fn(() => true),
    getApiKey: jest.fn(() => ({
      apiKey: 'abc',
      errorDetails: null,
      source: 'env',
    })),
  };
  const llmRequestService = opts.llmRequestService ?? {
    forwardRequest: jest.fn(() => ({
      success: true,
      data: { ok: true },
      statusCode: 200,
      contentTypeIfSuccess: undefined,
    })),
  };
  return new LlmRequestController(
    logger,
    llmConfigService,
    apiKeyService,
    llmRequestService
  );
};

describe('LlmRequestController', () => {
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
      requestId: 'test-request-id-123',
      body: { llmId: 'llm1', targetPayload: {}, targetHeaders: {} },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
      headersSent: false,
      commitResponse: jest.fn(() => true),
      isResponseCommitted: jest.fn(() => false),
      getCommitmentSource: jest.fn(() => null),
    };
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('constructor enforces required dependencies', () => {
      const logger = createLogger();
      const svc = {
        isOperational: jest.fn(),
        getInitializationErrorDetails: jest.fn(),
        getLlmById: jest.fn(),
      };

      expect(() => new LlmRequestController()).toThrow('logger is required');
      expect(() => new LlmRequestController(logger)).toThrow(
        'llmConfigService is required'
      );
      expect(() => new LlmRequestController(logger, svc)).toThrow(
        'apiKeyService is required'
      );
      expect(() => new LlmRequestController(logger, svc, {})).toThrow(
        'llmRequestService is required'
      );
    });

    test('successfully initializes with valid dependencies', () => {
      expect(controller).toBeInstanceOf(LlmRequestController);
      expect(typeof controller.handleLlmRequest).toBe('function');
    });
  });

  describe('Request Validation', () => {
    test('_validateRequest enforces parameters', () => {
      expect(controller._validateRequest('', {})).toEqual(
        expect.objectContaining({ stage: 'request_validation_llmid_missing' })
      );
      expect(controller._validateRequest('id', null)).toEqual(
        expect.objectContaining({ stage: 'request_validation_payload_missing' })
      );
      expect(controller._validateRequest('id', {})).toBeNull();
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

    test('returns 400 when validation fails for target payload', async () => {
      const controller = makeController();
      const req = { ip: '1.1.1.1', body: { llmId: 'id', targetPayload: null } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn(),
      };

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'request_validation_payload_missing',
        expect.any(String),
        expect.any(Object),
        'id',
        expect.any(Object)
      );
    });

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
  });

  describe('Service Operational Status', () => {
    test('handleLlmRequest returns 503 when proxy not operational', async () => {
      llmConfigService.isOperational.mockReturnValue(false);
      llmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'fail',
        stage: 'init_stage',
        details: { foo: 'bar' },
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        503,
        'init_stage',
        'fail',
        { foo: 'bar' },
        LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
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
  });

  describe('API Key Handling', () => {
    test('ApiKeyService config-stage errors map to 400', async () => {
      const apiKeyService = {
        isApiKeyRequired: jest.fn(() => true),
        getApiKey: jest.fn(() => ({
          apiKey: null,
          errorDetails: {
            stage: 'config_missing',
            message: 'bad',
            details: {},
          },
          source: 'env',
        })),
      };
      const controller = makeController({ apiKeyService });
      const req = { ip: '1.1.1.1', body: { llmId: 'id', targetPayload: {} } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn(),
      };

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'config_missing',
        'bad',
        {},
        'id',
        expect.any(Object)
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

    test('returns 500 when ApiKeyService gives no key or error', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: null,
        source: 'env',
      });

      await controller.handleLlmRequest(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'internal_api_key_service_state_error',
        expect.stringContaining('could not be obtained'),
        expect.objectContaining({ llmId: 'llm1' }),
        'llm1',
        logger
      );
    });

    test('succeeds when API key is required and retrieved', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'abc',
        errorDetails: null,
        source: 'env',
      });
      llmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        data: { ok: true },
        statusCode: 200,
        contentTypeIfSuccess: CONTENT_TYPE_JSON,
      });

      await controller.handleLlmRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.set).toHaveBeenCalledWith(
        HTTP_HEADER_CONTENT_TYPE,
        CONTENT_TYPE_JSON
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(sendProxyError).not.toHaveBeenCalled();
    });
  });

  describe('API Key Error Status Code Determination', () => {
    test('returns 500 for API key error with stage "not_set_or_empty"', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });

    test('returns 500 for API key error with stage "file_empty"', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });

    test('returns 500 for API key error with stage "not_found_or_unreadable"', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });

    test('returns 400 for API key error with stage "file_root_path_missing"', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });

    test('returns 400 for API key error with stage "sources_missing"', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });

    test('returns 500 for API key error with unrecognized stage', async () => {
      apiKeyService.isApiKeyRequired.mockReturnValue(true);
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
        'llm1',
        logger
      );
    });
  });

  describe('Response Handling', () => {
    test('uses default content type when none provided by request service', async () => {
      const llmRequestService = {
        forwardRequest: jest.fn(() => ({
          success: true,
          data: { ok: true },
          statusCode: 201,
        })),
      };
      const controller = makeController({ llmRequestService });
      const req = {
        ip: '1.1.1.1',
        requestId: 'test-request-id',
        body: { llmId: 'id', targetPayload: {} },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        headersSent: false,
        commitResponse: jest.fn(() => true),
        isResponseCommitted: jest.fn(() => false),
        getCommitmentSource: jest.fn(() => null),
      };

      await controller.handleLlmRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.set).toHaveBeenCalledWith(
        HTTP_HEADER_CONTENT_TYPE,
        CONTENT_TYPE_JSON
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
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
  });

  describe('Response salvage and failure fallbacks', () => {
    test('salvages response when guard cannot send success but salvage service is configured', async () => {
      const salvageService = { salvageResponse: jest.fn() };
      const controllerWithSalvage = new LlmRequestController(
        logger,
        llmConfigService,
        apiKeyService,
        {
          forwardRequest: jest.fn(() => ({
            success: true,
            data: { payload: true },
            statusCode: 207,
          })),
        },
        salvageService
      );

      res.commitResponse.mockReturnValue(false);

      await controllerWithSalvage.handleLlmRequest(req, res);

      expect(salvageService.salvageResponse).toHaveBeenCalledWith(
        req.requestId,
        req.body.llmId,
        req.body.targetPayload,
        { payload: true },
        207
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Successful LLM response could not be sent'),
        expect.objectContaining({
          requestId: req.requestId,
          llmId: req.body.llmId,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Response salvaged successfully'),
        expect.objectContaining({
          requestId: req.requestId,
          llmId: req.body.llmId,
        })
      );
      expect(sendProxyError).not.toHaveBeenCalled();
    });

    test('includes response commitment metadata when salvage is required', async () => {
      const salvageService = { salvageResponse: jest.fn() };
      const controllerWithSalvage = new LlmRequestController(
        logger,
        llmConfigService,
        apiKeyService,
        {
          forwardRequest: jest.fn(() => ({
            success: true,
            data: { payload: true },
            statusCode: 206,
            contentTypeIfSuccess: 'application/json',
          })),
        },
        salvageService
      );

      res.commitResponse.mockReturnValue(false);
      res.isResponseCommitted.mockReturnValue(true);

      await controllerWithSalvage.handleLlmRequest(req, res);

      expect(res.isResponseCommitted).toHaveBeenCalled();
      const salvageWarnCall = logger.warn.mock.calls.find((call) =>
        call[0].includes('Successful LLM response could not be sent')
      );
      expect(salvageWarnCall).toBeDefined();
      expect(salvageWarnCall[1]).toMatchObject({
        responseCommitted: true,
        headersSent: false,
      });
      expect(salvageService.salvageResponse).toHaveBeenCalledWith(
        req.requestId,
        req.body.llmId,
        req.body.targetPayload,
        { payload: true },
        206
      );
    });

    test('falls back to false when response commitment helper is unavailable', async () => {
      const salvageService = { salvageResponse: jest.fn() };
      const controllerWithSalvage = new LlmRequestController(
        logger,
        llmConfigService,
        apiKeyService,
        {
          forwardRequest: jest.fn(() => ({
            success: true,
            data: { answer: 42 },
            statusCode: 208,
          })),
        },
        salvageService
      );

      res.commitResponse.mockReturnValue(false);
      delete res.isResponseCommitted;

      await controllerWithSalvage.handleLlmRequest(req, res);

      const salvageWarnCall = logger.warn.mock.calls.find((call) =>
        call[0].includes('Successful LLM response could not be sent')
      );
      expect(salvageWarnCall).toBeDefined();
      expect(salvageWarnCall[1]).toMatchObject({ responseCommitted: false });
      expect(salvageService.salvageResponse).toHaveBeenCalledWith(
        req.requestId,
        req.body.llmId,
        req.body.targetPayload,
        { answer: 42 },
        208
      );
    });

    test('logs inability to send error response when headers already sent during exception', async () => {
      const error = new Error('boom');
      const controllerWithThrowingService = new LlmRequestController(
        logger,
        llmConfigService,
        apiKeyService,
        {
          forwardRequest: jest.fn(() => {
            throw error;
          }),
        }
      );

      res.headersSent = true;

      await controllerWithThrowingService.handleLlmRequest(req, res);

      expect(sendProxyError).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - LlmRequestService threw an unexpected exception'
        ),
        expect.objectContaining({
          details: expect.objectContaining({
            llmId: req.body.llmId,
            originalErrorMessage: error.message,
          }),
          llmId: req.body.llmId,
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot send error response - headers already sent'
        ),
        expect.objectContaining({
          llmId: req.body.llmId,
          errorMessage: error.message,
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
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
        'llm1',
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
          llmId: 'llm1',
          reason: 'LlmRequestService did not provide error details.',
        },
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
});
