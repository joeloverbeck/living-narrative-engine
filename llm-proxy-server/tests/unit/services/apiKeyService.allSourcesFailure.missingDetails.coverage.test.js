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

describe('ApiKeyService combined source error resilience', () => {
  let logger;
  let fsReader;
  let cacheService;
  let appConfigService;
  let apiKeyService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MISSING_ENV_KEY;

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

  it('synthesizes comprehensive errors when file read unexpectedly omits details', async () => {
    const llmId = 'llm-missing-details';

    const createErrorSpy = jest.spyOn(apiKeyService, '_createErrorDetails');

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: null });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: 'ghost.key',
      },
      llmId
    );

    const envFailureCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_env_var_not_set_or_empty'
    );
    expect(envFailureCall).toBeDefined();
    expect(envFailureCall?.[2]).toEqual(
      expect.objectContaining({
        llmId,
        attemptedEnvVar: 'MISSING_ENV_KEY',
      })
    );

    const combinedFailureCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_all_sources_failed'
    );
    expect(combinedFailureCall).toBeDefined();
    expect(combinedFailureCall?.[0]).toBe(
      'Failed to retrieve API key. All configured sources (environment variable and file) failed.'
    );
    expect(combinedFailureCall?.[2]).toEqual(
      expect.objectContaining({
        llmId,
        attemptedEnvVar: 'MISSING_ENV_KEY',
        attemptedFile: 'ghost.key',
        reason: expect.stringContaining('see previous logs'),
      })
    );
    expect(combinedFailureCall?.[2].originalErrorMessage).toBeUndefined();

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        message:
          'Failed to retrieve API key. All configured sources (environment variable and file) failed.',
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId,
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'ghost.key',
          reason: expect.stringContaining('see previous logs'),
        }),
      })
    );
    expect(result.errorDetails.details.originalErrorMessage).toBeUndefined();

    const warnCall = logger.warn.mock.calls.at(-1);
    expect(warnCall?.[0]).toContain('Stage: api_key_all_sources_failed');
    expect(warnCall?.[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          llmId,
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'ghost.key',
        }),
      })
    );
  });
});
