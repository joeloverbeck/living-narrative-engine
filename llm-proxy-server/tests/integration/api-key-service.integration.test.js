/**
 * @file api-key-service.integration.test.js
 * @description Integration tests verifying ApiKeyService behavior across environment, file system,
 * caching, and configuration boundaries.
 */

import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-integration-'));
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
  setEnv('API_KEY_CACHE_TTL', '200');

  if (projectRoot !== null) {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);
  } else {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);
  }

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 10,
    defaultTtl: 200,
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

describe('ApiKeyService integration', () => {
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

  it('retrieves API keys from environment variables for cloud models while skipping local types', async () => {
    const envVarName = 'INTEGRATION_API_KEY_FROM_ENV';
    setEnv(envVarName, 'env-secret-value');

    const { service } = buildService({
      cacheEnabled: false,
      projectRoot: null,
    });

    const cloudConfig = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: 'unused.txt',
    };

    const result = await service.getApiKey(cloudConfig, 'cloud-llm');
    expect(result.apiKey).toBe('env-secret-value');
    expect(result.errorDetails).toBeNull();
    expect(result.source).toContain(envVarName);

    expect(service.isApiKeyRequired({ apiType: 'OpenAI' })).toBe(true);
    expect(service.isApiKeyRequired({ apiType: 'ollama' })).toBe(false);
  });

  it('reads API keys from files, caches them, and respects cache invalidation utilities', async () => {
    const projectRoot = createTempDir();
    const keyFileName = 'cloud.key';
    const keyFilePath = path.join(projectRoot, keyFileName);
    writeFileSync(keyFilePath, '  cached-secret  ', 'utf8');

    const envVarName = 'UNSET_ENV_FOR_FILE_ONLY';
    setEnv(envVarName, undefined);

    const { service } = buildService({ cacheEnabled: true, projectRoot });

    const llmConfig = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: `../${keyFileName}`,
    };

    const firstResult = await service.getApiKey(llmConfig, 'file-llm');
    expect(firstResult.apiKey).toBe('cached-secret');
    expect(firstResult.errorDetails).toBeNull();
    expect(firstResult.source).toContain(keyFileName);

    const statsAfterFirst = service.getCacheStats();
    expect(statsAfterFirst).not.toBeNull();
    expect(statsAfterFirst.size).toBe(1);
    expect(statsAfterFirst.misses).toBeGreaterThanOrEqual(1);

    rmSync(keyFilePath);

    const secondResult = await service.getApiKey(llmConfig, 'file-llm');
    expect(secondResult.apiKey).toBe('cached-secret');
    expect(service.getCacheStats().hits).toBeGreaterThanOrEqual(1);

    const invalidatedCount = service.invalidateCache('file-llm');
    expect(invalidatedCount).toBeGreaterThan(0);

    writeFileSync(keyFilePath, 'next-secret', 'utf8');

    const thirdResult = await service.getApiKey(llmConfig, 'file-llm');
    expect(thirdResult.apiKey).toBe('next-secret');

    const invalidatedAllCount = service.invalidateAllCache();
    expect(invalidatedAllCount).toBeGreaterThanOrEqual(1);

    service.resetCacheStats();
    const statsAfterReset = service.getCacheStats();
    expect(statsAfterReset.hits).toBe(0);
    expect(statsAfterReset.misses).toBe(0);
  });

  it('surfaces configuration errors when file retrieval is configured without a project root', async () => {
    const { service } = buildService({
      cacheEnabled: false,
      projectRoot: null,
    });

    const config = {
      apiType: 'Azure',
      apiKeyEnvVar: undefined,
      apiKeyFileName: 'cloud.key',
    };

    const result = await service.getApiKey(config, 'missing-root');
    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe(
      'api_key_retrieval_file_root_path_missing'
    );
    expect(service.getCacheStats()).toBeNull();
    expect(service.invalidateAllCache()).toBe(0);
    service.resetCacheStats();
  });

  it('provides comprehensive error details when both environment and file sources fail', async () => {
    const projectRoot = createTempDir();
    const emptyKeyPath = path.join(projectRoot, 'empty.key');
    writeFileSync(emptyKeyPath, '   ', 'utf8');

    const envVarName = 'EMPTY_SOURCE_KEY';
    setEnv(envVarName, '   ');

    const { service } = buildService({ cacheEnabled: true, projectRoot });

    const config = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: 'empty.key',
    };

    const result = await service.getApiKey(config, 'combined-failure');
    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails.details.attemptedEnvVar).toBe(envVarName);
    expect(result.errorDetails.details.attemptedFile).toBe('empty.key');
    expect(result.errorDetails.details.reason).toContain(
      'Environment variable'
    );
  });

  it('reports failures when file retrieval is the only option and the file is missing', async () => {
    const projectRoot = createTempDir();

    const { service } = buildService({ cacheEnabled: true, projectRoot });

    const config = {
      apiType: 'OpenAI',
      apiKeyEnvVar: undefined,
      apiKeyFileName: 'missing.key',
    };

    const result = await service.getApiKey(config, 'missing-file');
    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe(
      'api_key_file_not_found_or_unreadable'
    );
    expect(result.errorDetails.details.attemptedFile).toContain('missing.key');
  });
});
