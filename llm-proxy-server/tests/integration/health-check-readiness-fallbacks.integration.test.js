import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import v8 from 'v8';

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
const ORIGINAL_HEAP_STATS = v8.getHeapStatistics;

const createMalformedConfig = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'readiness-fallback-'));
  const filePath = path.join(directory, 'llm-configs.json');
  writeFileSync(
    filePath,
    JSON.stringify({ defaultConfigId: 'broken-config' }),
    'utf8'
  );
  return { directory, filePath };
};

describe('health check readiness fallbacks integration', () => {
  const cleanupTasks = [];

  const registerCleanup = (task) => {
    cleanupTasks.push(task);
  };

  afterEach(async () => {
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      await task();
    }
  });

  beforeEach(() => {
    jest.setTimeout(20000);
  });

  it('uses default metadata while surfacing dependency failures and fallback metrics', async () => {
    const malformedConfig = createMalformedConfig();
    const logger = createConsoleLogger();

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'test',
      LLM_CONFIG_PATH: malformedConfig.filePath,
      CACHE_ENABLED: 'true',
      HTTP_AGENT_ENABLED: 'true',
      npm_package_version: '',
    };

    resetAppConfigServiceInstance();

    const appConfigService = getAppConfigService(logger);
    const llmConfigService = new LlmConfigService(
      new NodeFileSystemReader(),
      logger,
      appConfigService
    );
    await llmConfigService.initialize();

    const cacheConfig = appConfigService.getCacheConfig();
    const cacheService = new CacheService(logger, {
      maxSize: cacheConfig.maxSize,
      defaultTtl: cacheConfig.defaultTtl,
      enableAutoCleanup: false,
    });

    const originalCacheGetMemoryInfo = cacheService.getMemoryInfo;
    cacheService.getMemoryInfo = undefined;

    const httpAgentConfig = appConfigService.getHttpAgentConfig();
    const httpAgentService = new HttpAgentService(logger, {
      ...httpAgentConfig,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 100,
    });

    const originalProcessMemoryUsage = process.memoryUsage;
    const originalProcessCpuUsage = process.cpuUsage;
    const originalProcessUptime = process.uptime;

    process.memoryUsage = () => ({
      rss: 64 * 1024 * 1024,
      heapTotal: 32 * 1024 * 1024,
      heapUsed: 16 * 1024 * 1024,
      external: 4 * 1024 * 1024,
      arrayBuffers: 0,
    });
    process.cpuUsage = () => ({ user: 100, system: 50 });
    process.uptime = () => 10;

    v8.getHeapStatistics = undefined;

    registerCleanup(async () => {
      cacheService.getMemoryInfo = originalCacheGetMemoryInfo;
      cacheService.cleanup();
      httpAgentService.cleanup();
      process.memoryUsage = originalProcessMemoryUsage;
      process.cpuUsage = originalProcessCpuUsage;
      process.uptime = originalProcessUptime;
      v8.getHeapStatistics = ORIGINAL_HEAP_STATS;
      resetAppConfigServiceInstance();
      process.env = { ...ORIGINAL_ENV };
      rmSync(malformedConfig.directory, { recursive: true, force: true });
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

    const agent = request(app);

    const livenessResponse = await agent.get('/health');
    expect(livenessResponse.status).toBe(200);
    expect(livenessResponse.body.version).toBe('1.0.0');

    const readinessResponse = await agent.get('/health/ready');
    expect(readinessResponse.status).toBe(503);
    expect(readinessResponse.body.status).toBe('DOWN');
    expect(readinessResponse.body.version).toBe('1.0.0');

    const dependencyNames = readinessResponse.body.details.dependencies.map(
      (dep) => dep.name
    );
    expect(dependencyNames).toEqual(
      expect.arrayContaining([
        'llmConfigService',
        'cacheService',
        'httpAgentService',
        'nodeProcess',
      ])
    );

    const llmCheck = readinessResponse.body.details.dependencies.find(
      (dep) => dep.name === 'llmConfigService'
    );
    expect(llmCheck.status).toBe('DOWN');
    expect(llmCheck.details.operational).toBe(false);
    expect(llmCheck.details.error).toContain('ProxyLlmConfigLoader');
    expect(llmCheck.details.stage).toBe(
      'validation_malformed_or_missing_configs_map'
    );

    const cacheCheck = readinessResponse.body.details.dependencies.find(
      (dep) => dep.name === 'cacheService'
    );
    expect(cacheCheck.details.memoryUsage).toBeNull();

    const processCheck = readinessResponse.body.details.dependencies.find(
      (dep) => dep.name === 'nodeProcess'
    );
    expect(processCheck.details.memoryUsage.limits).toBeNull();
  });
});
