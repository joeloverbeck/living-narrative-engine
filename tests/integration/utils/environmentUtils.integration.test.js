import {
  detectEnvironment,
  isNodeEnvironment,
  isBrowserEnvironment,
  isTestEnvironment,
  getEnvironmentVariable,
  getEnvironmentMode,
  shouldSkipDebugConfig,
  getEnvironmentConfig,
  hasEnvironmentVariable,
  createProcessEnvShim,
  isGarbageCollectionAvailable,
  triggerGarbageCollection,
  getMemoryUsage,
  getMemoryUsageBytes,
  getMemoryUsagePercent,
} from '../../../src/utils/environmentUtils.js';
import { createBootstrapLogger, resolveBootstrapLogLevel } from '../../../src/logging/bootstrapLogger.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';

const originalDescriptors = {
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  importScripts: Object.getOwnPropertyDescriptor(globalThis, 'importScripts'),
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  performance: Object.getOwnPropertyDescriptor(globalThis, 'performance'),
  env: Object.getOwnPropertyDescriptor(globalThis, 'env'),
};
const originalProcess = global.process;
const originalNodeVersion = process.versions?.node;
const originalGlobalFlags = {
  jest: globalThis.jest,
  __TEST_MODE__: globalThis.__TEST_MODE__,
};
const originalGc = global.gc;
const processEnvSnapshot = { ...process.env };

function restoreDescriptor(key) {
  const descriptor = originalDescriptors[key];
  if (descriptor) {
    Object.defineProperty(globalThis, key, descriptor);
  } else {
    delete globalThis[key];
  }
}

function setGlobalValue(key, value) {
  try {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  } catch {
    try {
      globalThis[key] = value;
    } catch {
      // Ignore if property cannot be reassigned (e.g., non-writable window)
    }
  }
}

