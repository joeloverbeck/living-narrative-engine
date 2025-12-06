/**
 * @file metricsService.registryManagement.test.js
 * @description Covers MetricsService registry management helpers and error handling branches.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import * as promClient from 'prom-client';
import MetricsService from '../../../src/services/metricsService.js';

const createLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
});

describe('MetricsService registry management', () => {
  beforeEach(() => {
    promClient.register.clear();
    jest
      .spyOn(promClient, 'collectDefaultMetrics')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resets metrics when enabled and logs success', () => {
    const logger = createLogger();
    const resetSpy = jest
      .spyOn(promClient.register, 'resetMetrics')
      .mockImplementation(() => {});

    const service = new MetricsService({ logger, enabled: true });

    logger.debug.mockClear();

    service.reset();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Metrics reset successfully');
  });

  it('logs errors thrown during reset without rethrowing', () => {
    const logger = createLogger();
    const resetError = new Error('reset failure');
    jest.spyOn(promClient.register, 'resetMetrics').mockImplementation(() => {
      throw resetError;
    });

    const service = new MetricsService({ logger, enabled: true });

    logger.error.mockClear();

    expect(() => service.reset()).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Error resetting metrics',
      resetError
    );
  });

  it('does not attempt to reset metrics when disabled', () => {
    const logger = createLogger();
    const resetSpy = jest.spyOn(promClient.register, 'resetMetrics');

    const service = new MetricsService({ logger, enabled: false });

    service.reset();

    expect(resetSpy).not.toHaveBeenCalled();
  });

  it('clears metrics and logs success even when disabled', () => {
    const logger = createLogger();
    const clearSpy = jest.spyOn(promClient.register, 'clear');

    const service = new MetricsService({ logger, enabled: false });

    logger.debug.mockClear();

    service.clear();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Metrics cleared successfully');
  });

  it('logs errors thrown during clear without rethrowing', () => {
    const logger = createLogger();
    const clearError = new Error('clear failure');
    const clearSpy = jest
      .spyOn(promClient.register, 'clear')
      .mockImplementation(() => {
        throw clearError;
      });

    const service = new MetricsService({ logger, enabled: false });

    logger.error.mockClear();

    expect(() => service.clear()).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing metrics',
      clearError
    );
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('returns Prometheus output from getMetrics when enabled', async () => {
    const logger = createLogger();
    const metricsSpy = jest
      .spyOn(promClient.register, 'metrics')
      .mockResolvedValue('# HELP metric description');

    const service = new MetricsService({ logger, enabled: true });

    const result = await service.getMetrics();

    expect(result).toBe('# HELP metric description');
    expect(metricsSpy).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from getMetrics after logging them', async () => {
    const logger = createLogger();
    const metricsError = new Error('metrics failure');
    jest.spyOn(promClient.register, 'metrics').mockRejectedValue(metricsError);

    const service = new MetricsService({ logger, enabled: true });

    await expect(service.getMetrics()).rejects.toBe(metricsError);
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics',
      metricsError
    );
  });

  it('skips metrics retrieval when disabled', async () => {
    const logger = createLogger();
    const metricsSpy = jest.spyOn(promClient.register, 'metrics');

    const service = new MetricsService({ logger, enabled: false });

    await expect(service.getMetrics()).resolves.toBe(
      '# Metrics collection is disabled\n'
    );
    expect(metricsSpy).not.toHaveBeenCalled();
  });

  it('handles non-array results from getStats defensively', () => {
    const logger = createLogger();
    jest
      .spyOn(promClient.register, 'getMetricsAsJSON')
      .mockReturnValue({ invalid: true });

    const service = new MetricsService({ logger, enabled: true });

    const stats = service.getStats();

    expect(stats).toEqual({
      enabled: true,
      totalMetrics: 0,
      customMetrics: 0,
      defaultMetrics: 0,
    });
  });

  it('returns an error payload when getStats fails', () => {
    const logger = createLogger();
    const statsError = new Error('stats failure');
    jest
      .spyOn(promClient.register, 'getMetricsAsJSON')
      .mockImplementation(() => {
        throw statsError;
      });

    const service = new MetricsService({ logger, enabled: true });

    const stats = service.getStats();

    expect(stats).toEqual({ enabled: true, error: 'stats failure' });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics stats',
      statsError
    );
  });
});
