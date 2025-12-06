/**
 * @file metricsService.promClientConfig.test.js
 * @description Verifies MetricsService behaviour around prom-client configuration toggles.
 */

import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import * as promClient from 'prom-client';
import MetricsService from '../../../src/services/metricsService.js';

describe('MetricsService Prometheus configuration', () => {
  const createLogger = () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  });

  beforeEach(() => {
    promClient.register.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enables default metrics and custom metrics when configured', () => {
    const logger = createLogger();
    const getMetricsSpy = jest
      .spyOn(promClient.register, 'getMetricsAsJSON')
      .mockReturnValue([
        { name: 'llm_proxy_http_requests_total' },
        { name: 'process_cpu_user_seconds_total' },
      ]);
    jest
      .spyOn(promClient, 'collectDefaultMetrics')
      .mockImplementation(() => {});

    const service = new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: true,
      defaultMetricsInterval: 15000,
    });

    const stats = service.getStats();
    expect(stats.enabled).toBe(true);
    expect(stats.totalMetrics).toBe(2);
    expect(stats.defaultMetrics).toBe(1);
    expect(stats.customMetrics).toBe(1);
    expect(getMetricsSpy).toHaveBeenCalledTimes(1);

    service.clear();
  });

  it('can disable default metrics while keeping custom metrics active', () => {
    const logger = createLogger();
    const getMetricsSpy = jest
      .spyOn(promClient.register, 'getMetricsAsJSON')
      .mockReturnValue([
        { name: 'llm_proxy_http_requests_total' },
        { name: 'llm_proxy_llm_requests_total' },
      ]);
    jest
      .spyOn(promClient, 'collectDefaultMetrics')
      .mockImplementation(() => {});

    const service = new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: false,
    });

    const stats = service.getStats();
    expect(stats.enabled).toBe(true);
    expect(stats.defaultMetrics).toBe(0);
    expect(stats.totalMetrics).toBe(2);
    expect(stats.customMetrics).toBe(2);
    expect(getMetricsSpy).toHaveBeenCalledTimes(1);

    service.clear();
  });

  it('reports metrics as disabled when turned off', async () => {
    const logger = createLogger();
    const service = new MetricsService({ logger, enabled: false });

    expect(service.isEnabled()).toBe(false);
    await expect(service.getMetrics()).resolves.toBe(
      '# Metrics collection is disabled\n'
    );
    expect(service.getStats()).toEqual({ enabled: false });
  });
});
