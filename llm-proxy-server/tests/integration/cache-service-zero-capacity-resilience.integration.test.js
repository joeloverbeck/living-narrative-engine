/**
 * @file cache-service-zero-capacity-resilience.integration.test.js
 * @description Ensures CacheService handles minimal-capacity configurations and manual cleanup flows
 * using real ApiKeyService and filesystem integrations.
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

const ORIGINAL_ENV = new Map();

function instrumentConsole() {
  return {
    debugSpy: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    infoSpy: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warnSpy: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    errorSpy: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

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

describe('CacheService minimal-capacity resilience integration', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let consoleSpies;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now(), doNotFake: ['setImmediate'] });

    consoleSpies = instrumentConsole();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-zero-'));

    setEnv('CACHE_ENABLED', 'true');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('API_KEY_CACHE_TTL', '25');
    setEnv('API_KEY_CACHE_MAX_SIZE', '1');
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    logger = new ConsoleLogger();
    const fsReader = new NodeFileSystemReader();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 1,
      defaultTtl: 25,
      maxMemoryBytes: 256,
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

    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (consoleSpies) {
      for (const spy of Object.values(consoleSpies)) {
        spy.mockRestore();
      }
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('evicts least recently used entries and cleans expired data without mocks', async () => {
    const writeKey = (name, secret) => {
      const fullPath = path.join(tempDir, name);
      writeFileSync(fullPath, secret, 'utf8');
      return fullPath;
    };

    writeKey('alpha.key', 'alpha-secret');
    writeKey('beta.key', 'beta-secret');

    const readConfig = (fileName) => ({
      apiType: 'openai',
      apiKeyFileName: fileName,
    });

    const first = await apiKeyService.getApiKey(
      readConfig('alpha.key'),
      'llm-alpha'
    );
    expect(first.apiKey).toBe('alpha-secret');

    const second = await apiKeyService.getApiKey(
      readConfig('beta.key'),
      'llm-beta'
    );
    expect(second.apiKey).toBe('beta-secret');

    const statsAfterEviction = cacheService.getStats();
    expect(statsAfterEviction.evictions).toBeGreaterThanOrEqual(1);

    const invalidated = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidated).toBeGreaterThanOrEqual(1);

    cacheService.set('ephemeral:key', { ok: true }, 5);
    expect(cacheService.has('ephemeral:key')).toBe(true);

    jest.advanceTimersByTime(30);

    const cleanupSummary = cacheService.performManualCleanup();
    expect(cleanupSummary.entriesRemoved).toBeGreaterThanOrEqual(1);
    expect(cleanupSummary.memoryFreed).toBeGreaterThanOrEqual(1);

    const statsAfterCleanup = cacheService.getStats();
    expect(statsAfterCleanup.autoCleanups).toBeGreaterThanOrEqual(1);
    expect(statsAfterCleanup.expirations).toBeGreaterThanOrEqual(1);

    expect(consoleSpies.errorSpy).not.toHaveBeenCalled();
  });
});
