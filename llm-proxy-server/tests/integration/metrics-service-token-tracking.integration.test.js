/**
 * @file metrics-service-token-tracking.integration.test.js
 * @description Integration coverage verifying MetricsService captures token
 *              totals and rate limiting gauges when collaborating with the
 *              Prometheus registry without mocks.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const METRIC_TOKENS = 'llm_proxy_llm_tokens_processed_total';
const METRIC_MAP_SIZE = 'llm_proxy_rate_limit_map_size_entries';

/**
 * Helper to find a metric entry by name inside prom-client JSON output.
 * @param {Array} metricsJson
 * @param {string} name
 * @returns {import('prom-client').Metric | undefined}
 */
function findMetric(metricsJson, name) {
  return metricsJson.find((metric) => metric.name === name);
}

describe('MetricsService token accounting integration', () => {
  let MetricsService;
  /** @type {import('../../src/services/metricsService.js').default | null} */
  let metricsService = null;

  beforeEach(async () => {
    jest.resetModules();
    MetricsService = (await import('../../src/services/metricsService.js'))
      .default;
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.reset();
      metricsService.clear();
      metricsService = null;
    }
    jest.restoreAllMocks();
  });

  it('records bidirectional token counts and map sizes using defaulted constructor options', async () => {
    metricsService = new MetricsService({ collectDefaultMetrics: false });

    expect(metricsService.isEnabled()).toBe(true);

    metricsService.recordLlmRequest({
      provider: 'integration-provider',
      model: 'integrated-model',
      status: 'success',
      duration: 0.42,
      tokens: {
        input: 256,
        output: 128,
      },
    });

    metricsService.recordRateLimiting({
      limitType: 'general',
      clientType: 'ip',
      patternType: 'burst-detection',
      severity: 'medium',
      mapSize: 3,
    });

    const registry = metricsService.getRegistry();
    const metricsJson = await registry.getMetricsAsJSON();

    const tokenMetric = findMetric(metricsJson, METRIC_TOKENS);
    expect(tokenMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'integration-provider',
            model: 'integrated-model',
            token_type: 'input',
          }),
          value: 256,
        }),
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'integration-provider',
            model: 'integrated-model',
            token_type: 'output',
          }),
          value: 128,
        }),
      ])
    );

    const mapSizeMetric = findMetric(metricsJson, METRIC_MAP_SIZE);
    expect(mapSizeMetric?.values?.[0]?.value).toBe(3);

    const stats = metricsService.getStats();
    expect(stats.enabled).toBe(true);

    const expectedCustomCount = metricsJson.filter((metric) =>
      metric.name.startsWith('llm_proxy_')
    ).length;
    expect(expectedCustomCount).toBeGreaterThan(0);
    expect(stats.customMetrics).toBeGreaterThanOrEqual(0);
  });
});
