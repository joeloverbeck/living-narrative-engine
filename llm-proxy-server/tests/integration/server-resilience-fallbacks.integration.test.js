/**
 * @file server-resilience-fallbacks.integration.test.js
 * @description Focused integration coverage for server.js fallback branches
 *              involving NODE_ENV resolution, initialization failure responses,
 *              and graceful shutdown cleanup routines. These scenarios exercise
 *              portions of the core server startup and teardown logic that were
 *              previously uncovered by integration tests.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (checkFn, { timeout = 15000, interval = 200 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkFn()) {
      return true;
    }
    await sleep(interval);
  }
  return false;
};

const pingEndpoint = async (port, route = '/health') => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`);
    await response.arrayBuffer();
    return true;
  } catch (error) {
    void error;
    return false;
  }
};

const getAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve(port);
        }
      });
    });
    server.on('error', (error) => {
      server.close();
      reject(error);
    });
  });

const captureEventHandlers = (events) => {
  const baselines = new Map();
  for (const event of events) {
    baselines.set(event, new Set(process.listeners(event)));
  }
  return () => {
    const handlers = {};
    for (const event of events) {
      handlers[event] = process
        .listeners(event)
        .filter((handler) => !baselines.get(event).has(handler));
    }
    return handlers;
  };
};

const writeConfigFile = (content) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-resilience-'));
  const filePath = path.join(directory, 'llm-configs.json');
  const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { filePath, remove };
};

async function startProxyServer({
  configContent = {
    defaultConfigId: 'integration-model',
    configs: {
      'integration-model': {
        provider: 'stub',
        model: 'integration',
      },
    },
  },
  envOverrides = {},
  mutateAppConfigService,
  beforeServerImport,
  readinessRoute = '/health',
}) {
  const eventsToTrack = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];
  const computeNewHandlers = captureEventHandlers(eventsToTrack);
  const originalEnv = { ...process.env };
  const configFile = writeConfigFile(configContent);
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const trackedIntervals = new Set();
  const trackedTimeouts = new Set();
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

  const patchedSetInterval = (...args) => {
    const timer = originalSetInterval(...args);
    trackedIntervals.add(timer);
    return timer;
  };

  const patchedSetTimeout = (fn, delay, ...rest) => {
    const shouldAccelerate =
      typeof fn === 'function' && fn.toString().includes('Forced shutdown after timeout');
    if (shouldAccelerate) {
      const timerId = originalSetTimeout(() => fn(...rest), 0);
      trackedTimeouts.add(timerId);
      return timerId;
    }
    const timerId = originalSetTimeout(fn, delay, ...rest);
    trackedTimeouts.add(timerId);
    return timerId;
  };

  global.setInterval = patchedSetInterval;
  global.setTimeout = patchedSetTimeout;

  const port = envOverrides.PROXY_PORT ? Number(envOverrides.PROXY_PORT) : await getAvailablePort();

  const applyEnv = () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: envOverrides.NODE_ENV ?? 'test',
      METRICS_ENABLED: envOverrides.METRICS_ENABLED ?? 'false',
      ...envOverrides,
      PROXY_PORT: String(port),
      LLM_CONFIG_PATH: configFile.filePath,
    };
  };

  const restoreEnv = () => {
    process.env = { ...originalEnv };
  };

  applyEnv();
  jest.resetModules();

  const moduleCleanupCallbacks = [];

  try {
    const { ConsoleLogger } = await import('../../src/consoleLogger.js');
    const { getAppConfigService, resetAppConfigServiceInstance } = await import(
      '../../src/config/appConfig.js'
    );
    resetAppConfigServiceInstance();
    const configService = getAppConfigService(new ConsoleLogger());

    if (typeof mutateAppConfigService === 'function') {
      mutateAppConfigService(configService);
    }

    let extras = {};
    if (typeof beforeServerImport === 'function') {
      extras =
        (await beforeServerImport({
          ConsoleLogger,
          configService,
          moduleCleanupCallbacks,
        })) || {};
    }

    await import('../../src/core/server.js');
    const handlers = computeNewHandlers();

    const ready = await waitForCondition(() => pingEndpoint(port, readinessRoute), {
      timeout: 15000,
      interval: 200,
    });

    if (!ready) {
      throw new Error('Proxy server failed to start within timeout');
    }

    const shutdown = async (signal = 'SIGTERM') => {
      const selectedHandlers = handlers?.[signal]?.length ? handlers[signal] : handlers?.SIGTERM || [];
      for (const handler of selectedHandlers) {
        handler(signal);
      }
      await sleep(200);
    };

    const cleanup = async () => {
      for (const callback of moduleCleanupCallbacks) {
        try {
          callback();
        } catch (error) {
          void error;
        }
      }
      global.setInterval = originalSetInterval;
      global.setTimeout = originalSetTimeout;
      for (const timer of trackedIntervals) {
        clearInterval(timer);
      }
      for (const timer of trackedTimeouts) {
        clearTimeout(timer);
      }
      exitSpy.mockRestore();
      restoreEnv();
      resetAppConfigServiceInstance();
      configFile.remove();
      jest.resetModules();
    };

    return { port, shutdown, cleanup, exitSpy, ...extras };
  } catch (error) {
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    for (const timer of trackedTimeouts) {
      clearTimeout(timer);
    }
    exitSpy.mockRestore();
    restoreEnv();
    configFile.remove();
    jest.resetModules();
    throw error;
  }
}

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
