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

const createFileReader = () => ({
  readFile: jest.fn(),
});

const createAppConfig = () => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/var/secure'),
  isCacheEnabled: jest.fn(() => false),
  getApiKeyCacheTtl: jest.fn(() => 45_000),
});

const createCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
  getStats: jest.fn(),
  resetStats: jest.fn(),
});

describe('ApiKeyService permission denied coverage', () => {
  let logger;
  let fileReader;
  let cacheService;
  let appConfig;
  let service;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    logger = createLogger();
    fileReader = createFileReader();
    cacheService = createCacheService();
    appConfig = createAppConfig();
    service = new ApiKeyService(logger, fileReader, appConfig, cacheService);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  test('reports detailed all sources failure when file system denies access', async () => {
    process.env.RESTRICTED_API_KEY = '   ';

    const permissionError = new Error(
      'Permission denied while reading key file'
    );
    permissionError.code = 'EPERM';

    fileReader.readFile.mockRejectedValue(permissionError);

    const result = await service.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'RESTRICTED_API_KEY',
        apiKeyFileName: 'cloud-provider.key',
      },
      'llm-permission-denied'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');

    const { attemptedEnvVar, attemptedFile, reason, originalErrorMessage } =
      result.errorDetails?.details ?? {};

    expect(attemptedEnvVar).toBe('RESTRICTED_API_KEY');
    expect(attemptedFile).toBe('cloud-provider.key');
    expect(reason).toContain(
      "Environment variable 'RESTRICTED_API_KEY' was not set or empty."
    );
    expect(reason).toContain('File system error code: EPERM');
    expect(originalErrorMessage).toBe(permissionError.message);

    const envWarning = logger.warn.mock.calls.find(([message]) =>
      message.includes("Environment variable 'RESTRICTED_API_KEY'")
    );
    expect(envWarning).toBeDefined();

    const fileWarning = logger.warn.mock.calls.find(
      ([message]) =>
        message.includes("Path: '/var/secure/cloud-provider.key'") &&
        message.includes('EPERM')
    );
    expect(fileWarning).toBeDefined();
  });
});
