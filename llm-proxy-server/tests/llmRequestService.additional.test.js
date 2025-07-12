import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestService } from '../src/services/llmRequestService.js';
import {
  HTTP_METHOD_POST,
  CONTENT_TYPE_JSON,
} from '../src/config/constants.js';

jest.mock('../src/utils/proxyApiUtils.js', () => ({
  RetryManager: jest.fn(),
}));

// Mock HttpAgentService
jest.mock('../src/services/httpAgentService.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    getAgent: jest.fn().mockReturnValue(null),
  })),
}));

import { RetryManager } from '../src/utils/proxyApiUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createHttpAgentService = () => ({
  getAgent: jest.fn().mockReturnValue(null),
});

const createAppConfigService = () => ({
  isHttpAgentEnabled: jest.fn().mockReturnValue(false),
});

const baseConfig = {
  endpointUrl: 'http://example.com/llm',
  displayName: 'Example',
  apiType: 'openai',
};

describe('LlmRequestService additional coverage', () => {
  let logger;
  let httpAgentService;
  let appConfigService;
  let service;
  let mockExecuteWithRetry;

  beforeEach(() => {
    logger = createLogger();
    httpAgentService = createHttpAgentService();
    appConfigService = createAppConfigService();

    // Setup RetryManager mock
    mockExecuteWithRetry = jest.fn();
    RetryManager.mockImplementation(() => ({
      executeWithRetry: mockExecuteWithRetry,
    }));

    service = new LlmRequestService(
      logger,
      httpAgentService,
      appConfigService,
      RetryManager
    );
    jest.clearAllMocks();
  });

  test('_sanitizePayloadForLogging keeps non-string content', () => {
    const payload = { messages: [{ role: 'user', content: 123 }] };
    const result = service._sanitizePayloadForLogging(payload);
    expect(result.messages[0].content).toBe(123);
  });

  test('_handleForwardingError handles server error', () => {
    const err = new Error(
      'API request to http://example.com failed after 1 attempt(s) with status 503: {"error":"srv"}'
    );
    const res = service._handleForwardingError(
      err,
      'llm1',
      'http://example.com'
    );
    expect(res.statusCode).toBe(502);
    expect(res.errorStage).toBe('llm_forwarding_server_error_bad_gateway');
  });

  test('_handleForwardingError handles unexpected status', () => {
    const err = new Error(
      'API request to http://example.com failed after 1 attempt(s) with status 302: moved'
    );
    const res = service._handleForwardingError(
      err,
      'llm1',
      'http://example.com'
    );
    expect(res.statusCode).toBe(500);
    expect(res.errorStage).toBe('llm_forwarding_unexpected_llm_status');
  });

  test('_handleForwardingError handles unknown error', () => {
    const err = new Error('some random failure');
    const res = service._handleForwardingError(
      err,
      'llm1',
      'http://example.com'
    );
    expect(res.statusCode).toBe(500);
    expect(res.errorStage).toBe('llm_forwarding_error_unknown');
  });

  test('forwardRequest uses default retry parameters', async () => {
    mockExecuteWithRetry.mockResolvedValue({ ok: true });
    const res = await service.forwardRequest('llm1', baseConfig, { a: 1 });
    expect(RetryManager).toHaveBeenCalledWith(
      baseConfig.endpointUrl,
      {
        method: HTTP_METHOD_POST,
        headers: expect.any(Object),
        body: JSON.stringify({ a: 1 }),
      },
      3,
      1000,
      10000,
      logger
    );
    expect(res).toEqual({
      success: true,
      data: { ok: true },
      statusCode: 200,
      contentTypeIfSuccess: CONTENT_TYPE_JSON,
    });
  });
});
