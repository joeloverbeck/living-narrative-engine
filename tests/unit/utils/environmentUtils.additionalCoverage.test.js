import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as environmentUtilsModule from '../../../src/utils/environmentUtils.js';

const {
  getEnvironmentVariable,
  getEnvironmentMode,
  getEnvironmentConfig,
  getMemoryUsage,
  getMemoryUsageBytes,
  getMemoryUsagePercent,
  hasEnvironmentVariable,
  createProcessEnvShim,
  getBooleanEnvironmentVariable,
} = environmentUtilsModule;

const GLOBAL_KEYS = [
  'process',
  'window',
  'document',
  'performance',
  'env',
  '__TEST_MODE__',
  '__PROXY_HOST__',
  '__PROXY_PORT__',
  '__PROXY_USE_HTTPS__',
  '__SKIP_DEBUG_CONFIG__',
  '__DEBUG_LOG_MODE__',
  '__DEBUG_LOG_SILENT__',
  '__NODE_ENV__',
  'jest',
  'require',
];

function snapshotGlobals() {
  const snapshot = new Map();
  for (const key of GLOBAL_KEYS) {
    snapshot.set(key, globalThis[key]);
  }
  return snapshot;
}

function restoreGlobals(snapshot) {
  for (const key of GLOBAL_KEYS) {
    if (snapshot.get(key) === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = snapshot.get(key);
    }
  }
}

