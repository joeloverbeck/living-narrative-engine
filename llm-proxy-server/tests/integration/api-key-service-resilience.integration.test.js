/**
 * @file api-key-service-resilience.integration.test.js
 * @description Additional integration tests covering edge-case error handling and
 *              cache-disabled behaviors for ApiKeyService.
 */

import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
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
 * @returns {string}
 */
function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-resilience-'));
  createdTempDirs.push(dir);
  return dir;
}

const createdTempDirs = [];

/**
 * @param {{ cacheEnabled?: boolean, projectRoot?: string | null }} [options]
 */
function buildService(options = {}) {
  const { cacheEnabled = true, projectRoot = null } = options;

  resetAppConfigServiceInstance();

  setEnv('CACHE_ENABLED', cacheEnabled ? 'true' : 'false');
  setEnv('API_KEY_CACHE_TTL', '150');

  if (projectRoot !== null) {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);
  } else {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);
  }

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 5,
    defaultTtl: 150,
    enableAutoCleanup: false,
  });
  const fsReader = new NodeFileSystemReader();

  return {
    service: new ApiKeyService(logger, fsReader, appConfig, cacheService),
    logger,
    cacheService,
    appConfig,
  };
}

describe('ApiKeyService resilience integration', () => {
  afterEach(() => {
    resetAppConfigServiceInstance();

    for (const dir of createdTempDirs.splice(0, createdTempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }

    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
      delete envSnapshot[key];
    }
  });

  it('treats directory based key paths as read exceptions and surfaces detailed errors', async () => {
    const projectRoot = createTempDir();
    const directoryName = 'llm-key-directory';
    mkdirSync(path.join(projectRoot, directoryName));

    const { service, logger } = buildService({
      cacheEnabled: true,
      projectRoot,
    });

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: undefined,
        apiKeyFileName: directoryName,
      },
      'dir-llm'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_file_read_exception');
    expect(result.errorDetails.details.attemptedFile).toContain(directoryName);
    expect(result.errorDetails.details.reason).toBe(
      'Unexpected file system/read error.'
    );
    expect(result.errorDetails.details.originalErrorMessage).toContain(
      'EISDIR'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected error reading API key file.'),
      expect.objectContaining({
        errorCode: 'EISDIR',
        llmId: 'dir-llm',
      })
    );
  });

  it('reports configuration issues when no API key sources are defined for a cloud model', async () => {
    const { service } = buildService({
      cacheEnabled: false,
      projectRoot: null,
    });

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: undefined,
        apiKeyFileName: undefined,
      },
      'missing-sources'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_config_sources_missing');
    expect(result.errorDetails.details.reason).toContain(
      'does not specify how to obtain an API key'
    );

    expect(service.getCacheStats()).toBeNull();
    expect(service.invalidateCache('missing-sources')).toBe(0);
    expect(service.invalidateAllCache()).toBe(0);
    service.resetCacheStats();
  });

  it('logs cache disabled behaviour when resetCacheStats is invoked', () => {
    const { service, logger } = buildService({
      cacheEnabled: false,
      projectRoot: null,
    });

    service.resetCacheStats();

    expect(logger.debug).toHaveBeenCalledWith(
      'ApiKeyService.resetCacheStats: Cache is disabled, nothing to reset.'
    );
  });
});
