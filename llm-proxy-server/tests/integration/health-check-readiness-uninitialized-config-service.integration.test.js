/**
 * @file health-check-readiness-uninitialized-config-service.integration.test.js
 * @description Ensures the readiness check reports default diagnostics when the
 * LlmConfigService has never completed initialization and exposes no error details.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { createReadinessCheck } from '../../src/middleware/healthCheck.js';

const ORIGINAL_ENV = { ...process.env };

describe('readiness check integration when LlmConfigService is uninitialized', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAppConfigServiceInstance();
  });

  it('reports default downtime diagnostics without initialization error metadata', async () => {
    process.env.NODE_ENV = 'test';
    process.env.METRICS_ENABLED = 'false';
    process.env.CACHE_ENABLED = 'false';
    process.env.HTTP_AGENT_ENABLED = 'false';

    const logger = new ConsoleLogger();
    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);
    const fileSystemReader = new NodeFileSystemReader();
    const llmConfigService = new LlmConfigService(
      fileSystemReader,
      logger,
      appConfig
    );

    const app = express();
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger,
        llmConfigService,
      })
    );

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('DOWN');

    const llmDependency = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'llmConfigService'
    );

    expect(llmDependency).toBeDefined();
    expect(llmDependency.status).toBe('DOWN');
    expect(llmDependency.details).toMatchObject({
      operational: false,
      error: 'Service not operational',
      stage: 'unknown',
    });

    expect(response.body.details.summary.total).toBeGreaterThanOrEqual(2);
    expect(response.body.details.summary.down).toBeGreaterThanOrEqual(1);
  });
});
