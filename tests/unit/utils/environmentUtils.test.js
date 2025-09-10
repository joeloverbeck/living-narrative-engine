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
  hasEnvironmentVariable,
  createProcessEnvShim,
  isTestEnvironment,
} from '../../../src/utils/environmentUtils.js';

describe('environmentUtils', () => {
  let originalGlobals;

  beforeEach(() => {
    originalGlobals = {
      process: globalThis.process,
      window: globalThis.window,
      jest: globalThis.jest,
      __TEST_MODE__: globalThis.__TEST_MODE__,
    };
  });

  afterEach(() => {
    Object.keys(originalGlobals).forEach((key) => {
      if (originalGlobals[key] !== undefined) {
        globalThis[key] = originalGlobals[key];
      } else {
        delete globalThis[key];
      }
    });
  });

  describe('detectEnvironment', () => {
    it('should detect Node.js environment', () => {
      globalThis.process = { versions: { node: '16.0.0' } };
      expect(detectEnvironment()).toBe('node');
    });

    it('should detect browser environment', () => {
      delete globalThis.process;
      expect(detectEnvironment()).toBe('browser');
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
  });

  describe('getEnvironmentMode', () => {
    it('should normalize NODE_ENV', () => {
      globalThis.process = {
        versions: { node: '16.0.0' },
        env: { NODE_ENV: 'prod' },
      };
      expect(getEnvironmentMode()).toBe('production');
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
  });

  describe('isTestEnvironment', () => {
    it('should detect Jest environment', () => {
      globalThis.jest = true;
      expect(isTestEnvironment()).toBe(true);
    });
  });
});
