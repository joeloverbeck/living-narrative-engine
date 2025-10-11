import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (checkFn, { timeout = 10000, interval = 100 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await checkFn()) {
        return;
      }
    } catch (error) {
      void error;
    }
    await sleep(interval);
  }
  throw new Error('Timed out waiting for condition to become true');
};

const pingEndpoint = async (port, route = '/health') => {
  const url = `http://127.0.0.1:${port}${route}`;
  const response = await fetch(url);
  if (response.body?.cancel) {
    await response.body.cancel();
  }
  return response.ok;
};

const registerCleanup = (() => {
  const tasks = [];

  afterEach(async () => {
    while (tasks.length > 0) {
      const cleanup = tasks.pop();
      try {
        await cleanup();
      } catch (error) {
        // Ensure cleanup errors do not break subsequent tests
        // eslint-disable-next-line no-console
        console.error('Cleanup error:', error);
      }
    }
  });

  return (fn) => {
    tasks.push(fn);
  };
})();

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

const writeConfigFile = (content, { raw = false } = {}) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'proxy-server-config-'));
  const filePath = path.join(directory, 'llm-configs.json');
  if (raw) {
    writeFileSync(filePath, content, 'utf8');
  } else {
    writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  }
  const remove = () => {
    rmSync(directory, { recursive: true, force: true });
  };
  return { filePath, remove };
};

const createStubLlmServer = async (responsePayload = { reply: 'integration-ok' }) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks).toString('utf8');
      let parsedBody = null;
      try {
        parsedBody = bodyBuffer ? JSON.parse(bodyBuffer) : null;
      } catch (_error) {
        parsedBody = { invalidJson: true, raw: bodyBuffer };
      }
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsedBody,
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(responsePayload));
    });
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  let closed = false;
  const close = () =>
    new Promise((resolve) => {
      if (closed) {
        resolve();
        return;
      }
      closed = true;
      server.close(resolve);
    });

  return {
    port,
    requests,
    close,
  };
};

