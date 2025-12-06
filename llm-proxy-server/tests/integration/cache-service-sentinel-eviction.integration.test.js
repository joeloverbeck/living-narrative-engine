/**
 * @file cache-service-sentinel-eviction.integration.test.js
 * @description Validates CacheService eviction behavior at capacity boundaries
 * using the real ApiKeyService, filesystem reader, and configuration modules.
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

describe('CacheService sentinel eviction coverage integration', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let consoleSpies;
  let logger;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now(), doNotFake: ['setImmediate'] });

    consoleSpies = instrumentConsole();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-service-sentinel-'));

    setEnv('CACHE_ENABLED', 'true');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('API_KEY_CACHE_TTL', '75');
    setEnv('API_KEY_CACHE_MAX_SIZE', '2');
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();

    logger = new ConsoleLogger();
    const fsReader = new NodeFileSystemReader();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 75,
      maxMemoryBytes: 512,
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

  it('evicts the least recently used key without disturbing sentinel nodes', async () => {
    const writeKeyFile = (name, value) => {
      const filePath = path.join(tempDir, name);
      writeFileSync(filePath, value, 'utf8');
      return filePath;
    };

    const buildConfig = (fileName) => ({
      apiType: 'openai',
      apiKeyFileName: fileName,
    });

    writeKeyFile('alpha.key', 'alpha-secret');
    writeKeyFile('beta.key', 'beta-secret');
    writeKeyFile('gamma.key', 'gamma-secret');

    const alphaResult = await apiKeyService.getApiKey(
      buildConfig('alpha.key'),
      'llm-alpha'
    );
    const betaResult = await apiKeyService.getApiKey(
      buildConfig('beta.key'),
      'llm-beta'
    );

    expect(alphaResult.apiKey).toBe('alpha-secret');
    expect(betaResult.apiKey).toBe('beta-secret');
    expect(cacheService.getSize()).toBe(2);

    const debugCallsBeforeEviction = consoleSpies.debugSpy.mock.calls.length;

    const gammaResult = await apiKeyService.getApiKey(
      buildConfig('gamma.key'),
      'llm-gamma'
    );
    expect(gammaResult.apiKey).toBe('gamma-secret');

    const newDebugLogs = consoleSpies.debugSpy.mock.calls
      .slice(debugCallsBeforeEviction)
      .map(([message]) => message);

    expect(
      newDebugLogs.some((message) =>
        message.includes("CacheService: Evicted LRU entry with key '")
      )
    ).toBe(true);

    const statsAfterGamma = cacheService.getStats();
    expect(statsAfterGamma.evictions).toBeGreaterThanOrEqual(1);
    expect(cacheService.getSize()).toBe(2);

    const alphaReload = await apiKeyService.getApiKey(
      buildConfig('alpha.key'),
      'llm-alpha'
    );
    expect(alphaReload.apiKey).toBe('alpha-secret');

    expect(
      consoleSpies.debugSpy.mock.calls.some(([message]) =>
        message.includes(
          "CacheService: Cache miss for key 'api_key:file:".concat(tempDir)
        )
      )
    ).toBe(true);

    expect(
      consoleSpies.debugSpy.mock.calls.some(([message]) =>
        message.includes('CacheService: Cached value for key')
      )
    ).toBe(true);
  });
});
