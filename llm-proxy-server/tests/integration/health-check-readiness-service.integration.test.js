/**
 * @file Integration tests for advanced health check middleware behavior
 * @description Exercises health check middleware with real service implementations to validate
 * operational, degraded, and failure scenarios without relying on mocks.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';

import {
  createReadinessCheck,
  createLivenessCheck,
} from '../../src/middleware/healthCheck.js';
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
 * Creates a temporary llm-configs.json file for a test run.
 * @param {object} config - The configuration object to persist.
 * @returns {{ filePath: string, cleanup: () => void }} File path and cleanup function.
 */
function createTemporaryLlmConfig(config) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'llm-config-'));
  const filePath = path.join(tempDir, 'llm-configs.json');
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

  return {
    filePath,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

/**
 * Manages process.env mutations so tests can safely restore previous state.
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
 * Builds an Express app wired with the health check middleware and real services.
 * @param {object} options - Setup options for the test app.
 * @param {object} options.llmConfig - LLM configuration content to write. If omitted, initialization will fail.
 * @param {boolean} [options.includeCache=true] - Whether to include CacheService dependency.
 * @param {boolean} [options.includeHttpAgent=true] - Whether to include HttpAgentService dependency.
 * @param {EnvManager} envManager - Environment manager for the current test.
 * @returns {Promise<{ app: import('express').Express, services: object, cleanup: () => Promise<void> }>}
 */
async function buildHealthCheckApp(
  { llmConfig, includeCache = true, includeHttpAgent = true },
  envManager
) {
  const logger = new ConsoleLogger();
  const cleanupTasks = [];

  resetAppConfigServiceInstance();

  if (llmConfig) {
    const { filePath, cleanup } = createTemporaryLlmConfig(llmConfig);
    envManager.set('LLM_CONFIG_PATH', filePath);
    cleanupTasks.push(cleanup);
  } else {
    envManager.set(
      'LLM_CONFIG_PATH',
      path.join(os.tmpdir(), 'non-existent-config.json')
    );
  }

  // Keep environment deterministic for cache behaviour
  envManager.set('CACHE_ENABLED', 'true');
  envManager.set('CACHE_DEFAULT_TTL', '5000');
  envManager.set('CACHE_MAX_SIZE', '64');
  envManager.set('METRICS_ENABLED', 'false');

  const appConfigService = getAppConfigService(logger);
  const fileSystemReader = new NodeFileSystemReader();
  const llmConfigService = new LlmConfigService(
    fileSystemReader,
    logger,
    appConfigService
  );
  await llmConfigService.initialize();

  const services = {
    logger,
    llmConfigService,
  };

  if (includeCache) {
    const cacheService = new CacheService(logger, {
      enableAutoCleanup: false,
      maxSize: 64,
      defaultTtl: 5000,
    });
    services.cacheService = cacheService;
    cleanupTasks.push(() => cacheService.cleanup());
  }

  if (includeHttpAgent) {
    const httpAgentService = new HttpAgentService(logger, {
      keepAlive: false,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 600000,
    });
    services.httpAgentService = httpAgentService;
    cleanupTasks.push(() => httpAgentService.cleanup());
  }

  const app = express();
  app.get('/health/live', createLivenessCheck({ logger }));
  app.get('/health/ready', createReadinessCheck(services));

  const cleanup = async () => {
    for (const task of cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          'Cleanup task failed during health check integration tests:',
          error
        );
      }
    }
    resetAppConfigServiceInstance();
  };

  return { app, services, cleanup };
}

describe('Health check middleware integration coverage', () => {
  let envManager;
  let activeCleanup = null;

  beforeEach(() => {
    envManager = new EnvManager();
    activeCleanup = null;
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

  it('returns full operational status when core services are healthy', async () => {
    const config = {
      defaultConfigId: 'test-llm',
      configs: {
        'test-llm': {
          configId: 'test-llm',
          displayName: 'Test LLM',
          modelIdentifier: 'test-model',
          endpointUrl: 'https://example.com/v1',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
    };

    const { app, cleanup } = await buildHealthCheckApp(
      { llmConfig: config },
      envManager
    );
    activeCleanup = cleanup;

    try {
      const readinessResponse = await request(app).get('/health/ready');

      expect(readinessResponse.status).toBe(200);
      expect(readinessResponse.body.status).toBe('UP');
      expect(readinessResponse.body.details.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'llmConfigService', status: 'UP' }),
          expect.objectContaining({ name: 'cacheService', status: 'UP' }),
          expect.objectContaining({ name: 'httpAgentService', status: 'UP' }),
          expect.objectContaining({ name: 'nodeProcess', status: 'UP' }),
        ])
      );

      const livenessResponse = await request(app).get('/health/live');
      expect(livenessResponse.status).toBe(200);
      expect(livenessResponse.body.status).toBe('UP');
    } finally {
      await cleanup();
      activeCleanup = null;
    }
  });

  it('reports DOWN status when LLM configuration service fails to initialize', async () => {
    const { app, cleanup } = await buildHealthCheckApp(
      { llmConfig: null, includeCache: false, includeHttpAgent: false },
      envManager
    );
    activeCleanup = cleanup;

    try {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.details.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'llmConfigService',
            status: 'DOWN',
            details: expect.objectContaining({ operational: false }),
          }),
        ])
      );
    } finally {
      await cleanup();
      activeCleanup = null;
    }
  });

  it('captures degraded dependencies to surface OUT_OF_SERVICE readiness state', async () => {
    const config = {
      defaultConfigId: 'test-llm',
      configs: {
        'test-llm': {
          configId: 'test-llm',
          displayName: 'Test LLM',
          modelIdentifier: 'test-model',
          endpointUrl: 'https://example.com/v1',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
    };

    const { app, services, cleanup } = await buildHealthCheckApp(
      { llmConfig: config },
      envManager
    );
    activeCleanup = cleanup;

    const originalInvalidate = services.cacheService.invalidate;
    services.cacheService.invalidate = () => {
      throw new Error('forced cache invalidation failure');
    };

    const originalGetAgent = services.httpAgentService.getAgent;
    services.httpAgentService.getAgent = undefined;

    try {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('OUT_OF_SERVICE');
      expect(response.body.details.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'cacheService', status: 'DOWN' }),
          expect.objectContaining({ name: 'httpAgentService', status: 'DOWN' }),
        ])
      );
    } finally {
      services.cacheService.invalidate = originalInvalidate;
      services.httpAgentService.getAgent = originalGetAgent;
      await cleanup();
      activeCleanup = null;
    }
  });

  it('falls back gracefully when liveness checks encounter runtime failures', async () => {
    const config = {
      defaultConfigId: 'test-llm',
      configs: {
        'test-llm': {
          configId: 'test-llm',
          displayName: 'Test LLM',
          modelIdentifier: 'test-model',
          endpointUrl: 'https://example.com/v1',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
    };

    const { app, cleanup } = await buildHealthCheckApp(
      { llmConfig: config },
      envManager
    );
    activeCleanup = cleanup;

    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = () => {
      throw new Error('memory probe failed');
    };

    try {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.error).toEqual(
        expect.objectContaining({ message: 'Health check failed' })
      );
    } finally {
      process.memoryUsage = originalMemoryUsage;
      await cleanup();
      activeCleanup = null;
    }
  });
});
