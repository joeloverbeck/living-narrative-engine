import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../src/handlers/llmRequestController.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
} from '../src/config/constants.js';
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

describe('LlmRequestController additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('constructor enforces dependencies', () => {
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

  test('ApiKeyService config-stage errors map to 400', async () => {
    const apiKeyService = {
      isApiKeyRequired: jest.fn(() => true),
      getApiKey: jest.fn(() => ({
        apiKey: null,
        errorDetails: { stage: 'config_missing', message: 'bad', details: {} },
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

  test('uses default content type when none provided by request service', async () => {
    const llmRequestService = {
      forwardRequest: jest.fn(() => ({
        success: true,
        data: { ok: true },
        statusCode: 201,
      })),
    };
    const controller = makeController({ llmRequestService });
    const req = { ip: '1.1.1.1', body: { llmId: 'id', targetPayload: {} } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };
    await controller.handleLlmRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.set).toHaveBeenCalledWith(
      HTTP_HEADER_CONTENT_TYPE,
      CONTENT_TYPE_JSON
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
