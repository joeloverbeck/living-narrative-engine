/**
 * @file server-resilience-fallbacks.integration.test.js
 * @description Focused integration coverage for server.js fallback branches
 *              involving NODE_ENV resolution, initialization failure responses,
 *              and graceful shutdown cleanup routines. These scenarios exercise
 *              portions of the core server startup and teardown logic that were
 *              previously uncovered by integration tests.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { startProxyServer } from './helpers/serverTestHarness.js';

describe('core server resilience integration coverage', () => {
  let activeContext;

  afterEach(async () => {
    if (activeContext) {
      await activeContext.shutdown();
      await activeContext.cleanup();
      activeContext = undefined;
    }
  });

  it('falls back to process.env when getNodeEnv is unavailable and blank values default to production warnings', async () => {
    activeContext = await startProxyServer({
      envOverrides: { NODE_ENV: '   ', METRICS_ENABLED: 'false' },
      mutateAppConfigService: (configService) => {
        // Remove getNodeEnv to force the server to use process.env.NODE_ENV
        configService.getNodeEnv = undefined;
      },
      beforeServerImport: async ({ ConsoleLogger, moduleCleanupCallbacks }) => {
        const warnSpy = jest.spyOn(ConsoleLogger.prototype, 'warn');
        moduleCleanupCallbacks.push(() => warnSpy.mockRestore());
        return { warnSpy };
      },
    });

    const warnCalls = activeContext.warnSpy.mock.calls
      .map(([message]) => (typeof message === 'string' ? message : ''))
      .filter(Boolean);

    const productionWarning = warnCalls.find((message) =>
      message.includes('PROXY_ALLOWED_ORIGIN environment variable not set or empty')
    );
    const developmentWarning = warnCalls.find((message) =>
      message.includes('CORS not configured in development mode')
    );

    expect(productionWarning).toBeDefined();
    expect(developmentWarning).toBeUndefined();
  });

  it('returns initialization failure diagnostics from the legacy root endpoint when configs are malformed', async () => {
    activeContext = await startProxyServer({
      configContent: {
        defaultConfigId: 'broken-model',
        note: 'configs field intentionally omitted to trigger validation error',
      },
      envOverrides: { METRICS_ENABLED: 'false' },
      readinessRoute: '/',
    });

    const response = await fetch(`http://127.0.0.1:${activeContext.port}/`);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      error: true,
      stage: 'validation_malformed_or_missing_configs_map',
    });
    expect(payload.message).toContain('LLM Proxy Server is NOT OPERATIONAL');
  });

  it('cleans up dependent services during graceful shutdown', async () => {
    activeContext = await startProxyServer({
      envOverrides: { METRICS_ENABLED: 'true' },
      beforeServerImport: async ({ moduleCleanupCallbacks }) => {
        const [{ default: ResponseSalvageService }, { default: HttpAgentService }, { default: MetricsService }] =
          await Promise.all([
            import('../../src/services/responseSalvageService.js'),
            import('../../src/services/httpAgentService.js'),
            import('../../src/services/metricsService.js'),
          ]);

        const salvageCleanupSpy = jest.spyOn(ResponseSalvageService.prototype, 'cleanup');
        const httpAgentCleanupSpy = jest.spyOn(HttpAgentService.prototype, 'cleanup');
        const metricsClearSpy = jest.spyOn(MetricsService.prototype, 'clear');

        moduleCleanupCallbacks.push(() => salvageCleanupSpy.mockRestore());
        moduleCleanupCallbacks.push(() => httpAgentCleanupSpy.mockRestore());
        moduleCleanupCallbacks.push(() => metricsClearSpy.mockRestore());

        return { salvageCleanupSpy, httpAgentCleanupSpy, metricsClearSpy };
      },
    });

    await activeContext.shutdown('SIGTERM');

    expect(activeContext.salvageCleanupSpy).toHaveBeenCalled();
    expect(activeContext.httpAgentCleanupSpy).toHaveBeenCalled();
    expect(activeContext.metricsClearSpy).toHaveBeenCalled();
  });
});
