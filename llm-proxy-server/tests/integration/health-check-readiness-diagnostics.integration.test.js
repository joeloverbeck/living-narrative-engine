/**
 * @file health-check-readiness-diagnostics.integration.test.js
 * @description Integration tests that exercise the readiness health check middleware with
 *              real service implementations, focusing on dependency telemetry and
 *              degradation scenarios that were previously under-covered.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';

import { createReadinessCheck } from '../../src/middleware/healthCheck.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';

/**
 * Creates a temporary llm-configs.json file for the provided configuration.
 * @param {object} config - The JSON object to persist to disk.
 * @returns {{ filePath: string, cleanup: () => void }} Metadata for cleanup.
 */
function createTemporaryLlmConfig(config) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'health-readiness-config-'));
  const filePath = path.join(tempDir, 'llm-configs.json');
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

  return {
    filePath,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

/**
 * Tracks environment variable mutations so they can be restored after each test.
 */
class EnvManager {
  #originalValues = new Map();

  set(key, value) {
    if (!this.#originalValues.has(key)) {
      this.#originalValues.set(key, process.env[key]);
    }

    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  restore() {
    for (const [key, original] of this.#originalValues.entries()) {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    this.#originalValues.clear();
  }
}

/**
 * Bootstraps an Express app with the readiness middleware wired to real services.
 * @param {object} options
 * @param {object} options.llmConfig - Configuration that should be written to disk.
 * @param {EnvManager} envManager - Utility to manage process.env mutations.
 * @returns {Promise<{ app: import('express').Express, services: object, cleanup: () => Promise<void> }>}
 */
async function buildReadinessApp({ llmConfig }, envManager) {
  const logger = new ConsoleLogger();
  const cleanupTasks = [];

  resetAppConfigServiceInstance();

  if (llmConfig) {
    const { filePath, cleanup } = createTemporaryLlmConfig(llmConfig);
    envManager.set('LLM_CONFIG_PATH', filePath);
    cleanupTasks.push(cleanup);
  } else {
    envManager.set('LLM_CONFIG_PATH', path.join(os.tmpdir(), 'missing-config.json'));
  }

  envManager.set('CACHE_ENABLED', 'true');
  envManager.set('CACHE_DEFAULT_TTL', '2000');
  envManager.set('CACHE_MAX_SIZE', '32');
  envManager.set('METRICS_ENABLED', 'false');

  const appConfigService = getAppConfigService(logger);
  const fileSystemReader = new NodeFileSystemReader();
  const llmConfigService = new LlmConfigService(
    fileSystemReader,
    logger,
    appConfigService
  );
  await llmConfigService.initialize();

  const cacheService = new CacheService(logger, {
    enableAutoCleanup: false,
    maxSize: 32,
    defaultTtl: 2000,
  });
  cleanupTasks.push(() => cacheService.cleanup());

  const httpAgentService = new HttpAgentService(logger, {
    keepAlive: false,
    adaptiveCleanupEnabled: false,
    baseCleanupIntervalMs: 600000,
  });
  cleanupTasks.push(() => httpAgentService.cleanup());

  const app = express();
  app.get(
    '/health/ready',
    createReadinessCheck({
      logger,
      llmConfigService,
      cacheService,
      httpAgentService,
    })
  );

  const cleanup = async () => {
    for (const task of cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Cleanup task failed in readiness diagnostics tests:', error);
      }
    }
    resetAppConfigServiceInstance();
  };

  return {
    app,
    services: { logger, llmConfigService, cacheService, httpAgentService },
    cleanup,
  };
}

describe('Readiness health check diagnostics integration', () => {
  let envManager;
  let activeCleanup = null;

  beforeEach(() => {
    envManager = new EnvManager();
  });

  afterEach(async () => {
    if (activeCleanup) {
      await activeCleanup();
      activeCleanup = null;
    }
    if (envManager) {
      envManager.restore();
      envManager = null;
    }
  });

  it('reports extended dependency telemetry when optional services expose metrics', async () => {
    const config = {
      defaultConfigId: 'diagnostic-llm',
      configs: {
        'diagnostic-llm': {
          configId: 'diagnostic-llm',
          displayName: 'Diagnostic LLM',
          modelIdentifier: 'diag-model',
          endpointUrl: 'https://example.com/v1',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
    };

    const { app, services, cleanup } = await buildReadinessApp(
      { llmConfig: config },
      envManager
    );
    activeCleanup = cleanup;

    // Exercise agent usage so statistics have meaningful values.
    services.httpAgentService.getAgent('https://example.com/v1');

    const originalGetStats = services.httpAgentService.getStats;
    services.httpAgentService.getStats = () => ({
      activeAgents: 1,
      totalRequests: 5,
      memoryUsage: { rss: 10 },
    });

    const originalGetMemoryInfo = services.cacheService.getMemoryInfo;
    services.cacheService.getMemoryInfo = () => ({ heapUsed: 64, entries: 1 });

    try {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');

      const dependencies = response.body.details.dependencies;
      const cacheDependency = dependencies.find(
        (dep) => dep.name === 'cacheService'
      );
      const httpAgentDependency = dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );

      expect(cacheDependency).toBeDefined();
      expect(cacheDependency.status).toBe('UP');
      expect(cacheDependency.details.memoryUsage).toEqual({
        heapUsed: 64,
        entries: 1,
      });

      expect(httpAgentDependency).toBeDefined();
      expect(httpAgentDependency.status).toBe('UP');
      expect(httpAgentDependency.details).toEqual(
        expect.objectContaining({
          working: true,
          agentCount: 1,
          totalRequests: expect.any(Number),
          memoryUsage: { rss: 10 },
        })
      );

      expect(response.body.details.summary).toEqual(
        expect.objectContaining({ total: expect.any(Number), down: 0 })
      );
    } finally {
      if (originalGetStats) {
        services.httpAgentService.getStats = originalGetStats;
      }

      if (originalGetMemoryInfo) {
        services.cacheService.getMemoryInfo = originalGetMemoryInfo;
      } else {
        delete services.cacheService.getMemoryInfo;
      }
    }
  });

  it('escalates readiness to OUT_OF_SERVICE when optional dependencies degrade', async () => {
    const config = {
      defaultConfigId: 'degrade-llm',
      configs: {
        'degrade-llm': {
          configId: 'degrade-llm',
          displayName: 'Degrade LLM',
          modelIdentifier: 'degrade-model',
          endpointUrl: 'https://example.com/v1',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
    };

    const { app, services, cleanup } = await buildReadinessApp(
      { llmConfig: config },
      envManager
    );
    activeCleanup = cleanup;

    const originalInvalidate = services.cacheService.invalidate;
    services.cacheService.invalidate = () => {
      throw new Error('forced cache invalidation error');
    };

    const originalCleanup = services.httpAgentService.cleanup;
    services.httpAgentService.cleanup = undefined;

    try {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('OUT_OF_SERVICE');

      const dependencies = response.body.details.dependencies;
      const cacheDependency = dependencies.find(
        (dep) => dep.name === 'cacheService'
      );
      const httpAgentDependency = dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );
      const llmDependency = dependencies.find(
        (dep) => dep.name === 'llmConfigService'
      );

      expect(llmDependency.status).toBe('UP');
      expect(cacheDependency.status).toBe('DOWN');
      expect(cacheDependency.details.error).toContain(
        'forced cache invalidation error'
      );
      expect(httpAgentDependency.status).toBe('DOWN');
      expect(httpAgentDependency.details.error).toBe(
        'Missing required methods'
      );

      expect(response.body.details.summary.down).toBeGreaterThanOrEqual(1);
    } finally {
      services.cacheService.invalidate = originalInvalidate;
      services.httpAgentService.cleanup = originalCleanup;
    }
  });
});
