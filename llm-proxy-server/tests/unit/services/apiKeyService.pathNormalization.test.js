import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as path from 'node:path';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';

const ORIGINAL_ENV = { ...process.env };

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({ readFile: jest.fn() });

const createAppConfigService = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/secure/root'),
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

describe('ApiKeyService path normalization and configuration safeguards', () => {
  let logger;
  let fsReader;
  let appConfig;
  let cacheService;
  let service;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    logger = createLogger();
    fsReader = createFsReader();
    appConfig = createAppConfigService();
    cacheService = createCacheService();
    service = new ApiKeyService(logger, fsReader, appConfig, cacheService);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('normalizes file names with directory segments before reading', async () => {
    fsReader.readFile.mockResolvedValue('  sanitized-secret  ');

    const result = await service._readApiKeyFromFile(
      '../nested/folder/llm.key',
      '/secure/root',
      'llm-sanitized'
    );

    expect(fsReader.readFile).toHaveBeenCalledWith(
      path.join('/secure/root', 'llm.key'),
      'utf-8'
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("was normalized to 'llm.key'")
    );

    expect(result).toEqual({ key: 'sanitized-secret', error: null });
  });

  it('surfaces configuration errors when the API key root path is missing', async () => {
    appConfig.getProxyProjectRootPathForApiKeyFiles.mockReturnValue('   ');

    const outcome = await service.getApiKey(
      {
        apiType: 'openai',
        apiKeyFileName: 'provider.key',
      },
      'llm-missing-root'
    );

    expect(outcome.apiKey).toBeNull();
    expect(outcome.source).toBe('N/A');
    expect(outcome.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_retrieval_file_root_path_missing',
        details: expect.objectContaining({
          llmId: 'llm-missing-root',
          attemptedFile: 'provider.key',
          reason:
            'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable not set.',
        }),
      })
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set. Cannot access API key file.'
      )
    );
  });

  it('propagates normalized file failure details when both env var and file sources fail', async () => {
    const missingEnv = 'MISSING_ENV_FOR_NORMALIZED_PATH';
    delete process.env[missingEnv];

    const createErrorSpy = jest.spyOn(service, '_createErrorDetails');

    const fileError = new Error('File missing on disk');
    fileError.code = 'ENOENT';
    fsReader.readFile.mockRejectedValue(fileError);

    const result = await service.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: `  ${missingEnv}  `,
        apiKeyFileName: '  ../nested/provider.key  ',
      },
      'llm-normalized-failure'
    );

    expect(fsReader.readFile).toHaveBeenCalledWith(
      path.join('/secure/root', 'provider.key'),
      'utf-8'
    );

    const normalizationWarning = logger.warn.mock.calls.find(([message]) =>
      message.includes("was normalized to 'provider.key'")
    );
    expect(normalizationWarning).toBeDefined();

    const envVarCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_env_var_not_set_or_empty'
    );
    expect(envVarCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-normalized-failure',
        attemptedEnvVar: missingEnv,
      })
    );

    const fileFailureCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_file_not_found_or_unreadable'
    );
    expect(fileFailureCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-normalized-failure',
        attemptedFile: path.join('/secure/root', 'provider.key'),
        reason: expect.stringContaining('File system error code: ENOENT'),
        originalErrorMessage: 'File missing on disk',
      })
    );

    const combinedFailureCall = createErrorSpy.mock.calls.find(
      ([, stage]) => stage === 'api_key_all_sources_failed'
    );
    expect(combinedFailureCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-normalized-failure',
        attemptedEnvVar: missingEnv,
        attemptedFile: '../nested/provider.key',
      })
    );

    expect(result).toEqual({
      apiKey: null,
      source: 'N/A',
      errorDetails: expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-normalized-failure',
          attemptedEnvVar: missingEnv,
          attemptedFile: '../nested/provider.key',
          reason: expect.stringContaining(
            "Environment variable 'MISSING_ENV_FOR_NORMALIZED_PATH' was not set or empty."
          ),
          originalErrorMessage: 'File missing on disk',
        }),
      }),
    });

    expect(result.errorDetails.details.reason).toContain(
      "File '../nested/provider.key' retrieval also failed"
    );
    expect(result.errorDetails.details.reason).toContain(
      'File system error code: ENOENT'
    );
  });
});
