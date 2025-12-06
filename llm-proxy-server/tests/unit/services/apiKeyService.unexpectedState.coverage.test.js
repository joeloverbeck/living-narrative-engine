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

describe('ApiKeyService unexpected fallback coverage', () => {
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

  it('creates a defensive error when all branches fail to set details', async () => {
    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: null });

    const createErrorSpy = jest
      .spyOn(apiKeyService, '_createErrorDetails')
      .mockImplementation((message, stage, detailsContext) => {
        if (stage === 'api_key_retrieval_unknown_error') {
          return { message, stage, details: detailsContext };
        }

        return null;
      });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: 'fallback.key',
      },
      'llm-unexpected-state'
    );

    expect(createErrorSpy).toHaveBeenCalledWith(
      'Environment variable for API key not set or empty.',
      'api_key_env_var_not_set_or_empty',
      expect.objectContaining({ llmId: 'llm-unexpected-state' })
    );
    expect(createErrorSpy).toHaveBeenCalledWith(
      'Failed to retrieve API key. All configured sources (environment variable and file) failed.',
      'api_key_all_sources_failed',
      expect.objectContaining({ attemptedFile: 'fallback.key' })
    );
    expect(createErrorSpy).toHaveBeenCalledWith(
      'API key for LLM could not be retrieved due to an unknown internal error.',
      'api_key_retrieval_unknown_error',
      {
        llmId: 'llm-unexpected-state',
        attemptedEnvVar: 'MISSING_ENV_KEY',
        attemptedFile: 'fallback.key',
      }
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Reached unexpected state for llmId')
    );

    expect(result).toEqual({
      apiKey: null,
      source: 'N/A',
      errorDetails: {
        message:
          'API key for LLM could not be retrieved due to an unknown internal error.',
        stage: 'api_key_retrieval_unknown_error',
        details: {
          llmId: 'llm-unexpected-state',
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'fallback.key',
        },
      },
    });
  });
});