describe('environmentUtils additional coverage', () => {
  /** @type {Map<string, unknown>} */
  let globals;

  beforeEach(() => {
    globals = snapshotGlobals();
  });

  afterEach(() => {
    restoreGlobals(globals);
  });

  it('falls back from window.env to global env when the browser shim lacks a value', () => {
    delete globalThis.process;
    globalThis.window = { env: {} };
    globalThis.document = {};
    globalThis.env = { FALLBACK_VALUE: 'from-global-env' };

    const value = getEnvironmentVariable('FALLBACK_VALUE', 'default');
    expect(value).toBe('from-global-env');
  });

  it('uses the default when window.env contains an empty string', () => {
    delete globalThis.process;
    globalThis.window = { env: { EMPTY_KEY: '' } };
    globalThis.document = {};
    delete globalThis.env;

    const value = getEnvironmentVariable('EMPTY_KEY', 'default-value');
    expect(value).toBe('default-value');
  });

  it('returns configured defaults for missing and unrecognized boolean flags', () => {
    globalThis.process = {
      versions: { node: '20.0.0' },
      env: {},
    };

    expect(getBooleanEnvironmentVariable('EXPERIMENT_FLAG', true)).toBe(true);

    globalThis.process.env.EXPERIMENT_FLAG = 'perhaps';
    expect(getBooleanEnvironmentVariable('EXPERIMENT_FLAG', true)).toBe(true);
  });

  it('falls back to provided boolean defaults when browser shim stores undefined', () => {
    globalThis.process = { versions: {}, env: {} };
    globalThis.window = { env: { SHIM_FLAG: undefined } };
    globalThis.document = {};

    expect(getBooleanEnvironmentVariable('SHIM_FLAG', true)).toBe(true);
  });

  it('treats null boolean values as absent and returns the fallback in browser shim', () => {
    globalThis.process = { versions: {}, env: {} };
    globalThis.window = { env: { SHIM_FLAG: null } };
    globalThis.document = {};

    expect(getBooleanEnvironmentVariable('SHIM_FLAG', false)).toBe(false);
  });

  it('treats absent global env as falsy when looking up variables', () => {
    delete globalThis.process;
    globalThis.window = { env: null };
    globalThis.document = {};
    delete globalThis.env;

    const value = getEnvironmentVariable('UNKNOWN_KEY', 'browser-default');
    expect(value).toBe('browser-default');
  });

  it('uses the default when global env contains an empty string', () => {
    delete globalThis.process;
    globalThis.window = undefined;
    globalThis.document = undefined;
    Object.defineProperty(globalThis, 'env', {
      configurable: true,
      value: {
        get EMPTY_KEY() {
          return undefined;
        },
      },
    });

    const value = getEnvironmentVariable('EMPTY_KEY', 'global-default');
    expect(value).toBe('global-default');

  });

  it('uses the global default inside an isolated module when env values are empty', async () => {
    await jest.isolateModulesAsync(async () => {
      delete globalThis.process;
      globalThis.window = undefined;
      globalThis.document = undefined;
      Object.defineProperty(globalThis, 'env', {
        configurable: true,
        value: {
          get EMPTY_KEY() {
            return undefined;
          },
        },
      });

      const mod = await import('../../../src/utils/environmentUtils.js');
      expect(mod.getEnvironmentVariable('EMPTY_KEY', 'isolated-default')).toBe(
        'isolated-default'
      );

    });
  });

  it('covers every getEnvironmentMode branch including shorthand values', () => {
    delete globalThis.jest;
    delete globalThis.process;

    globalThis.__NODE_ENV__ = 'development';
    expect(getEnvironmentMode()).toBe('development');

    globalThis.__NODE_ENV__ = 'test';
    expect(getEnvironmentMode()).toBe('test');

    globalThis.__NODE_ENV__ = 'testing';
    expect(getEnvironmentMode()).toBe('test');

    globalThis.__NODE_ENV__ = 'prod';
    expect(getEnvironmentMode()).toBe('production');

    globalThis.__NODE_ENV__ = 'production';
    expect(getEnvironmentMode()).toBe('production');

    globalThis.__NODE_ENV__ = 'dev';
    expect(getEnvironmentMode()).toBe('development');

    globalThis.__NODE_ENV__ = 'STAGING';
    expect(getEnvironmentMode()).toBe('development');
  });

  it('reports memory metrics for browser and node fallbacks', () => {
    delete globalThis.process;
    globalThis.performance = {};
    expect(getMemoryUsage()).toBeNull();

    globalThis.process = {
      versions: { node: '20.0.0' },
      memoryUsage: jest.fn(() => ({
        heapUsed: 1024,
        heapTotal: 2048,
        external: 64,
      })),
    };

    const nodeUsage = getMemoryUsage();
    expect(nodeUsage.heapUsed).toBe(1024);
    expect(nodeUsage.heapTotal).toBe(2048);
    expect(nodeUsage.external).toBe(64);
    // heapLimit comes from v8.getHeapStatistics() which returns real values in Node
    expect(nodeUsage.heapLimit).toBeGreaterThan(0);
    expect(typeof nodeUsage.heapLimit).toBe('number');

    expect(getMemoryUsageBytes()).toBe(1024);
    // Calculate expected percent with real heap limit
    const expectedPercent = nodeUsage.heapUsed / nodeUsage.heapLimit;
    expect(getMemoryUsagePercent()).toBeCloseTo(expectedPercent);
  });

  it('returns zeroed memory metrics when usage data is missing', () => {
    delete globalThis.performance;
    globalThis.process = {
      versions: { node: '20.0.0' },
      memoryUsage: jest.fn(() => ({
        heapUsed: undefined,
        heapTotal: undefined,
        external: undefined,
      })),
    };

    const usage = getMemoryUsage();
    expect(usage.heapUsed).toBe(0);
    expect(usage.heapTotal).toBe(0);
    expect(usage.external).toBe(0);
    // heapLimit falls back to heapTotal (0) when process.memoryUsage returns undefined values
    // But v8.getHeapStatistics() is still available and will provide a real limit
    expect(usage.heapLimit).toBeGreaterThan(0);
    expect(getMemoryUsageBytes()).toBe(0);
    // With heapUsed=0, percent should be 0
    expect(getMemoryUsagePercent()).toBe(0);
  });

  it('uses v8 heap statistics when available in Node.js', () => {
    delete globalThis.performance;
    globalThis.process = {
      versions: { node: '20.0.0' },
      memoryUsage: jest.fn(() => ({
        heapUsed: 128,
        heapTotal: 256,
        external: 32,
      })),
    };

    const usage = getMemoryUsage();

    // With modern v8 module available, heap limit comes from v8.getHeapStatistics()
    expect(usage.heapUsed).toBe(128);
    expect(usage.heapTotal).toBe(256);
    expect(usage.external).toBe(32);
    // heapLimit will be from v8.getHeapStatistics() which returns real values
    expect(usage.heapLimit).toBeGreaterThan(0);
    expect(typeof usage.heapLimit).toBe('number');
  });

  it('returns zeros when browser memory data is missing', () => {
    delete globalThis.process;
    globalThis.performance = {
      memory: {
        usedJSHeapSize: undefined,
        totalJSHeapSize: undefined,
        jsHeapSizeLimit: undefined,
      },
    };

    const usage = getMemoryUsage();
    expect(usage).toEqual({ heapUsed: 0, heapTotal: 0, heapLimit: 0, external: 0 });
  });

  it('handles environment variable failures safely', () => {
    globalThis.process = {
      versions: { node: '20.0.0' },
      get env() {
        throw new Error('boom');
      },
    };

    expect(hasEnvironmentVariable('DOES_NOT_EXIST')).toBe(false);
  });

  it('treats explicit null values as absent when checking presence', () => {
    const spy = jest
      .spyOn(environmentUtilsModule, 'getEnvironmentVariable')
      .mockReturnValueOnce(null);

    try {
      expect(hasEnvironmentVariable('NULLISH')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('treats explicit undefined values as absent when checking presence in browser shim', () => {
    globalThis.process = { versions: {}, env: {} };
    globalThis.window = { env: { UNDEFINED: undefined } };
    globalThis.document = {};

    expect(hasEnvironmentVariable('UNDEFINED')).toBe(false);
  });

  it('returns false when a fresh module experiences an environment lookup failure', async () => {
    await jest.isolateModulesAsync(async () => {
      const mod = await import('../../../src/utils/environmentUtils.js');
      jest
        .spyOn(mod, 'getEnvironmentVariable')
        .mockImplementation(() => {
          throw new Error('isolated');
        });
      expect(mod.hasEnvironmentVariable('ANY')).toBe(false);
    });
  });

  it('builds environment config including debug options', () => {
    delete globalThis.jest;
    delete globalThis.process;
    globalThis.window = {};
    globalThis.document = {};
    globalThis.__NODE_ENV__ = 'development';
    globalThis.__DEBUG_LOG_MODE__ = 'verbose';
    globalThis.__DEBUG_LOG_SILENT__ = 'true';
    globalThis.__SKIP_DEBUG_CONFIG__ = 'on';

    const config = getEnvironmentConfig();
    expect(config).toEqual(
      expect.objectContaining({
        environment: 'browser',
        mode: 'development',
        isBrowser: true,
        isNode: false,
        isProduction: false,
        isTest: false,
        skipDebugConfig: true,
        debugLogMode: 'verbose',
        debugLogSilent: true,
      })
    );
  });

  it('creates a shim when process.env is unavailable', () => {
    delete globalThis.process;
    delete globalThis.jest;
    globalThis.__NODE_ENV__ = 'shim-env';

    const shim = createProcessEnvShim();
    expect(shim.NODE_ENV).toBe('shim-env');
    expect(Object.keys(shim)).toEqual(
      expect.arrayContaining([
        'NODE_ENV',
        'DEBUG_LOG_MODE',
        'DEBUG_LOG_SILENT',
        'SKIP_DEBUG_CONFIG',
        'PROXY_HOST',
        'PROXY_PORT',
        'PROXY_USE_HTTPS',
      ])
    );
  });

  it('falls back to the provided heap limit when process becomes unavailable mid-calculation', async () => {
    await jest.isolateModulesAsync(async () => {
      const originalProcess = globalThis.process;

      try {
        delete globalThis.performance;
        globalThis.process = {
          versions: { node: '20.0.0' },
          memoryUsage: jest.fn(() => {
            globalThis.process = null;
            return {
              heapUsed: 512,
              heapTotal: 1024,
              external: 128,
            };
          }),
        };

        const mod = await import('../../../src/utils/environmentUtils.js');
        const usage = mod.getMemoryUsage();

        expect(usage).toEqual(
          expect.objectContaining({
            heapUsed: 512,
            heapTotal: 1024,
            external: 128,
            heapLimit: 1024,
          })
        );
      } finally {
        globalThis.process = originalProcess;
      }
    });
  });

  it('skips loading the v8 module when the node version flag disappears', async () => {
    await jest.isolateModulesAsync(async () => {
      delete globalThis.performance;

      const originalProcess = globalThis.process;
      const originalRequire = globalThis.require;

      try {
        globalThis.require = jest.fn(() => {
          throw new Error('v8 should not be required when node flag is missing');
        });

        globalThis.process = {
          versions: { node: '20.0.0' },
          memoryUsage: jest.fn(() => {
            delete globalThis.process.versions.node;
            return {
              heapUsed: 256,
              heapTotal: 768,
              external: 64,
            };
          }),
        };

        const mod = await import('../../../src/utils/environmentUtils.js');
        const usage = mod.getMemoryUsage();

        expect(globalThis.require).not.toHaveBeenCalled();
        expect(usage.heapLimit).toBe(768);
      } finally {
        globalThis.process = originalProcess;
        globalThis.require = originalRequire;
      }
    });
  });

  it('falls back gracefully when the v8 module throws during resolution', async () => {
    await jest.isolateModulesAsync(async () => {
      delete globalThis.performance;

      const originalProcess = globalThis.process;

      try {
        globalThis.process = {
          versions: { node: '20.0.0' },
          memoryUsage: jest.fn(() => ({
            heapUsed: 100,
            heapTotal: 500,
            external: 0,
          })),
        };

        jest.doMock('v8', () => {
          throw new Error('no v8 available');
        });

        const mod = await import('../../../src/utils/environmentUtils.js');
        const usage = mod.getMemoryUsage();

        expect(usage).toEqual(
          expect.objectContaining({
            heapUsed: 100,
            heapTotal: 500,
            heapLimit: 500,
          })
        );
      } finally {
        globalThis.process = originalProcess;
        jest.resetModules();
        jest.dontMock('v8');
      }
    });
  });
});
