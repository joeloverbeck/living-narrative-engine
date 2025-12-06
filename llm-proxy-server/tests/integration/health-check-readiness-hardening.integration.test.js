import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createReadinessCheck } from '../../src/middleware/healthCheck.js';
import CacheService from '../../src/services/cacheService.js';

const createLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

const createOperationalLlmConfigService = () => ({
  isOperational: () => true,
  getLlmConfigs: () => ({
    defaultConfigId: 'integration-llm',
    configs: { 'integration-llm': { name: 'ok' } },
  }),
  getInitializationErrorDetails: () => null,
  getResolvedConfigPath: () => '/tmp/integration-llm-config.json',
});

const createCacheService = () =>
  new CacheService(createLogger(), {
    maxSize: 16,
    defaultTtl: 200,
    enableAutoCleanup: false,
  });

const createHttpAgentService = () => ({
  getAgent: () => ({
    keepAlive: true,
  }),
  cleanup: jest.fn(),
  getStats: () => ({
    activeAgents: 0,
    totalRequests: 0,
    memoryUsage: null,
  }),
});

const buildReadinessApp = ({
  logger = createLogger(),
  llmConfigService = createOperationalLlmConfigService(),
  cacheService = createCacheService(),
  httpAgentService = createHttpAgentService(),
} = {}) => {
  const app = express();
  const cleanupTasks = [];

  const readinessEnvKeys = [
    'READINESS_CRITICAL_HEAP_PERCENT',
    'READINESS_CRITICAL_HEAP_TOTAL_MB',
    'READINESS_CRITICAL_HEAP_USED_MB',
    'READINESS_CRITICAL_HEAP_LIMIT_PERCENT',
  ];
  const originalEnv = readinessEnvKeys.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});

  process.env.READINESS_CRITICAL_HEAP_PERCENT = '90';
  process.env.READINESS_CRITICAL_HEAP_TOTAL_MB = '512';
  process.env.READINESS_CRITICAL_HEAP_USED_MB = '512';
  process.env.READINESS_CRITICAL_HEAP_LIMIT_PERCENT = '90';

  cleanupTasks.push(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  app.get(
    '/health/ready',
    createReadinessCheck({
      logger,
      llmConfigService,
      cacheService,
      httpAgentService,
    })
  );

  if (typeof cacheService?.cleanup === 'function') {
    cleanupTasks.push(() => {
      cacheService.cleanup();
    });
  }
  if (
    httpAgentService &&
    typeof httpAgentService.cleanup === 'function' &&
    httpAgentService.cleanup.mock
  ) {
    cleanupTasks.push(() => {
      httpAgentService.cleanup();
    });
  }

  return {
    app,
    logger,
    llmConfigService,
    cacheService,
    httpAgentService,
    dispose: () => {
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        task();
      }
    },
  };
};

const cleanupStack = [];

const registerCleanup = (fn) => {
  cleanupStack.push(fn);
};

afterEach(() => {
  while (cleanupStack.length > 0) {
    const fn = cleanupStack.pop();
    fn();
  }
});

describe('health check readiness hardening integration', () => {
  it('surfaces operational errors when the LLM config service throws unexpectedly', async () => {
    const failingLlmConfigService = {
      isOperational: () => {
        throw new Error('operational check exploded');
      },
      getLlmConfigs: () => ({
        configs: {},
        defaultConfigId: null,
      }),
      getInitializationErrorDetails: () => ({
        message: 'not used',
        stage: 'initialization',
      }),
      getResolvedConfigPath: () => '/tmp/unreachable.json',
    };

    const { app, cacheService, httpAgentService, dispose } = buildReadinessApp({
      llmConfigService: failingLlmConfigService,
    });
    registerCleanup(dispose);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');

    const llmCheck = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'llmConfigService'
    );

    expect(llmCheck).toBeDefined();
    expect(llmCheck.status).toBe('DOWN');
    expect(llmCheck.details.operational).toBe(false);
    expect(llmCheck.details.error).toBe('operational check exploded');

    // Ensure optional services remained intact
    expect(typeof cacheService.getSize).toBe('function');
    expect(typeof httpAgentService.getAgent).toBe('function');
  });

  it('continues operating when HTTP agent statistics retrieval fails mid-check', async () => {
    const httpAgentService = {
      getAgent: () => ({}),
      cleanup: jest.fn(),
      getStats: () => {
        throw new Error('stats backend unavailable');
      },
    };

    const { app, dispose } = buildReadinessApp({ httpAgentService });
    registerCleanup(dispose);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('OUT_OF_SERVICE');

    const agentCheck = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'httpAgentService'
    );

    expect(agentCheck).toBeDefined();
    expect(agentCheck.status).toBe('DOWN');
    expect(agentCheck.details.error).toBe('stats backend unavailable');
  });

  it('reports process metric collection failures instead of crashing readiness route', async () => {
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = () => {
      throw new Error('memory inspector offline');
    };
    registerCleanup(() => {
      process.memoryUsage = originalMemoryUsage;
    });

    const { app, dispose } = buildReadinessApp();
    registerCleanup(dispose);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');

    const processCheck = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'nodeProcess'
    );

    expect(processCheck).toBeDefined();
    expect(processCheck.status).toBe('DOWN');
    expect(processCheck.details.error).toBe('memory inspector offline');
  });

  it('fails fast with a descriptive error payload when logging throws during readiness summary', async () => {
    const readinessLogger = createLogger();
    readinessLogger.info.mockImplementation(() => {
      throw new Error('log pipeline offline');
    });

    const cacheService = createCacheService();
    const httpAgentService = createHttpAgentService();

    const { app, dispose, logger } = buildReadinessApp({
      logger: readinessLogger,
      cacheService,
      httpAgentService,
    });
    registerCleanup(dispose);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');
    expect(response.body.error).toEqual({
      message: 'Readiness check failed',
      details: 'log pipeline offline',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Health check (readiness) failed with exception',
      expect.any(Error)
    );
  });
});
