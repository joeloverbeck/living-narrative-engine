/**
 * @file cache-service-auto-maintenance.integration.test.js
 * @description Integration tests extending CacheService coverage by exercising
 *              eviction, pattern invalidation, and auto-cleanup flows while
 *              collaborating with ApiKeyService, AppConfigService, and the
 *              real filesystem utilities.
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
 * Creates a logger compatible with ILogger that captures structured output.
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

const envSnapshot = new Map();

/**
 * Safely mutates process.env during the test while supporting restoration.
 * @param {string} key
 * @param {string | undefined} value
 * @returns {void}
 */
function setEnv(key, value) {
  if (!envSnapshot.has(key)) {
    envSnapshot.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Restores mutated environment variables to their original values.
 * @returns {void}
 */
function restoreEnv() {
  for (const [key, value] of envSnapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  envSnapshot.clear();
}

describe('CacheService automatic maintenance integration', () => {
  let tempDir;
  /** @type {import('../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  /** @type {CacheService} */
  let cacheService;
  /** @type {ApiKeyService} */
  let apiKeyService;
  /** @type {NodeFileSystemReader} */
  let fsReader;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-auto-'));
    logger = createLogger();
    fsReader = new NodeFileSystemReader();

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '25');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 1,
      defaultTtl: 25,
      maxMemoryBytes: 256,
      enableAutoCleanup: true,
      cleanupIntervalMs: 10,
    });

    apiKeyService = new ApiKeyService(
      logger,
      fsReader,
      appConfig,
      cacheService
    );
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
    }

    resetAppConfigServiceInstance();
    restoreEnv();
    jest.useRealTimers();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('evicts least-recently used keys, invalidates by pattern, and auto-cleans expired entries', async () => {
    const firstFile = path.join(tempDir, 'first.key');
    const secondFile = path.join(tempDir, 'second.key');

    writeFileSync(firstFile, 'first-value', 'utf8');
    writeFileSync(secondFile, 'second-value', 'utf8');

    const buildConfig = (fileName) => ({
      apiType: 'OpenAI',
      apiKeyEnvVar: undefined,
      apiKeyFileName: fileName,
    });

    const firstCacheKey = `api_key:file:${firstFile}`;
    const secondCacheKey = `api_key:file:${secondFile}`;

    const firstResult = await apiKeyService.getApiKey(
      buildConfig('first.key'),
      'llm-first'
    );
    expect(firstResult.apiKey).toBe('first-value');
    expect(cacheService.has(firstCacheKey)).toBe(true);

    const secondResult = await apiKeyService.getApiKey(
      buildConfig('second.key'),
      'llm-second'
    );
    expect(secondResult.apiKey).toBe('second-value');
    expect(cacheService.has(secondCacheKey)).toBe(true);
    expect(cacheService.has(firstCacheKey)).toBe(false);

    const invalidated = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidated).toBeGreaterThanOrEqual(1);
    expect(cacheService.has(secondCacheKey)).toBe(false);

    await apiKeyService.getApiKey(buildConfig('first.key'), 'llm-first');
    expect(cacheService.has(firstCacheKey)).toBe(true);

    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(cacheService.has(firstCacheKey)).toBe(false);

    const stats = cacheService.getStats();
    expect(stats.expirations).toBeGreaterThanOrEqual(1);
  });
});
