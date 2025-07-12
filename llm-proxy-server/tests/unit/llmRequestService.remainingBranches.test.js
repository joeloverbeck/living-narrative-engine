import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import {
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_HEADER_AUTHORIZATION,
  CONTENT_TYPE_JSON,
  AUTH_SCHEME_BEARER_PREFIX,
} from '../../src/config/constants.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';

jest.mock('../../src/utils/proxyApiUtils.js', () => ({
  RetryManager: jest.fn(),
}));

// Mock HttpAgentService
jest.mock('../../src/services/httpAgentService.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    getAgent: jest.fn().mockReturnValue(null),
  })),
}));

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

describe('LlmRequestService remaining branches', () => {
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

  test('_constructHeaders handles missing and inherited headers', () => {
    const inheritedClient = Object.create({ proto: 'v' });
    const inheritedProvider = Object.create({ Prov: 'p' });
    const headers = service._constructHeaders(
      { ...baseConfig, providerSpecificHeaders: inheritedProvider },
      inheritedClient,
      'tok'
    );
    expect(headers).toEqual({
      [HTTP_HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
      [HTTP_HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER_PREFIX}tok`,
    });
  });

  test('_sanitizePayloadForLogging handles short prompt only', () => {
    const payload = { prompt: 'short text' };
    expect(service._sanitizePayloadForLogging(payload)).toEqual(payload);
  });

  test('_handleForwardingError truncates long body', () => {
    const longBody = '{"msg":"' + 'a'.repeat(210) + '"}';
    const errMsg =
      'API request to http://example.com failed after 1 attempt(s) with status 404: ' +
      longBody;
    const res = service._handleForwardingError(
      new Error(errMsg),
      'llm1',
      'http://example.com'
    );
    expect(
      res.errorDetailsForClient.llmApiResponseBodyPreview.endsWith('...')
    ).toBe(true);
  });

  test('forwardRequest logs preview when response body is long', async () => {
    mockExecuteWithRetry.mockResolvedValue({ data: 'x'.repeat(101) });
    const res = await service.forwardRequest('llm1', baseConfig, {});
    expect(res.success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('LLM Provider Response Body'),
      expect.objectContaining({ llmId: 'llm1' })
    );
  });
});
