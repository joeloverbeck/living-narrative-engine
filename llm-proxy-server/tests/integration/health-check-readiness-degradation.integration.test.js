import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import {
  createLivenessCheck,
  createReadinessCheck,
} from '../../src/middleware/healthCheck.js';
import { createConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';

const ORIGINAL_ENV = { ...process.env };

const createTempInvalidConfig = () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'health-readiness-degrade-')
  );
  const filePath = path.join(directory, 'llm-configs.json');
  writeFileSync(filePath, '{"invalidJson": }', 'utf8');
  return { directory, filePath };
};

describe('health check readiness degradation integration', () => {
  const cleanupTasks = [];

  const registerCleanup = (task) => {
    cleanupTasks.push(task);
  };

  afterEach(async () => {
    jest.restoreAllMocks();
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      await task();
    }
    process.env = { ...ORIGINAL_ENV };
  });

  it('reports dependency degradations with detailed readiness metadata', async () => {
    const logger = createConsoleLogger();
    const invalidConfig = createTempInvalidConfig();
    const versionLabel = 'integration-health-version-9.9.9';

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'test',
      LLM_CONFIG_PATH: invalidConfig.filePath,
      CACHE_ENABLED: 'true',
      HTTP_AGENT_ENABLED: 'true',
      npm_package_version: versionLabel,
      READINESS_CRITICAL_HEAP_PERCENT: '95',
      READINESS_CRITICAL_HEAP_TOTAL_MB: '64',
      READINESS_CRITICAL_HEAP_USED_MB: '64',
      READINESS_CRITICAL_HEAP_LIMIT_PERCENT: '1',
    };

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    const llmConfigService = new LlmConfigService(
      new NodeFileSystemReader(),
      logger,
      appConfig
    );
    await llmConfigService.initialize();

    const cacheConfig = appConfig.getCacheConfig();
    const cacheService = new CacheService(logger, {
      maxSize: cacheConfig.maxSize,
      defaultTtl: cacheConfig.defaultTtl,
      enableAutoCleanup: false,
    });

    const httpAgentConfig = appConfig.getHttpAgentConfig();
    const httpAgentService = new HttpAgentService(logger, {
      ...httpAgentConfig,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 500,
      minCleanupIntervalMs: 200,
    });

    registerCleanup(async () => {
      cacheService.cleanup();
      httpAgentService.cleanup();
      rmSync(invalidConfig.directory, { recursive: true, force: true });
      resetAppConfigServiceInstance();
    });

    const app = express();
    app.get('/health', createLivenessCheck({ logger }));
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger,
        llmConfigService,
        cacheService,
        httpAgentService,
      })
    );

    const originalCacheGet = cacheService.get;
    cacheService.get = () => undefined;
    registerCleanup(async () => {
      cacheService.get = originalCacheGet;
    });

    const originalAgentCleanup = httpAgentService.cleanup;
    // Simulate a missing cleanup method to exercise dependency guards.
    // eslint-disable-next-line no-param-reassign
    httpAgentService.cleanup = undefined;
    registerCleanup(async () => {
      httpAgentService.cleanup = originalAgentCleanup;
    });

    const originalMemoryUsage = process.memoryUsage;
    const originalCpuUsage = process.cpuUsage;
    const originalUptime = process.uptime;
    process.memoryUsage = () => ({
      rss: 512 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      heapUsed: 99 * 1024 * 1024,
      external: 32 * 1024 * 1024,
      arrayBuffers: 8 * 1024 * 1024,
    });
    process.cpuUsage = () => ({ user: 1500, system: 250 });
    process.uptime = () => 123;
    registerCleanup(async () => {
      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
      process.uptime = originalUptime;
    });

    const readinessResponse = await request(app).get('/health/ready');
    expect(readinessResponse.status).toBe(503);
    expect(readinessResponse.body).toMatchObject({
      status: 'DOWN',
      version: versionLabel,
      details: {
        summary: expect.objectContaining({
          total: expect.any(Number),
          down: expect.any(Number),
        }),
      },
    });

    const dependencies = readinessResponse.body.details.dependencies;
    const llmConfigCheck = dependencies.find(
      (dep) => dep.name === 'llmConfigService'
    );
    expect(llmConfigCheck.status).toBe('DOWN');
    expect(llmConfigCheck.details).toMatchObject({
      operational: false,
      stage: expect.any(String),
    });
    expect(typeof llmConfigCheck.details.error).toBe('string');
    expect(llmConfigCheck.details.error.length).toBeGreaterThan(0);

    const cacheCheck = dependencies.find((dep) => dep.name === 'cacheService');
    expect(cacheCheck.status).toBe('DOWN');
    expect(cacheCheck.details.size).toBeGreaterThanOrEqual(0);
    expect(cacheCheck.details.memoryUsage).toEqual(
      expect.objectContaining({ entryCount: expect.any(Number) })
    );

    const httpAgentCheck = dependencies.find(
      (dep) => dep.name === 'httpAgentService'
    );
    expect(httpAgentCheck.status).toBe('DOWN');
    expect(httpAgentCheck.details).toMatchObject({
      error: 'Missing required methods',
      working: false,
    });

    const processCheck = dependencies.find((dep) => dep.name === 'nodeProcess');
    expect(processCheck.status).toBe('DOWN');
    expect(processCheck.details.memoryUsage.percentage).toBeGreaterThanOrEqual(
      98
    );

    const livenessResponse = await request(app).get('/health');
    expect(livenessResponse.status).toBe(200);
    expect(livenessResponse.body.version).toBe(versionLabel);
    expect(livenessResponse.body.details.memory).toHaveProperty('used');
  });
});
