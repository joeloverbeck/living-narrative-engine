import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createReadinessCheck } from '../../src/middleware/healthCheck.js';
import CacheService from '../../src/services/cacheService.js';

const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('health check readiness integration happy path', () => {
  let logger;
  let cacheService;
  let app;

  beforeEach(() => {
    logger = createTestLogger();
    cacheService = new CacheService(logger, {
      maxSize: 5,
      defaultTtl: 250,
      enableAutoCleanup: false,
    });

    const llmConfigService = {
      isOperational: () => true,
      getLlmConfigs: () => ({
        configs: {
          'openai-test': {
            apiType: 'openai',
            apiKeyEnvVar: 'OPENAI_KEY',
          },
          'anthropic-test': {
            apiType: 'anthropic',
            apiKeyEnvVar: 'ANTHROPIC_KEY',
          },
        },
        defaultConfigId: 'openai-test',
      }),
      getResolvedConfigPath: () => '/configs/llm-configs.json',
      getInitializationErrorDetails: () => null,
    };

    let agentRequests = 0;
    const httpAgentService = {
      getAgent: () => ({ id: 'agent-mock', requests: ++agentRequests }),
      cleanup: jest.fn(),
      getStats: () => ({
        activeAgents: 1,
        totalRequests: agentRequests,
        memoryUsage: { bytes: 2048 },
      }),
    };

    app = express();
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger,
        llmConfigService,
        cacheService,
        httpAgentService,
      })
    );
  });

  afterEach(() => {
    cacheService.cleanup();
    jest.restoreAllMocks();
  });

  test('reports UP status with dependency details when all collaborators succeed', async () => {
    const response = await request(app).get('/health/ready').expect(200);

    expect(response.body.status).toBe('UP');
    expect(response.body.details.summary.total).toBe(4);
    expect(response.body.details.summary.up).toBe(4);
    expect(response.body.details.summary.down).toBe(0);

    const dependencyStatuses = Object.fromEntries(
      response.body.details.dependencies.map((check) => [check.name, check])
    );

    expect(dependencyStatuses.llmConfigService.status).toBe('UP');
    expect(dependencyStatuses.llmConfigService.details).toMatchObject({
      operational: true,
      configuredLlms: 2,
      defaultLlm: 'openai-test',
      configPath: '/configs/llm-configs.json',
    });

    expect(dependencyStatuses.cacheService.status).toBe('UP');
    expect(dependencyStatuses.cacheService.details).toMatchObject({
      working: true,
      size: 0,
    });

    expect(dependencyStatuses.httpAgentService.status).toBe('UP');
    expect(dependencyStatuses.httpAgentService.details).toMatchObject({
      working: true,
      agentCount: 1,
    });

    expect(dependencyStatuses.nodeProcess.status).toBe('UP');

    expect(logger.info).toHaveBeenCalledWith(
      'Health check (readiness) completed',
      expect.objectContaining({
        status: 'UP',
        statusCode: 200,
        dependenciesChecked: 4,
        downDependencies: 0,
      })
    );
  });
});
