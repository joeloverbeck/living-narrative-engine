import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
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

const createTempConfig = (config) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'readiness-config-'));
  const filePath = path.join(directory, 'llm-configs.json');
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
  return { directory, filePath };
};

const startReadinessApp = async ({ envOverrides = {} } = {}) => {
  const logger = createConsoleLogger();
  const tempConfig = createTempConfig({
    defaultConfigId: 'resilience-llm',
    configs: {
      'resilience-llm': {
        configId: 'resilience-llm',
        displayName: 'Resilience Test LLM',
        apiType: 'ollama',
        endpointUrl: 'http://127.0.0.1:65535/unreachable',
        jsonOutputStrategy: { method: 'passthrough' },
        promptElements: [],
        promptAssemblyOrder: [],
        defaultParameters: {},
      },
    },
  });

  const nextEnv = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'test',
    LLM_CONFIG_PATH: tempConfig.filePath,
    CACHE_ENABLED: 'true',
    HTTP_AGENT_ENABLED: 'true',
    PROXY_ALLOWED_ORIGIN: envOverrides.PROXY_ALLOWED_ORIGIN ?? '',
    READINESS_CRITICAL_HEAP_PERCENT:
      envOverrides.READINESS_CRITICAL_HEAP_PERCENT ?? '90',
    READINESS_CRITICAL_HEAP_TOTAL_MB:
      envOverrides.READINESS_CRITICAL_HEAP_TOTAL_MB ?? '512',
    READINESS_CRITICAL_HEAP_USED_MB:
      envOverrides.READINESS_CRITICAL_HEAP_USED_MB ?? '512',
    READINESS_CRITICAL_HEAP_LIMIT_PERCENT:
      envOverrides.READINESS_CRITICAL_HEAP_LIMIT_PERCENT ?? '90',
    ...envOverrides,
  };

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete nextEnv[key];
    }
  }

  process.env = nextEnv;

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

  const httpAgentConfig = appConfigService.getHttpAgentConfig();
  const httpAgentService = new HttpAgentService(logger, {
    ...httpAgentConfig,
    adaptiveCleanupEnabled: false,
    baseCleanupIntervalMs: 250,
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

  return {
    requestAgent: request(app),
    cleanup: () => {
      cacheService.cleanup();
      httpAgentService.cleanup();
      rmSync(tempConfig.directory, { recursive: true, force: true });
      resetAppConfigServiceInstance();
      process.env = { ...ORIGINAL_ENV };
    },
    services: { llmConfigService, cacheService, httpAgentService },
  };
};

describe('health check readiness resilience integration', () => {
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

  it('returns detailed readiness results when all dependencies are healthy', async () => {
    const { requestAgent, cleanup } = await startReadinessApp();
    registerCleanup(cleanup);

    const response = await requestAgent.get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
    expect(response.body.details.summary.total).toBeGreaterThanOrEqual(4);

    const dependencyNames = response.body.details.dependencies.map(
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
  });

  it('marks optional dependencies as OUT_OF_SERVICE when runtime checks fail', async () => {
    const { requestAgent, cleanup, services } = await startReadinessApp({
      envOverrides: {
        READINESS_CRITICAL_HEAP_TOTAL_MB: '2048',
        READINESS_CRITICAL_HEAP_USED_MB: '2048',
        READINESS_CRITICAL_HEAP_PERCENT: '99',
        READINESS_CRITICAL_HEAP_LIMIT_PERCENT: '99',
      },
    });

    const originalGet = services.cacheService.get;
    const originalCleanup = services.httpAgentService.cleanup;

    registerCleanup(async () => {
      services.cacheService.get = originalGet;
      services.httpAgentService.cleanup = originalCleanup;
      await cleanup();
    });

    services.cacheService.get = () => undefined;
    services.httpAgentService.cleanup = undefined;

    const response = await requestAgent.get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('OUT_OF_SERVICE');

    const cacheCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'cacheService'
    );
    const agentCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'httpAgentService'
    );

    expect(cacheCheck.status).toBe('DOWN');
    expect(agentCheck.status).toBe('DOWN');
  });

  it('surfaces a DOWN status when process health indicators cross critical thresholds', async () => {
    const { requestAgent, cleanup } = await startReadinessApp({
      envOverrides: {
        READINESS_CRITICAL_HEAP_TOTAL_MB: '128',
        READINESS_CRITICAL_HEAP_USED_MB: '128',
      },
    });

    const originalMemoryUsage = process.memoryUsage;
    const originalCpuUsage = process.cpuUsage;
    const originalUptime = process.uptime;

    registerCleanup(async () => {
      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
      process.uptime = originalUptime;
      await cleanup();
    });

    process.memoryUsage = () => ({
      rss: 512 * 1024 * 1024,
      heapTotal: 200 * 1024 * 1024,
      heapUsed: 190 * 1024 * 1024,
      external: 8 * 1024 * 1024,
      arrayBuffers: 2 * 1024 * 1024,
    });
    process.cpuUsage = () => ({ user: 1000, system: 500 });
    process.uptime = () => 42;

    const response = await requestAgent.get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');

    const processCheck = response.body.details.dependencies.find(
      (dep) => dep.name === 'nodeProcess'
    );

    expect(processCheck.status).toBe('DOWN');
    expect(processCheck.details.memoryUsage.percentage).toBeGreaterThanOrEqual(
      90
    );
  });
});
