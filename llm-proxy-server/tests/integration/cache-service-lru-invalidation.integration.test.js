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

describe('CacheService LRU eviction and pattern invalidation integration', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let fsReader;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(
      path.join(os.tmpdir(), 'cache-service-lru-invalidation-')
    );
    fsReader = new NodeFileSystemReader();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isDebugEnabled: true,
    };

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '150');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 100,
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

  it('evicts LRU entries, cleans up expired items, and invalidates matching patterns', async () => {
    const configFor = (fileName) => ({
      configId: `config-${fileName}`,
      displayName: `Model for ${fileName}`,
      modelIdentifier: 'test-model',
      endpointUrl: 'http://localhost',
      apiType: 'openai',
      promptElements: [],
      promptAssemblyOrder: [],
      apiKeyFileName: fileName,
    });

    writeFileSync(path.join(tempDir, 'first.key'), 'first-secret', 'utf8');
    writeFileSync(path.join(tempDir, 'second.key'), 'second-secret', 'utf8');
    writeFileSync(path.join(tempDir, 'third.key'), 'third-secret', 'utf8');

    const firstKey = await apiKeyService.getApiKey(
      configFor('first.key'),
      'first-llm'
    );
    expect(firstKey.apiKey).toBe('first-secret');

    await apiKeyService.getApiKey(configFor('second.key'), 'second-llm');
    await apiKeyService.getApiKey(configFor('third.key'), 'third-llm');

    const evictionLog = logger.debug.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('CacheService: Evicted LRU entry with key')
    );
    expect(evictionLog).toBeDefined();

    cacheService.set('api_key:file:temporary', { shortLived: true }, 10);
    jest.advanceTimersByTime(30);
    await Promise.resolve();

    const autoCleanupLog = logger.debug.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('CacheService: Auto cleanup removed')
    );
    expect(autoCleanupLog).toBeDefined();

    const invalidated = apiKeyService.invalidateAllCache();
    expect(invalidated).toBeGreaterThan(0);

    const patternLog = logger.info.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('CacheService: Invalidated') &&
        call[0].includes('freed')
    );
    expect(patternLog).toBeDefined();

    expect(cacheService.getSize()).toBe(0);
  });
});
