import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import MetricsService from '../../src/services/metricsService.js';

function createLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('MetricsService statistics integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies metrics retrieved from the Prometheus registry without mocks of service internals', () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const registry = service.getRegistry();

    jest
      .spyOn(registry, 'getMetricsAsJSON')
      .mockReturnValue([
        { name: 'llm_proxy_http_requests_total' },
        { name: 'node_process_seconds_total' },
        { name: 'llm_proxy_cache_operations_total' },
      ]);

    const stats = service.getStats();

    expect(stats.enabled).toBe(true);
    expect(stats.totalMetrics).toBe(3);
    expect(stats.customMetrics).toBe(2);
    expect(stats.defaultMetrics).toBe(1);

    service.clear();
  });

  it('falls back to empty collections when registry returns a non-array payload', () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const registry = service.getRegistry();
    jest.spyOn(registry, 'getMetricsAsJSON').mockReturnValue({ invalid: true });

    const stats = service.getStats();

    expect(stats).toEqual({
      enabled: true,
      totalMetrics: 0,
      customMetrics: 0,
      defaultMetrics: 0,
    });

    service.clear();
  });
});
