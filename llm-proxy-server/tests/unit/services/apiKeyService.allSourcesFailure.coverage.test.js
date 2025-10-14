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

  it('falls back to file error message when detailed reason is unavailable', async () => {
    const sparseFileError = {
      message: 'File retrieval failed in storage backend',
      stage: 'api_key_file_read_exception',
      details: {
        llmId: 'llm-cloud-2',
        attemptedFile: 'ghost.key',
        originalErrorMessage: 'Socket timeout',
      },
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: sparseFileError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'CLOUD_ENV_KEY',
        apiKeyFileName: 'ghost.key',
      },
      'llm-cloud-2'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.details?.reason).toContain(
      "File 'ghost.key' retrieval also failed (Reason: File retrieval failed in storage backend)."
    );
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
  });

  it('handles file error payloads with a null details object', async () => {
    const nullDetailsError = {
      message: '',
      stage: 'api_key_file_read_exception',
      details: null,
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: nullDetailsError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'BROKEN_ENV_KEY',
        apiKeyFileName: 'null-metadata.key',
      },
      'llm-cloud-null-details'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails?.details).toEqual(
      expect.objectContaining({
        llmId: 'llm-cloud-null-details',
        attemptedEnvVar: 'BROKEN_ENV_KEY',
        attemptedFile: 'null-metadata.key',
      })
    );
    expect(result.errorDetails?.details?.reason).toContain(
      "File 'null-metadata.key' retrieval also failed (Reason: see previous logs)."
    );
    expect(result.errorDetails?.details?.originalErrorMessage).toBeUndefined();
  });

  it('falls back to error message when file error details are provided as a primitive', async () => {
    const primitiveDetailsError = {
      message: 'storage backend refused the connection',
      stage: 'api_key_file_read_exception',
      details: 'permission denied',
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: primitiveDetailsError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'PRIMITIVE_ENV_KEY',
        apiKeyFileName: 'primitive.key',
      },
      'llm-cloud-primitive-details'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails?.details?.reason).toContain(
      "File 'primitive.key' retrieval also failed (Reason: storage backend refused the connection)."
    );
    expect(result.errorDetails?.details?.reason).not.toContain('permission denied');
  });

  it("uses 'see previous logs' fallback when no file error context is provided", async () => {
    const minimalFileError = {
      message: '',
      stage: 'api_key_file_not_found_or_unreadable',
      details: {
        llmId: 'llm-cloud-3',
        attemptedFile: 'void.key',
      },
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: minimalFileError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'SHADOW_ENV_KEY',
        apiKeyFileName: 'void.key',
      },
      'llm-cloud-3'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.details?.reason).toContain(
      "File 'void.key' retrieval also failed (Reason: see previous logs)."
    );
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
  });

  it('falls back to combined error when file source returns a null error payload', async () => {
    const originalCreateErrorDetails =
      apiKeyService._createErrorDetails.bind(apiKeyService);

    const createErrorDetailsSpy = jest
      .spyOn(apiKeyService, '_createErrorDetails')
      .mockImplementationOnce(() => null)
      .mockImplementation((...args) =>
        originalCreateErrorDetails(...args)
      );

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: null });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_ENV_KEY',
        apiKeyFileName: 'missing.key',
      },
      'llm-cloud-5'
    );

    expect(createErrorDetailsSpy).toHaveBeenCalledTimes(2);
    expect(createErrorDetailsSpy.mock.calls[1][1]).toBe(
      'api_key_all_sources_failed'
    );

    const combinedDetails = createErrorDetailsSpy.mock.calls[1][2];
    expect(combinedDetails).toEqual(
      expect.objectContaining({
        llmId: 'llm-cloud-5',
        attemptedEnvVar: 'MISSING_ENV_KEY',
        attemptedFile: 'missing.key',
      })
    );
    expect(combinedDetails.reason).toContain('see previous logs');

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-cloud-5',
          attemptedEnvVar: 'MISSING_ENV_KEY',
          attemptedFile: 'missing.key',
          reason: expect.stringContaining('see previous logs'),
        }),
      })
    );
  });

  it('escalates missing project root path errors into the combined failure summary', async () => {
    appConfigService.getProxyProjectRootPathForApiKeyFiles.mockReturnValue('   ');

    const fileReadSpy = jest.spyOn(apiKeyService, '_readApiKeyFromFile');

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'ROOTLESS_ENV_KEY',
        apiKeyFileName: 'ghost.key',
      },
      'llm-cloud-4'
    );

    expect(fileReadSpy).not.toHaveBeenCalled();

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails?.details).toEqual(
      expect.objectContaining({
        llmId: 'llm-cloud-4',
        attemptedEnvVar: 'ROOTLESS_ENV_KEY',
        attemptedFile: 'ghost.key',
      })
    );
    expect(result.errorDetails?.details?.reason).toContain(
      'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable not set.'
    );
    expect(result.errorDetails?.details?.originalErrorMessage).toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set. Cannot access API key file.'
      )
    );
  });
});
