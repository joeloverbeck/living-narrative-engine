import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import healthRoutes from '../../src/routes/healthRoutes.js';
import * as appConfigModule from '../../src/config/appConfig.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

/**
 * Helper to create an express app using the real health routes.
 * @returns {import('express').Express} Express application instance wired with health routes.
 */
function createHealthApp() {
  const app = express();
  app.use('/health', healthRoutes);
  return app;
}

describe('Health routes readiness integration behaviours', () => {
  let app;
  let envManager;

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();
    appConfigModule.resetAppConfigServiceInstance();
    app = createHealthApp();
  });

  afterEach(() => {
    appConfigModule.resetAppConfigServiceInstance();
    if (envManager) {
      envManager.restoreEnvironment();
    }
    jest.restoreAllMocks();
  });

  it('surfaces a degraded readiness state when required configuration is missing', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks).toMatchObject({
      server: 'ok',
      config: 'degraded',
      debug_logging: 'disabled',
    });
  });

  it('reports full readiness when configuration is provided and debug logging is disabled', async () => {
    envManager.setEnvironment({
      PROXY_PORT: '4100',
      PROXY_ALLOWED_ORIGIN: 'https://example.com',
      DEBUG_LOGGING_ENABLED: 'false',
    });
    appConfigModule.resetAppConfigServiceInstance();

    const originalGetAppConfigService = appConfigModule.getAppConfigService;
    jest
      .spyOn(appConfigModule, 'getAppConfigService')
      .mockImplementation((logger) => {
        const service = originalGetAppConfigService(logger);
        jest
          .spyOn(service, 'isDebugLoggingEnabled')
          .mockReturnValue(true);
        return service;
      });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks).toMatchObject({
      server: 'ok',
      config: 'ok',
      debug_logging: 'ok',
    });
  });

  it('falls back to an error response when AppConfigService fails to initialize', async () => {
    const failure = new Error('AppConfig bootstrap failure');
    jest
      .spyOn(appConfigModule, 'getAppConfigService')
      .mockImplementation(() => {
        throw failure;
      });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not_ready',
      error: 'Health check failed',
      service: 'llm-proxy-server',
      checks: { server: 'error' },
    });
  });
});
