/**
 * @file server-operational-coverage.integration.test.js
 * @description Additional integration scenarios to close coverage gaps in the proxy server module.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const EVENTS_TO_TRACK = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const captureBaselineListeners = (events) => {
  const baselines = new Map();
  for (const event of events) {
    baselines.set(event, new Set(process.listeners(event)));
  }
  return baselines;
};

const diffListeners = (baselines, events) => {
  const handlers = {};
  for (const event of events) {
    const baseline = baselines.get(event) || new Set();
    handlers[event] = process
      .listeners(event)
      .filter((handler) => !baseline.has(handler));
  }
  return handlers;
};

const removeListeners = (handlers) => {
  for (const [event, list] of Object.entries(handlers)) {
    for (const handler of list) {
      process.removeListener(event, handler);
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
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-coverage-'));
  const filePath = path.join(directory, 'llm-configs.json');
  const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  writeFileSync(filePath, payload, 'utf8');
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { directory, filePath, remove };
};

const waitForServerReady = async (port, { timeout = 15000, interval = 150 } = {}) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.body?.cancel) {
        await response.body.cancel();
      }
      if (response.ok || response.status === 503) {
        return true;
      }
    } catch (_error) {
      // Retry until timeout
    }
    await delay(interval);
  }
  throw new Error('Proxy server did not become ready before timeout');
};

async function startProxyServer({
  configContent,
  rawConfigContent,
  envOverrides = {},
  beforeImport,
}) {
  const baselines = captureBaselineListeners(EVENTS_TO_TRACK);
  const originalEnv = { ...process.env };
  const configFile = writeConfigFile(rawConfigContent ?? configContent);

  const port = envOverrides.PROXY_PORT
    ? Number(envOverrides.PROXY_PORT)
    : await getAvailablePort();

  process.env = {
    ...originalEnv,
    NODE_ENV: envOverrides.NODE_ENV ?? 'test',
    ...envOverrides,
    PROXY_PORT: String(port),
    LLM_CONFIG_PATH: configFile.filePath,
  };

  const trackedTimers = new Set();
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;

  global.setTimeout = (fn, delayMs = 0, ...args) => {
    const accelerate =
      typeof fn === 'function' && fn.toString().includes('Forced shutdown after timeout');
    const timerId = originalSetTimeout(fn, accelerate ? 0 : delayMs, ...args);
    trackedTimers.add(timerId);
    return timerId;
  };

  global.setInterval = (...args) => {
    const timerId = originalSetInterval(...args);
    trackedTimers.add(timerId);
    return timerId;
  };

  jest.resetModules();
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

  try {
    if (beforeImport) {
      await beforeImport();
    }
    await import('../../src/core/server.js');
  } catch (error) {
    process.env = { ...originalEnv };
    configFile.remove();
    exitSpy.mockRestore();
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    for (const timerId of trackedTimers) {
      clearTimeout(timerId);
    }
    removeListeners(diffListeners(baselines, EVENTS_TO_TRACK));
    throw error;
  }

  await waitForServerReady(port);

  const handlers = diffListeners(baselines, EVENTS_TO_TRACK);
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;

    removeListeners(handlers);
    process.env = { ...originalEnv };
    configFile.remove();
    exitSpy.mockRestore();

    for (const timerId of trackedTimers) {
      clearTimeout(timerId);
    }
    trackedTimers.clear();
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
  };

  const shutdown = async (signal = 'SIGTERM') => {
    const targetHandlers = handlers[signal]?.length ? handlers[signal] : handlers.SIGTERM || [];
    for (const handler of targetHandlers) {
      handler(signal);
    }
    await delay(150);
  };

  return { port, shutdown, cleanup, exitSpy, handlers };
}

describe('proxy server extended integration coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns detailed initialization failure diagnostics on the root endpoint', async () => {
    const malformedConfig = '{ "configs": {"broken": } }';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
      expect(payload.stage).toBe('parse_json_syntax_error');
      expect(payload.message).toContain('NOT OPERATIONAL');
      expect(payload.details).toMatchObject({
        stage: 'parse_json_syntax_error',
        message: expect.any(String),
      });

      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGTERM');
      await proxy.cleanup();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('logs loaded configuration counts in the startup summary', async () => {
    const healthyConfig = {
      defaultConfigId: 'primary-model',
      configs: {
        'primary-model': {
          configId: 'primary-model',
          displayName: 'Primary Model',
          apiType: 'openai',
          endpointUrl: 'https://example.test/v1',
          apiKeyEnvVar: 'PRIMARY_KEY',
          jsonOutputStrategy: { method: 'passthrough' },
          promptElements: [],
          promptAssemblyOrder: [],
          defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
        },
        'secondary-model': {
          configId: 'secondary-model',
          displayName: 'Secondary Model',
          apiType: 'anthropic',
          endpointUrl: 'https://example.test/anthropic',
          apiKeyEnvVar: 'SECONDARY_KEY',
          jsonOutputStrategy: { method: 'passthrough' },
          promptElements: [],
          promptAssemblyOrder: [],
          defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
        },
      },
    };

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const proxy = await startProxyServer({
      configContent: healthyConfig,
      envOverrides: {
        NODE_ENV: 'test',
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
        PRIMARY_KEY: 'value-1',
        SECONDARY_KEY: 'value-2',
      },
    });

    try {
      await delay(250);
      const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
      const summaryLine = infoMessages.find((message) =>
        message.includes('Successfully loaded 2 LLM configurations')
      );
      expect(summaryLine).toBeDefined();
    } finally {
      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGTERM');
      await proxy.cleanup();
      infoSpy.mockRestore();
    }
  });

  it('preserves upstream error status codes and clears metrics during shutdown', async () => {
    const healthyConfig = {
      defaultConfigId: 'cloud-model',
      configs: {
        'cloud-model': {
          configId: 'cloud-model',
          displayName: 'Cloud Model',
          apiType: 'openai',
          endpointUrl: 'https://example.com/v1',
          apiKeyEnvVar: 'CLOUD_KEY',
          jsonOutputStrategy: { method: 'passthrough' },
          promptElements: [],
          promptAssemblyOrder: [],
          defaultParameters: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 20 },
        },
      },
    };

    let clearSpy;

    const proxy = await startProxyServer({
      configContent: healthyConfig,
      envOverrides: {
        NODE_ENV: 'test',
        METRICS_ENABLED: 'true',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
        CLOUD_KEY: 'value-123',
      },
      beforeImport: async () => {
        const metricsModule = await import('../../src/services/metricsService.js');
        clearSpy = jest.spyOn(metricsModule.default.prototype, 'clear');
      },
    });

    try {
      const response = await fetch(`http://127.0.0.1:${proxy.port}/api/llm-request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"incomplete":',
      });

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.stage).toBe('internal_proxy_unhandled_error');

      process.emit('beforeExit', 0);
      await proxy.shutdown('SIGTERM');
      await delay(50);
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      await proxy.cleanup();
      if (clearSpy) {
        clearSpy.mockRestore();
      }
    }
  });
});
