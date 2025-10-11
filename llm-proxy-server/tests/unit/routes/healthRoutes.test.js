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

jest.mock('../../../src/config/appConfig.js', () => ({
  getAppConfigService: jest.fn(),
}));

import healthRoutes from '../../../src/routes/healthRoutes.js';
import { getAppConfigService } from '../../../src/config/appConfig.js';

describe('Health Routes', () => {
  let app;
  let uptimeSpy;
  let memoryUsageSpy;
  let loadAverageSpy;

  const buildApp = () => {
    const server = express();
    server.use('/health', healthRoutes);
    return server;
  };

  beforeEach(() => {
    app = buildApp();
    uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(123.456);
    memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 101,
      heapUsed: 202,
      heapTotal: 303,
      external: 404,
    });
    loadAverageSpy = jest.spyOn(os, 'loadavg').mockReturnValue([0.1, 0.2, 0.3]);
    getAppConfigService.mockReset();
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
      status: 'ok',
      service: 'llm-proxy-server',
    });
    expect(response.body.uptime).toBe(123.456);
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('should expose liveness status', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'alive',
      service: 'llm-proxy-server',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body).toHaveProperty('pid', process.pid);
  });

  it('should report detailed diagnostics', async () => {
    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
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
  });

  it('should indicate readiness when dependencies are healthy', async () => {
    getAppConfigService.mockReturnValue({
      getProxyPort: jest.fn().mockReturnValue(8080),
      getProxyAllowedOrigin: jest.fn().mockReturnValue(['*']),
      isDebugLoggingEnabled: jest.fn().mockReturnValue(true),
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ready',
      service: 'llm-proxy-server',
      checks: {
        server: 'ok',
        config: 'ok',
        debug_logging: 'ok',
      },
    });
  });

  it('should detect degraded configuration and return 503', async () => {
    getAppConfigService.mockReturnValue({
      getProxyPort: jest.fn().mockReturnValue(undefined),
      getProxyAllowedOrigin: jest.fn().mockReturnValue(null),
      isDebugLoggingEnabled: jest.fn().mockReturnValue(false),
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not_ready',
      checks: expect.objectContaining({ config: 'degraded', debug_logging: 'disabled' }),
    });
  });

  it('should handle unexpected errors during readiness checks', async () => {
    getAppConfigService.mockImplementation(() => {
      throw new Error('boot failure');
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not_ready',
      error: 'Health check failed',
      checks: { server: 'error' },
    });
  });
});
