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

const createTrackingLogger = () => {
  const entries = [];
  const logger = {
    debug: (...args) => entries.push({ level: 'debug', args }),
    info: (...args) => entries.push({ level: 'info', args }),
    warn: (...args) => entries.push({ level: 'warn', args }),
    error: (...args) => entries.push({ level: 'error', args }),
    isDebugEnabled: true,
  };

  return { logger, entries };
};

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

describe('CacheService LRU maintenance integration', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let fsReader;
  let loggerBundle;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-lru-'));
    fsReader = new NodeFileSystemReader();
    loggerBundle = createTrackingLogger();

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '30');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(loggerBundle.logger);

    cacheService = new CacheService(loggerBundle.logger, {
      maxSize: 2,
      defaultTtl: 30,
      maxMemoryBytes: 4096,
      enableAutoCleanup: true,
      cleanupIntervalMs: 20,
    });

    apiKeyService = new ApiKeyService(
      loggerBundle.logger,
      fsReader,
      appConfig,
      cacheService
    );
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
    }
    cacheService = null;

    resetAppConfigServiceInstance();
    restoreEnv();

    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('evicts LRU entries, reports invalidation, and auto cleans expired values', async () => {
    const writeKeyFile = (fileName, value) => {
      writeFileSync(path.join(tempDir, fileName), value, 'utf8');
    };

    writeKeyFile('alpha.key', 'alpha-secret');
    writeKeyFile('bravo.key', 'bravo-secret');
    writeKeyFile('charlie.key', 'charlie-secret');

    const configFor = (fileName) => ({
      apiType: 'OpenAI',
      apiKeyEnvVar: undefined,
      apiKeyFileName: fileName,
    });

    await apiKeyService.getApiKey(configFor('alpha.key'), 'llm-alpha');
    await apiKeyService.getApiKey(configFor('bravo.key'), 'llm-bravo');

    const statsBeforeEviction = cacheService.getStats();
    expect(statsBeforeEviction.size).toBeGreaterThanOrEqual(2);

    await apiKeyService.getApiKey(configFor('charlie.key'), 'llm-charlie');

    const statsAfterEviction = cacheService.getStats();
    expect(statsAfterEviction.evictions).toBeGreaterThanOrEqual(1);

    const debugMessagesAfterEviction = loggerBundle.entries
      .filter((entry) => entry.level === 'debug')
      .map((entry) => String(entry.args[0]));

    expect(
      debugMessagesAfterEviction.some((message) =>
        message.includes('CacheService: Evicted LRU entry')
      )
    ).toBe(true);

    const invalidatedCount = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidatedCount).toBeGreaterThanOrEqual(1);

    const infoMessagesAfterInvalidation = loggerBundle.entries
      .filter((entry) => entry.level === 'info')
      .map((entry) => String(entry.args[0]));

    expect(
      infoMessagesAfterInvalidation.some((message) =>
        message.includes('CacheService: Invalidated')
      )
    ).toBe(true);

    cacheService.set('transient-entry', { sample: true }, 10);
    expect(cacheService.has('transient-entry')).toBe(true);

    jest.advanceTimersByTime(12);
    await Promise.resolve();

    jest.advanceTimersByTime(20);
    await Promise.resolve();

    expect(cacheService.has('transient-entry')).toBe(false);

    const statsAfterCleanup = cacheService.getStats();
    expect(statsAfterCleanup.autoCleanups).toBeGreaterThanOrEqual(1);
    expect(statsAfterCleanup.expirations).toBeGreaterThanOrEqual(1);
  });
});
