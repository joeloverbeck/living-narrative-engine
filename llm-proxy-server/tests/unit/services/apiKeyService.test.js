import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';
import * as path from 'node:path';

// Test utilities
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
  resetStats: jest.fn(),
});

const createAppConfig = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/root'),
  isCacheEnabled: jest.fn(() => false),
  getApiKeyCacheTtl: jest.fn(() => 3600000),
});

const ORIGINAL_ENV = { ...process.env };

describe('ApiKeyService', () => {
  let logger;
  let fsReader;
  let cacheService;
  let appConfig;
  let service;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    logger = createLogger();
    fsReader = createFsReader();
    cacheService = createCacheService();
    appConfig = createAppConfig();
    service = new ApiKeyService(logger, fsReader, appConfig, cacheService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
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

      expect(
        () => new ApiKeyService(logger, fsReader, appConfig, null)
      ).toThrow('ApiKeyService: cacheService is required.');
    });

    test('successfully initializes with valid dependencies', () => {
      expect(service).toBeInstanceOf(ApiKeyService);
      expect(() =>
        service.isApiKeyRequired({ apiType: 'openai' })
      ).not.toThrow();
    });
  });

  describe('Core Functionality', () => {
    test('isApiKeyRequired detects local types', () => {
      expect(service.isApiKeyRequired({ apiType: 'ollama' })).toBe(false);
      expect(service.isApiKeyRequired({ apiType: 'openai' })).toBe(true);
      expect(service.isApiKeyRequired(null)).toBe(false);
    });

    test('returns null when API key not required', async () => {
      const result = await service.getApiKey({ apiType: 'ollama' }, 'llm1');
      expect(result).toEqual({
        apiKey: null,
        errorDetails: null,
        source: 'Not applicable (local LLM or no key needed)',
      });
    });

    test('retrieves API key from environment variable', async () => {
      process.env.MY_KEY = 'abc123';
      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MY_KEY',
          apiKeyFileName: 'unused.txt',
        },
        'llm2'
      );

      expect(result).toEqual({
        apiKey: 'abc123',
        errorDetails: null,
        source: "environment variable 'MY_KEY'",
      });
      expect(fsReader.readFile).not.toHaveBeenCalled();
    });

    test('normalizes whitespace around env var configuration and value', async () => {
      process.env.TRIMMED_ENV_KEY = '   env-secret-value   ';

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: '  TRIMMED_ENV_KEY  ',
          apiKeyFileName: 'not-used.txt',
        },
        'llm-trim-env'
      );

      expect(result).toEqual({
        apiKey: 'env-secret-value',
        errorDetails: null,
        source: "environment variable 'TRIMMED_ENV_KEY'",
      });
      expect(fsReader.readFile).not.toHaveBeenCalled();
    });

    test('falls back to file when env var missing', async () => {
      fsReader.readFile.mockResolvedValue('filekey\n');
      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING',
          apiKeyFileName: 'api.txt',
        },
        'llm3'
      );

      expect(fsReader.readFile).toHaveBeenCalledWith(
        path.join('/root', 'api.txt'),
        'utf-8'
      );
      expect(result).toEqual({
        apiKey: 'filekey',
        errorDetails: null,
        source: "file 'api.txt'",
      });
    });

    test('trims file configuration when env var contains only whitespace', async () => {
      process.env.WHITESPACE_ENV = '    ';
      fsReader.readFile.mockResolvedValue('  file-secret   ');

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: '  WHITESPACE_ENV  ',
          apiKeyFileName: '  spaced.key  ',
        },
        'llm-trim-file'
      );

      expect(fsReader.readFile).toHaveBeenCalledWith(
        path.join('/root', 'spaced.key'),
        'utf-8'
      );
      expect(result).toEqual({
        apiKey: 'file-secret',
        errorDetails: null,
        source: "file 'spaced.key'",
      });
    });

    test('provides combined error details when both env var and file retrieval fail', async () => {
      delete process.env.MISSING_ENV;
      const fileError = new Error('file not found');
      fileError.code = 'ENOENT';
      fsReader.readFile.mockRejectedValue(fileError);

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_ENV',
          apiKeyFileName: 'missing.key',
        },
        'llm-both-fail'
      );

      expect(result.apiKey).toBeNull();
      expect(result.source).toBe('N/A');
      expect(result.errorDetails).toMatchObject({
        stage: 'api_key_all_sources_failed',
        message:
          'Failed to retrieve API key. All configured sources (environment variable and file) failed.',
        details: expect.objectContaining({
          llmId: 'llm-both-fail',
          attemptedEnvVar: 'MISSING_ENV',
          attemptedFile: 'missing.key',
        }),
      });
      expect(result.errorDetails.details.reason).toContain(
        "Environment variable 'MISSING_ENV' was not set or empty."
      );
      expect(result.errorDetails.details.reason).toContain(
        "File 'missing.key'"
      );
    });

    test('merges error sources even when file reader does not provide details', async () => {
      delete process.env.MISSING_ENV_WITHOUT_DETAILS;

      const readSpy = jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_ENV_WITHOUT_DETAILS',
          apiKeyFileName: 'missing.key',
        },
        'llm-missing-details'
      );

      expect(readSpy).toHaveBeenCalled();
      expect(result.apiKey).toBeNull();
      expect(result.errorDetails).toMatchObject({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-missing-details',
          attemptedEnvVar: 'MISSING_ENV_WITHOUT_DETAILS',
          attemptedFile: 'missing.key',
          reason: expect.stringContaining('see previous logs'),
        }),
      });
      expect(result.errorDetails.details.originalErrorMessage).toBeUndefined();
    });

    test('retains original file error details when available', async () => {
      delete process.env.MISSING_ENV_WITH_FILE_REASON;

      const fileErrorDetails = service._createErrorDetails(
        'File could not be read',
        'api_key_file_not_found_or_unreadable',
        {
          llmId: 'llm-detailed-error',
          attemptedFile: 'detailed.key',
          reason: 'Simulated file system failure',
          originalErrorMessage: 'ENOENT: missing file',
        }
      );

      const readSpy = jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: fileErrorDetails });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_ENV_WITH_FILE_REASON',
          apiKeyFileName: 'detailed.key',
        },
        'llm-detailed-error'
      );

      expect(readSpy).toHaveBeenCalled();
      expect(result.errorDetails).toMatchObject({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          attemptedEnvVar: 'MISSING_ENV_WITH_FILE_REASON',
          attemptedFile: 'detailed.key',
          originalErrorMessage: 'ENOENT: missing file',
        }),
      });
      expect(result.errorDetails.details.reason).toContain(
        'Simulated file system failure'
      );
    });

    test('continues gracefully when error details helpers return null', async () => {
      const originalCreateErrorDetails =
        service._createErrorDetails.bind(service);

      const createErrorDetailsSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementation((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        });

      const fileReadSpy = jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_KEY',
          apiKeyFileName: 'proxy.key',
        },
        'llm-unexpected'
      );

      expect(fileReadSpy).toHaveBeenCalledWith(
        'proxy.key',
        '/root',
        'llm-unexpected'
      );
      expect(logger.error).toHaveBeenCalledWith(
        "ApiKeyService.getApiKey: Reached unexpected state for llmId 'llm-unexpected'. API key is null, but no specific error was set. This should not happen."
      );
      expect(createErrorDetailsSpy).toHaveBeenCalledTimes(3);
      expect(createErrorDetailsSpy.mock.calls[1][1]).toBe(
        'api_key_all_sources_failed'
      );
      expect(createErrorDetailsSpy.mock.calls[2][1]).toBe(
        'api_key_retrieval_unknown_error'
      );
      expect(result).toEqual({
        apiKey: null,
        errorDetails: null,
        source: 'N/A',
      });
    });

    test('falls back to unknown error details when earlier consolidation fails', async () => {
      const originalCreateErrorDetails =
        service._createErrorDetails.bind(service);

      const createErrorDetailsSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementation((...args) => originalCreateErrorDetails(...args));

      jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_KEY',
          apiKeyFileName: 'missing.key',
        },
        'llm-fallback-final'
      );

      expect(createErrorDetailsSpy).toHaveBeenCalledTimes(3);
      expect(createErrorDetailsSpy.mock.calls[1][1]).toBe(
        'api_key_all_sources_failed'
      );
      expect(createErrorDetailsSpy.mock.calls[2][1]).toBe(
        'api_key_retrieval_unknown_error'
      );

      expect(result).toEqual({
        apiKey: null,
        errorDetails: expect.objectContaining({
          stage: 'api_key_retrieval_unknown_error',
          details: expect.objectContaining({
            llmId: 'llm-fallback-final',
            attemptedEnvVar: 'MISSING_KEY',
            attemptedFile: 'missing.key',
          }),
        }),
        source: 'N/A',
      });
    });

    test('fallback populates attemptedEnvVar with N/A when no env var is configured', async () => {
      const originalCreateErrorDetails =
        service._createErrorDetails.bind(service);

      const createErrorDetailsSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementation((...args) => originalCreateErrorDetails(...args));

      jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyFileName: 'missing.key',
        },
        'llm-no-env'
      );

      expect(createErrorDetailsSpy).toHaveBeenCalledTimes(2);
      expect(createErrorDetailsSpy.mock.calls[0][1]).toBe(
        'api_key_file_fail_no_env_fallback'
      );
      expect(createErrorDetailsSpy.mock.calls[1][1]).toBe(
        'api_key_retrieval_unknown_error'
      );

      expect(result).toEqual({
        apiKey: null,
        errorDetails: expect.objectContaining({
          stage: 'api_key_retrieval_unknown_error',
          details: expect.objectContaining({
            llmId: 'llm-no-env',
            attemptedEnvVar: 'N/A',
            attemptedFile: 'missing.key',
          }),
        }),
        source: 'N/A',
      });
    });

    test('fallback populates attemptedFile with N/A when no file is configured', async () => {
      delete process.env.ONLY_ENV;
      const originalCreateErrorDetails =
        service._createErrorDetails.bind(service);

      const createErrorDetailsSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementation((...args) => originalCreateErrorDetails(...args));

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'ONLY_ENV',
        },
        'llm-no-file'
      );

      expect(createErrorDetailsSpy).toHaveBeenCalledTimes(3);
      expect(createErrorDetailsSpy.mock.calls[0][1]).toBe(
        'api_key_env_var_not_set_or_empty'
      );
      expect(createErrorDetailsSpy.mock.calls[1][1]).toBe(
        'api_key_env_var_fail_no_fallback'
      );
      expect(createErrorDetailsSpy.mock.calls[2][1]).toBe(
        'api_key_retrieval_unknown_error'
      );

      expect(result).toEqual({
        apiKey: null,
        errorDetails: expect.objectContaining({
          stage: 'api_key_retrieval_unknown_error',
          details: expect.objectContaining({
            llmId: 'llm-no-file',
            attemptedEnvVar: 'ONLY_ENV',
            attemptedFile: 'N/A',
          }),
        }),
        source: 'N/A',
      });
    });

    test('constructs combined failure reason when both sources fail without detailed errors', async () => {
      delete process.env.NULL_DETAIL_ENV;

      const createErrorDetailsSpy = jest.spyOn(service, '_createErrorDetails');

      jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'NULL_DETAIL_ENV',
          apiKeyFileName: 'missing.key',
        },
        'llm-both-null-details'
      );

      expect(createErrorDetailsSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve API key.'),
        'api_key_all_sources_failed',
        expect.objectContaining({
          llmId: 'llm-both-null-details',
          attemptedEnvVar: 'NULL_DETAIL_ENV',
          attemptedFile: 'missing.key',
          reason: expect.stringContaining('see previous logs'),
        })
      );

      expect(result).toEqual({
        apiKey: null,
        errorDetails: expect.objectContaining({
          stage: 'api_key_all_sources_failed',
          details: expect.objectContaining({
            llmId: 'llm-both-null-details',
            attemptedEnvVar: 'NULL_DETAIL_ENV',
            attemptedFile: 'missing.key',
            reason: expect.stringContaining('see previous logs'),
          }),
        }),
        source: 'N/A',
      });
    });

    test('creates fallback error when earlier attempts fail to set details', async () => {
      const originalCreateErrorDetails =
        service._createErrorDetails.bind(service);

      const createErrorDetailsSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementationOnce((...args) => {
          originalCreateErrorDetails(...args);
          return null;
        })
        .mockImplementation((...args) => originalCreateErrorDetails(...args));

      jest
        .spyOn(service, '_readApiKeyFromFile')
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING_KEY',
          apiKeyFileName: 'missing.key',
        },
        'llm-fallback'
      );

      expect(createErrorDetailsSpy).toHaveBeenCalledTimes(3);
      expect(createErrorDetailsSpy.mock.calls[2][1]).toBe(
        'api_key_retrieval_unknown_error'
      );
      expect(logger.error).toHaveBeenCalledWith(
        "ApiKeyService.getApiKey: Reached unexpected state for llmId 'llm-fallback'. API key is null, but no specific error was set. This should not happen."
      );
      expect(result).toEqual({
        apiKey: null,
        errorDetails: expect.objectContaining({
          stage: 'api_key_retrieval_unknown_error',
          message:
            'API key for LLM could not be retrieved due to an unknown internal error.',
          details: expect.objectContaining({
            llmId: 'llm-fallback',
            attemptedEnvVar: 'MISSING_KEY',
            attemptedFile: 'missing.key',
          }),
        }),
        source: 'N/A',
      });
    });
  });

  describe('Cache management utilities', () => {
    test('invalidateCache returns 0 when cache is disabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(false);

      const result = service.invalidateCache('llm-cache-disabled');

      expect(result).toBe(0);
      expect(cacheService.invalidatePattern).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "ApiKeyService.invalidateCache: Cache is disabled, nothing to invalidate for llmId 'llm-cache-disabled'."
      );
    });

    test('invalidateCache removes cached entries when cache is enabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(true);
      cacheService.invalidatePattern.mockReturnValue(3);

      const result = service.invalidateCache('llm-cache-enabled');

      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );
      const pattern = cacheService.invalidatePattern.mock.calls[0][0];
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.test('api_key:file:/tmp/example.txt')).toBe(true);

      expect(logger.info).toHaveBeenCalledWith(
        'ApiKeyService.invalidateCache: Invalidated 3 cache entries for pattern matching API keys.'
      );
      expect(result).toBe(3);
    });

    test('invalidateAllCache returns 0 when cache is disabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(false);

      const result = service.invalidateAllCache();

      expect(result).toBe(0);
      expect(cacheService.invalidatePattern).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'ApiKeyService.invalidateAllCache: Cache is disabled, nothing to invalidate.'
      );
    });

    test('invalidateAllCache clears all entries when cache is enabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(true);
      cacheService.invalidatePattern.mockReturnValue(5);

      const result = service.invalidateAllCache();

      expect(cacheService.invalidatePattern).toHaveBeenCalledWith(
        expect.any(RegExp)
      );
      const pattern = cacheService.invalidatePattern.mock.calls[0][0];
      expect(pattern.test('api_key:file:/tmp/another.txt')).toBe(true);

      expect(logger.info).toHaveBeenCalledWith(
        'ApiKeyService.invalidateAllCache: Invalidated 5 cache entries for all API keys.'
      );
      expect(result).toBe(5);
    });

    test('getCacheStats returns null when cache is disabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(false);

      const result = service.getCacheStats();

      expect(result).toBeNull();
      expect(cacheService.getStats).not.toHaveBeenCalled();
    });

    test('getCacheStats returns statistics when cache is enabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(true);
      const stats = { hits: 10, misses: 2 };
      cacheService.getStats.mockReturnValue(stats);

      const result = service.getCacheStats();

      expect(result).toBe(stats);
      expect(cacheService.getStats).toHaveBeenCalledTimes(1);
    });

    test('resetCacheStats does nothing when cache is disabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(false);

      service.resetCacheStats();

      expect(cacheService.resetStats).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'ApiKeyService.resetCacheStats: Cache is disabled, nothing to reset.'
      );
    });

    test('resetCacheStats clears statistics when cache is enabled', () => {
      appConfig.isCacheEnabled.mockReturnValue(true);

      service.resetCacheStats();

      expect(cacheService.resetStats).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        'ApiKeyService.resetCacheStats: Cache statistics reset.'
      );
    });
  });

  describe('File Reading Operations', () => {
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
        expect.objectContaining({
          stage: 'api_key_file_not_found_or_unreadable',
        })
      );
    });

    test('_readApiKeyFromFile handles empty file', async () => {
      fsReader.readFile.mockResolvedValue('   ');
      const result = await service._readApiKeyFromFile(
        'key.txt',
        '/root',
        'id1'
      );

      expect(result.key).toBeNull();
      expect(result.error.stage).toBe('api_key_file_empty');
    });

    test('_readApiKeyFromFile handles unexpected error', async () => {
      const err = new Error('locked');
      err.code = 'EBUSY';
      fsReader.readFile.mockRejectedValue(err);

      const result = await service._readApiKeyFromFile(
        'key.txt',
        '/root',
        'id1'
      );

      expect(result.key).toBeNull();
      expect(result.error.stage).toBe('api_key_file_read_exception');
    });

    test('_readApiKeyFromFile warns when file path contains directories', async () => {
      fsReader.readFile.mockResolvedValue('secret');
      await service._readApiKeyFromFile('../key.txt', '/root', 'llm1');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('normalized')
      );
    });

    test('_readApiKeyFromFile normalizes directory traversal attempts before reading and caching', async () => {
      appConfig.isCacheEnabled.mockReturnValue(true);
      appConfig.getApiKeyCacheTtl.mockReturnValue(5000);
      cacheService.get.mockReturnValue(undefined);
      fsReader.readFile.mockResolvedValue('trailing-space-key   ');

      const result = await service._readApiKeyFromFile(
        '../../secrets/api.key',
        '/var/keys',
        'llm-sanitized'
      );

      const sanitizedPath = path.join('/var/keys', 'api.key');
      expect(fsReader.readFile).toHaveBeenCalledWith(sanitizedPath, 'utf-8');
      expect(cacheService.set).toHaveBeenCalledWith(
        `api_key:file:${sanitizedPath}`,
        'trailing-space-key',
        5000
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("was normalized to 'api.key'")
      );
      expect(result).toEqual({ key: 'trailing-space-key', error: null });
    });

    test('_readApiKeyFromFile reports sanitized attemptedFile paths on read errors', async () => {
      const accessError = new Error('permission denied');
      accessError.code = 'EACCES';
      fsReader.readFile.mockRejectedValue(accessError);

      const result = await service._readApiKeyFromFile(
        '../nested/secret.key',
        '/secure/configs',
        'llm-error'
      );

      expect(result.error.stage).toBe('api_key_file_not_found_or_unreadable');
      expect(result.error).toEqual(
        expect.objectContaining({
          details: expect.objectContaining({
            attemptedFile: path.join('/secure/configs', 'secret.key'),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('getApiKey env var only and missing', async () => {
      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'NONE' },
        'id2'
      );

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe(
        'api_key_env_var_not_set_or_empty'
      );
    });

    test('getApiKey file only and fails', async () => {
      const err = new Error('oops');
      err.code = 'ENOENT';
      fsReader.readFile.mockRejectedValue(err);

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyFileName: 'key.txt' },
        'id3'
      );

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe(
        'api_key_file_not_found_or_unreadable'
      );
    });

    test('getApiKey with file only and no result sets fail_no_env_fallback', async () => {
      service._readApiKeyFromFile = jest
        .fn()
        .mockResolvedValue({ key: null, error: null });

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyFileName: 'key.txt' },
        'id'
      );

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe(
        'api_key_file_fail_no_env_fallback'
      );
    });

    test('getApiKey with no configured sources', async () => {
      const result = await service.getApiKey({ apiType: 'openai' }, 'id2');

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe('api_key_config_sources_missing');
    });

    test('returns error when file root path not configured', async () => {
      appConfig.getProxyProjectRootPathForApiKeyFiles.mockReturnValue('');
      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'api.txt' },
        'llm4'
      );

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
      expect(result.errorDetails.details.reason).toContain(
        'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES'
      );
    });

    test('returns combined error when env var and file both fail', async () => {
      const err = new Error('missing');
      err.code = 'ENOENT';
      fsReader.readFile.mockRejectedValue(err);

      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'MISSING',
          apiKeyFileName: 'api.txt',
        },
        'llm5'
      );

      expect(result.apiKey).toBeNull();
      expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
    });
  });

  describe('Private Methods', () => {
    test('_createErrorDetails attaches original error message', () => {
      const err = new Error('boom');
      const details = { llmId: 'x' };
      const result = service._createErrorDetails('msg', 'stage', details, err);

      expect(result).toEqual({
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

    test('_createErrorDetails handles missing originalError', () => {
      const result = service._createErrorDetails('msg', 'stage', {
        llmId: 'id',
      });

      expect(result).toEqual({
        message: 'msg',
        stage: 'stage',
        details: { llmId: 'id' },
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('stage'),
        expect.objectContaining({ originalError: undefined })
      );
    });

    test('_createErrorDetails logs N/A when llmId missing', () => {
      const err = new Error('oops');
      const details = {};
      const result = service._createErrorDetails('msg', 'stage', details, err);

      expect(result).toEqual({
        message: 'msg',
        stage: 'stage',
        details: { originalErrorMessage: 'oops' },
      });
      expect(logger.warn.mock.calls[0][0]).toContain('N/A');
    });

    test('_createErrorDetails preserves pre-existing originalErrorMessage metadata', () => {
      const err = new Error('should not override');
      const details = {
        llmId: 'llm-preexisting',
        originalErrorMessage: 'prior context',
      };

      const result = service._createErrorDetails('msg', 'stage', details, err);

      expect(result).toEqual({
        message: 'msg',
        stage: 'stage',
        details: {
          llmId: 'llm-preexisting',
          originalErrorMessage: 'prior context',
        },
      });

      const warnCall = logger.warn.mock.calls.at(-1);
      expect(warnCall[0]).toContain('stage');
      expect(warnCall[1]).toEqual(
        expect.objectContaining({
          details: expect.objectContaining({
            llmId: 'llm-preexisting',
            originalErrorMessage: 'prior context',
          }),
          originalError: expect.objectContaining({
            message: 'should not override',
            name: err.name,
          }),
        })
      );
    });
  });

  describe('Edge Cases and Branch Coverage', () => {
    test('env var fail with no fallback when prior error was undefined', async () => {
      const realCreate = service._createErrorDetails.bind(service);
      service._createErrorDetails = jest
        .fn()
        .mockReturnValueOnce(undefined)
        .mockImplementation(realCreate);

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'MISSING' },
        'llm'
      );

      expect(result.errorDetails.stage).toBe(
        'api_key_env_var_fail_no_fallback'
      );
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

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'key.txt' },
        'llm'
      );

      expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
      expect(result.errorDetails.details.reason).toContain('file msg');
    });

    test('combinedReason defaults when both reason and message missing', async () => {
      const errObj = { stage: 'x', details: { llmId: 'llm' } };
      service._readApiKeyFromFile = jest
        .fn()
        .mockResolvedValue({ key: null, error: errObj });

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'key.txt' },
        'llm'
      );

      expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
      expect(result.errorDetails.details.reason).toContain('see previous logs');
    });

    test('falls back to unknown error when prior builders return null', async () => {
      delete process.env.MISSING_ONLY_ENV_KEY;

      const realCreate = service._createErrorDetails.bind(service);
      const createSpy = jest
        .spyOn(service, '_createErrorDetails')
        .mockImplementationOnce(() => null)
        .mockImplementationOnce(() => null)
        .mockImplementation((...args) => realCreate(...args));

      const result = await service.getApiKey(
        { apiType: 'openai', apiKeyEnvVar: 'MISSING_ONLY_ENV_KEY' },
        'llm-unknown'
      );

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(createSpy.mock.calls[2][1]).toBe(
        'api_key_retrieval_unknown_error'
      );
      expect(result.apiKey).toBeNull();
      expect(result.errorDetails).toEqual(
        expect.objectContaining({ stage: 'api_key_retrieval_unknown_error' })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('unexpected state for llmId')
      );
    });
  });

  describe('Security: API Key Logging Verification', () => {
    test('_readApiKeyFromFile does not log API key content', async () => {
      fsReader.readFile.mockResolvedValue('super-secret-api-key-12345');

      await service._readApiKeyFromFile('key.txt', '/root', 'test-llm');

      // Verify that no log calls contain the actual API key
      const allLogCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const logMessage = call[0] || '';
        expect(logMessage).not.toContain('super-secret-api-key-12345');
        // Only look for actual API key values being logged, not the word "key"
        expect(logMessage).not.toMatch(/\b[a-zA-Z0-9\-_]{20,}\b/); // No long key-like values
      });
    });

    test('getApiKey does not log API key from environment variable', async () => {
      const testApiKey = 'env-secret-key-67890';
      const originalEnv = process.env.TEST_API_KEY;
      process.env.TEST_API_KEY = testApiKey;

      try {
        const llmConfig = {
          apiType: 'openai',
          apiKeyEnvVar: 'TEST_API_KEY',
        };

        await service.getApiKey(llmConfig, 'test-llm');

        // Verify that no log calls contain the actual API key
        const allLogCalls = [
          ...logger.debug.mock.calls,
          ...logger.info.mock.calls,
          ...logger.warn.mock.calls,
          ...logger.error.mock.calls,
        ];

        allLogCalls.forEach((call) => {
          const logMessage = call[0] || '';
          expect(logMessage).not.toContain(testApiKey);
          // Only look for actual API key values being logged, not the word "key"
          expect(logMessage).not.toMatch(/\b[a-zA-Z0-9\-_]{20,}\b/); // No long key-like values
        });
      } finally {
        if (originalEnv !== undefined) {
          process.env.TEST_API_KEY = originalEnv;
        } else {
          delete process.env.TEST_API_KEY;
        }
      }
    });

    test('getApiKey does not log API key from file', async () => {
      const testApiKey = 'file-secret-key-abcdef';
      fsReader.readFile.mockResolvedValue(testApiKey);

      const llmConfig = {
        apiType: 'openai',
        apiKeyFileName: 'test-key.txt',
      };

      await service.getApiKey(llmConfig, 'test-llm');

      // Verify that no log calls contain the actual API key
      const allLogCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const logMessage = call[0] || '';
        expect(logMessage).not.toContain(testApiKey);
        // Only look for actual API key values being logged, not the word "key"
        expect(logMessage).not.toMatch(/\b[a-zA-Z0-9\-_]{20,}\b/); // No long key-like values
      });
    });

    test('cached API key retrieval does not log key content', async () => {
      const testApiKey = 'cached-secret-key-xyz789';
      appConfig.isCacheEnabled.mockReturnValue(true);
      cacheService.get.mockReturnValue(testApiKey);

      const result = await service._readApiKeyFromFile(
        'key.txt',
        '/root',
        'test-llm'
      );

      expect(result.key).toBe(testApiKey);

      // Verify that no log calls contain the actual API key
      const allLogCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const logMessage = call[0] || '';
        expect(logMessage).not.toContain(testApiKey);
        // Only look for actual API key values being logged, not the word "key"
        expect(logMessage).not.toMatch(/\b[a-zA-Z0-9\-_]{20,}\b/); // No long key-like values
      });
    });

    test('logs success messages without exposing key material', async () => {
      fsReader.readFile.mockResolvedValue('secret-api-key');

      await service._readApiKeyFromFile('key.txt', '/root', 'test-llm');

      // Verify that success is logged but without key material
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully retrieved API key')
      );

      // But ensure the log message doesn't contain the actual key
      const successLogCall = logger.info.mock.calls.find((call) =>
        call[0].includes('Successfully retrieved API key')
      );

      expect(successLogCall[0]).not.toContain('secret-api-key');
      expect(successLogCall[0]).not.toMatch(/\b[a-zA-Z0-9\-_]{20,}\b/); // No long key-like values
    });

    test('error logging does not expose partial key information', async () => {
      const testApiKey = 'secret-key-that-should-not-appear';
      fsReader.readFile.mockResolvedValue(''); // Empty file

      await service._readApiKeyFromFile('key.txt', '/root', 'test-llm');

      // Verify that error logs don't contain any API key information
      const allLogCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const logMessage = call[0] || '';
        expect(logMessage).not.toContain(testApiKey);
        // Check for any masked patterns that could leak information
        expect(logMessage).not.toMatch(/\*{3,}/); // No asterisk masking patterns
        expect(logMessage).not.toMatch(/Key:\s*[*]+/); // No "Key: ***" patterns
      });
    });

    test('prevents accidental key logging through object serialization', async () => {
      const testApiKey = 'serialization-test-key-123';
      fsReader.readFile.mockResolvedValue(testApiKey);

      await service._readApiKeyFromFile('key.txt', '/root', 'test-llm');

      // Check all log calls and their additional data parameters
      const allLogCalls = [
        ...logger.debug.mock.calls,
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        // Check all parameters passed to the logger
        call.forEach((param) => {
          const paramStr =
            typeof param === 'object' ? JSON.stringify(param) : String(param);
          expect(paramStr).not.toContain(testApiKey);
        });
      });
    });
  });
});
