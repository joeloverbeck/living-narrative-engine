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

describe('ApiKeyService additional cases', () => {
  let logger;
  let fsReader;
  let cacheService;
  let service;

  beforeEach(() => {
    logger = createLogger();
    fsReader = createFsReader();
    cacheService = createCacheService();
    service = new ApiKeyService(
      logger,
      fsReader,
      {
        getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/root'),
        isCacheEnabled: jest.fn(() => false),
        getApiKeyCacheTtl: jest.fn(() => 3600000),
      },
      cacheService
    );
    jest.clearAllMocks();
  });

  test('_readApiKeyFromFile handles empty file', async () => {
    fsReader.readFile.mockResolvedValue('   ');
    const result = await service._readApiKeyFromFile('key.txt', '/root', 'id1');
    expect(result.key).toBeNull();
    expect(result.error.stage).toBe('api_key_file_empty');
  });

  test('_readApiKeyFromFile handles unexpected error', async () => {
    const err = new Error('locked');
    err.code = 'EBUSY';
    fsReader.readFile.mockRejectedValue(err);
    const result = await service._readApiKeyFromFile('key.txt', '/root', 'id1');
    expect(result.key).toBeNull();
    expect(result.error.stage).toBe('api_key_file_read_exception');
  });

  test('getApiKey env var only and missing', async () => {
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'NONE' },
      'id2'
    );
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_env_var_not_set_or_empty');
  });

  test('getApiKey file only and fails', async () => {
    const err = new Error('oops');
    err.code = 'ENOENT';
    fsReader.readFile.mockRejectedValue(err);
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyFileName: 'key.txt' },
      'id3'
    );
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_file_not_found_or_unreadable');
  });
});
