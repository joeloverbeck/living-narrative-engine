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
