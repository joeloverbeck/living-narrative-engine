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

const createTrackingLogger = () => {
  const entries = [];
  const logger = {
    info: (...args) => entries.push({ level: 'info', args }),
    warn: (...args) => entries.push({ level: 'warn', args }),
    error: (...args) => entries.push({ level: 'error', args }),
    debug: (...args) => entries.push({ level: 'debug', args }),
    isDebugEnabled: true,
  };

  return { logger, entries };
};

describe('CacheService memory eviction and shutdown logging (integration)', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let fsReader;
  let loggerBundle;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-memory-'));
    fsReader = new NodeFileSystemReader();
    loggerBundle = createTrackingLogger();

    setEnv('CACHE_ENABLED', 'true');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('API_KEY_CACHE_TTL', '120');
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(loggerBundle.logger);

    cacheService = new CacheService(loggerBundle.logger, {
      maxSize: 5,
      defaultTtl: 200,
      maxMemoryBytes: 600,
      enableAutoCleanup: true,
      cleanupIntervalMs: 40,
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

    resetAppConfigServiceInstance();
    restoreEnv();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('evicts cached API keys by memory limit, logs invalidations, and stops auto cleanup on shutdown', async () => {
    const writeKeyFile = (fileName, size) => {
      const targetPath = path.join(tempDir, fileName);
      writeFileSync(targetPath, 'k'.repeat(size), 'utf8');
      return targetPath;
    };

    writeKeyFile('alpha.key', 150);
    writeKeyFile('bravo.key', 150);
    writeKeyFile('charlie.key', 400);

    const buildConfig = (fileName) => ({
      apiType: 'OpenAI',
      apiKeyEnvVar: undefined,
      apiKeyFileName: fileName,
    });

    const firstResult = await apiKeyService.getApiKey(
      buildConfig('alpha.key'),
      'llm-alpha'
    );
    expect(firstResult.apiKey).toHaveLength(150);

    const secondResult = await apiKeyService.getApiKey(
      buildConfig('bravo.key'),
      'llm-bravo'
    );
    expect(secondResult.apiKey).toHaveLength(150);

    const statsBefore = cacheService.getStats();
    expect(statsBefore.memoryEvictions).toBe(0);

    const thirdResult = await apiKeyService.getApiKey(
      buildConfig('charlie.key'),
      'llm-charlie'
    );
    expect(thirdResult.apiKey).toHaveLength(400);

    const statsAfterEviction = cacheService.getStats();
    expect(statsAfterEviction.memoryEvictions).toBeGreaterThan(0);

    const infoMessagesAfterEviction = loggerBundle.entries
      .filter((entry) => entry.level === 'info')
      .map((entry) => String(entry.args[0]));

    expect(
      infoMessagesAfterEviction.some((message) =>
        message.includes('CacheService: Evicted')
      )
    ).toBe(true);

    const infoCountBeforeInvalidation = infoMessagesAfterEviction.length;
    const invalidatedCount = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidatedCount).toBeGreaterThanOrEqual(1);

    const infoMessagesAfterInvalidation = loggerBundle.entries
      .filter((entry) => entry.level === 'info')
      .map((entry) => String(entry.args[0]));

    const newInvalidationMessages = infoMessagesAfterInvalidation.slice(
      infoCountBeforeInvalidation
    );

    expect(
      newInvalidationMessages.some(
        (message) =>
          message.includes('CacheService: Invalidated') &&
          message.includes('pattern')
      )
    ).toBe(true);

    const reloaded = await apiKeyService.getApiKey(
      buildConfig('charlie.key'),
      'llm-charlie-refresh'
    );
    expect(reloaded.apiKey).toHaveLength(400);

    cacheService.cleanup();
    const finalMemoryInfo = cacheService.getMemoryInfo();
    cacheService = null;

    const finalInfoMessages = loggerBundle.entries
      .filter((entry) => entry.level === 'info')
      .map((entry) => String(entry.args[0]));

    expect(
      finalInfoMessages.some((message) =>
        message.includes('CacheService: Stopped auto cleanup')
      )
    ).toBe(true);
    expect(
      finalInfoMessages.some((message) =>
        message.includes('CacheService: Cleaned up all resources')
      )
    ).toBe(true);

    expect(finalMemoryInfo.currentBytes).toBe(0);
    expect(finalMemoryInfo.entryCount).toBe(0);
  });
});
