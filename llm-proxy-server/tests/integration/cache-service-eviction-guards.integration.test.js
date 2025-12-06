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

import CacheService from '../../src/services/cacheService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Keeps track of environment mutations so tests can restore original values.
 * @type {Record<string, string | undefined>}
 */
const ENV_SNAPSHOT = {};

/**
 * Sets or clears an environment variable while remembering the original value.
 * @param {string} key
 * @param {string | undefined} value
 */
function setEnv(key, value) {
  if (!Object.prototype.hasOwnProperty.call(ENV_SNAPSHOT, key)) {
    ENV_SNAPSHOT[key] = process.env[key];
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Restores all environment variables that were mutated during a test.
 */
function restoreEnv() {
  for (const [key, value] of Object.entries(ENV_SNAPSHOT)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
    delete ENV_SNAPSHOT[key];
  }
}

/**
 * Creates a Jest-backed logger that satisfies the ILogger contract.
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

describe('CacheService integration guard coverage', () => {
  describe('constructor requirements', () => {
    it('enforces logger dependency at construction time', () => {
      expect(() => new CacheService()).toThrow(
        'CacheService: logger is required.'
      );
    });
  });

  describe('expiration and LRU eviction with ApiKeyService', () => {
    let tempDir;
    let logger;
    let cacheService;
    let apiKeyService;

    beforeEach(() => {
      jest.useFakeTimers({ now: Date.now() });

      tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-eviction-'));
      setEnv('CACHE_ENABLED', 'true');
      setEnv('API_KEY_CACHE_TTL', '15');
      setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);

      resetAppConfigServiceInstance();

      logger = createLogger();
      const appConfig = getAppConfigService(logger);
      const fsReader = new NodeFileSystemReader();

      cacheService = new CacheService(logger, {
        maxSize: 2,
        defaultTtl: 15,
        maxMemoryBytes: 2048,
        enableAutoCleanup: false,
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

      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
        tempDir = '';
      }

      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('expires stale cached API keys and evicts the oldest entry under pressure', async () => {
      const configFor = (fileName) => ({
        configId: `config-${fileName}`,
        displayName: `Model ${fileName}`,
        modelIdentifier: 'integration-model',
        endpointUrl: 'http://localhost',
        apiType: 'openai',
        promptElements: [],
        promptAssemblyOrder: [],
        apiKeyFileName: fileName,
      });

      const firstKeyPath = path.join(tempDir, 'first.key');
      const secondKeyPath = path.join(tempDir, 'second.key');
      const thirdKeyPath = path.join(tempDir, 'third.key');

      writeFileSync(firstKeyPath, 'first-secret', 'utf8');
      writeFileSync(secondKeyPath, 'second-secret', 'utf8');
      writeFileSync(thirdKeyPath, 'third-secret', 'utf8');

      const firstCacheKey = `api_key:file:${firstKeyPath}`;
      const secondCacheKey = `api_key:file:${secondKeyPath}`;
      const thirdCacheKey = `api_key:file:${thirdKeyPath}`;

      logger.debug.mockClear();
      await apiKeyService.getApiKey(configFor('first.key'), 'first-llm');
      expect(cacheService.has(firstCacheKey)).toBe(true);

      jest.advanceTimersByTime(20);
      await Promise.resolve();

      logger.debug.mockClear();
      const refreshedResult = await apiKeyService.getApiKey(
        configFor('first.key'),
        'first-llm'
      );
      expect(refreshedResult.apiKey).toBe('first-secret');
      expect(
        logger.debug.mock.calls.some(
          ([message]) =>
            message ===
            `CacheService: Cache entry expired for key '${firstCacheKey}'`
        )
      ).toBe(true);
      expect(cacheService.has(firstCacheKey)).toBe(true);

      logger.debug.mockClear();
      await apiKeyService.getApiKey(configFor('second.key'), 'second-llm');
      expect(cacheService.has(secondCacheKey)).toBe(true);

      await apiKeyService.getApiKey(configFor('third.key'), 'third-llm');
      expect(cacheService.has(thirdCacheKey)).toBe(true);

      expect(cacheService.has(firstCacheKey)).toBe(false);
      expect(
        logger.debug.mock.calls.some(
          ([message]) =>
            message ===
            `CacheService: Evicted LRU entry with key '${firstCacheKey}'`
        )
      ).toBe(true);
    });
  });

  describe('memory eviction fallbacks', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('breaks out of memory eviction loop when encountering sentinel nodes', () => {
      const logger = createLogger();
      const cache = new CacheService(logger, {
        maxSize: 4,
        defaultTtl: 50,
        maxMemoryBytes: 64,
        enableAutoCleanup: false,
      });

      cache.set(undefined, 'seed-value');
      const sizeAfterSeed = cache.getSize();

      expect(() => {
        cache.set('oversized-entry', 'x'.repeat(512));
      }).not.toThrow();

      expect(cache.get('oversized-entry')).toBe('x'.repeat(512));
      expect(cache.getSize()).toBe(sizeAfterSeed + 1);
      expect(
        logger.info.mock.calls.some(
          ([message]) =>
            typeof message === 'string' && message.includes('Evicted')
        )
      ).toBe(false);

      cache.cleanup();
    });
  });
});
