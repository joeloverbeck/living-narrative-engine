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
});
