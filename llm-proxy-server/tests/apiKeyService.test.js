import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ApiKeyService } from '../src/services/apiKeyService.js';
import * as path from 'node:path';

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

const mockAppConfig = {
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/root'),
  isCacheEnabled: jest.fn(() => false), // Default to disabled for existing tests
  getApiKeyCacheTtl: jest.fn(() => 3600000),
};

describe('ApiKeyService', () => {
  let logger;
  let fsReader;
  let cacheService;
  let service;

  beforeEach(() => {
    logger = createLogger();
    fsReader = createFsReader();
    cacheService = createCacheService();
    service = new ApiKeyService(logger, fsReader, mockAppConfig, cacheService);
    jest.clearAllMocks();
  });

  test('isApiKeyRequired detects local types', () => {
    expect(service.isApiKeyRequired({ apiType: 'ollama' })).toBe(false);
    expect(service.isApiKeyRequired({ apiType: 'openai' })).toBe(true);
    expect(service.isApiKeyRequired(null)).toBe(false);
  });

  test('_readApiKeyFromFile returns trimmed key', async () => {
    fsReader.readFile.mockResolvedValue('secret\n');
    const result = await service._readApiKeyFromFile(
      'key.txt',
      '/root',
      'llm1'
    );
    expect(fsReader.readFile).toHaveBeenCalledWith(
      path.join('/root', 'key.txt'),
      'utf-8'
    );
    expect(result).toEqual({ key: 'secret', error: null });
  });

  test('_readApiKeyFromFile handles missing file', async () => {
    const err = new Error('no file');
    err.code = 'ENOENT';
    fsReader.readFile.mockRejectedValue(err);
    const result = await service._readApiKeyFromFile(
      'none.txt',
      '/root',
      'llm1'
    );
    expect(result.key).toBeNull();
    expect(result.error).toEqual(
      expect.objectContaining({ stage: 'api_key_file_not_found_or_unreadable' })
    );
  });
});
