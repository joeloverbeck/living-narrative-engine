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
    expect(result.errorDetails?.details?.reason).not.toContain(
      'permission denied'
    );
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

  it('includes file error message in the combined reason when the file details omit a reason', async () => {
    delete process.env.MESSAGE_ONLY_ENV_KEY;

    const messageOnlyFileError = {
      message: 'File system returned EPIPE with no extra context',
      stage: 'api_key_file_read_exception',
      details: {
        llmId: 'llm-cloud-message',
        attemptedFile: 'message-only.key',
      },
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: messageOnlyFileError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MESSAGE_ONLY_ENV_KEY',
        apiKeyFileName: 'message-only.key',
      },
      'llm-cloud-message'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');

    const combinedReason = result.errorDetails?.details?.reason;
    expect(combinedReason).toContain(
      "Environment variable 'MESSAGE_ONLY_ENV_KEY' was not set or empty."
    );
    expect(combinedReason).toContain(
      "File 'message-only.key' retrieval also failed (Reason: File system returned EPIPE with no extra context)."
    );
    expect(combinedReason).not.toContain('see previous logs');
  });

  it('falls back to see previous logs when the file details reason is an empty string while preserving original error metadata', async () => {
    delete process.env.EMPTY_REASON_ENV_KEY;

    const emptyReasonError = {
      message: '',
      stage: 'api_key_file_read_exception',
      details: {
        llmId: 'llm-cloud-empty-reason',
        attemptedFile: 'empty-reason.key',
        reason: '',
        originalErrorMessage: 'storage backend timeout',
      },
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: emptyReasonError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'EMPTY_REASON_ENV_KEY',
        apiKeyFileName: 'empty-reason.key',
      },
      'llm-cloud-empty-reason'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');

    const combinedDetails = result.errorDetails?.details;
    expect(combinedDetails).toEqual(
      expect.objectContaining({
        llmId: 'llm-cloud-empty-reason',
        attemptedEnvVar: 'EMPTY_REASON_ENV_KEY',
        attemptedFile: 'empty-reason.key',
        originalErrorMessage: 'storage backend timeout',
      })
    );
    expect(combinedDetails?.reason).toContain('see previous logs');
  });

  it('falls back to combined error when file source returns a null error payload', async () => {
    const originalCreateErrorDetails =
      apiKeyService._createErrorDetails.bind(apiKeyService);

    const createErrorDetailsSpy = jest
      .spyOn(apiKeyService, '_createErrorDetails')
      .mockImplementationOnce(() => null)
      .mockImplementation((...args) => originalCreateErrorDetails(...args));

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

  it('treats primitive string file errors as missing context and preserves combined diagnostics', async () => {
    delete process.env.PRIMITIVE_STRING_ENV_KEY;

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: 'catastrophic failure' });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'PRIMITIVE_STRING_ENV_KEY',
        apiKeyFileName: 'primitive-string.key',
      },
      'llm-cloud-primitive-string'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-cloud-primitive-string',
          attemptedEnvVar: 'PRIMITIVE_STRING_ENV_KEY',
          attemptedFile: 'primitive-string.key',
          reason: expect.stringContaining('see previous logs'),
        }),
      })
    );

    const warnCall = logger.warn.mock.calls.at(-1);
    expect(warnCall?.[0]).toContain('Stage: api_key_all_sources_failed');
    expect(warnCall?.[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          attemptedEnvVar: 'PRIMITIVE_STRING_ENV_KEY',
          attemptedFile: 'primitive-string.key',
        }),
      })
    );
  });

  it('surfaces native Error instances from the file reader within the combined failure summary', async () => {
    delete process.env.ERROR_INSTANCE_ENV_KEY;

    const fileError = new Error('filesystem returned EIO');

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: fileError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'ERROR_INSTANCE_ENV_KEY',
        apiKeyFileName: 'error-instance.key',
      },
      'llm-cloud-error-instance'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-cloud-error-instance',
          attemptedEnvVar: 'ERROR_INSTANCE_ENV_KEY',
          attemptedFile: 'error-instance.key',
          reason: expect.stringContaining('filesystem returned EIO'),
        }),
      })
    );

    const combinedReason = result.errorDetails?.details?.reason;
    expect(combinedReason).toContain(
      "Environment variable 'ERROR_INSTANCE_ENV_KEY' was not set or empty."
    );
    expect(combinedReason).toContain(
      "File 'error-instance.key' retrieval also failed (Reason: filesystem returned EIO)."
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stage: api_key_all_sources_failed'),
      expect.objectContaining({
        details: expect.objectContaining({
          attemptedEnvVar: 'ERROR_INSTANCE_ENV_KEY',
          attemptedFile: 'error-instance.key',
        }),
      })
    );
  });

  it('synthesizes a combined failure when the file reader returns an undefined error payload', async () => {
    delete process.env.UNDEFINED_ENV_KEY;

    const createErrorDetailsSpy = jest.spyOn(
      apiKeyService,
      '_createErrorDetails'
    );

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: undefined });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'UNDEFINED_ENV_KEY',
        apiKeyFileName: 'undefined.key',
      },
      'llm-cloud-undefined'
    );

    expect(createErrorDetailsSpy).toHaveBeenCalled();
    const lastCall = createErrorDetailsSpy.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe('api_key_all_sources_failed');
    expect(lastCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-cloud-undefined',
        attemptedEnvVar: 'UNDEFINED_ENV_KEY',
        attemptedFile: 'undefined.key',
      })
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-cloud-undefined',
          attemptedEnvVar: 'UNDEFINED_ENV_KEY',
          attemptedFile: 'undefined.key',
          reason: expect.stringContaining('see previous logs'),
        }),
      })
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stage: api_key_all_sources_failed'),
      expect.objectContaining({
        details: expect.objectContaining({
          attemptedEnvVar: 'UNDEFINED_ENV_KEY',
        }),
      })
    );
  });

  it('escalates missing project root path errors into the combined failure summary', async () => {
    appConfigService.getProxyProjectRootPathForApiKeyFiles.mockReturnValue(
      '   '
    );

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
  it('routes dual-source failures through the combined branch with full context', async () => {
    delete process.env.DUAL_SOURCE_ENV_KEY;

    const missingFileError = new Error('missing key file');
    missingFileError.code = 'ENOENT';
    fsReader.readFile.mockRejectedValue(missingFileError);

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'DUAL_SOURCE_ENV_KEY',
        apiKeyFileName: 'missing.key',
      },
      'llm-dual-source'
    );

    expect(fsReader.readFile).toHaveBeenCalledWith(
      '/configs/missing.key',
      'utf-8'
    );
    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails?.details).toEqual(
      expect.objectContaining({
        llmId: 'llm-dual-source',
        attemptedEnvVar: 'DUAL_SOURCE_ENV_KEY',
        attemptedFile: 'missing.key',
      })
    );
    expect(result.errorDetails?.details?.reason).toContain(
      'Environment variable'
    );
    expect(result.errorDetails?.details?.reason).toContain(
      "File 'missing.key' retrieval also failed"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stage: api_key_all_sources_failed'),
      expect.objectContaining({
        details: expect.objectContaining({
          attemptedEnvVar: 'DUAL_SOURCE_ENV_KEY',
        }),
      })
    );
  });

  it('falls back to the generic combined summary when file error metadata is blank', async () => {
    delete process.env.BLANK_ENV_KEY;

    const blankFileError = {
      message: '',
      stage: 'api_key_file_read_exception',
      details: {
        llmId: 'llm-blank-meta',
        attemptedFile: 'blank.key',
        reason: '',
        originalErrorMessage: '',
      },
    };

    const createErrorDetailsSpy = jest.spyOn(
      apiKeyService,
      '_createErrorDetails'
    );

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: blankFileError });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'BLANK_ENV_KEY',
        apiKeyFileName: 'blank.key',
      },
      'llm-blank-meta'
    );

    expect(createErrorDetailsSpy).toHaveBeenCalled();
    const lastCreateCall = createErrorDetailsSpy.mock.calls.at(-1);
    expect(lastCreateCall?.[1]).toBe('api_key_all_sources_failed');
    expect(lastCreateCall?.[2]).toEqual(
      expect.objectContaining({
        llmId: 'llm-blank-meta',
        attemptedEnvVar: 'BLANK_ENV_KEY',
        attemptedFile: 'blank.key',
        reason: expect.stringContaining('see previous logs'),
      })
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        stage: 'api_key_all_sources_failed',
        details: expect.objectContaining({
          llmId: 'llm-blank-meta',
          attemptedEnvVar: 'BLANK_ENV_KEY',
          attemptedFile: 'blank.key',
          reason: expect.stringContaining('see previous logs'),
          originalErrorMessage: '',
        }),
      })
    );

    const warnCall = logger.warn.mock.calls.at(-1);
    expect(warnCall?.[0]).toContain('Stage: api_key_all_sources_failed');
    expect(warnCall?.[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          llmId: 'llm-blank-meta',
          attemptedEnvVar: 'BLANK_ENV_KEY',
          attemptedFile: 'blank.key',
        }),
      })
    );
  });

  it('falls back to see previous logs when file reason is an empty string', async () => {
    const fileErrorWithEmptyReason = {
      message: '',
      stage: 'api_key_file_read_exception',
      details: {
        llmId: 'llm-cloud-empty-reason',
        attemptedFile: 'empty-reason.key',
        reason: '',
      },
    };

    jest
      .spyOn(apiKeyService, '_readApiKeyFromFile')
      .mockResolvedValue({ key: null, error: fileErrorWithEmptyReason });

    const result = await apiKeyService.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'EMPTY_REASON_ENV_KEY',
        apiKeyFileName: 'empty-reason.key',
      },
      'llm-cloud-empty-reason'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');

    const { reason, attemptedEnvVar, attemptedFile } =
      result.errorDetails?.details ?? {};

    expect(attemptedEnvVar).toBe('EMPTY_REASON_ENV_KEY');
    expect(attemptedFile).toBe('empty-reason.key');
    expect(reason).toContain(
      "Environment variable 'EMPTY_REASON_ENV_KEY' was not set or empty."
    );
    expect(reason).toContain(
      "File 'empty-reason.key' retrieval also failed (Reason: see previous logs)."
    );
    expect(reason).not.toMatch(/\(Reason:\s*\)/);

    const lastWarning = logger.warn.mock.calls.at(-1);
    expect(lastWarning?.[0]).toContain('Stage: api_key_all_sources_failed');
    expect(lastWarning?.[1]).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          llmId: 'llm-cloud-empty-reason',
          attemptedEnvVar: 'EMPTY_REASON_ENV_KEY',
          attemptedFile: 'empty-reason.key',
        }),
      })
    );
  });
});
