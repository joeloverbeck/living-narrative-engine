import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestService } from '../src/services/llmRequestService.js';
import {
  CONTENT_TYPE_JSON,
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_HEADER_AUTHORIZATION,
  AUTH_SCHEME_BEARER_PREFIX,
  HTTP_METHOD_POST,
} from '../src/config/constants.js';

// Mock Workspace_retry
jest.mock('../src/utils/proxyApiUtils.js', () => ({
  Workspace_retry: jest.fn(),
}));

import { Workspace_retry } from '../src/utils/proxyApiUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
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
  let service;

  beforeEach(() => {
    logger = createLogger();
    service = new LlmRequestService(logger);
    jest.clearAllMocks();
  });

  test('constructor requires logger', () => {
    expect(() => new LlmRequestService()).toThrow(
      'LlmRequestService: logger is required.'
    );
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
    expect(result.messages[0].content).toBe('a'.repeat(70) + '...');
  });

  test('_sanitizePayloadForLogging truncates prompt', () => {
    const payload = { prompt: 'b'.repeat(75) };
    const result = service._sanitizePayloadForLogging(payload);
    expect(result.prompt).toBe('b'.repeat(70) + '...');
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
      'Workspace_retry: Failed for http://example.com after 3 attempt(s) Final error: timeout';
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
    Workspace_retry.mockResolvedValue({ ok: true });
    const res = await service.forwardRequest(
      'llm1',
      baseConfig,
      { a: 1 },
      { 'X-Extra': 'h' },
      'key'
    );
    expect(Workspace_retry).toHaveBeenCalledWith(
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
    Workspace_retry.mockRejectedValue(
      new Error(
        'Workspace_retry: Failed for http://example.com after 1 attempt(s) Final error: fail'
      )
    );
    const spy = jest.spyOn(service, '_handleForwardingError');
    const res = await service.forwardRequest('llm1', baseConfig, {});
    expect(spy).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.errorStage).toBe('llm_forwarding_network_or_retry_exhausted');
  });
});
