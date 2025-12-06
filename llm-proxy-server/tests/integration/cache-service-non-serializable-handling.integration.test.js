import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
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

function createTrackingLogger() {
  const entries = [];
  const logger = {
    debug: (...args) => entries.push({ level: 'debug', args }),
    info: (...args) => entries.push({ level: 'info', args }),
    warn: (...args) => entries.push({ level: 'warn', args }),
    error: (...args) => entries.push({ level: 'error', args }),
  };
  logger.isDebugEnabled = true;
  return { logger, entries };
}

describe('CacheService integration for serialization fallbacks', () => {
  let tempDir;
  let cacheService;
  let apiKeyService;
  let loggerBundle;
  let fileSystemReader;

  beforeEach(() => {
    loggerBundle = createTrackingLogger();
    fileSystemReader = new NodeFileSystemReader();

    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-fallback-'));

    setEnv('NODE_ENV', 'test');
    setEnv('CACHE_ENABLED', 'true');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('API_KEY_CACHE_TTL', '300');
    setEnv('HTTP_AGENT_ENABLED', 'false');
    setEnv('PROXY_ALLOWED_ORIGIN', '');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(loggerBundle.logger);

    cacheService = new CacheService(loggerBundle.logger, {
      maxSize: 6,
      defaultTtl: 250,
      maxMemoryBytes: 360,
      enableAutoCleanup: false,
    });

    apiKeyService = new ApiKeyService(
      loggerBundle.logger,
      fileSystemReader,
      appConfig,
      cacheService
    );
  });

  afterEach(() => {
    if (cacheService) {
      cacheService.cleanup();
      cacheService = undefined;
    }

    apiKeyService = undefined;
    loggerBundle = undefined;
    fileSystemReader = undefined;

    resetAppConfigServiceInstance();
    restoreEnv();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  const buildConfig = (fileName) => ({
    apiType: 'OpenAI',
    apiKeyEnvVar: undefined,
    apiKeyFileName: fileName,
    jsonOutputStrategy: { method: 'passthrough' },
    promptElements: [],
    promptAssemblyOrder: [],
    defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
  });

  const getInfoMessages = () =>
    loggerBundle.entries
      .filter((entry) => entry.level === 'info')
      .map((entry) => String(entry.args[0]));

  it('evicts by memory, handles non-serializable entries, and logs pattern invalidation', async () => {
    const writeKeyFile = (name, size) => {
      const filePath = path.join(tempDir, name);
      writeFileSync(filePath, 'k'.repeat(size), 'utf8');
      return filePath;
    };

    const alphaPath = writeKeyFile('alpha.key', 180);
    const bravoPath = writeKeyFile('bravo.key', 180);

    const firstResult = await apiKeyService.getApiKey(
      buildConfig('alpha.key'),
      'llm-alpha'
    );
    expect(firstResult.apiKey).toHaveLength(180);

    const alphaCacheKey = `api_key:file:${alphaPath}`;
    expect(cacheService.has(alphaCacheKey)).toBe(true);

    const infoCountBeforeSecond = getInfoMessages().length;

    const secondResult = await apiKeyService.getApiKey(
      buildConfig('bravo.key'),
      'llm-bravo'
    );
    expect(secondResult.apiKey).toHaveLength(180);

    const infoMessagesAfterSecond = getInfoMessages();
    const newEvictionMessages = infoMessagesAfterSecond.slice(
      infoCountBeforeSecond
    );
    expect(
      newEvictionMessages.some(
        (message) =>
          message.includes('CacheService: Evicted') &&
          message.includes('entries to free')
      )
    ).toBe(true);

    expect(cacheService.has(alphaCacheKey)).toBe(false);

    const infoCountBeforeInvalidation = getInfoMessages().length;
    const invalidatedFromPattern = cacheService.invalidatePattern(/^api_key:/);
    expect(invalidatedFromPattern).toBeGreaterThanOrEqual(1);

    const invalidationMessages = getInfoMessages().slice(
      infoCountBeforeInvalidation
    );
    expect(
      invalidationMessages.some(
        (message) =>
          message.includes('CacheService: Invalidated') &&
          message.includes('^api_key:')
      )
    ).toBe(true);

    const circular = {};
    circular.self = circular;

    cacheService.set('circular:test-entry', { payload: circular });
    const storedCircular = cacheService.get('circular:test-entry');
    expect(storedCircular).toEqual({ payload: circular });
    expect(storedCircular.payload.self).toBe(storedCircular.payload);

    const memoryInfo = cacheService.getMemoryInfo();
    expect(memoryInfo.currentBytes).toBeGreaterThanOrEqual(512);

    const infoCountBeforeCircularInvalidation = getInfoMessages().length;
    const circularInvalidations = cacheService.invalidatePattern(/^circular:/);
    expect(circularInvalidations).toBe(1);

    const circularMessages = getInfoMessages().slice(
      infoCountBeforeCircularInvalidation
    );
    expect(
      circularMessages.some(
        (message) =>
          message.includes('CacheService: Invalidated') &&
          message.includes('^circular:')
      )
    ).toBe(true);
  });
});
