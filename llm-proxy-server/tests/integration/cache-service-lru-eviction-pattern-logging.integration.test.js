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

const ORIGINAL_ENV = new Map();

function setEnv(key, value) {
  if (!ORIGINAL_ENV.has(key)) {
    ORIGINAL_ENV.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreEnv() {
  for (const [key, value] of ORIGINAL_ENV.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  ORIGINAL_ENV.clear();
}

describe('CacheService integrated eviction and invalidation coverage', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let fsReader;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-lru-pattern-'));
    fsReader = new NodeFileSystemReader();
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isDebugEnabled: true,
    };

    setEnv('CACHE_ENABLED', 'true');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('API_KEY_CACHE_TTL', '50');
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 40,
      maxMemoryBytes: 512,
      enableAutoCleanup: true,
      cleanupIntervalMs: 25,
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
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('evicts LRU entries, logs pattern invalidations, and removes expired nodes during auto cleanup', async () => {
    const writeKey = (name, contents) => {
      const fullPath = path.join(tempDir, name);
      writeFileSync(fullPath, contents, 'utf8');
      return fullPath;
    };

    const buildConfig = (fileName) => ({
      apiType: 'openai',
      apiKeyEnvVar: undefined,
      apiKeyFileName: fileName,
    });

    writeKey('first.key', 'first-secret');
    writeKey('second.key', 'second-secret');
    writeKey('third.key', 'third-secret');

    const firstResult = await apiKeyService.getApiKey(
      buildConfig('first.key'),
      'llm-first'
    );
    const secondResult = await apiKeyService.getApiKey(
      buildConfig('second.key'),
      'llm-second'
    );

    expect(firstResult.apiKey).toBe('first-secret');
    expect(secondResult.apiKey).toBe('second-secret');
    expect(cacheService.getSize()).toBe(2);

    const thirdResult = await apiKeyService.getApiKey(
      buildConfig('third.key'),
      'llm-third'
    );
    expect(thirdResult.apiKey).toBe('third-secret');
    expect(cacheService.getSize()).toBe(2);

    const evictionMessages = logger.debug.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('CacheService: Evicted LRU entry'));
    expect(evictionMessages.length).toBeGreaterThanOrEqual(1);

    const invalidatedCount = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidatedCount).toBeGreaterThanOrEqual(1);

    const infoMessages = logger.info.mock.calls.map((call) => String(call[0]));
    expect(
      infoMessages.some(
        (message) =>
          message.includes('CacheService: Invalidated') &&
          message.includes('pattern')
      )
    ).toBe(true);

    cacheService.set('short-lived', { flag: true }, 5);
    expect(cacheService.has('short-lived')).toBe(true);

    jest.advanceTimersByTime(30);
    await Promise.resolve();
    jest.advanceTimersByTime(30);
    await Promise.resolve();

    const debugMessages = logger.debug.mock.calls.map((call) =>
      String(call[0])
    );
    expect(
      debugMessages.some((message) =>
        message.includes('CacheService: Auto cleanup removed')
      )
    ).toBe(true);
    expect(cacheService.has('short-lived')).toBe(false);
  });
});
