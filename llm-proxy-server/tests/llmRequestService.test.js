import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestService } from '../src/services/llmRequestService.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_HEADER_AUTHORIZATION,
  AUTH_SCHEME_BEARER_PREFIX,
  HTTP_METHOD_POST,
  PAYLOAD_SANITIZATION_MAX_LENGTH,
  PAYLOAD_SANITIZATION_ELLIPSIS,
} from '../src/config/constants.js';

// Mock RetryManager
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
  providerSpecificHeaders: { 'X-Provider': '1', Authorization: 'skip' },
  defaultParameters: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 20 },
};

describe('LlmRequestService', () => {
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

  test('constructor requires logger', () => {
    expect(() => new LlmRequestService()).toThrow(
      'LlmRequestService: logger is required.'
    );
  });

  test('constructor requires httpAgentService', () => {
    expect(() => new LlmRequestService(logger)).toThrow(
      'LlmRequestService: httpAgentService is required.'
    );
  });

  test('constructor requires appConfigService', () => {
    expect(() => new LlmRequestService(logger, httpAgentService)).toThrow(
      'LlmRequestService: appConfigService is required.'
    );
  });

  test('constructor requires RetryManagerClass', () => {
    expect(
      () => new LlmRequestService(logger, httpAgentService, appConfigService)
    ).toThrow('LlmRequestService: RetryManagerClass is required.');
  });

  test('_constructHeaders merges headers correctly', () => {
    const headers = service._constructHeaders(
      baseConfig,
      {
        'X-Custom': 'yes',
        Authorization: 'client',
        'Content-Type': 'text/plain',
      },
      'key123'
    );
    expect(headers).toEqual({
      [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
      'X-Custom': 'yes',
      'X-Provider': '1',
      [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER_PREFIX}key123`,
    });
  });

  test('_sanitizePayloadForLogging truncates message content', () => {
    const payload = { messages: [{ role: 'user', content: 'a'.repeat(80) }] };
    const result = service._sanitizePayloadForLogging(payload);
    expect(result.messages[0].content).toBe(
      'a'.repeat(PAYLOAD_SANITIZATION_MAX_LENGTH) +
        PAYLOAD_SANITIZATION_ELLIPSIS
    );
  });

  test('_sanitizePayloadForLogging truncates prompt', () => {
    const payload = { prompt: 'b'.repeat(75) };
    const result = service._sanitizePayloadForLogging(payload);
    expect(result.prompt).toBe(
      'b'.repeat(PAYLOAD_SANITIZATION_MAX_LENGTH) +
        PAYLOAD_SANITIZATION_ELLIPSIS
    );
  });

  test('_handleForwardingError parses HTTP errors', () => {
    const errMsg =
      'API request to http://example.com failed after 2 attempt(s) with status 404: {"err":"bad"}';
    const result = service._handleForwardingError(
      new Error(errMsg),
      'llm1',
      'http://example.com'
    );
    expect(result.statusCode).toBe(404);
    expect(result.errorStage).toBe('llm_forwarding_client_error_relayed');
    expect(result.errorDetailsForClient.llmApiStatusCode).toBe(404);
    expect(result.errorDetailsForClient.llmApiResponseBodyPreview).toContain(
      '{"err":"bad"}'
    );
  });

  test('_handleForwardingError parses network errors', () => {
    const errMsg =
      'RetryManager: Failed for http://example.com after 3 attempt(s) due to persistent network error: timeout';
    const result = service._handleForwardingError(
      new Error(errMsg),
      'llm1',
      'http://example.com'
    );
    expect(result.statusCode).toBe(504);
    expect(result.errorStage).toBe('llm_forwarding_network_or_retry_exhausted');
    expect(result.errorDetailsForClient.originalProxiedErrorMessage).toContain(
      'timeout'
    );
  });

  test('forwardRequest returns success on happy path', async () => {
    mockExecuteWithRetry.mockResolvedValue({ ok: true });
    const res = await service.forwardRequest(
      'llm1',
      baseConfig,
      { a: 1 },
      { 'X-Extra': 'h' },
      'key'
    );
    expect(RetryManager).toHaveBeenCalledWith(
      baseConfig.endpointUrl,
      {
        method: HTTP_METHOD_POST,
        headers: expect.any(Object),
        body: JSON.stringify({ a: 1 }),
      },
      2,
      10,
      20,
      logger
    );
    expect(res).toEqual({
      success: true,
      data: { ok: true },
      statusCode: 200,
      contentTypeIfSuccess: CONTENT_TYPE_JSON,
    });
  });

  test('forwardRequest handles invalid endpoint URL', async () => {
    const cfg = { ...baseConfig, endpointUrl: '' };
    const res = await service.forwardRequest('llm1', cfg, {});
    expect(res.errorStage).toBe('llm_config_invalid_endpoint_url');
    expect(res.success).toBe(false);
  });

  test('forwardRequest delegates errors to _handleForwardingError', async () => {
    mockExecuteWithRetry.mockRejectedValue(
      new Error(
        'RetryManager: Failed for http://example.com after 1 attempt(s) due to persistent network error: fail'
      )
    );
    const spy = jest.spyOn(service, '_handleForwardingError');
    const res = await service.forwardRequest('llm1', baseConfig, {});
    expect(spy).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.errorStage).toBe('llm_forwarding_network_or_retry_exhausted');
  });

  test('forwardRequest uses HTTP agent when enabled', async () => {
    appConfigService.isHttpAgentEnabled.mockReturnValue(true);
    const mockAgent = { id: 'mock-agent' };
    httpAgentService.getAgent.mockReturnValue(mockAgent);

    mockExecuteWithRetry.mockResolvedValue({ ok: true });

    await service.forwardRequest('llm1', baseConfig, { a: 1 }, {}, 'key');

    expect(appConfigService.isHttpAgentEnabled).toHaveBeenCalled();
    expect(httpAgentService.getAgent).toHaveBeenCalledWith(
      baseConfig.endpointUrl
    );
    expect(RetryManager).toHaveBeenCalledWith(
      baseConfig.endpointUrl,
      {
        method: HTTP_METHOD_POST,
        headers: expect.any(Object),
        body: JSON.stringify({ a: 1 }),
        agent: mockAgent,
      },
      2,
      10,
      20,
      logger
    );
  });

  test('forwardRequest does not use HTTP agent when disabled', async () => {
    appConfigService.isHttpAgentEnabled.mockReturnValue(false);

    mockExecuteWithRetry.mockResolvedValue({ ok: true });

    await service.forwardRequest('llm1', baseConfig, { a: 1 }, {}, 'key');

    expect(appConfigService.isHttpAgentEnabled).toHaveBeenCalled();
    expect(httpAgentService.getAgent).not.toHaveBeenCalled();
    expect(RetryManager).toHaveBeenCalledWith(
      baseConfig.endpointUrl,
      {
        method: HTTP_METHOD_POST,
        headers: expect.any(Object),
        body: JSON.stringify({ a: 1 }),
      },
      2,
      10,
      20,
      logger
    );
  });
});
