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
 * Builds an Express application that mounts the real health routes.
 * @returns {import('express').Express} Configured app instance for integration testing.
 */
function createHealthApp() {
  const app = express();
  app.use('/health', healthRoutes);
  return app;
}

describe('healthRoutes readiness error integration coverage', () => {
  let app;
  let envManager;

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();
    envManager.setEnvironment({
      PROXY_PORT: '4100',
      PROXY_ALLOWED_ORIGIN: 'https://integrations.example',
      DEBUG_LOGGING_ENABLED: 'true',
    });

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

  it('marks configuration checks as errored when service getters throw mid-readiness evaluation', async () => {
    const originalGetAppConfigService = appConfigModule.getAppConfigService;

    jest
      .spyOn(appConfigModule, 'getAppConfigService')
      .mockImplementation((logger) => {
        const service = originalGetAppConfigService(logger);

        jest
          .spyOn(service, 'getProxyAllowedOrigin')
          .mockImplementation(() => {
            throw new Error('allowed origin resolution failure');
          });

        return service;
      });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks).toMatchObject({
      server: 'ok',
      config: 'error',
      debug_logging: 'disabled',
    });
  });
});
