import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import path from 'node:path';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';
import { DEFAULT_ENCODING_UTF8 } from '../../../src/config/constants.js';

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

describe('ApiKeyService fallback success scenarios', () => {
  let logger;
  let fsReader;
  let cacheService;
  let appConfigService;
  let apiKeyService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MISSING_ENV_KEY;
    delete process.env.BLANK_ENV_KEY;

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

  it('returns API key from file when env var fallback fails and clears previous error', async () => {
    fsReader.readFile.mockResolvedValue('  fallback-secret-key  ');

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: 'fallback.key',
      },
      'llm-file-fallback'
    );

    expect(fsReader.readFile).toHaveBeenCalledWith(
      path.join('/configs', 'fallback.key'),
      DEFAULT_ENCODING_UTF8
    );

    expect(result).toEqual({
      apiKey: 'fallback-secret-key',
      errorDetails: null,
      source: "file 'fallback.key'",
    });

    const warnMessages = logger.warn.mock.calls.map((call) => call[0]);
    expect(
      warnMessages.some((message) =>
        message.includes("Environment variable 'MISSING_ENV_KEY'")
      )
    ).toBe(true);

    expect(logger.info).toHaveBeenCalledWith(
      "ApiKeyService.getApiKey: Successfully retrieved API key for llmId 'llm-file-fallback' from file 'fallback.key'."
    );
  });

  it('preserves original error message when combined failure falls back to log guidance', async () => {
    jest.spyOn(apiKeyService, '_readApiKeyFromFile').mockResolvedValue({
      key: null,
      error: {
        message: '',
        stage: 'api_key_file_read_exception',
        details: {
          llmId: 'llm-blank-original',
          attemptedFile: 'blank.key',
          reason: '',
          originalErrorMessage: 'Socket timeout after 3s',
        },
      },
    });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'BLANK_ENV_KEY',
        apiKeyFileName: 'blank.key',
      },
      'llm-blank-original'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails?.details).toEqual(
      expect.objectContaining({
        llmId: 'llm-blank-original',
        attemptedEnvVar: 'BLANK_ENV_KEY',
        attemptedFile: 'blank.key',
      })
    );
    expect(result.errorDetails?.details?.reason).toContain('see previous logs');
    expect(result.errorDetails?.details?.originalErrorMessage).toBe(
      'Socket timeout after 3s'
    );

    const lastWarnCall = logger.warn.mock.calls.at(-1);
    expect(lastWarnCall?.[0]).toContain('Stage: api_key_all_sources_failed');
  });
});
