import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ApiKeyService } from '../src/services/apiKeyService.js';

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

describe('ApiKeyService additional coverage', () => {
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
  });

  test('constructor enforces required dependencies', () => {
    expect(
      () => new ApiKeyService(null, fsReader, appConfig, cacheService)
    ).toThrow('ApiKeyService: logger is required.');
    expect(
      () => new ApiKeyService(logger, null, appConfig, cacheService)
    ).toThrow('ApiKeyService: fileSystemReader is required.');
    expect(
      () => new ApiKeyService(logger, fsReader, null, cacheService)
    ).toThrow('ApiKeyService: appConfigService is required.');
    expect(() => new ApiKeyService(logger, fsReader, appConfig, null)).toThrow(
      'ApiKeyService: cacheService is required.'
    );
  });

  test('_createErrorDetails attaches original error message', () => {
    const err = new Error('boom');
    const details = { llmId: 'x' };
    const res = service._createErrorDetails('msg', 'stage', details, err);
    expect(res).toEqual({
      message: 'msg',
      stage: 'stage',
      details: { llmId: 'x', originalErrorMessage: 'boom' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('stage'),
      expect.objectContaining({
        details: { llmId: 'x', originalErrorMessage: 'boom' },
      })
    );
  });

  test('_readApiKeyFromFile warns when file path contains directories', async () => {
    fsReader.readFile.mockResolvedValue('secret');
    await service._readApiKeyFromFile('../key.txt', '/root', 'llm1');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('normalized')
    );
  });

  test('getApiKey with file only and no result sets fail_no_env_fallback', async () => {
    service._readApiKeyFromFile = jest
      .fn()
      .mockResolvedValue({ key: null, error: null });
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyFileName: 'key.txt' },
      'id'
    );
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_file_fail_no_env_fallback');
  });

  test('getApiKey with no configured sources', async () => {
    const res = await service.getApiKey({ apiType: 'openai' }, 'id2');
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_config_sources_missing');
  });
});
