/**
 * @file server-graceful-shutdown-degraded.integration.test.js
 * @description Exercises server.js graceful shutdown fallbacks when optional
 *              cleanup hooks are missing and validates the global error handler's
 *              default status code behavior when downstream errors omit a status.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { startProxyServer } from './helpers/serverTestHarness.js';

describe('core server degraded cleanup integration coverage', () => {
  let activeContext;

  afterEach(async () => {
    if (activeContext) {
      await activeContext.shutdown();
      await activeContext.cleanup();
      activeContext = undefined;
    }
  });

  it('skips optional cleanup hooks when dependent services do not expose them', async () => {
    activeContext = await startProxyServer({
      envOverrides: { METRICS_ENABLED: 'true' },
      beforeServerImport: async ({ ConsoleLogger, moduleCleanupCallbacks }) => {
        const [{ default: ResponseSalvageService }, { default: HttpAgentService }, { default: MetricsService }] =
          await Promise.all([
            import('../../src/services/responseSalvageService.js'),
            import('../../src/services/httpAgentService.js'),
            import('../../src/services/metricsService.js'),
          ]);

        const originalSalvageCleanup = ResponseSalvageService.prototype.cleanup;
        const originalHttpCleanup = HttpAgentService.prototype.cleanup;
        const originalMetricsClear = MetricsService.prototype.clear;

        delete ResponseSalvageService.prototype.cleanup;
        delete HttpAgentService.prototype.cleanup;
        delete MetricsService.prototype.clear;

        moduleCleanupCallbacks.push(() => {
          ResponseSalvageService.prototype.cleanup = originalSalvageCleanup;
          HttpAgentService.prototype.cleanup = originalHttpCleanup;
          MetricsService.prototype.clear = originalMetricsClear;
        });

        const infoSpy = jest.spyOn(ConsoleLogger.prototype, 'info');
        moduleCleanupCallbacks.push(() => infoSpy.mockRestore());

        return { infoSpy };
      },
    });

    await activeContext.shutdown('SIGTERM');

    const infoMessages = activeContext.infoSpy.mock.calls
      .map(([message]) => (typeof message === 'string' ? message : ''))
      .filter(Boolean);

    expect(infoMessages.some((msg) => msg.includes('Graceful shutdown complete'))).toBe(true);
    expect(infoMessages.some((msg) => msg.includes('Response salvage service cleaned up'))).toBe(false);
    expect(infoMessages.some((msg) => msg.includes('HTTP agent service cleaned up'))).toBe(false);
    expect(infoMessages.some((msg) => msg.includes('Metrics service cleaned up'))).toBe(false);
  });

  it('falls back to a 500 status when unhandled errors omit explicit status codes', async () => {
    activeContext = await startProxyServer({
      beforeServerImport: async ({ moduleCleanupCallbacks }) => {
        const { LlmRequestController } = await import('../../src/handlers/llmRequestController.js');
        const originalHandler = LlmRequestController.prototype.handleLlmRequest;
        moduleCleanupCallbacks.push(() => {
          LlmRequestController.prototype.handleLlmRequest = originalHandler;
        });
        LlmRequestController.prototype.handleLlmRequest = async function () {
          throw new Error('synthetic integration failure without status');
        };
      },
    });

    const response = await fetch(`http://127.0.0.1:${activeContext.port}/api/llm-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llmId: 'integration-model',
        targetPayload: { prompt: 'hello-world' },
      }),
    });

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: true,
      stage: 'internal_proxy_unhandled_error',
      originalStatusCode: 500,
    });
  });
});
