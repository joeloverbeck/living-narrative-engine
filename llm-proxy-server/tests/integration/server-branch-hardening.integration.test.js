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
 * @description Waits for the provided asynchronous predicate to return true.
 * @param {() => Promise<boolean>} checkFn - The predicate to evaluate repeatedly.
 * @param {{ timeout?: number, interval?: number }} [options] - Polling configuration overrides.
 * @returns {Promise<void>} Resolves when the predicate returns true before timeout.
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

/**
 * @description Allocates an ephemeral TCP port by creating and closing a temporary server.
 * @returns {Promise<number>} A free port on the loopback interface.
 */
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

/**
 * @description Captures newly registered process listeners so they can be removed after the test.
 * @param {string[]} events - The process events to monitor.
 * @returns {() => void} A cleanup function that removes listeners registered after capture.
 */
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

/**
 * @description Wraps global timer registration so timers can be cleared reliably after each test.
 * @returns {() => void} Cleanup function that restores original timer functions and clears tracked timers.
 */
const trackTimers = () => {
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const trackedIntervals = new Set();
  const trackedTimeouts = new Set();

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

  return () => {
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
};

describe('core server branch completion integration', () => {
  const originalEnv = { ...process.env };
  let restoreListeners = () => {};
  let restoreTimers = () => {};
  let capturedServer = null;
  let capturedApp = null;
  let capturedErrorMiddlewares = [];

  afterEach(async () => {
    restoreListeners();
    restoreListeners = () => {};

    restoreTimers();
    restoreTimers = () => {};

    if (capturedServer) {
      await new Promise((resolve) => {
        capturedServer.close(() => resolve());
      });
    }
    capturedServer = null;
    capturedApp = null;
    capturedErrorMiddlewares = [];

    process.env = { ...originalEnv };

    jest.dontMock('express');
    jest.unmock('express');
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('falls back to the default initialization stage when none is provided', async () => {
    jest.resetModules();

    const port = await getAvailablePort();
    const configPath = path.join(process.cwd(), '../config/llm-configs.json');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROXY_PORT: String(port),
      METRICS_ENABLED: 'false',
      CACHE_ENABLED: 'false',
      HTTP_AGENT_ENABLED: 'false',
      PROXY_ALLOWED_ORIGIN: '',
      LLM_CONFIG_PATH: configPath,
      OPENROUTER_API_KEY_ENV_VAR: 'test-key',
    };

    restoreTimers = trackTimers();
    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/config/llmConfigService.js', () => {
        class NonOperationalLlmConfigService {
          async initialize() {}
          isOperational() {
            return false;
          }
          getInitializationErrorDetails() {
            return {
              message: 'Unable to load configurations',
              details: { diagnostics: 'missing files' },
            };
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
                capturedErrorMiddlewares.push(middleware);
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
        const response = await fetch(`http://127.0.0.1:${port}/`);
        if (response.body?.cancel) {
          await response.body.cancel();
        }
        return response.status === 503;
      } catch (error) {
        void error;
        return false;
      }
    }, { timeout: 15000, interval: 200 });

    const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
    expect(rootResponse.status).toBe(503);
    const payload = await rootResponse.json();
    expect(payload.stage).toBe('initialization_failure');
    expect(payload.message).toContain('NOT OPERATIONAL');
    expect(payload.details).toEqual(
      expect.objectContaining({ message: 'Unable to load configurations' })
    );
  });

  it('cleans up services on shutdown and honors upstream status codes in the error handler', async () => {
    jest.resetModules();

    const port = await getAvailablePort();
    const configPath = path.join(process.cwd(), '../config/llm-configs.json');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROXY_PORT: String(port),
      METRICS_ENABLED: 'true',
      CACHE_ENABLED: 'false',
      HTTP_AGENT_ENABLED: 'false',
      PROXY_ALLOWED_ORIGIN: '',
      LLM_CONFIG_PATH: configPath,
      OPENROUTER_API_KEY_ENV_VAR: 'test-key',
    };

    restoreTimers = trackTimers();
    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    let salvageCleanupSpy;
    let httpAgentCleanupSpy;
    let metricsClearSpy;

    await jest.isolateModulesAsync(async () => {
      const moduleUrl = pathToFileURL(
        path.resolve(process.cwd(), 'src/core/server.js')
      ).href;

      jest.doMock('../../src/config/llmConfigService.js', () => {
        class MinimalOperationalLlmConfigService {
          async initialize() {}
          isOperational() {
            return true;
          }
          getInitializationErrorDetails() {
            return null;
          }
          getResolvedConfigPath() {
            return '/tmp/mock';
          }
          getLlmConfigs() {
            return { metadata: 'available' };
          }
          hasFileBasedApiKeys() {
            return false;
          }
        }
        return { LlmConfigService: MinimalOperationalLlmConfigService };
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
                capturedErrorMiddlewares.push(middleware);
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

      const salvageModule = await import(
        '../../src/services/responseSalvageService.js'
      );
      salvageCleanupSpy = jest
        .spyOn(salvageModule.default.prototype, 'cleanup')
        .mockImplementation(function cleanupOverride() {
          this._cleanupPerformed = true;
        });

      const httpAgentModule = await import(
        '../../src/services/httpAgentService.js'
      );
      httpAgentCleanupSpy = jest
        .spyOn(httpAgentModule.default.prototype, 'cleanup')
        .mockImplementation(function cleanupOverride() {
          this._cleanupPerformed = true;
        });

      const metricsModule = await import(
        '../../src/services/metricsService.js'
      );
      metricsClearSpy = jest
        .spyOn(metricsModule.default.prototype, 'clear')
        .mockImplementation(function clearOverride() {
          this._metricsCleared = true;
        });

      await import(moduleUrl);
    });

    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.body?.cancel) {
          await response.body.cancel();
        }
        return response.status === 200;
      } catch (error) {
        void error;
        return false;
      }
    }, { timeout: 15000, interval: 200 });

    expect(typeof capturedApp?.use).toBe('function');

    const routerStack = capturedApp?._router?.stack;
    if (Array.isArray(routerStack)) {
      capturedApp._router.stack = routerStack.filter(
        (layer) => !(typeof layer.handle === 'function' && layer.handle.length === 4)
      );
    }

    capturedApp.get('/trigger-error', (_req, _res, next) => {
      const error = new Error('synthetic failure');
      error.statusCode = 429;
      next(error);
    });

    const errorHandlersToReinstall = [...capturedErrorMiddlewares];
    capturedErrorMiddlewares = [];
    for (const errorMiddleware of errorHandlersToReinstall) {
      capturedApp.use(errorMiddleware);
    }

    const failureResponse = await fetch(
      `http://127.0.0.1:${port}/trigger-error`
    );
    expect(failureResponse.status).toBe(429);
    const failurePayload = await failureResponse.json();
    expect(failurePayload.stage).toBe('internal_proxy_unhandled_error');
    expect(failurePayload.originalStatusCode).toBe(429);
    expect(failurePayload.details).toEqual(
      expect.objectContaining({ originalErrorMessage: 'synthetic failure' })
    );

    process.emit('SIGTERM');

    await waitFor(async () => {
      const cleanupCalls =
        (salvageCleanupSpy?.mock.calls.length ?? 0) > 0 &&
        (httpAgentCleanupSpy?.mock.calls.length ?? 0) > 0 &&
        (metricsClearSpy?.mock.calls.length ?? 0) > 0;
      return cleanupCalls;
    }, { timeout: 5000, interval: 50 });

    expect(salvageCleanupSpy).toHaveBeenCalled();
    expect(httpAgentCleanupSpy).toHaveBeenCalled();
    expect(metricsClearSpy).toHaveBeenCalled();
  });
});
