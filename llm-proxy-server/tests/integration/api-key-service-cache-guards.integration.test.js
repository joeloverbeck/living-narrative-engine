/**
 * @file api-key-service-cache-guards.integration.test.js
 * @description Integration tests covering ApiKeyService cache-management behaviour when
 *              caching is disabled and constructor guard rails for dependency wiring.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Creates a jest-backed logger compatible with ILogger.
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

/**
 * Sets or clears an environment variable, keeping track for restoration.
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
});

describe('ApiKeyService cache guards integration', () => {
  it('gracefully handles cache utilities when caching is disabled', () => {
    setEnv('CACHE_ENABLED', 'false');
    setEnv('API_KEY_CACHE_TTL', '150');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);

    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 150,
      enableAutoCleanup: false,
    });
    const fsReader = new NodeFileSystemReader();

    const service = new ApiKeyService(
      logger,
      fsReader,
      appConfig,
      cacheService
    );

    const invalidateResult = service.invalidateCache('disabled-llm');
    expect(invalidateResult).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      "ApiKeyService.invalidateCache: Cache is disabled, nothing to invalidate for llmId 'disabled-llm'."
    );

    const invalidateAllResult = service.invalidateAllCache();
    expect(invalidateAllResult).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      'ApiKeyService.invalidateAllCache: Cache is disabled, nothing to invalidate.'
    );

    expect(service.getCacheStats()).toBeNull();

    service.resetCacheStats();
    expect(logger.debug).toHaveBeenCalledWith(
      'ApiKeyService.resetCacheStats: Cache is disabled, nothing to reset.'
    );
  });

  it('enforces collaborator requirements at construction time', () => {
    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '200');

    const logger = createLogger();
    const fsReader = new NodeFileSystemReader();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 200,
      enableAutoCleanup: false,
    });

    expect(
      () => new ApiKeyService(null, fsReader, appConfig, cacheService)
    ).toThrow('ApiKeyService: logger is required.');

    expect(
      () => new ApiKeyService(logger, null, appConfig, cacheService)
    ).toThrow('ApiKeyService: fileSystemReader is required.');

    expect(
      () => new ApiKeyService(logger, fsReader, null, cacheService)
    ).toThrow('ApiKeyService: appConfigService is required.');

    expect(() => new ApiKeyService(logger, fsReader, appConfig, null)).toThrow(
      'ApiKeyService: cacheService is required.'
    );
  });
});
