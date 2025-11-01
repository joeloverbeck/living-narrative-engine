/**
 * @file Unit tests for health check routes
 * @description Validates readiness, liveness, and diagnostic endpoints exposed by the proxy server
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
import os from 'os';

import createHealthRoutes from '../../../src/routes/healthRoutes.js';

describe('Health Routes', () => {
  let app;
  let uptimeSpy;
  let memoryUsageSpy;
  let loadAverageSpy;
  let mockLlmConfigService;
  let mockCacheService;
  let mockHttpAgentService;
  let mockAppConfigService;
  let mockLogger;

  const buildApp = () => {
    const server = express();

    // Invoke factory function with mocked dependencies
    const healthRoutes = createHealthRoutes({
      llmConfigService: mockLlmConfigService,
      cacheService: mockCacheService,
      httpAgentService: mockHttpAgentService,
      appConfigService: mockAppConfigService,
      logger: mockLogger,
    });

    server.use('/health', healthRoutes);
    return server;
  };

  beforeEach(() => {
    // Create mock services before building app
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockLlmConfigService = {
      isOperational: jest.fn().mockReturnValue(true),
      getLlmConfigs: jest.fn().mockReturnValue({
        configs: { 'test-llm': {} },
        defaultConfigId: 'test-llm',
      }),
      getResolvedConfigPath: jest.fn().mockReturnValue('/path/to/config.json'),
      getInitializationErrorDetails: jest.fn(),
    };

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn().mockReturnValue({ timestamp: Date.now() }),
      invalidate: jest.fn(),
      getSize: jest.fn().mockReturnValue(10),
      getMemoryInfo: jest.fn().mockReturnValue({ used: 1024 }),
    };

    mockHttpAgentService = {
      getAgent: jest.fn(),
      cleanup: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        activeAgents: 2,
        totalRequests: 100,
        memoryUsage: 2048,
      }),
    };

    mockAppConfigService = {
      getNodeEnv: jest.fn().mockReturnValue('test'),
      getProxyPort: jest.fn().mockReturnValue(3001),
    };

    app = buildApp();
    uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(123.456);
    memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 101,
      heapUsed: 202,
      heapTotal: 303,
      external: 404,
    });
    loadAverageSpy = jest.spyOn(os, 'loadavg').mockReturnValue([0.1, 0.2, 0.3]);
  });

  afterEach(() => {
    uptimeSpy.mockRestore();
    memoryUsageSpy.mockRestore();
    loadAverageSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should respond with basic health information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      version: expect.any(String),
    });
    expect(response.body.details).toHaveProperty('uptime');
    expect(response.body.details).toHaveProperty('memory');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('should expose liveness status', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      service: 'llm-proxy-server',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body).toHaveProperty('pid', process.pid);
  });

  it('should report detailed diagnostics', async () => {
    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      service: 'llm-proxy-server',
      system: {
        memory: {
          rss: 101,
          heap_used: 202,
          heap_total: 303,
          external: 404,
        },
        load_average: [0.1, 0.2, 0.3],
      },
    });
    expect(response.body.environment).toHaveProperty('node_env');
    expect(response.body.environment.node_env).toBe('test');
  });

  it('should indicate readiness when dependencies are healthy', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      version: expect.any(String),
    });
    expect(response.body.details).toHaveProperty('dependencies');
    expect(response.body.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'llmConfigService',
          status: 'UP',
        }),
        expect.objectContaining({
          name: 'cacheService',
          status: 'UP',
        }),
        expect.objectContaining({
          name: 'httpAgentService',
          status: 'UP',
        }),
        expect.objectContaining({
          name: 'nodeProcess',
          status: 'UP',
        }),
      ])
    );
  });

  it('should detect degraded configuration and return 503', async () => {
    // Mock llmConfigService as not operational
    mockLlmConfigService.isOperational.mockReturnValueOnce(false);
    mockLlmConfigService.getInitializationErrorDetails.mockReturnValueOnce({
      message: 'Configuration error',
      stage: 'initialization',
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');
    expect(response.body.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'llmConfigService',
          status: 'DOWN',
        }),
      ])
    );
  });

  it('should report configuration errors when accessors throw', async () => {
    // Mock llmConfigService to throw error
    mockLlmConfigService.isOperational.mockImplementationOnce(() => {
      throw new Error('Configuration access error');
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');
    expect(response.body.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'llmConfigService',
          status: 'DOWN',
          details: expect.objectContaining({
            error: expect.stringContaining('Configuration access error'),
          }),
        }),
      ])
    );
  });

  it('should handle unexpected errors during readiness checks', async () => {
    // Mock cache service to throw unexpected error
    mockCacheService.set.mockImplementationOnce(() => {
      throw new Error('Unexpected cache failure');
    });

    const response = await request(app).get('/health/ready');

    // Service should still respond, but cache should be DOWN
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('OUT_OF_SERVICE'); // Non-critical degradation
    expect(response.body.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'cacheService',
          status: 'DOWN',
        }),
      ])
    );
  });
});
