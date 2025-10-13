import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (
  checkFn,
  { timeout = 10000, interval = 100 } = {}
) => {
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
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
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
        // eslint-disable-next-line no-console
        console.error(
          'Cleanup error during server error handling tests:',
          error
        );
      }
    }
  });

  return (fn) => {
    tasks.push(fn);
  };
})();

const clearCacheAutoCleanupTimers = () => {
  const handles =
    typeof process._getActiveHandles === 'function'
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
  const directory = mkdtempSync(
    path.join(tmpdir(), 'proxy-server-error-tests-')
  );
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

const getAvailablePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Unable to determine ephemeral port');
  }
  const { port } = address;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const createStubLlmServer = async (
  responsePayload = { reply: 'error-handler-ok' }
) => {
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
  const configFile = writeConfigFile(rawConfigContent ?? configContent, {
    raw: Boolean(rawConfigContent),
  });
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
      // ignore detection errors
    }
    return timer;
  };
  global.setInterval = patchedSetInterval;
  let intervalPatched = true;

  const port = await getAvailablePort();

  const applyEnv = () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROXY_PORT: String(port),
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
    const serverModuleUrl = pathToFileURL(path.resolve('src/core/server.js'));
    await import(serverModuleUrl.href);
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

  await waitForCondition(() => pingEndpoint(port), {
    timeout: 15000,
    interval: 200,
  });

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
      displayName: 'Integration Error Handling LLM',
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

describe('core server error handling integration coverage', () => {
  beforeEach(() => {
    jest.setTimeout(30000);
  });

  it('surfaces initialization failure details on the root endpoint when configuration parsing fails', async () => {
    const proxy = await startProxyServer({
      rawConfigContent: '{ "defaultConfigId": "broken"',
      envOverrides: {
        METRICS_ENABLED: 'false',
        CACHE_ENABLED: 'false',
        HTTP_AGENT_ENABLED: 'false',
        PROXY_ALLOWED_ORIGIN: '',
      },
    });

    const baseUrl = (pathSuffix) =>
      `http://127.0.0.1:${proxy.port}${pathSuffix}`;

    const rootResponse = await fetch(baseUrl('/'));
    expect(rootResponse.status).toBe(503);
    const rootBody = await rootResponse.json();
    expect(rootBody).toMatchObject({
      error: true,
      stage: 'parse_json_syntax_error',
    });

    const readinessResponse = await fetch(baseUrl('/health/ready'));
    expect(readinessResponse.status).toBe(503);
    const readinessBody = await readinessResponse.json();
    expect(readinessBody.status).toBe('DOWN');
    expect(readinessBody.details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'llmConfigService', status: 'DOWN' }),
      ])
    );

    process.emit('beforeExit', 0);
    await proxy.shutdown('SIGTERM');
  });

  it('returns sanitized error payloads via the global error handler when JSON parsing fails early', async () => {
    const stubServer = await createStubLlmServer({ reply: 'stub-ok' });
    registerCleanup(() => stubServer.close());

    const proxy = await startProxyServer({
      configContent: buildOperationalConfig(
        `http://127.0.0.1:${stubServer.port}`
      ),
      envOverrides: {
        PROXY_ALLOWED_ORIGIN: 'http://localhost:4000',
        METRICS_ENABLED: 'true',
      },
    });

    const baseUrl = (pathSuffix) =>
      `http://127.0.0.1:${proxy.port}${pathSuffix}`;

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
      message: expect.stringContaining('unexpected'),
    });
    expect(invalidJsonBody).not.toHaveProperty('stack');

    process.emit('beforeExit', 0);
    await proxy.shutdown('SIGTERM');
  });
});
