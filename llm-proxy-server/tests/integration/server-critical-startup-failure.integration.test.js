/**
 * @file server-critical-startup-failure.integration.test.js
 * @description Exercises the proxy server's startup failure handling paths by
 *              forcing the LlmConfigService initialization to throw. This
 *              ensures the asynchronous bootstrap catch block and shutdown
 *              signal fallbacks are covered using real module wiring.
 */

import {
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EVENTS_TO_TRACK = ['SIGTERM', 'SIGINT', 'SIGHUP'];

/**
 * Captures newly-registered process listeners so they can be cleaned up after
 * the test completes. Prevents interference with other integration suites.
 * @param {string[]} events
 * @returns {() => void}
 */
function captureNewListeners(events) {
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
}

describe('proxy server startup critical failure integration', () => {
  const originalEnv = { ...process.env };
  let restoreListeners = () => {};
  let exitSpy;
  let consoleErrorSpy;
  let restoreTimers = () => {};

  afterEach(() => {
    restoreListeners();
    restoreListeners = () => {};

    restoreTimers();
    restoreTimers = () => {};

    if (exitSpy) {
      exitSpy.mockRestore();
      exitSpy = undefined;
    }

    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
      consoleErrorSpy = undefined;
    }

    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('logs the critical failure and avoids process exit while handling shutdown signals', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PROXY_PORT = '0';
    process.env.METRICS_ENABLED = 'false';
    process.env.CACHE_ENABLED = 'false';
    process.env.HTTP_AGENT_ENABLED = 'false';
    process.env.LLM_CONFIG_PATH = path.join(process.cwd(), 'config', 'llm-configs.json');

    jest.resetModules();

    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    restoreListeners = captureNewListeners(EVENTS_TO_TRACK);

    const simulatedFailure = new Error('simulated asynchronous startup failure');
    const trackedIntervals = [];
    const trackedTimeouts = [];
    const originalSetInterval = global.setInterval;
    const originalSetTimeout = global.setTimeout;

    restoreTimers = () => {
      for (const id of trackedIntervals.splice(0, trackedIntervals.length)) {
        clearInterval(id);
      }
      for (const id of trackedTimeouts.splice(0, trackedTimeouts.length)) {
        clearTimeout(id);
      }
      global.setInterval = originalSetInterval;
      global.setTimeout = originalSetTimeout;
    };

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/config/llmConfigService.js', () => {
        class FailingLlmConfigService {
          constructor(fileSystemReader, logger, appConfig) {
            this.fileSystemReader = fileSystemReader;
            this.logger = logger;
            this.appConfig = appConfig;
          }

          async initialize() {
            throw simulatedFailure;
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

      global.setInterval = (handler, timeout, ...args) => {
        const timer = originalSetInterval(handler, timeout, ...args);
        trackedIntervals.push(timer);
        return timer;
      };

      global.setTimeout = (handler, timeout, ...args) => {
        const timer = originalSetTimeout(handler, timeout, ...args);
        trackedTimeouts.push(timer);
        return timer;
      };

      const serverModuleUrl = pathToFileURL(
        path.resolve(process.cwd(), 'src/core/server.js')
      ).href;

      await import(serverModuleUrl);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessages = consoleErrorSpy.mock.calls.map(([message]) => String(message));
    expect(
      loggedMessages.some((entry) =>
        entry.includes(
          'LLM Proxy Server: A critical error occurred during asynchronous server startup sequence PRIOR to app.listen.'
        )
      )
    ).toBe(true);
    expect(
      loggedMessages.some((entry) =>
        entry.includes(
          'LLM Proxy Server: CRITICAL - Proxy will NOT be operational due to a severe error during startup initialization steps.'
        )
      )
    ).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();

    process.emit('SIGTERM');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
