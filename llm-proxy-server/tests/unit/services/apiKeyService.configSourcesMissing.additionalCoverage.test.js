import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';

const ORIGINAL_ENV = { ...process.env };

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
  getApiKeyCacheTtl: jest.fn(() => 3_600_000),
});

describe('ApiKeyService additional coverage: configuration edge cases', () => {
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

  test('provides rich error details when no API key sources are configured', async () => {
    const result = await service.getApiKey(
      { apiType: 'openai' },
      'llm-missing-sources'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_config_sources_missing',
        message:
          'No API key source (apiKeyEnvVar or apiKeyFileName) configured for cloud LLM.',
        details: expect.objectContaining({
          llmId: 'llm-missing-sources',
          reason: expect.stringContaining(
            'LLM configuration for this cloud service does not specify how to obtain an API key.'
          ),
        }),
      })
    );
  });

  test('short-circuits fallback logic when environment variable retrieval succeeds', async () => {
    process.env.DIRECT_API_KEY = 'direct-env-secret';
    const fileSpy = jest
      .spyOn(service, '_readApiKeyFromFile')
      .mockImplementation(() => {
        throw new Error(
          'File fallback should not be invoked when env var succeeds'
        );
      });
    const errorSpy = jest.spyOn(service, '_createErrorDetails');

    try {
      const result = await service.getApiKey(
        {
          apiType: 'openai',
          apiKeyEnvVar: 'DIRECT_API_KEY',
          apiKeyFileName: 'fallback.key',
        },
        'llm-short-circuit'
      );

      expect(result).toEqual({
        apiKey: 'direct-env-secret',
        errorDetails: null,
        source: "environment variable 'DIRECT_API_KEY'",
      });
      expect(fileSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(fsReader.readFile).not.toHaveBeenCalled();
    } finally {
      fileSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
