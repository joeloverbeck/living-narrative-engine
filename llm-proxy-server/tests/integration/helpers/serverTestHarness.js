import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (
  checkFn,
  { timeout = 15000, interval = 200 } = {}
) => {
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
  const directory = mkdtempSync(
    path.join(tmpdir(), 'proxy-server-resilience-')
  );
  const filePath = path.join(directory, 'llm-configs.json');
  const payload =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { filePath, remove };
};

/**
 * Spins up the proxy server with a real configuration file and returns helpers
 * for shutting it down and cleaning up side effects between tests.
 *
 * @param {object} [options] - Startup configuration overrides.
 * @param {object|string} [options.configContent] - JSON payload to write to the LLM config file.
 * @param {object} [options.envOverrides] - Environment variables to apply before starting the server.
 * @param {(configService: any) => void} [options.mutateAppConfigService] - Optional mutator invoked before server import.
 * @param {(context: object) => Promise<object>} [options.beforeServerImport] - Async hook invoked before importing the server.
 * @param {string} [options.readinessRoute] - Route to poll for readiness once the server starts.
 * @returns {Promise<object>} Context object with shutdown/cleanup helpers and extras returned by hooks.
 */
export async function startProxyServer({
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
} = {}) {
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
      typeof fn === 'function' &&
      fn.toString().includes('Forced shutdown after timeout');
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

  const port = envOverrides.PROXY_PORT
    ? Number(envOverrides.PROXY_PORT)
    : await getAvailablePort();

  const applyEnv = () => {
    const nextEnv = {
      ...originalEnv,
      NODE_ENV: envOverrides.NODE_ENV ?? 'test',
      METRICS_ENABLED: envOverrides.METRICS_ENABLED ?? 'false',
      PROXY_ALLOWED_ORIGIN: envOverrides.PROXY_ALLOWED_ORIGIN ?? '',
      ...envOverrides,
      PROXY_PORT: String(port),
      LLM_CONFIG_PATH: configFile.filePath,
    };

    for (const [key, value] of Object.entries(envOverrides)) {
      if (value === undefined) {
        delete nextEnv[key];
      }
    }

    process.env = nextEnv;
  };

  const restoreEnv = () => {
    process.env = { ...originalEnv };
  };

  applyEnv();
  jest.resetModules();

  const moduleCleanupCallbacks = [];

  try {
    const { ConsoleLogger } = await import('../../../src/consoleLogger.js');
    const { getAppConfigService, resetAppConfigServiceInstance } = await import(
      '../../../src/config/appConfig.js'
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

    await import('../../../src/core/server.js');
    const handlers = computeNewHandlers();

    const ready = await waitForCondition(
      () => pingEndpoint(port, readinessRoute),
      {
        timeout: 15000,
        interval: 200,
      }
    );

    if (!ready) {
      throw new Error('Proxy server failed to start within timeout');
    }

    const shutdown = async (signal = 'SIGTERM') => {
      const selectedHandlers = handlers?.[signal]?.length
        ? handlers[signal]
        : handlers?.SIGTERM || [];
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