const startProxyServer = async ({
  configContent,
  rawConfigContent,
  envOverrides = {},
}) => {
  const eventsToTrack = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];
  const computeNewHandlers = captureEventHandlers(eventsToTrack);
  const originalEnv = { ...process.env };
  const configFile = writeConfigFile(
    rawConfigContent ?? configContent,
    { raw: Boolean(rawConfigContent) }
  );
  const originalSetInterval = global.setInterval;
  const trackedIntervals = new Set();
  const patchedSetInterval = (...args) => {
    const timer = originalSetInterval(...args);
    try {
      const fn = args[0];
      if (typeof fn === 'function') {
        const fnString = fn.toString();
        if (fnString.includes('performAutoCleanup')) {
          if (typeof timer.unref === 'function') {
            timer.unref();
          }
          trackedIntervals.add(timer);
        }
      }
    } catch (_error) {
      // Ignore detection errors
    }
    return timer;
  };
  global.setInterval = patchedSetInterval;
  let intervalPatched = true;

  const applyEnv = () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      ...envOverrides,
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

  const port = Number(process.env.PROXY_PORT || 3001);
  await waitForCondition(() => pingEndpoint(port), { timeout: 15000, interval: 200 });

  const handlers = computeNewHandlers();
  let active = true;

  const shutdown = async (signal = 'SIGTERM') => {
    if (!active) {
      return;
    }
    active = false;
    const availableHandlers = handlers[signal]?.length
      ? handlers[signal]
      : handlers.SIGTERM || [];

    for (const handler of availableHandlers) {
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

  registerCleanup(async () => {
    await shutdown('SIGTERM');
  });

  return { port, shutdown };
};

const buildOperationalConfig = (endpointUrl) => ({
  defaultConfigId: 'integration-llm',
  configs: {
    'integration-llm': {
      configId: 'integration-llm',
      displayName: 'Integration Test LLM',
      apiType: 'ollama',
      endpointUrl,
      jsonOutputStrategy: { method: 'passthrough' },
      promptElements: [],
      promptAssemblyOrder: [],
      defaultParameters: {
        maxRetries: 1,
        baseDelayMs: 10,
        maxDelayMs: 20,
      },
    },
  },
});

describe('core server end-to-end integration coverage', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('starts successfully with healthy configuration and handles core routes', async () => {
    const stubServer = await createStubLlmServer({
      reply: 'stub-ok',
      tokens: 42,
    });

    registerCleanup(() => stubServer.close());

    const proxy = await startProxyServer({
      configContent: buildOperationalConfig(`http://127.0.0.1:${stubServer.port}`),
      envOverrides: {
        PROXY_PORT: '3311',
        PROXY_ALLOWED_ORIGIN: 'http://localhost:4000,http://127.0.0.1:4000',
        METRICS_ENABLED: 'true',
      },
    });

    const baseUrl = (pathSuffix) => `http://127.0.0.1:${proxy.port}${pathSuffix}`;

    const rootResponse = await fetch(baseUrl('/'));
    expect(rootResponse.status).toBe(200);
    const rootText = await rootResponse.text();
    expect(rootText).toContain('LLM Proxy Server is running and operational');

    const healthResponse = await fetch(baseUrl('/health'));
    expect(healthResponse.status).toBe(200);
    const healthBody = await healthResponse.json();
    expect(healthBody.status).toBe('UP');

    const readyResponse = await fetch(baseUrl('/health/ready'));
    expect(readyResponse.status).toBe(200);
    const readyBody = await readyResponse.json();
    expect(readyBody.status).toBe('UP');

    const detailedResponse = await fetch(baseUrl('/health/detailed'));
    expect(detailedResponse.status).toBe(200);
    const detailedBody = await detailedResponse.json();
    expect(detailedBody.environment.proxy_port).toBe(String(proxy.port));

    const metricsResponse = await fetch(baseUrl('/metrics'));
    expect(metricsResponse.status).toBe(200);
    const metricsBody = await metricsResponse.text();
    expect(metricsBody).toContain('llm_proxy_http_requests_total');

    const llmRequestResponse = await fetch(baseUrl('/api/llm-request'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        llmId: 'integration-llm',
        targetPayload: {
          model: 'integration-test',
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0,
        },
        targetHeaders: {
          'X-Trace': 'integration-test',
        },
      }),
    });

    expect(llmRequestResponse.status).toBe(200);
    const llmResponseBody = await llmRequestResponse.json();
    expect(llmResponseBody).toEqual({ reply: 'stub-ok', tokens: 42 });
    expect(stubServer.requests).toHaveLength(1);
    expect(stubServer.requests[0].headers['content-type']).toContain('application/json');

    const salvageStatsResponse = await fetch(baseUrl('/api/llm-request/salvage-stats'));
    expect(salvageStatsResponse.status).toBe(200);
    const salvageStats = await salvageStatsResponse.json();
    expect(salvageStats).toHaveProperty('stats');
    expect(salvageStats.stats).toHaveProperty('salvaged');

    const invalidJsonResponse = await fetch(baseUrl('/api/llm-request'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{ invalid json',
    });

    expect(invalidJsonResponse.status).toBeGreaterThanOrEqual(400);
    const invalidJsonBody = await invalidJsonResponse.json();
    expect(invalidJsonBody).toMatchObject({
      error: true,
      stage: 'internal_proxy_unhandled_error',
    });

    process.emit('beforeExit', 0);
    await proxy.shutdown('SIGTERM');
  });

  it('provides guarded responses when configuration fails to load', async () => {
    const rawConfig = '{ "defaultConfigId": "broken"';

    const proxy = await startProxyServer({
      rawConfigContent: rawConfig,
      envOverrides: {
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
        PROXY_ALLOWED_ORIGIN: '',
      },
    });

    const baseUrl = (pathSuffix) => `http://127.0.0.1:${proxy.port}${pathSuffix}`;

    const rootResponse = await fetch(baseUrl('/'));
    expect(rootResponse.status).toBe(503);
    const rootError = await rootResponse.json();
    expect(rootError).toMatchObject({
      error: true,
      stage: 'parse_json_syntax_error',
    });

    const readinessResponse = await fetch(baseUrl('/health/ready'));
    expect([200, 503]).toContain(readinessResponse.status);

    const metricsResponse = await fetch(baseUrl('/metrics'));
    expect(metricsResponse.status).toBe(200);
    const metricsText = await metricsResponse.text();
    expect(metricsText).toContain('Metrics collection is disabled');

    process.emit('beforeExit', 0);
    await proxy.shutdown('SIGHUP');
  });
});
