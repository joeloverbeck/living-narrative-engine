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

const createAppConfigService = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/configs'),
  isCacheEnabled: jest.fn(() => false),
  getApiKeyCacheTtl: jest.fn(() => 60_000),
});

const createCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
  getStats: jest.fn(),
  resetStats: jest.fn(),
});

describe('ApiKeyService combined failure handling for bare Error payloads', () => {
  let logger;
  let fsReader;
  let appConfigService;
  let cacheService;
  let apiKeyService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ERROR_ENV_KEY;

    logger = createLogger();
    fsReader = createFileSystemReader();
    appConfigService = createAppConfigService();
    cacheService = createCacheService();

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

  it('folds bare Error instances from file lookups into the combined diagnostics summary', async () => {
    const bareError = new Error('Disk meltdown while loading API key');

    const fileReadSpy = jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: bareError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'ERROR_ENV_KEY',
        apiKeyFileName: 'unstable.key',
      },
      'llm-bare-error'
    );

    expect(fileReadSpy).toHaveBeenCalledWith(
      'unstable.key',
      '/configs',
      'llm-bare-error'
    );
    expect(result).toEqual(
      expect.objectContaining({
        apiKey: null,
        source: 'N/A',
        errorDetails: expect.objectContaining({
          stage: 'api_key_all_sources_failed',
          details: expect.objectContaining({
            llmId: 'llm-bare-error',
            attemptedEnvVar: 'ERROR_ENV_KEY',
            attemptedFile: 'unstable.key',
            reason: expect.stringContaining(
              'Disk meltdown while loading API key'
            ),
          }),
        }),
      })
    );

    const combinedReason = result.errorDetails?.details?.reason;
    expect(combinedReason).toContain(
      "Environment variable 'ERROR_ENV_KEY' was not set or empty."
    );
    expect(combinedReason).toContain('Disk meltdown while loading API key');
    expect(result.errorDetails?.details?.originalErrorMessage).toBeUndefined();

    const finalWarnCall = logger.warn.mock.calls.at(-1);
    expect(finalWarnCall?.[0]).toContain('Stage: api_key_all_sources_failed');
    expect(finalWarnCall?.[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          llmId: 'llm-bare-error',
          attemptedEnvVar: 'ERROR_ENV_KEY',
          attemptedFile: 'unstable.key',
        }),
      })
    );
  });

  it('maintains combined diagnostics when env var error creation unexpectedly returns null for bare Error fallbacks', async () => {
    const bareError = new Error('Disk meltdown while loading API key');

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: bareError });

    const originalCreateErrorDetails =
      apiKeyService._createErrorDetails.bind(apiKeyService);

    const createErrorSpy = jest
      .spyOn(apiKeyService, '_createErrorDetails')
      .mockImplementationOnce(() => null)
      .mockImplementation((...args) => originalCreateErrorDetails(...args));

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'ERROR_ENV_KEY',
        apiKeyFileName: 'unstable.key',
      },
      'llm-bare-error-resilient'
    );

    const combinedCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_all_sources_failed'
    );

    expect(combinedCall).toBeDefined();
    expect(combinedCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-bare-error-resilient',
        attemptedEnvVar: 'ERROR_ENV_KEY',
        attemptedFile: 'unstable.key',
        reason: expect.stringContaining('Disk meltdown while loading API key'),
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        apiKey: null,
        source: 'N/A',
        errorDetails: expect.objectContaining({
          stage: 'api_key_all_sources_failed',
          details: expect.objectContaining({
            llmId: 'llm-bare-error-resilient',
            attemptedEnvVar: 'ERROR_ENV_KEY',
            attemptedFile: 'unstable.key',
            reason: expect.stringContaining(
              'Disk meltdown while loading API key'
            ),
          }),
        }),
      })
    );
  });
});
