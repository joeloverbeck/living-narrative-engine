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

describe('ApiKeyService error consolidation coverage', () => {
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

  it('combines environment and file failures into a comprehensive error summary', async () => {
    const fileErrorDetails = {
      message: 'File retrieval failed',
      stage: 'api_key_file_not_found_or_unreadable',
      details: {
        llmId: 'llm-cloud-1',
        attemptedFile: 'missing.key',
        reason: 'File not accessible',
        originalErrorMessage: 'ENOENT: no such file or directory',
      },
    };

    const readSpy = jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: fileErrorDetails });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: 'missing.key',
      },
      'llm-cloud-1'
    );

    expect(readSpy).toHaveBeenCalledWith(
      'missing.key',
      '/configs',
      'llm-cloud-1'
    );
    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-cloud-1',
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'missing.key',
        }),
      })
    );

    expect(result.errorDetails.details.reason).toContain(
      "Environment variable 'MISSING_ENV_KEY' was not set or empty."
    );
    expect(result.errorDetails.details.reason).toContain(
      "File 'missing.key' retrieval also failed (Reason: File not accessible)."
    );
    expect(result.errorDetails.details.originalErrorMessage).toBe(
      'ENOENT: no such file or directory'
    );

    const finalWarnCall = logger.warn.mock.calls.at(-1);
    expect(finalWarnCall[0]).toContain('Stage: api_key_all_sources_failed');
    expect(finalWarnCall[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          llmId: 'llm-cloud-1',
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'missing.key',
        }),
      })
    );
  });
});
