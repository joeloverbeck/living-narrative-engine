import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ApiKeyService } from '../../src/services/apiKeyService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({ readFile: jest.fn() });

const createCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
  getStats: jest.fn(),
});

const createAppConfig = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/root'),
  isCacheEnabled: jest.fn(() => false),
  getApiKeyCacheTtl: jest.fn(() => 3600000),
});

describe('ApiKeyService remaining branch coverage', () => {
  let logger;
  let fsReader;
  let cacheService;
  let appConfig;
  let service;

  beforeEach(() => {
    logger = createLogger();
    fsReader = createFsReader();
    cacheService = createCacheService();
    appConfig = createAppConfig();
    service = new ApiKeyService(logger, fsReader, appConfig, cacheService);
    jest.clearAllMocks();
    process.env = {};
  });

  test('_createErrorDetails handles missing originalError', () => {
    const res = service._createErrorDetails('msg', 'stage', { llmId: 'id' });
    expect(res).toEqual({
      message: 'msg',
      stage: 'stage',
      details: { llmId: 'id' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('stage'),
      expect.objectContaining({ originalError: undefined })
    );
  });

  test('env var fail with no fallback when prior error was undefined', async () => {
    const realCreate = service._createErrorDetails.bind(service);
    service._createErrorDetails = jest
      .fn()
      .mockReturnValueOnce(undefined)
      .mockImplementation(realCreate);

    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'MISSING' },
      'llm'
    );
    expect(res.errorDetails.stage).toBe('api_key_env_var_fail_no_fallback');
    expect(service._createErrorDetails).toHaveBeenCalledTimes(2);
  });

  test('combinedReason uses message when reason missing', async () => {
    const fileErr = service._createErrorDetails(
      'file msg',
      'api_key_file_not_found_or_unreadable',
      { llmId: 'llm', attemptedFile: 'key.txt' }
    );
    delete fileErr.details.reason;
    service._readApiKeyFromFile = jest
      .fn()
      .mockResolvedValue({ key: null, error: fileErr });

    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'key.txt' },
      'llm'
    );
    expect(res.errorDetails.stage).toBe('api_key_all_sources_failed');
    expect(res.errorDetails.details.reason).toContain('file msg');
  });

  test('combinedReason defaults when both reason and message missing', async () => {
    const errObj = { stage: 'x', details: { llmId: 'llm' } };
    service._readApiKeyFromFile = jest
      .fn()
      .mockResolvedValue({ key: null, error: errObj });

    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'key.txt' },
      'llm'
    );
    expect(res.errorDetails.stage).toBe('api_key_all_sources_failed');
    expect(res.errorDetails.details.reason).toContain('see previous logs');
  });

  test('_createErrorDetails logs N/A when llmId missing', () => {
    const err = new Error('oops');
    const details = {};
    const res = service._createErrorDetails('msg', 'stage', details, err);
    expect(res).toEqual({
      message: 'msg',
      stage: 'stage',
      details: { originalErrorMessage: 'oops' },
    });
    expect(logger.warn.mock.calls[0][0]).toContain('N/A');
  });
});