afterEach(() => {
  global.process = originalProcess;
  if (originalNodeVersion !== undefined) {
    Object.defineProperty(process.versions, 'node', {
      configurable: true,
      value: originalNodeVersion,
    });
  }

  restoreDescriptor('window');
  restoreDescriptor('document');
  restoreDescriptor('importScripts');
  restoreDescriptor('navigator');
  restoreDescriptor('performance');
  restoreDescriptor('env');

  if (originalGlobalFlags.jest === undefined) {
    delete globalThis.jest;
  } else {
    globalThis.jest = originalGlobalFlags.jest;
  }
  if (originalGlobalFlags.__TEST_MODE__ === undefined) {
    delete globalThis.__TEST_MODE__;
  } else {
    globalThis.__TEST_MODE__ = originalGlobalFlags.__TEST_MODE__;
  }

  if (originalGc) {
    global.gc = originalGc;
  } else {
    delete global.gc;
  }

  for (const key of Object.keys(process.env)) {
    if (!(key in processEnvSnapshot)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, processEnvSnapshot);
});

describe('environmentUtils integration behavior', () => {
  describe('environment detection across execution contexts', () => {
    it('detects the active Node.js + Jest environment', () => {
      expect(detectEnvironment()).toBe('node');
      expect(isNodeEnvironment()).toBe(true);
      expect(isBrowserEnvironment()).toBe(false);
      expect(isTestEnvironment()).toBe(true);
    });

    it('detects browser-like globals while ignoring Node specific structures', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousEnv = globalThis.window?.env;
      delete process.env.FEATURE_FLAG;
      if (typeof window !== 'undefined') {
        window.env = { FEATURE_FLAG: 'enabled' };
      }

      expect(detectEnvironment()).toBe('browser');
      expect(isNodeEnvironment()).toBe(false);
      expect(isBrowserEnvironment()).toBe(true);
      expect(getEnvironmentVariable('FEATURE_FLAG', 'disabled')).toBe('enabled');

      if (typeof window !== 'undefined') {
        if (previousEnv === undefined) {
          delete window.env;
        } else {
          window.env = previousEnv;
        }
      }
    });

    it('falls back to web worker detection when importScripts is available', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousInternalDocument =
        typeof window !== 'undefined' ? window._document : undefined;
      if (typeof window !== 'undefined') {
        window._document = undefined;
      }
      setGlobalValue('importScripts', () => {});
      setGlobalValue('navigator', {});

      expect(typeof document).toBe('undefined');
      expect(typeof importScripts).toBe('function');

      expect(detectEnvironment()).toBe('webworker');
      expect(isNodeEnvironment()).toBe(false);
      expect(isBrowserEnvironment()).toBe(false);

      if (typeof window !== 'undefined') {
        window._document = previousInternalDocument;
      }
    });

    it('returns unknown when no environment markers are present', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousInternalDocument =
        typeof window !== 'undefined' ? window._document : undefined;
      if (typeof window !== 'undefined') {
        window._document = undefined;
      }
      setGlobalValue('importScripts', undefined);
      setGlobalValue('navigator', undefined);

      expect(typeof document).toBe('undefined');
      expect(typeof importScripts).toBe('undefined');

      expect(detectEnvironment()).toBe('unknown');

      if (typeof window !== 'undefined') {
        window._document = previousInternalDocument;
      }
    });
  });

  describe('environment variable sourcing hierarchy', () => {
    it('prefers process.env values when present', () => {
      process.env.TEST_PRIMARY_SOURCE = 'process-value';
      globalThis.__TEST_PRIMARY_SOURCE__ = 'global-value';
      Object.defineProperty(globalThis, 'env', {
        configurable: true,
        value: { TEST_PRIMARY_SOURCE: 'env-object-value' },
      });

      expect(getEnvironmentVariable('TEST_PRIMARY_SOURCE', 'fallback')).toBe(
        'process-value'
      );
    });

    it('resolves build-time globals and environment shims', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      delete process.env.TEST_BUILD_FLAG;
      globalThis.__TEST_BUILD_FLAG__ = 42;

      expect(getEnvironmentVariable('TEST_BUILD_FLAG', 'not-set')).toBe('42');

      delete globalThis.__TEST_BUILD_FLAG__;
      const previousEnv = window?.env;
      if (typeof window !== 'undefined') {
        window.env = { TEST_BUILD_FLAG: 'from-window' };
      }

      expect(getEnvironmentVariable('TEST_BUILD_FLAG', 'not-set')).toBe(
        'from-window'
      );

      if (typeof window !== 'undefined') {
        if (previousEnv === undefined) {
          delete window.env;
        } else {
          window.env = previousEnv;
        }
      }

      Object.defineProperty(globalThis, 'env', {
        configurable: true,
        value: { TEST_FALLBACK_FLAG: 'from-global-env' },
      });

      expect(getEnvironmentVariable('TEST_FALLBACK_FLAG', 'not-set')).toBe(
        'from-global-env'
      );
    });

    it('handles getters that throw when checking for variable presence', () => {
      Object.defineProperty(globalThis, 'env', {
        configurable: true,
        get() {
          throw new Error('boom');
        },
      });

      expect(hasEnvironmentVariable('ANYTHING')).toBe(false);
    });
  });

  describe('environment mode resolution and derived config', () => {
    it('treats jest execution as test mode regardless of NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      globalThis.jest = globalThis.jest || {};
      expect(getEnvironmentMode()).toBe('test');
    });

    it('derives production and development modes when outside of Jest', () => {
      const originalJest = globalThis.jest;
      delete globalThis.jest;

      process.env.NODE_ENV = 'production';
      expect(getEnvironmentMode()).toBe('production');

      process.env.NODE_ENV = 'DEV';
      expect(getEnvironmentMode()).toBe('development');

      if (originalJest !== undefined) {
        globalThis.jest = originalJest;
      }
    });

    it('produces a comprehensive environment config snapshot', () => {
      process.env.NODE_ENV = 'development';
      process.env.SKIP_DEBUG_CONFIG = 'yes';
      process.env.DEBUG_LOG_MODE = 'warn';
      process.env.DEBUG_LOG_SILENT = 'false';
      globalThis.jest = globalThis.jest || {};

      const config = getEnvironmentConfig();

      expect(config.environment).toBe('node');
      expect(config.mode).toBe('test');
      expect(config.isNode).toBe(true);
      expect(config.isBrowser).toBe(false);
      expect(config.skipDebugConfig).toBe(true);
      expect(config.debugLogMode).toBe('warn');
      expect(config.debugLogSilent).toBe(false);
    });

    it('evaluates skip debug configuration flag against multiple truthy values', () => {
      process.env.SKIP_DEBUG_CONFIG = 'on';
      expect(shouldSkipDebugConfig()).toBe(true);

      process.env.SKIP_DEBUG_CONFIG = '0';
      expect(shouldSkipDebugConfig()).toBe(false);
    });
  });

  describe('process env shim and garbage collection helpers', () => {
    it('returns actual process.env when running under Node', () => {
      const shim = createProcessEnvShim();
      shim.UNIQUE_KEY_FOR_TEST = 'value-from-shim';
      expect(process.env.UNIQUE_KEY_FOR_TEST).toBe('value-from-shim');
    });

    it('creates a safe shim when process env is unavailable', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousInternalDocument =
        typeof window !== 'undefined' ? window._document : undefined;
      if (typeof window !== 'undefined') {
        window._document = undefined;
      }

      const shim = createProcessEnvShim();
      expect(shim).toMatchObject({
        NODE_ENV: '',
        DEBUG_LOG_MODE: '',
        DEBUG_LOG_SILENT: '',
        SKIP_DEBUG_CONFIG: '',
      });

      if (typeof window !== 'undefined') {
        window._document = previousInternalDocument;
      }
    });

    it('reports garbage collection availability and triggers collection when possible', () => {
      let gcCalled = false;
      global.gc = () => {
        gcCalled = true;
      };

      expect(isGarbageCollectionAvailable()).toBe(true);
      expect(triggerGarbageCollection()).toBe(true);
      expect(gcCalled).toBe(true);
    });
  });

  describe('memory usage helpers and instrumentation consumers', () => {
    it('exposes browser memory statistics when available', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousInternalDocument =
        typeof window !== 'undefined' ? window._document : undefined;
      if (typeof window !== 'undefined') {
        window._document = undefined;
      }
      setGlobalValue('performance', {
        memory: {
          usedJSHeapSize: 10,
          totalJSHeapSize: 20,
          jsHeapSizeLimit: 40,
        },
      });

      const usage = getMemoryUsage();
      expect(usage).toEqual({
        heapUsed: 10,
        heapTotal: 20,
        heapLimit: 40,
        external: 0,
      });
      expect(getMemoryUsageBytes()).toBe(10);
      expect(getMemoryUsagePercent()).toBe(0.25);

      if (typeof window !== 'undefined') {
        window._document = previousInternalDocument;
      }
    });

    it('reads memory usage from process when running under Node', () => {
      const originalMemoryUsage = process.memoryUsage;
      const originalBinding = process.binding;
      process.memoryUsage = () => ({
        heapUsed: 100,
        heapTotal: 400,
        external: 50,
      });
      process.binding = jest.fn(() => ({
        getHeapStatistics: () => ({ heap_size_limit: 800 }),
      }));

      const usage = getMemoryUsage();
      expect(usage).toEqual({
        heapUsed: 100,
        heapTotal: 400,
        heapLimit: 800,
        external: 50,
      });
      expect(getMemoryUsageBytes()).toBe(100);
      expect(getMemoryUsagePercent()).toBeCloseTo(0.125);

      process.memoryUsage = originalMemoryUsage;
      process.binding = originalBinding;
    });

    it('returns zeroed metrics when no memory information is available', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousInternalDocument =
        typeof window !== 'undefined' ? window._document : undefined;
      if (typeof window !== 'undefined') {
        window._document = undefined;
      }
      setGlobalValue('performance', undefined);

      expect(getMemoryUsage()).toBeNull();
      expect(getMemoryUsageBytes()).toBe(0);
      expect(getMemoryUsagePercent()).toBe(0);

      if (typeof window !== 'undefined') {
        window._document = previousInternalDocument;
      }
    });
  });

  describe('downstream consumers honor resolved environment state', () => {
    it('creates bootstrap loggers that respect environment controlled log levels', () => {
      process.env.DEBUG_LOG_LEVEL = 'warn';
      const logger = createBootstrapLogger();

      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('warn message');

      debugSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('resolves bootstrap log level using window injected environment variables', () => {
      Object.defineProperty(process.versions, 'node', {
        configurable: true,
        value: undefined,
      });
      const previousEnv = window?.env;
      if (typeof window !== 'undefined') {
        window.env = { DEBUG_LOG_MODE: 'error' };
      }

      const level = resolveBootstrapLogLevel();
      expect(level).toBe(LogLevel.ERROR);

      if (typeof window !== 'undefined') {
        if (previousEnv === undefined) {
          delete window.env;
        } else {
          window.env = previousEnv;
        }
      }
    });
  });
});
