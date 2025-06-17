import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../src/handlers/llmRequestController.js';
import { LOG_LLM_ID_PROXY_NOT_OPERATIONAL } from '../src/config/constants.js';

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
      isOperational: jest.fn(() => false),
      getInitializationErrorDetails: jest.fn(() => ({
        message: 'fail',
        stage: 'init_stage',
        details: { foo: 'bar' },
      })),
      getLlmById: jest.fn(),
    };
    apiKeyService = { isApiKeyRequired: jest.fn(), getApiKey: jest.fn() };
    llmRequestService = { forwardRequest: jest.fn() };
    controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService
    );
    req = { ip: '1.1.1.1', body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
    };
    jest.clearAllMocks();
  });

  test('_validateRequest enforces parameters', () => {
    expect(controller._validateRequest('', {})).toEqual(
      expect.objectContaining({ stage: 'request_validation_llmid_missing' })
    );
    expect(controller._validateRequest('id', null)).toEqual(
      expect.objectContaining({ stage: 'request_validation_payload_missing' })
    );
    expect(controller._validateRequest('id', {})).toBeNull();
  });

  test('handleLlmRequest returns 503 when proxy not operational', async () => {
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
});
