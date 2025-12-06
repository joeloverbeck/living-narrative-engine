import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import MetricsService from '../../src/services/metricsService.js';
import { createMetricsMiddleware } from '../../src/middleware/metrics.js';

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('MetricsService registry failure integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces registry export failures while keeping middleware operational', async () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = 'metrics-registry-errors';
      next();
    });
    app.use(
      createMetricsMiddleware({
        metricsService: service,
        logger,
        enabled: service.isEnabled(),
      })
    );

    app.get('/metrics-export', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/metrics-export');
    expect(response.status).toBe(200);

    await new Promise((resolve) => setImmediate(resolve));

    const registry = service.getRegistry();

    const metricsSpy = jest
      .spyOn(registry, 'metrics')
      .mockImplementation(async () => {
        throw new Error('registry-metrics-broken');
      });

    await expect(service.getMetrics()).rejects.toThrow(
      'registry-metrics-broken'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics',
      expect.any(Error)
    );

    metricsSpy.mockRestore();

    const statsSpy = jest
      .spyOn(registry, 'getMetricsAsJSON')
      .mockImplementation(() => {
        throw new Error('json-export-broken');
      });

    const stats = service.getStats();
    expect(stats).toEqual({ enabled: true, error: 'json-export-broken' });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics stats',
      expect.any(Error)
    );

    statsSpy.mockRestore();

    service.clear();
  });
});
