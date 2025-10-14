import {
  describe,
  it,
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

const createFileSystemReader = () => ({
  readFile: jest.fn(),
});

const createCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
  getStats: jest.fn(),
  resetStats: jest.fn(),
});

const createAppConfigService = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/configs'),
  isCacheEnabled: jest.fn(() => false),
  getApiKeyCacheTtl: jest.fn(() => 60_000),
});

describe('ApiKeyService environment-variable preferred path coverage', () => {
  let logger;
  let fsReader;
  let cacheService;
  let appConfigService;
  let apiKeyService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };

    logger = createLogger();
    fsReader = createFileSystemReader();
    cacheService = createCacheService();
    appConfigService = createAppConfigService();

    apiKeyService = new ApiKeyService(
      logger,
      fsReader,
      appConfigService,
      cacheService
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('short-circuits to the environment variable when both sources are configured', async () => {
    process.env.DUAL_SOURCE_AVAILABLE_KEY = 'from-env';

    const readSpy = jest.spyOn(apiKeyService, '_readApiKeyFromFile');
    const createErrorSpy = jest.spyOn(apiKeyService, '_createErrorDetails');

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'DUAL_SOURCE_AVAILABLE_KEY',
        apiKeyFileName: 'secondary.key',
      },
      'llm-env-first'
    );

    expect(result).toEqual({
      apiKey: 'from-env',
      errorDetails: null,
      source: "environment variable 'DUAL_SOURCE_AVAILABLE_KEY'",
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(createErrorSpy).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "ApiKeyService.getApiKey: Successfully retrieved API key for llmId 'llm-env-first' from environment variable 'DUAL_SOURCE_AVAILABLE_KEY'."
      )
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
