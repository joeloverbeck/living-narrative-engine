/**
 * @file server-operational-modes.integration.test.js
 * @description Focused integration coverage for the core server startup paths
 *              that previously lacked exercised branches. These scenarios
 *              verify CORS warnings, API key file path logging, and resilience
 *              of the metrics endpoint when dependencies fail at runtime.
 */

import {
  afterEach,
  describe,
  expect,
  it,
  jest,
  beforeEach,
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
  return response.ok;
};

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

const clearCacheAutoCleanupTimers = () => {
  const handles = typeof process._getActiveHandles === 'function'
    ? process._getActiveHandles()
    : [];

  for (const handle of handles) {
    if (
      handle &&
      typeof handle === 'object' &&
      typeof handle._onTimeout === 'function' &&
      handle._onTimeout.toString().includes('performAutoCleanup')
    ) {
      clearInterval(handle);
    }
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

const writeConfigFile = (content) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-modes-'));
  const filePath = path.join(directory, 'llm-configs.json');
  const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { filePath, remove, directory };
};

async function startProxyServer({ configContent, envOverrides = {}, rawConfigContent }) {
  const eventsToTrack = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];
  const computeNewHandlers = captureEventHandlers(eventsToTrack);
  const originalEnv = { ...process.env };
  const configFile = writeConfigFile(rawConfigContent ?? configContent);
  const originalSetInterval = global.setInterval;
  const trackedIntervals = new Set();
  jest.spyOn(process, 'exit').mockImplementation(() => {});
  const patchedSetInterval = (...args) => {
    const timer = originalSetInterval(...args);
    try {
      const fn = args[0];
      if (typeof fn === 'function' && fn.toString().includes('performAutoCleanup')) {
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
        trackedIntervals.add(timer);
      }
    } catch (error) {
      void error;
    }
    return timer;
  };
  global.setInterval = patchedSetInterval;
  let intervalPatched = true;

  const port = envOverrides.PROXY_PORT
    ? Number(envOverrides.PROXY_PORT)
    : await getAvailablePort();

  const applyEnv = () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
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
    if (intervalPatched) {
      global.setInterval = originalSetInterval;
      intervalPatched = false;
    }
    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    throw error;
  }

  const ready = await waitForCondition(() => pingEndpoint(port), {
    timeout: 15000,
    interval: 200,
  });

  let handlers = {};
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
    clearCacheAutoCleanupTimers();
    for (const timer of trackedIntervals) {
      clearInterval(timer);
    }
    trackedIntervals.clear();
    if (intervalPatched) {
      global.setInterval = originalSetInterval;
      intervalPatched = false;
    }
  };

  handlers = computeNewHandlers();

  if (!ready) {
    await shutdown('SIGTERM');
    throw new Error('Proxy server failed to start within timeout');
  }

  return { port, shutdown, directory: configFile.directory };
}

const buildFileBackedConfig = (endpointUrl) => ({
  defaultConfigId: 'file-based-llm',
  configs: {
    'file-based-llm': {
      configId: 'file-based-llm',
      displayName: 'File Based Model',
      apiType: 'openai',
      endpointUrl,
      apiKeyFileName: 'integration.key',
      jsonOutputStrategy: { method: 'passthrough' },
      promptElements: [],
      promptAssemblyOrder: [],
      defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
    },
  },
});

describe('core server operational mode coverage', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns when CORS is absent in development and highlights missing API key root paths', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const proxy = await startProxyServer({
      configContent: buildFileBackedConfig('https://example.com/v1'),
      envOverrides: {
        NODE_ENV: 'development',
        PROXY_ALLOWED_ORIGIN: '',
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
      },
    });

    try {
      const warningMessages = warnSpy.mock.calls.map((args) => String(args[0]));
      expect(
        warningMessages.some((message) =>
          message.includes('CORS not configured in development mode')
        )
      ).toBe(true);
      expect(
        warningMessages.some((message) =>
          message.includes(
            'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is NOT SET. File-based API key retrieval WILL FAIL'
          )
        )
      ).toBe(true);
    } finally {
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGTERM');
    }
  });

  it('falls back gracefully when the Prometheus registry throws during metrics export', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const proxy = await startProxyServer({
      configContent: buildFileBackedConfig('https://example.com/v1'),
      envOverrides: {
        NODE_ENV: 'production',
        PROXY_ALLOWED_ORIGIN: 'https://docs.example.com',
        METRICS_ENABLED: 'true',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
      },
    });

    const { register } = await import('prom-client');
    const originalMetrics = register.metrics;
    register.metrics = async () => {
      throw new Error('intentional metrics failure');
    };

    try {
      const response = await fetch(`http://127.0.0.1:${proxy.port}/metrics`);
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).toBe('Error retrieving metrics');
      expect(
        errorSpy.mock.calls.some(([message]) =>
          String(message).includes('Error serving metrics endpoint')
        )
      ).toBe(true);
    } finally {
      register.metrics = originalMetrics;
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGINT');
    }
  });

  it('reports configured API key root paths during startup summaries', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const proxy = await startProxyServer({
      configContent: buildFileBackedConfig('https://example.com/v1'),
      envOverrides: {
        NODE_ENV: 'production',
        PROXY_ALLOWED_ORIGIN: '',
        PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: '/var/proxy/keys',
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
      },
    });

    try {
      const infoMessages = infoSpy.mock.calls.map((args) => String(args[0]));
      expect(
        infoMessages.some((message) =>
          message.includes("API Key file root path set to: '/var/proxy/keys'")
        )
      ).toBe(true);
    } finally {
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGHUP');
    }
  });
});
