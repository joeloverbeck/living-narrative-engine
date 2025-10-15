/**
 * @file Focused unit tests for MetricsService Prometheus instrumentation setup
 * @description Ensures MetricsService interacts with prom-client as expected when toggling default metrics
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Creates prom-client mocks and loads MetricsService with those mocks applied.
 * @returns {Promise<{MetricsService: any, registerMock: any, collectDefaultMetricsMock: jest.Mock, counterCtor: jest.Mock, histogramCtor: jest.Mock, gaugeCtor: jest.Mock}>}
 */
async function loadMetricsServiceWithMocks() {
  const registerMock = {
    clear: jest.fn(),
    resetMetrics: jest.fn(),
    metrics: jest.fn(),
    getMetricsAsJSON: jest.fn().mockReturnValue([]),
  };

  const metricFactory = () => ({
    inc: jest.fn(),
    observe: jest.fn(),
    set: jest.fn(),
  });

  const counterCtor = jest.fn(metricFactory);
  const histogramCtor = jest.fn(metricFactory);
  const gaugeCtor = jest.fn(metricFactory);
  const collectDefaultMetricsMock = jest.fn();

  jest.unstable_mockModule('prom-client', () => ({
    register: registerMock,
    collectDefaultMetrics: collectDefaultMetricsMock,
    Counter: counterCtor,
    Histogram: histogramCtor,
    Gauge: gaugeCtor,
  }));

  const module = await import('../../../src/services/metricsService.js');
  return {
    MetricsService: module.default,
    registerMock,
    collectDefaultMetricsMock,
    counterCtor,
    histogramCtor,
    gaugeCtor,
  };
}

describe('MetricsService Prometheus configuration', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers default prom-client metrics when enabled', async () => {
    const {
      MetricsService,
      registerMock,
      collectDefaultMetricsMock,
      counterCtor,
      histogramCtor,
      gaugeCtor,
    } = await loadMetricsServiceWithMocks();

    new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: true,
      defaultMetricsInterval: 15000,
    });

    expect(registerMock.clear).toHaveBeenCalledTimes(1);
    expect(collectDefaultMetricsMock).toHaveBeenCalledTimes(1);
    expect(collectDefaultMetricsMock).toHaveBeenCalledWith({
      register: registerMock,
      prefix: 'llm_proxy_',
      timeout: 15000,
    });

    expect(counterCtor).toHaveBeenCalled();
    expect(histogramCtor).toHaveBeenCalled();
    expect(gaugeCtor).toHaveBeenCalled();
  });

  it('skips default metrics when disabled but still initialises custom metrics', async () => {
    const {
      MetricsService,
      registerMock,
      collectDefaultMetricsMock,
      counterCtor,
      histogramCtor,
      gaugeCtor,
    } = await loadMetricsServiceWithMocks();

    new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: false,
    });

    expect(registerMock.clear).toHaveBeenCalledTimes(1);
    expect(collectDefaultMetricsMock).not.toHaveBeenCalled();

    expect(counterCtor).toHaveBeenCalled();
    expect(histogramCtor).toHaveBeenCalled();
    expect(gaugeCtor).toHaveBeenCalled();
  });

  it('does not touch prom-client when metrics are disabled', async () => {
    const {
      MetricsService,
      registerMock,
      collectDefaultMetricsMock,
      counterCtor,
      histogramCtor,
      gaugeCtor,
    } = await loadMetricsServiceWithMocks();

    new MetricsService({
      logger,
      enabled: false,
    });

    expect(logger.info).toHaveBeenCalledWith('Metrics collection is disabled');
    expect(registerMock.clear).not.toHaveBeenCalled();
    expect(collectDefaultMetricsMock).not.toHaveBeenCalled();
    expect(counterCtor).not.toHaveBeenCalled();
    expect(histogramCtor).not.toHaveBeenCalled();
    expect(gaugeCtor).not.toHaveBeenCalled();
  });
});
