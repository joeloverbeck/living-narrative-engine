/**
 * @file server-root-endpoint-shutdown.integration.test.js
 * @description Integration coverage for the proxy server root endpoint behaviour
 *              during initialization failures and graceful shutdown flows.
 */

import {
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (checkFn, { timeout = 10000, interval = 100 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await checkFn()) {
        return true;
      }
    } catch (error) {
      void error;
    }
    await sleep(interval);
  }
  return false;
};

const pingEndpoint = async (port, route = '/health') => {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (response.body?.cancel) {
    await response.body.cancel();
  }
  return response.ok || response.status === 503;
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
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-root-'));
  const filePath = path.join(directory, 'llm-configs.json');
  const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { directory, filePath, remove };
};

async function startProxyServer({ configContent, envOverrides = {}, rawConfigContent }) {
  const eventsToTrack = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];
  const computeNewHandlers = captureEventHandlers(eventsToTrack);
  const originalEnv = { ...process.env };
  const configFile = writeConfigFile(rawConfigContent ?? configContent);
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const trackedIntervals = new Set();
  const trackedTimeouts = new Set();
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

  const patchedSetInterval = (...args) => {
    const timer = originalSetInterval(...args);
    try {
      const fn = args[0];
      if (
        typeof fn === 'function' &&
        fn.toString().includes('performAutoCleanup') &&
        typeof timer.unref === 'function'
      ) {
        timer.unref();
      }
    } catch (error) {
      void error;
    }
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
    process.env = {
      ...originalEnv,
      NODE_ENV: envOverrides.NODE_ENV ?? 'test',
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

  try {
    await import('../../src/core/server.js');
  } catch (error) {
    restoreEnv();
    configFile.remove();
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    for (const timer of trackedTimeouts) {
      clearTimeout(timer);
    }
    throw error;
  }

  const ready = await waitForCondition(() => pingEndpoint(port), {
    timeout: 15000,
    interval: 200,
  });

  if (!ready) {
    restoreEnv();
    configFile.remove();
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    for (const timer of trackedTimeouts) {
      clearTimeout(timer);
    }
    throw new Error('Proxy server failed to start within timeout');
  }

  const handlers = computeNewHandlers();

  let active = true;
  const shutdown = async (signal = 'SIGTERM') => {
    if (!active) {
      return;
    }
    active = false;

    const selectedHandlers = handlers[signal]?.length
      ? handlers[signal]
      : handlers.SIGTERM || [];

    for (const handler of selectedHandlers) {
      handler(signal);
    }

    await sleep(200);

    for (const event of eventsToTrack) {
      for (const handler of handlers[event] || []) {
        process.removeListener(event, handler);
      }
    }

    restoreEnv();
    configFile.remove();
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;

    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    trackedIntervals.clear();

    for (const timer of trackedTimeouts) {
      clearTimeout(timer);
    }
    trackedTimeouts.clear();
  };

  return {
    port,
    shutdown,
    configPath: configFile.filePath,
    exitSpy,
  };
}

describe('proxy server root endpoint and shutdown behaviour', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns initialization failure diagnostics on the legacy root endpoint when configs fail to load', async () => {
    const malformedConfig = '{ "configs": {"bad": } }';

    const proxy = await startProxyServer({
      rawConfigContent: malformedConfig,
      envOverrides: {
        NODE_ENV: 'test',
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
      },
    });

    try {
      const response = await fetch(`http://127.0.0.1:${proxy.port}/`);
      expect(response.status).toBe(503);
      const payload = await response.json();

      expect(payload.error).toBe(true);
      expect(payload.stage).toBe('parse_json_syntax_error');
      expect(payload.message).toContain('NOT OPERATIONAL');
      expect(payload.details).toMatchObject({
        stage: 'parse_json_syntax_error',
        details: expect.objectContaining({
          pathAttempted: proxy.configPath,
          originalErrorMessage: expect.any(String),
        }),
      });
    } finally {
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGTERM');
    }
  });

  it('invokes graceful shutdown exit paths when running in production mode', async () => {
    const healthyConfig = {
      defaultConfigId: 'cloud-model',
      configs: {
        'cloud-model': {
          configId: 'cloud-model',
          displayName: 'Cloud Model',
          apiType: 'openai',
          endpointUrl: 'https://example.com/v1',
          apiKeyEnvVar: 'DUMMY_KEY',
          jsonOutputStrategy: { method: 'passthrough' },
          promptElements: [],
          promptAssemblyOrder: [],
          defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
        },
      },
    };

    const proxy = await startProxyServer({
      configContent: healthyConfig,
      envOverrides: {
        NODE_ENV: 'production',
        PROXY_ALLOWED_ORIGIN: 'https://example.com',
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
        DUMMY_KEY: 'value',
      },
    });

    try {
      const healthResponse = await fetch(`http://127.0.0.1:${proxy.port}/health`);
      expect(healthResponse.status).toBe(200);

      await proxy.shutdown('SIGINT');

      const exitCodes = proxy.exitSpy.mock.calls.map(([code]) => code);
      expect(exitCodes).toContain(0);
      expect(exitCodes).toContain(1);
    } finally {
      await proxy.shutdown('SIGTERM');
    }
  });
});
