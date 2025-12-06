/**
 * @file api-key-service-cache-disabled-combined-failures.integration.test.js
 * @description Integration tests extending ApiKeyService coverage for cache-disabled
 *              file retrieval success paths and consolidated failure reporting when
 *              both environment and file sources are misconfigured.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Creates a Jest-backed logger compatible with ILogger.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

const envSnapshot = {};
const tempDirectories = new Set();

/**
 * Sets or clears an environment variable while tracking original values for restoration.
 * @param {string} key
 * @param {string | undefined} value
 */
function setEnv(key, value) {
  if (!Object.prototype.hasOwnProperty.call(envSnapshot, key)) {
    envSnapshot[key] = process.env[key];
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Creates a temporary directory for API key files.
 * @returns {string} Absolute path to the temporary directory.
 */
function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-service-int-'));
  tempDirectories.add(dir);
  return dir;
}

beforeEach(() => {
  resetAppConfigServiceInstance();
});

afterEach(() => {
  resetAppConfigServiceInstance();

  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
    delete envSnapshot[key];
  }

  for (const dir of tempDirectories) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirectories.clear();

  jest.restoreAllMocks();
});

describe('ApiKeyService cache-disabled success and combined failure integration', () => {
  it('retrieves keys from disk without touching cache when caching is disabled', async () => {
    const tempDir = createTempDir();
    const fileName = 'no-cache.key';
    const filePath = path.join(tempDir, fileName);
    writeFileSync(filePath, '   cached-secret   ', 'utf-8');

    setEnv('CACHE_ENABLED', 'false');
    setEnv('API_KEY_CACHE_TTL', '300');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);

    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 300,
      enableAutoCleanup: false,
    });
    const cacheGetSpy = jest.spyOn(cacheService, 'get');
    const cacheSetSpy = jest.spyOn(cacheService, 'set');

    const service = new ApiKeyService(
      logger,
      new NodeFileSystemReader(),
      appConfig,
      cacheService
    );

    const result = await service.getApiKey(
      { apiType: 'openai', apiKeyFileName: fileName },
      'llm-cache-disabled'
    );

    expect(result).toEqual({
      apiKey: 'cached-secret',
      errorDetails: null,
      source: `file '${fileName}'`,
    });
    expect(cacheGetSpy).not.toHaveBeenCalled();
    expect(cacheSetSpy).not.toHaveBeenCalled();
  });

  it('combines environment and file failures while logging missing llm context', async () => {
    const tempDir = createTempDir();
    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '200');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('MISSING_COMBINED_VAR', undefined);

    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 200,
      enableAutoCleanup: false,
    });

    const service = new ApiKeyService(
      logger,
      new NodeFileSystemReader(),
      appConfig,
      cacheService
    );

    const config = {
      apiType: 'openai',
      apiKeyEnvVar: 'MISSING_COMBINED_VAR',
      apiKeyFileName: 'missing-secret.key',
    };

    const result = await service.getApiKey(config, undefined);

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toMatchObject({
      stage: 'api_key_all_sources_failed',
    });
    expect(result.errorDetails.details).toMatchObject({
      attemptedEnvVar: 'MISSING_COMBINED_VAR',
      attemptedFile: 'missing-secret.key',
    });
    expect(result.errorDetails.details.reason).toContain(
      "Environment variable 'MISSING_COMBINED_VAR' was not set or empty. File 'missing-secret.key' retrieval also failed"
    );
    expect(result.errorDetails.details.reason).toContain('ENOENT');
    expect(result.errorDetails.details.llmId).toBeUndefined();
    expect(result.errorDetails.details.originalErrorMessage).toContain(
      'ENOENT'
    );

    const warnMessages = logger.warn.mock.calls.map(([message]) => message);
    expect(
      warnMessages.some(
        (message) =>
          typeof message === 'string' && message.includes('LLM ID: N/A')
      )
    ).toBe(true);
  });
});
