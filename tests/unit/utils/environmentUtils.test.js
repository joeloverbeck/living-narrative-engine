/** @jest-environment node */
/**
 * @file Unit tests for environmentUtils module
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  detectEnvironment,
  getEnvironmentVariable,
  getEnvironmentMode,
  shouldSkipDebugConfig,
  getEnvironmentConfig,
  getBooleanEnvironmentVariable,
  hasEnvironmentVariable,
  createProcessEnvShim,
  isTestEnvironment,
  isGarbageCollectionAvailable,
  triggerGarbageCollection,
  getMemoryUsage,
  getMemoryUsageBytes,
  getMemoryUsagePercent,
} from '../../../src/utils/environmentUtils.js';
import * as environmentUtilsModule from '../../../src/utils/environmentUtils.js';

describe('environmentUtils', () => {
  let originalGlobals;

  const trackedKeys = [
    'process',
    'window',
    'document',
    'navigator',
    'importScripts',
    'performance',
    'env',
    '__TEST_MODE__',
    '__NODE_ENV__',
    '__DEBUG_LOG_MODE__',
    '__DEBUG_LOG_SILENT__',
    '__SKIP_DEBUG_CONFIG__',
    '__PROXY_HOST__',
    '__PROXY_PORT__',
    '__PROXY_USE_HTTPS__',
    'jest',
  ];

  beforeEach(() => {
    originalGlobals = {};
    for (const key of trackedKeys) {
      originalGlobals[key] = globalThis[key];
    }
  });

  afterEach(() => {
    for (const key of trackedKeys) {
      if (originalGlobals[key] !== undefined) {
        globalThis[key] = originalGlobals[key];
      } else {
        delete globalThis[key];
      }
    }

    jest.restoreAllMocks();
  });

  describe('detectEnvironment', () => {
    it('should detect Node.js environment', () => {
      globalThis.process = { versions: { node: '16.0.0' } };
      expect(detectEnvironment()).toBe('node');
    });

    it('should detect browser environment', () => {
      delete globalThis.process;
      globalThis.window = {};
      globalThis.document = {};
      expect(detectEnvironment()).toBe('browser');
    });

    it('should detect web worker environment', async () => {
      const originalProcess = globalThis.process;
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const originalNavigator = globalThis.navigator;
      const originalImportScripts = globalThis.importScripts;

      globalThis.process = undefined;
      globalThis.window = undefined;
      globalThis.document = undefined;
      expect(typeof globalThis.window).toBe('undefined');
      expect(typeof globalThis.document).toBe('undefined');
      globalThis.navigator = { userAgent: 'worker' };
      globalThis.importScripts = () => {};

      await jest.resetModules();
      const { detectEnvironment: isolatedDetectEnvironment } = await import(
        '../../../src/utils/environmentUtils.js'
      );
      expect(isolatedDetectEnvironment()).toBe('webworker');

      globalThis.process = originalProcess;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.navigator = originalNavigator;
      globalThis.importScripts = originalImportScripts;
      await jest.resetModules();
    });

    it('should return unknown when heuristics fail', async () => {
      const originalProcess = globalThis.process;
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const originalNavigator = globalThis.navigator;
      const originalImportScripts = globalThis.importScripts;

      globalThis.process = undefined;
      globalThis.window = undefined;
      globalThis.document = undefined;
      expect(typeof globalThis.window).toBe('undefined');
      expect(typeof globalThis.document).toBe('undefined');
      delete globalThis.importScripts;
      delete globalThis.navigator;

      await jest.resetModules();
      const { detectEnvironment: isolatedDetectEnvironment } = await import(
        '../../../src/utils/environmentUtils.js'
      );
      expect(isolatedDetectEnvironment()).toBe('unknown');

      globalThis.process = originalProcess;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.navigator = originalNavigator;
      globalThis.importScripts = originalImportScripts;
      await jest.resetModules();
    });
  });

  describe('getEnvironmentVariable', () => {
    it('should get from process.env', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { TEST_VAR: 'node-value' },
      };
      expect(getEnvironmentVariable('TEST_VAR')).toBe('node-value');
    });

    it('should get from globalThis injection', () => {
      delete globalThis.process;
      globalThis.__TEST_VAR__ = 'build-value';
      expect(getEnvironmentVariable('TEST_VAR')).toBe('build-value');
    });

    it('should return default', () => {
      delete globalThis.process;
      expect(getEnvironmentVariable('MISSING', 'default')).toBe('default');
    });

    it('should get from window.env when present', () => {
      globalThis.process = undefined;
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const workingWindow = originalWindow || {};
      workingWindow.env = { BROWSER_ONLY: 'window-value' };
      globalThis.window = workingWindow;
      globalThis.document = originalDocument || {};

      expect(getEnvironmentVariable('BROWSER_ONLY', 'fallback')).toBe(
        'window-value',
      );

      if (originalWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }
      if (originalDocument === undefined) {
        delete globalThis.document;
      } else {
        globalThis.document = originalDocument;
      }
    });

    it('should get from globalThis.env object when defined', () => {
      globalThis.process = undefined;
      const originalWindow = globalThis.window;
      globalThis.window = undefined;
      globalThis.env = { SHARED_KEY: 'shared-value' };

      expect(getEnvironmentVariable('SHARED_KEY', 'fallback')).toBe(
        'shared-value',
      );

      globalThis.window = originalWindow;
    });

    it('should not treat falsy values as missing in browser or global env', () => {
      globalThis.process = undefined;
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      const workingWindow = originalWindow || {};
      const originalWindowEnv = workingWindow.env;
      workingWindow.env = { ZERO_PORT: 0, DISABLED: false };
      globalThis.window = workingWindow;
      globalThis.document = originalDocument || {};

      expect(getEnvironmentVariable('ZERO_PORT', 'fallback')).toBe('0');
      expect(getEnvironmentVariable('DISABLED', 'fallback')).toBe('false');

      if (originalWindow === undefined) {
        delete globalThis.window;
      } else {
        workingWindow.env = originalWindowEnv;
        globalThis.window = originalWindow;
      }
      if (originalDocument === undefined) {
        delete globalThis.document;
      } else {
        globalThis.document = originalDocument;
      }

      const originalGlobalEnv = globalThis.env;
      globalThis.env = { ZERO_FLAG: 0, DISABLED_FLAG: false };

      expect(getEnvironmentVariable('ZERO_FLAG', 'fallback')).toBe('0');
      expect(getEnvironmentVariable('DISABLED_FLAG', 'fallback')).toBe(
        'false',
      );

      if (originalGlobalEnv === undefined) {
        delete globalThis.env;
      } else {
        globalThis.env = originalGlobalEnv;
      }
    });
  });

  describe('getEnvironmentMode', () => {
    it('should normalize NODE_ENV', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'prod' },
      };
      expect(getEnvironmentMode()).toBe('production');
    });

    it('should treat testing synonyms as test mode', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'Testing' },
      };

      expect(getEnvironmentMode()).toBe('test');
    });

    it('should prefer explicit test mode flags', () => {
      delete globalThis.process;
      globalThis.__TEST_MODE__ = true;

      expect(getEnvironmentMode()).toBe('test');
    });

    it('falls back to development for unknown values', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'staging' },
      };

      expect(getEnvironmentMode()).toBe('development');
    });
  });

  describe('shouldSkipDebugConfig', () => {
    it('should return true for truthy values', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { SKIP_DEBUG_CONFIG: 'true' },
      };
      expect(shouldSkipDebugConfig()).toBe(true);
    });

    it.each(['1', 'yes', 'on'])('treats %s as truthy', (value) => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { SKIP_DEBUG_CONFIG: value },
      };

      expect(shouldSkipDebugConfig()).toBe(true);
    });

    it.each(['TRUE', 'YeS', '  On  '])(
      'treats %s as truthy ignoring case and whitespace',
      (value) => {
        globalThis.process = {
          versions: { node: '16.0.0' },
          env: { SKIP_DEBUG_CONFIG: value },
        };

        expect(shouldSkipDebugConfig()).toBe(true);
      }
    );

    it('returns false for other values', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { SKIP_DEBUG_CONFIG: 'false' },
      };

      expect(shouldSkipDebugConfig()).toBe(false);
    });

    it('trims whitespace before evaluating falsy values', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { SKIP_DEBUG_CONFIG: '  false  ' },
      };

      expect(shouldSkipDebugConfig()).toBe(false);
    });
  });

  describe('getBooleanEnvironmentVariable', () => {
    it.each(['true', 'TRUE', '  On  ', '1', 'YeS'])(
      'treats %s as a truthy value',
      (rawValue) => {
        globalThis.process = {
          versions: { node: '16.0.0' },
          env: { FEATURE_FLAG: rawValue },
        };

        expect(getBooleanEnvironmentVariable('FEATURE_FLAG')).toBe(true);
      }
    );

    it.each(['false', 'FALSE', '0', 'No', ' off '])(
      'treats %s as a falsy value',
      (rawValue) => {
        globalThis.process = {
          versions: { node: '16.0.0' },
          env: { FEATURE_FLAG: rawValue },
        };

        expect(getBooleanEnvironmentVariable('FEATURE_FLAG', true)).toBe(
          false
        );
      }
    );

    it('returns default when value is missing or empty', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: {},
      };

      expect(getBooleanEnvironmentVariable('FEATURE_FLAG', true)).toBe(true);

      globalThis.process.env.FEATURE_FLAG = '   ';
      expect(getBooleanEnvironmentVariable('FEATURE_FLAG', true)).toBe(true);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return complete config', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'development' },
      };

      const config = getEnvironmentConfig();
      expect(config.environment).toBe('node');
      expect(config.mode).toBe('development');
    });

    it.each(['TRUE', ' yes ', '1', 'On'])(
      'normalizes DEBUG_LOG_SILENT=%s to true',
      (value) => {
        globalThis.process = {
          versions: { node: '16.0.0' },
          env: { NODE_ENV: 'test', DEBUG_LOG_SILENT: value },
        };

        expect(getEnvironmentConfig().debugLogSilent).toBe(true);
      }
    );

    it.each(['FALSE', '0', ' off ', 'No'])(
      'normalizes DEBUG_LOG_SILENT=%s to false',
      (value) => {
        globalThis.process = {
          versions: { node: '16.0.0' },
          env: { NODE_ENV: 'test', DEBUG_LOG_SILENT: value },
        };

        expect(getEnvironmentConfig().debugLogSilent).toBe(false);
      }
    );
  });

  describe('hasEnvironmentVariable', () => {
    it('should return true for existing variable', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { TEST_VAR: 'value' },
      };
      expect(hasEnvironmentVariable('TEST_VAR')).toBe(true);
    });

    it('should return false for empty string', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { TEST_VAR: '' },
      };
      expect(hasEnvironmentVariable('TEST_VAR')).toBe(false);
    });

    it('returns false when environment lookup throws', () => {
      jest
        .spyOn(environmentUtilsModule, 'getEnvironmentVariable')
        .mockImplementation(() => {
          throw new Error('unexpected');
        });

      expect(environmentUtilsModule.hasEnvironmentVariable('BROKEN')).toBe(
        false,
      );
    });
  });

  describe('createProcessEnvShim', () => {
    it('should return real process.env in Node.js', () => {
      const mockEnv = { NODE_ENV: 'test' };
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: mockEnv,
      };

      const result = createProcessEnvShim();
      expect(result).toBe(mockEnv);
    });

    it('should create shim in browser', () => {
      delete globalThis.process;
      globalThis.__NODE_ENV__ = 'production';

      const result = createProcessEnvShim();
      expect(result.NODE_ENV).toBe('production');
    });

    it('populates shim with common environment keys', () => {
      delete globalThis.process;
      globalThis.window = {};
      globalThis.document = {};
      globalThis.__NODE_ENV__ = 'dev';
      globalThis.__DEBUG_LOG_MODE__ = 'trace';
      globalThis.__DEBUG_LOG_SILENT__ = 'true';
      globalThis.__SKIP_DEBUG_CONFIG__ = 'yes';
      globalThis.__PROXY_HOST__ = 'proxy.example';
      globalThis.__PROXY_PORT__ = '443';
      globalThis.__PROXY_USE_HTTPS__ = '1';

      const shim = createProcessEnvShim();

      expect(shim).toMatchObject({
        NODE_ENV: 'dev',
        DEBUG_LOG_MODE: 'trace',
        DEBUG_LOG_SILENT: 'true',
        SKIP_DEBUG_CONFIG: 'yes',
        PROXY_HOST: 'proxy.example',
        PROXY_PORT: '443',
        PROXY_USE_HTTPS: '1',
      });
    });
  });

  describe('isTestEnvironment', () => {
    it('should detect Jest environment', () => {
      globalThis.jest = true;
      expect(isTestEnvironment()).toBe(true);
    });

    it('detects NODE_ENV based test mode', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'test' },
      };

      expect(isTestEnvironment()).toBe(true);
    });
  });

  describe('garbage collection helpers', () => {
    let originalGc;

    beforeEach(() => {
      originalGc = global.gc;
    });

    afterEach(() => {
      global.gc = originalGc;
    });

    it('detects exposed GC and triggers it', () => {
      const gcSpy = jest.fn();
      // eslint-disable-next-line no-global-assign
      global.gc = gcSpy;

      expect(isGarbageCollectionAvailable()).toBe(true);
      expect(triggerGarbageCollection()).toBe(true);
      expect(gcSpy).toHaveBeenCalledTimes(1);
    });

    it('returns false when GC is not available', () => {
      // eslint-disable-next-line no-global-assign
      global.gc = undefined;

      expect(isGarbageCollectionAvailable()).toBe(false);
      expect(triggerGarbageCollection()).toBe(false);
    });
  });

  describe('memory usage helpers', () => {
    it('uses performance.memory data when present', () => {
      globalThis.process = undefined;
      const performanceObject = globalThis.performance ?? {};
      const originalMemory = performanceObject.memory;
      if (!globalThis.performance) {
        globalThis.performance = performanceObject;
      }
      globalThis.performance.memory = {
        usedJSHeapSize: 100,
        totalJSHeapSize: 200,
        jsHeapSizeLimit: 400,
      };

      const usage = getMemoryUsage();

      expect(usage).toEqual({
        heapUsed: 100,
        heapTotal: 200,
        heapLimit: 400,
        external: 0,
      });
      expect(getMemoryUsageBytes()).toBe(100);

      if (originalMemory === undefined) {
        delete globalThis.performance.memory;
      } else {
        globalThis.performance.memory = originalMemory;
      }
    });

    it('falls back to process.memoryUsage in Node.js', () => {
      delete globalThis.performance;
      globalThis.process = {
        versions: { node: '16.0.0' },
        memoryUsage: jest.fn(() => ({
          heapUsed: 256,
          heapTotal: 512,
          external: 128,
        })),
      };

      const usage = getMemoryUsage();

      expect(globalThis.process.memoryUsage).toHaveBeenCalledTimes(1);
      expect(usage).toEqual({
        heapUsed: 256,
        heapTotal: 512,
        heapLimit: 512,
        external: 128,
      });
      expect(getMemoryUsagePercent()).toBeCloseTo(0.5);
    });

    it('returns null when memory usage cannot be determined', () => {
      delete globalThis.performance;
      globalThis.process = { versions: { node: '16.0.0' } };

      expect(getMemoryUsage()).toBeNull();
      expect(getMemoryUsageBytes()).toBe(0);
      expect(getMemoryUsagePercent()).toBe(0);
    });

    it('returns zero percent when heap limit is unavailable', () => {
      delete globalThis.performance;
      globalThis.process = {
        versions: { node: '16.0.0' },
        memoryUsage: () => ({ heapUsed: 123, heapTotal: 0, external: 0 }),
      };

      expect(getMemoryUsagePercent()).toBe(0);
    });
  });
});
