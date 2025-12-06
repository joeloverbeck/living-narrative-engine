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

describe('ApiKeyService combined failure message fallback coverage', () => {
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

  it('uses the file error message when no detailed reason is provided', async () => {
    const llmId = 'llm-message-fallback';
    const fileName = 'glitch.key';

    const createErrorSpy = jest.spyOn(apiKeyService, '_createErrorDetails');

    jest.spyOn(apiKeyService, '_readApiKeyFromFile').mockResolvedValue({
      key: null,
      error: {
        message: 'File read failure message',
        stage: 'api_key_file_read_exception',
        details: {
          llmId,
          attemptedFile: fileName,
        },
      },
    });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: fileName,
      },
      llmId
    );

    const combinedFailureCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_all_sources_failed'
    );

    expect(combinedFailureCall).toBeDefined();
    expect(combinedFailureCall?.[2]).toEqual(
      expect.objectContaining({
        llmId,
        attemptedEnvVar: 'MISSING_ENV_KEY',
        attemptedFile: fileName,
        reason: expect.stringContaining('File read failure message'),
      })
    );

    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          reason: expect.stringContaining('File read failure message'),
        }),
      })
    );
    expect(result.errorDetails?.details.reason).not.toContain(
      'see previous logs'
    );
  });
});
