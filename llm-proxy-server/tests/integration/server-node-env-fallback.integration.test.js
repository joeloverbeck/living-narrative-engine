/**
 * @file server-node-env-fallback.integration.test.js
 * @description Integration coverage ensuring the proxy server falls back to a production
 *              environment classification when the AppConfigService reports an invalid
 *              NODE_ENV value. This exercises the defensive branch in server.js that was
 *              previously untested.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (checkFn, { timeout = 10000, interval = 100 } = {}) => {
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
    if (response.body?.cancel) {
      await response.body.cancel();
    }
    return response.ok;
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
      server.close((error) => {
        if (error) {
          reject(error);
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
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-node-env-'));
  const filePath = path.join(directory, 'llm-configs.json');
  const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { filePath, remove };
};

async function startProxyServerWithNodeEnv({
  nodeEnvReturnValue,
  configContent = {
    defaultConfigId: 'fallback-model',
    configs: {
      'fallback-model': {
        provider: 'stub',
        model: 'integration',
      },
    },
  },
  envOverrides = {},
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
    try {
      const fn = args[0];
      if (typeof fn === 'function' && fn.toString().includes('performAutoCleanup')) {
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
      }
    } catch (error) {
      void error;
    }
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

  const { getAppConfigService, resetAppConfigServiceInstance } = await import(
    '../../src/config/appConfig.js'
  );
  resetAppConfigServiceInstance();

  const stubLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };

  const configService = getAppConfigService(stubLogger);
  const originalGetNodeEnv = configService.getNodeEnv.bind(configService);
  configService.getNodeEnv = () => nodeEnvReturnValue;

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  let handlers;
  let active = true;

  try {
    await import('../../src/core/server.js');
    handlers = computeNewHandlers();
    const ready = await waitForCondition(() => pingEndpoint(port), {
      timeout: 15000,
      interval: 200,
    });
    if (!ready) {
      throw new Error('Proxy server failed to start within timeout');
    }
  } catch (error) {
    configService.getNodeEnv = originalGetNodeEnv;
    warnSpy.mockRestore();
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
    throw error;
  }

  configService.getNodeEnv = originalGetNodeEnv;

  const shutdown = async (signal = 'SIGTERM') => {
    if (!active) {
      return;
    }
    active = false;
    const selectedHandlers = handlers?.[signal]?.length ? handlers[signal] : handlers?.SIGTERM || [];
    for (const handler of selectedHandlers) {
      handler(signal);
    }
    await sleep(200);
  };

  const cleanup = async () => {
    warnSpy.mockRestore();
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
  };

  return { port, warnSpy, shutdown, cleanup };
}

describe('core server environment resilience integration', () => {
  let serverContext;

  afterEach(async () => {
    if (serverContext) {
      await serverContext.shutdown();
      await serverContext.cleanup();
      serverContext = undefined;
    }
  });

  it('falls back to production mode logging when AppConfigService returns a non-string NODE_ENV', async () => {
    serverContext = await startProxyServerWithNodeEnv({ nodeEnvReturnValue: null });

    const productionWarning = serverContext.warnSpy.mock.calls.find(([message]) =>
      typeof message === 'string'
        ? message.includes('PROXY_ALLOWED_ORIGIN environment variable not set or empty')
        : false
    );

    expect(productionWarning).toBeDefined();

    const developmentWarning = serverContext.warnSpy.mock.calls.find(([message]) =>
      typeof message === 'string'
        ? message.includes('CORS not configured in development mode')
        : false
    );

    expect(developmentWarning).toBeUndefined();
  });
});
