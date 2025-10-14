import {
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EVENTS_TO_TRACK = ['SIGTERM', 'SIGINT', 'SIGHUP', 'beforeExit'];

/**
 * Polls until the provided async predicate returns true.
 * @param {() => Promise<boolean>} checkFn
 * @param {{ timeout?: number, interval?: number }} [options]
 */
const waitFor = async (checkFn, options = {}) => {
  const { timeout = 10000, interval = 100 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await checkFn()) {
        return;
      }
    } catch (error) {
      void error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Timed out waiting for condition');
};

const getAvailablePort = async () => {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to determine ephemeral port'));
        return;
      }
      const { port } = address;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
        } else {
          resolve(port);
        }
      });
    });
  });
};

let capturedErrorMiddleware = null;

const captureNewListeners = (events) => {
  const baselines = new Map();
  for (const event of events) {
    baselines.set(event, new Set(process.listeners(event)));
  }
  return () => {
    for (const event of events) {
      const baseline = baselines.get(event);
      for (const listener of process.listeners(event)) {
        if (!baseline?.has(listener)) {
          process.removeListener(event, listener);
        }
      }
    }
  };
};

let capturedServer = null;
let capturedApp = null;

describe('core server additional integration coverage', () => {
  const originalEnv = { ...process.env };
  let restoreListeners = () => {};
  let restoreTimers = () => {};

  afterEach(async () => {
    restoreListeners();
    restoreListeners = () => {};

    restoreTimers();
    restoreTimers = () => {};

    if (capturedServer) {
      await new Promise((resolve) => capturedServer.close(resolve));
    }
    capturedServer = null;
    capturedApp = null;
    capturedErrorMiddleware = null;

    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('provides guarded responses when initialization details are unavailable', async () => {
    const port = await getAvailablePort();
    const configPath = path.join(process.cwd(), 'config', 'llm-configs.json');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROXY_PORT: String(port),
      METRICS_ENABLED: 'false',
      CACHE_ENABLED: 'false',
      HTTP_AGENT_ENABLED: 'false',
      PROXY_ALLOWED_ORIGIN: '',
      LLM_CONFIG_PATH: configPath,
    };

    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const trackedIntervals = new Set();
    const trackedTimeouts = new Set();
    const originalSetInterval = global.setInterval;
    const originalSetTimeout = global.setTimeout;
    global.setInterval = (...args) => {
      const timer = originalSetInterval(...args);
      trackedIntervals.add(timer);
      return timer;
    };
    global.setTimeout = (...args) => {
      const timer = originalSetTimeout(...args);
      trackedTimeouts.add(timer);
      return timer;
    };
    restoreTimers = () => {
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

    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    let detailCallCount = 0;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/config/llmConfigService.js', () => {
        class NonOperationalLlmConfigService {
          async initialize() {}
          isOperational() {
            return false;
          }
          getInitializationErrorDetails() {
            detailCallCount += 1;
            if (detailCallCount === 1) {
              return { stage: 'mock-stage' };
            }
            return null;
          }
          getResolvedConfigPath() {
            return null;
          }
          getLlmConfigs() {
            return null;
          }
          hasFileBasedApiKeys() {
            return false;
          }
        }
        return { LlmConfigService: NonOperationalLlmConfigService };
      });

      jest.doMock('express', () => {
        const actualExpress = jest.requireActual('express');
        const wrapped = (...args) => {
          const app = actualExpress(...args);
          capturedApp = app;
          const originalListen = app.listen.bind(app);
          const originalUse = app.use.bind(app);
          app.use = (...middlewares) => {
            for (const middleware of middlewares) {
              if (typeof middleware === 'function' && middleware.length === 4) {
                capturedErrorMiddleware = middleware;
              }
            }
            return originalUse(...middlewares);
          };
          app.listen = (...listenArgs) => {
            const server = originalListen(...listenArgs);
            capturedServer = server;
            return server;
          };
          return app;
        };
        return Object.assign(wrapped, actualExpress);
      });

      const moduleUrl = pathToFileURL(
        path.resolve(process.cwd(), 'src/core/server.js')
      ).href;
      await import(moduleUrl);
    });

    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.body?.cancel) {
          await response.body.cancel();
        }
        return response.ok;
      } catch (error) {
        void error;
        return false;
      }
    });

    const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(rootResponse.status).toBe(503);
    const rootBody = await rootResponse.json();
    expect(rootBody.stage).toBe('initialization_failure_unknown');

    const warnMessages = consoleWarnSpy.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(warnMessages).toContain('LLM configurations path could not be determined');
    expect(consoleErrorSpy.mock.calls.some(([message]) => String(message).includes('Reason: Unknown initialization error.'))).toBe(true);

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('requests process termination when startup fails outside the test environment', async () => {
    const configPath = path.join(process.cwd(), 'config', 'llm-configs.json');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      PROXY_PORT: '0',
      METRICS_ENABLED: 'false',
      CACHE_ENABLED: 'false',
      HTTP_AGENT_ENABLED: 'false',
      PROXY_ALLOWED_ORIGIN: '',
      LLM_CONFIG_PATH: configPath,
    };

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined);

    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    const trackedIntervals = new Set();
    const trackedTimeouts = new Set();
    const originalSetInterval = global.setInterval;
    const originalSetTimeout = global.setTimeout;
    global.setInterval = (...args) => {
      const timer = originalSetInterval(...args);
      trackedIntervals.add(timer);
      return timer;
    };
    global.setTimeout = (...args) => {
      const timer = originalSetTimeout(...args);
      trackedTimeouts.add(timer);
      return timer;
    };
    restoreTimers = () => {
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

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/config/llmConfigService.js', () => {
        class FailingLlmConfigService {
          async initialize() {
            throw new Error('simulated startup failure');
          }
          isOperational() {
            return false;
          }
          getInitializationErrorDetails() {
            return null;
          }
          getResolvedConfigPath() {
            return null;
          }
          getLlmConfigs() {
            return null;
          }
          hasFileBasedApiKeys() {
            return false;
          }
        }
        return { LlmConfigService: FailingLlmConfigService };
      });

      const moduleUrl = pathToFileURL(
        path.resolve(process.cwd(), 'src/core/server.js')
      ).href;
      await import(moduleUrl);
    });

    expect(exitSpy).toHaveBeenCalledWith(1);

    process.emit('SIGINT');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });

  it('delegates to Express when headers have already been sent', async () => {
    const port = await getAvailablePort();
    const configPath = path.join(process.cwd(), 'config', 'llm-configs.json');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROXY_PORT: String(port),
      METRICS_ENABLED: 'false',
      CACHE_ENABLED: 'false',
      HTTP_AGENT_ENABLED: 'false',
      PROXY_ALLOWED_ORIGIN: '',
      LLM_CONFIG_PATH: configPath,
    };

    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    const trackedIntervals = new Set();
    const trackedTimeouts = new Set();
    const originalSetInterval = global.setInterval;
    const originalSetTimeout = global.setTimeout;
    global.setInterval = (...args) => {
      const timer = originalSetInterval(...args);
      trackedIntervals.add(timer);
      return timer;
    };
    global.setTimeout = (...args) => {
      const timer = originalSetTimeout(...args);
      trackedTimeouts.add(timer);
      return timer;
    };
    restoreTimers = () => {
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

    await jest.isolateModulesAsync(async () => {
      jest.doMock('express', () => {
        const actualExpress = jest.requireActual('express');
        const wrapped = (...args) => {
          const app = actualExpress(...args);
          capturedApp = app;
          const originalListen = app.listen.bind(app);
          const originalUse = app.use.bind(app);
          app.use = (...middlewares) => {
            for (const middleware of middlewares) {
              if (typeof middleware === 'function' && middleware.length === 4) {
                capturedErrorMiddleware = middleware;
              }
            }
            return originalUse(...middlewares);
          };
          app.listen = (...listenArgs) => {
            const server = originalListen(...listenArgs);
            capturedServer = server;
            return server;
          };
          return app;
        };
        return Object.assign(wrapped, actualExpress);
      });

      const moduleUrl = pathToFileURL(
        path.resolve(process.cwd(), 'src/core/server.js')
      ).href;
      await import(moduleUrl);
    });

    expect(typeof capturedErrorMiddleware).toBe('function');

    const errorHandler = capturedErrorMiddleware;
    const err = new Error('headers already sent');
    const req = { originalUrl: '/test', method: 'GET' };
    const next = jest.fn();
    const res = {
      headersSent: true,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    const warnMessages = warnSpy.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(warnMessages).toContain('Headers already sent for this request');

    warnSpy.mockRestore();
  });
});
