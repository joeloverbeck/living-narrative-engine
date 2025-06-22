import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ApiKeyService } from '../src/services/apiKeyService.js';
import * as path from 'node:path';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({ readFile: jest.fn() });

const ORIGINAL_ENV = { ...process.env };

describe('ApiKeyService.getApiKey', () => {
  let logger;
  let fsReader;
  let appConfig;
  let service;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    logger = createLogger();
    fsReader = createFsReader();
    appConfig = {
      getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/keys'),
    };
    service = new ApiKeyService(logger, fsReader, appConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('returns null when API key not required', async () => {
    const res = await service.getApiKey({ apiType: 'ollama' }, 'llm1');
    expect(res).toEqual({
      apiKey: null,
      errorDetails: null,
      source: 'Not applicable (local LLM or no key needed)',
    });
  });

  test('retrieves API key from environment variable', async () => {
    process.env.MY_KEY = 'abc123';
    const res = await service.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: 'MY_KEY',
        apiKeyFileName: 'unused.txt',
      },
      'llm2'
    );
    expect(res).toEqual({
      apiKey: 'abc123',
      errorDetails: null,
      source: "environment variable 'MY_KEY'",
    });
    expect(fsReader.readFile).not.toHaveBeenCalled();
  });

  test('falls back to file when env var missing', async () => {
    fsReader.readFile.mockResolvedValue('filekey\n');
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'MISSING', apiKeyFileName: 'api.txt' },
      'llm3'
    );
    expect(fsReader.readFile).toHaveBeenCalledWith(
      path.join('/keys', 'api.txt'),
      'utf-8'
    );
    expect(res).toEqual({
      apiKey: 'filekey',
      errorDetails: null,
      source: "file 'api.txt'",
    });
  });

  test('returns error when file root path not configured', async () => {
    appConfig.getProxyProjectRootPathForApiKeyFiles.mockReturnValue('');
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'NONE', apiKeyFileName: 'api.txt' },
      'llm4'
    );
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_all_sources_failed');
    expect(res.errorDetails.details.reason).toContain(
      'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES'
    );
  });

  test('returns combined error when env var and file both fail', async () => {
    const err = new Error('missing');
    err.code = 'ENOENT';
    fsReader.readFile.mockRejectedValue(err);
    const res = await service.getApiKey(
      { apiType: 'openai', apiKeyEnvVar: 'MISSING', apiKeyFileName: 'api.txt' },
      'llm5'
    );
    expect(res.apiKey).toBeNull();
    expect(res.errorDetails.stage).toBe('api_key_all_sources_failed');
  });
});
