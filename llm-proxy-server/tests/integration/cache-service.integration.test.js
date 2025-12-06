/**
 * @file cache-service.integration.test.js
 * @description Deep integration coverage for CacheService collaborating with ApiKeyService,
 * health readiness middleware, and file system interactions.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

import CacheService from '../../src/services/cacheService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { createReadinessCheck } from '../../src/middleware/healthCheck.js';

/**
 * Creates a structured logger compatible with the service interfaces.
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

const envSnapshot = new Map();

/**
 * Safely sets environment variables during a test run.
 * @param {string} key
 * @param {string | undefined} value
 */
function setEnv(key, value) {
  if (!envSnapshot.has(key)) {
    envSnapshot.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Restores the environment variables modified via setEnv.
 */
function restoreEnv() {
  for (const [key, value] of envSnapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  envSnapshot.clear();
}

describe('CacheService integration coverage', () => {
  let tempDir;
  let logger;
  let cacheService;
  let apiKeyService;
  let fsReader;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.now() });
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-int-'));
    logger = createLogger();
    fsReader = new NodeFileSystemReader();

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '40');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
    setEnv('HTTP_AGENT_ENABLED', 'false');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    cacheService = new CacheService(logger, {
      maxSize: 2,
      defaultTtl: 40,
      maxMemoryBytes: 220,
      enableAutoCleanup: true,
      cleanupIntervalMs: 20,
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
    jest.useRealTimers();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('manages TTL, eviction, manual cleanup, and stats while collaborating with ApiKeyService and NodeFileSystemReader', async () => {
    const fileNames = ['alpha.key', 'beta.key', 'gamma.key', 'delta.key'];
    const contents = [
      'value-alpha',
      'value-beta',
      'value-gamma',
      'x'.repeat(320),
    ];

    fileNames.forEach((name, index) => {
      writeFileSync(path.join(tempDir, name), contents[index], 'utf8');
    });

    const buildConfig = (fileName) => ({
      apiType: 'OpenAI',
      apiKeyEnvVar: undefined,
      apiKeyFileName: fileName,
    });

    const cacheKey = (fileName) =>
      `api_key:file:${path.join(tempDir, fileName)}`;

    const alpha = await apiKeyService.getApiKey(
      buildConfig(fileNames[0]),
      'llm-alpha'
    );
    expect(alpha.apiKey).toBe('value-alpha');

    let stats = cacheService.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);

    const alphaHit = await apiKeyService.getApiKey(
      buildConfig(fileNames[0]),
      'llm-alpha'
    );
    expect(alphaHit.apiKey).toBe('value-alpha');

    stats = cacheService.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);

    await apiKeyService.getApiKey(buildConfig(fileNames[1]), 'llm-beta');
    expect(cacheService.has(cacheKey(fileNames[1]))).toBe(true);

    await apiKeyService.getApiKey(buildConfig(fileNames[2]), 'llm-gamma');
    expect(cacheService.has(cacheKey(fileNames[0]))).toBe(false);
    expect(cacheService.has(cacheKey(fileNames[2]))).toBe(true);
    expect(cacheService.getSize()).toBeLessThanOrEqual(2);

    await apiKeyService.getApiKey(buildConfig(fileNames[3]), 'llm-delta');
    stats = cacheService.getStats();
    expect(stats.memoryEvictions).toBeGreaterThanOrEqual(1);

    jest.advanceTimersByTime(60);
    await Promise.resolve();

    expect(cacheService.has(cacheKey(fileNames[2]))).toBe(false);

    const manualCleanup = cacheService.performManualCleanup();
    expect(manualCleanup.currentSize).toBe(cacheService.getSize());

    const loaderKey = `fs-load:${path.join(tempDir, fileNames[0])}`;
    const loaderValue = await cacheService.getOrLoad(loaderKey, async () => {
      return fsReader.readFile(path.join(tempDir, fileNames[0]), 'utf8');
    });
    expect(loaderValue.trim()).toBe('value-alpha');

    cacheService.set(loaderKey, 'manually-updated', 80);
    expect(cacheService.get(loaderKey)).toBe('manually-updated');

    expect(cacheService.invalidate('non-existent-key')).toBe(false);
    expect(cacheService.invalidate(loaderKey)).toBe(true);

    const memoryInfo = cacheService.getMemoryInfo();
    expect(memoryInfo.maxBytes).toBe(220);

    await apiKeyService.getApiKey(buildConfig(fileNames[1]), 'llm-beta');
    const invalidated = apiKeyService.invalidateAllCache();
    expect(invalidated).toBeGreaterThanOrEqual(1);

    apiKeyService.resetCacheStats();
    stats = cacheService.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('reports healthy cache state through readiness middleware alongside real config services', async () => {
    const configDir = mkdtempSync(path.join(os.tmpdir(), 'cache-int-config-'));
    const configPath = path.join(configDir, 'llm-configs.json');

    const configPayload = {
      defaultConfigId: 'demo-llm',
      configs: {
        'demo-llm': {
          configId: 'demo-llm',
          displayName: 'Demo LLM',
          modelIdentifier: 'gpt-test',
          endpointUrl: 'http://localhost/test',
          apiType: 'openai',
          promptElements: [],
          promptAssemblyOrder: [],
        },
      },
    };

    writeFileSync(configPath, JSON.stringify(configPayload), 'utf8');

    setEnv('LLM_CONFIG_PATH', configPath);
    setEnv('CACHE_ENABLED', 'true');
    setEnv('READINESS_CRITICAL_HEAP_PERCENT', '100');
    setEnv('READINESS_CRITICAL_HEAP_TOTAL_MB', '16384');
    setEnv('READINESS_CRITICAL_HEAP_USED_MB', '16384');
    setEnv('READINESS_CRITICAL_HEAP_LIMIT_PERCENT', '100');

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);
    const llmConfigService = new LlmConfigService(fsReader, logger, appConfig);
    await llmConfigService.initialize();

    cacheService.set('readiness-probe', { ok: true }, 200);

    const app = express();
    app.get(
      '/health/ready',
      createReadinessCheck({ logger, llmConfigService, cacheService })
    );

    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
    expect(response.body.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'cacheService',
          status: 'UP',
          details: expect.objectContaining({ working: true }),
        }),
      ])
    );

    rmSync(configDir, { recursive: true, force: true });
  });
});
