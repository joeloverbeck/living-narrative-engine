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

const createAppConfig = (isCacheEnabled = true, cacheTtl = 3600000) => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/root'),
  isCacheEnabled: jest.fn(() => isCacheEnabled),
  getApiKeyCacheTtl: jest.fn(() => cacheTtl),
});

describe('ApiKeyService - Caching functionality', () => {
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

  describe('constructor', () => {
    test('should throw error when cacheService is not provided', () => {
      expect(
        () => new ApiKeyService(logger, fsReader, appConfig, null)
      ).toThrow('ApiKeyService: cacheService is required.');
    });

    test('should initialize with cacheService', () => {
      expect(
        () => new ApiKeyService(logger, fsReader, appConfig, cacheService)
      ).not.toThrow();
      expect(logger.debug).toHaveBeenCalledWith(
        'ApiKeyService: Instance created with caching support.'
      );
    });
  });

  describe('_readApiKeyFromFile with caching', () => {
    const fileName = 'test-key.txt';
    const projectRoot = '/root';
    const llmId = 'test-llm';
    const fullPath = path.join(projectRoot, fileName);
    const cacheKey = `api_key:file:${fullPath}`;
    const apiKey = 'test-api-key-123';

    describe('when caching is enabled', () => {
      test('should return cached API key when available', async () => {
        cacheService.get.mockReturnValue(apiKey);

        const result = await service._readApiKeyFromFile(
          fileName,
          projectRoot,
          llmId
        );

        expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
        expect(fsReader.readFile).not.toHaveBeenCalled();
        expect(result).toEqual({ key: apiKey, error: null });
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Retrieved API key from cache')
        );
      });

      test('should read from file and cache when not in cache', async () => {
        cacheService.get.mockReturnValue(undefined);
        fsReader.readFile.mockResolvedValue(`${apiKey}\n`);

        const result = await service._readApiKeyFromFile(
          fileName,
          projectRoot,
          llmId
        );

        expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
        expect(fsReader.readFile).toHaveBeenCalledWith(fullPath, 'utf-8');
        expect(cacheService.set).toHaveBeenCalledWith(
          cacheKey,
          apiKey,
          3600000
        );
        expect(result).toEqual({ key: apiKey, error: null });
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Cached API key')
        );
      });

      test('should not cache empty or whitespace-only keys', async () => {
        cacheService.get.mockReturnValue(undefined);
        fsReader.readFile.mockResolvedValue('   \n');

        const result = await service._readApiKeyFromFile(
          fileName,
          projectRoot,
          llmId
        );

        expect(cacheService.set).not.toHaveBeenCalled();
        expect(result.key).toBeNull();
        expect(result.error.stage).toBe('api_key_file_empty');
      });

      test('should not cache when file read fails', async () => {
        cacheService.get.mockReturnValue(undefined);
        const error = new Error('File not found');
        error.code = 'ENOENT';
        fsReader.readFile.mockRejectedValue(error);

        const result = await service._readApiKeyFromFile(
          fileName,
          projectRoot,
          llmId
        );

        expect(cacheService.set).not.toHaveBeenCalled();
        expect(result.key).toBeNull();
        expect(result.error.stage).toBe('api_key_file_not_found_or_unreadable');
      });
    });

    describe('when caching is disabled', () => {
      beforeEach(() => {
        appConfig = createAppConfig(false);
        service = new ApiKeyService(logger, fsReader, appConfig, cacheService);
      });

      test('should not check cache or cache the key', async () => {
        fsReader.readFile.mockResolvedValue(`${apiKey}\n`);

        const result = await service._readApiKeyFromFile(
          fileName,
          projectRoot,
          llmId
        );

        expect(cacheService.get).not.toHaveBeenCalled();
        expect(cacheService.set).not.toHaveBeenCalled();
        expect(fsReader.readFile).toHaveBeenCalledWith(fullPath, 'utf-8');
        expect(result).toEqual({ key: apiKey, error: null });
      });
    });
  });

  describe('invalidateCache', () => {
    const llmId = 'test-llm';

    test('should invalidate cache entries when caching is enabled', () => {
      cacheService.invalidatePattern.mockReturnValue(3);

      const count = service.invalidateCache(llmId);

      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );
      expect(count).toBe(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 3 cache entries')
      );
    });

    test('should return 0 when caching is disabled', () => {
      appConfig = createAppConfig(false);
      service = new ApiKeyService(logger, fsReader, appConfig, cacheService);

      const count = service.invalidateCache(llmId);

      expect(cacheService.invalidatePattern).not.toHaveBeenCalled();
      expect(count).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache is disabled')
      );
    });
  });

  describe('invalidateAllCache', () => {
    test('should invalidate all API key cache entries when caching is enabled', () => {
      cacheService.invalidatePattern.mockReturnValue(10);

      const count = service.invalidateAllCache();

      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );
      expect(count).toBe(10);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 10 cache entries for all API keys')
      );
    });

    test('should return 0 when caching is disabled', () => {
      appConfig = createAppConfig(false);
      service = new ApiKeyService(logger, fsReader, appConfig, cacheService);

      const count = service.invalidateAllCache();

      expect(cacheService.invalidatePattern).not.toHaveBeenCalled();
      expect(count).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache is disabled')
      );
    });
  });

  describe('getCacheStats', () => {
    test('should return cache statistics when caching is enabled', () => {
      const stats = {
        hits: 100,
        misses: 50,
        keys: 10,
        size: 1024,
      };
      cacheService.getStats.mockReturnValue(stats);

      const result = service.getCacheStats();

      expect(cacheService.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });

    test('should return null when caching is disabled', () => {
      appConfig = createAppConfig(false);
      service = new ApiKeyService(logger, fsReader, appConfig, cacheService);

      const result = service.getCacheStats();

      expect(cacheService.getStats).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getApiKey integration with caching', () => {
    test('should use cached API key from file when available', async () => {
      const cachedKey = 'cached-api-key';
      cacheService.get.mockReturnValue(cachedKey);

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_VAR',
          apiKeyFileName: 'openai.txt',
        },
        'llm-openai'
      );

      expect(result).toEqual({
        apiKey: cachedKey,
        errorDetails: null,
        source: "file 'openai.txt'",
      });
      expect(fsReader.readFile).not.toHaveBeenCalled();
    });

    test('should cache API key when read from file', async () => {
      cacheService.get.mockReturnValue(undefined);
      fsReader.readFile.mockResolvedValue('new-api-key\n');

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_VAR',
          apiKeyFileName: 'openai.txt',
        },
        'llm-openai'
      );

      expect(result.apiKey).toBe('new-api-key');
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('api_key:file:'),
        'new-api-key',
        3600000
      );
    });

    test('should prefer environment variable over cached file', async () => {
      process.env.TEST_API_KEY = 'env-api-key';
      cacheService.get.mockReturnValue('cached-file-key');

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'openai.txt',
        },
        'llm-openai'
      );

      expect(result).toEqual({
        apiKey: 'env-api-key',
        errorDetails: null,
        source: "environment variable 'TEST_API_KEY'",
      });
      expect(cacheService.get).not.toHaveBeenCalled();

      delete process.env.TEST_API_KEY;
    });

    test('should combine error details when both environment and file sources fail', async () => {
      delete process.env.MISSING_VAR;
      cacheService.get.mockReturnValue(undefined);

      const fileError = new Error('File not found');
      fileError.code = 'ENOENT';
      fsReader.readFile.mockRejectedValue(fileError);

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_VAR',
          apiKeyFileName: 'openai.txt',
        },
        'llm-openai'
      );

      expect(result.apiKey).toBeNull();
      expect(result.source).toBe('N/A');
      expect(result.errorDetails).not.toBeNull();
      expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
      expect(result.errorDetails.details).toMatchObject({
        llmId: 'llm-openai',
        attemptedEnvVar: 'MISSING_VAR',
        attemptedFile: 'openai.txt',
      });
      expect(result.errorDetails.details.reason).toContain(
        "Environment variable 'MISSING_VAR' was not set or empty."
      );
      expect(result.errorDetails.details.reason).toContain(
        "File 'openai.txt' retrieval also failed"
      );
      expect(result.errorDetails.details.reason).toContain('ENOENT');
    });
  });
});
