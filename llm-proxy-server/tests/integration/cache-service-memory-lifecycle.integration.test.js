/**
 * @file cache-service-memory-lifecycle.integration.test.js
 * @description Covers CacheService memory eviction and cleanup flows by exercising
 *              its collaboration with ApiKeyService, AppConfigService, and the
 *              production ConsoleLogger implementation.
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

import { ConsoleLogger } from '../../src/consoleLogger.js';
import CacheService from '../../src/services/cacheService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Persists original environment variables so they can be restored after each test.
 */
const ORIGINAL_ENV = { ...process.env };

/**
 * Builds a ConsoleLogger-backed CacheService and ApiKeyService wired to the live
 * AppConfig singleton and NodeFileSystemReader. Returns helpers for teardown.
 * @param {string} projectRoot
 */
function buildIntegrationServices(projectRoot) {
  const consoleLogger = new ConsoleLogger();

  const cacheService = new CacheService(consoleLogger, {
    maxSize: 6,
    defaultTtl: 50,
    maxMemoryBytes: 260,
    enableAutoCleanup: false,
  });

  resetAppConfigServiceInstance();
  const appConfig = getAppConfigService(consoleLogger);
  const fsReader = new NodeFileSystemReader();

  const apiKeyService = new ApiKeyService(
    consoleLogger,
    fsReader,
    appConfig,
    cacheService
  );

  return { cacheService, apiKeyService, logger: consoleLogger };
}

/**
 * Instruments console output so the production ConsoleLogger can be asserted
 * without polluting the integration test logs.
 */
function instrumentConsole() {
  return {
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

describe('CacheService memory lifecycle integration', () => {
  let tempDir;
  let consoleSpies;
  let cacheService;
  let apiKeyService;

  beforeEach(() => {
    jest.useFakeTimers({
      now: Date.now(),
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-memory-'));

    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'test';
    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_DEFAULT_TTL = '50';
    process.env.CACHE_MAX_SIZE = '6';
    process.env.API_KEY_CACHE_TTL = '35';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = tempDir;
    process.env.HTTP_AGENT_ENABLED = 'false';
    process.env.LOG_ENHANCED_FORMATTING = 'false';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.LOG_ICON_MODE = 'false';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'false';

    consoleSpies = instrumentConsole();

    const services = buildIntegrationServices(tempDir);
    cacheService = services.cacheService;
    apiKeyService = services.apiKeyService;
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
      cacheService = null;
    }

    resetAppConfigServiceInstance();
    jest.useRealTimers();

    for (const spy of Object.values(consoleSpies || {})) {
      spy.mockRestore();
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }

    process.env = { ...ORIGINAL_ENV };
  });

  it('reports memory evictions, pattern invalidation, and manual cleanup activity', async () => {
    const writeApiKey = (fileName, contents) => {
      const filePath = path.join(tempDir, fileName);
      writeFileSync(filePath, contents, 'utf8');
      return filePath;
    };

    const buildConfig = (fileName) => ({
      configId: `cfg-${fileName}`,
      displayName: `LLM ${fileName}`,
      modelIdentifier: `integration-${fileName}`,
      endpointUrl: 'http://127.0.0.1/fake',
      apiType: 'openai',
      promptElements: [],
      promptAssemblyOrder: [],
      apiKeyFileName: fileName,
    });

    writeApiKey('first.key', 'A'.repeat(180));
    writeApiKey('second.key', 'B'.repeat(180));
    writeApiKey('third.key', 'C'.repeat(220));

    await apiKeyService.getApiKey(buildConfig('first.key'), 'llm-first');
    await apiKeyService.getApiKey(buildConfig('second.key'), 'llm-second');

    expect(cacheService.getSize()).toBeGreaterThanOrEqual(1);

    consoleSpies.info.mockClear();

    await apiKeyService.getApiKey(buildConfig('third.key'), 'llm-third');

    const statsAfterThird = cacheService.getStats();
    expect(statsAfterThird.memoryEvictions).toBeGreaterThan(0);

    const evictionLog = consoleSpies.info.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('CacheService: Evicted') &&
          message.includes('free ')
      );

    expect(evictionLog).toBeDefined();

    const invalidated = apiKeyService.invalidateAllCache();
    expect(invalidated).toBeGreaterThanOrEqual(1);

    const invalidationLog = consoleSpies.info.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('CacheService: Invalidated') &&
          message.includes('pattern /')
      );

    expect(invalidationLog).toBeDefined();

    writeApiKey('stale.key', 'stale-secret');
    await apiKeyService.getApiKey(buildConfig('stale.key'), 'llm-stale');

    await jest.advanceTimersByTimeAsync(40);

    const cleanupSummary = cacheService.performManualCleanup();
    expect(cleanupSummary.entriesRemoved).toBeGreaterThanOrEqual(1);

    const cleanupLog = consoleSpies.debug.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('CacheService: Auto cleanup removed')
      );

    expect(cleanupLog).toBeDefined();

    cacheService.cleanup();
    cacheService = null;

    const clearLog = consoleSpies.info.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('CacheService: Cleared all')
      );

    expect(clearLog).toBeDefined();
  });
});
