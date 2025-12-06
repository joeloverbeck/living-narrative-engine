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

describe('CacheService advanced integration coverage', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let fsReader;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-advanced-'));
    fsReader = new NodeFileSystemReader();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isDebugEnabled: true,
    };

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '25');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 25,
      maxMemoryBytes: 200,
      enableAutoCleanup: true,
      cleanupIntervalMs: 40,
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

  it('sustains cache health under expiration, eviction, and pattern invalidation stress', async () => {
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

    writeFileSync(path.join(tempDir, 'alpha.key'), 'alpha-secret', 'utf8');
    writeFileSync(path.join(tempDir, 'bravo.key'), 'b'.repeat(160), 'utf8');

    const alphaKey = await apiKeyService.getApiKey(
      configFor('alpha.key'),
      'alpha-llm'
    );
    expect(alphaKey.apiKey).toBe('alpha-secret');

    await apiKeyService.getApiKey(configFor('bravo.key'), 'bravo-llm');

    cacheService.set('manual-loader', { session: true }, 40);
    const cachedManual = await cacheService.getOrLoad(
      'manual-loader',
      async () => ({ session: false })
    );
    expect(cachedManual).toEqual({ session: true });

    await expect(
      cacheService.getOrLoad('missing-file', async () =>
        fsReader.readFile(path.join(tempDir, 'missing.key'), 'utf8')
      )
    ).rejects.toThrow();

    const cyclic = {};
    cyclic.self = cyclic;
    cacheService.set('cyclic-entry', cyclic, 60);

    cacheService.set('memory-heavy', 'z'.repeat(512), 80);

    cacheService.set('expiring-entry', { expires: true }, 5);
    jest.advanceTimersByTime(6);
    await Promise.resolve();
    expect(cacheService.has('expiring-entry')).toBe(false);

    cacheService.set('auto-clean-target', { id: 1 }, 5);
    jest.advanceTimersByTime(80);
    await Promise.resolve();
    const statsAfterAuto = cacheService.getStats();
    expect(statsAfterAuto.autoCleanups).toBeGreaterThanOrEqual(1);
    expect(cacheService.has('auto-clean-target')).toBe(false);

    cacheService.set('manual-stale', { id: 2 }, 5);
    jest.advanceTimersByTime(10);
    await Promise.resolve();
    const manualCleanupResults = cacheService.performManualCleanup();
    expect(manualCleanupResults.entriesRemoved).toBeGreaterThanOrEqual(1);
    expect(manualCleanupResults.currentSize).toBe(cacheService.getSize());

    await apiKeyService.getApiKey(configFor('alpha.key'), 'alpha-llm-refresh');

    const invalidatedCount = apiKeyService.invalidateAllCache();
    expect(invalidatedCount).toBeGreaterThanOrEqual(1);

    cacheService.resetStats();
    const resetStats = cacheService.getStats();
    expect(resetStats.hits).toBe(0);
    expect(resetStats.misses).toBe(0);

    const memoryInfo = cacheService.getMemoryInfo();
    expect(memoryInfo.maxBytes).toBe(200);
    expect(parseFloat(memoryInfo.usagePercent)).toBeGreaterThanOrEqual(0);
  });
});
