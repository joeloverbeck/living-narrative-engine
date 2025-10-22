import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import createHealthRoutes from '../../src/routes/healthRoutes.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { createOperationalLlmConfigService } from '../common/healthRoutesTestUtils.js';

const createLogger = () => ({
  info: () => undefined,
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
});

describe('healthRoutes end-to-end readiness with concrete services', () => {
  it('throws a descriptive error when required dependencies are missing', () => {
    expect(() => createHealthRoutes()).toThrow(
      'createHealthRoutes: llmConfigService is required'
    );
  });

  it('returns an UP readiness status when cache and http agent services are healthy', async () => {
    const logger = createLogger();
    const cacheService = new CacheService(logger, {
      maxSize: 32,
      defaultTtl: 2500,
      enableAutoCleanup: false,
    });
    const httpAgentService = new HttpAgentService(logger, {
      keepAlive: true,
      maxSockets: 4,
      maxFreeSockets: 2,
      timeout: 2000,
      freeSocketTimeout: 1000,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 50,
      minCleanupIntervalMs: 50,
      maxCleanupIntervalMs: 100,
    });

    const app = express();
    app.use(
      '/health',
      createHealthRoutes({
        llmConfigService: createOperationalLlmConfigService(),
        cacheService,
        httpAgentService,
        logger,
      })
    );

    try {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('UP');
      const dependencyStatuses = Object.fromEntries(
        response.body.details.dependencies.map((dependency) => [
          dependency.name,
          dependency.status,
        ])
      );
      expect(dependencyStatuses.llmConfigService).toBe('UP');
      expect(dependencyStatuses.cacheService).toBe('UP');
      expect(dependencyStatuses.httpAgentService).toBe('UP');
    } finally {
      cacheService.cleanup();
      httpAgentService.cleanup();
    }
  });
});
