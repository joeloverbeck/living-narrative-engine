/**
 * @file Unit tests for DebugLoggingConfigMerger
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { DebugLoggingConfigMerger } from '../../../../src/logging/config/configMerger.js';
import {
  DEFAULT_CONFIG,
  CONFIG_PRESETS,
  ENV_VAR_MAPPINGS,
} from '../../../../src/logging/config/defaultConfig.js';

describe('DebugLoggingConfigMerger', () => {
  let testBed;
  let merger;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    merger = new DebugLoggingConfigMerger({
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should initialize with valid logger', () => {
      expect(merger).toBeInstanceOf(DebugLoggingConfigMerger);
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new DebugLoggingConfigMerger({
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('mergeConfig', () => {
    it('should return default configuration with no overrides', () => {
      const result = merger.mergeConfig({}, null, {});

      expect(result).toEqual(DEFAULT_CONFIG);
      expect(result).not.toBe(DEFAULT_CONFIG); // Should be a deep clone
    });

    it('should apply preset configuration', () => {
      const result = merger.mergeConfig({}, 'production', {});

      expect(result.mode).toBe('remote');
      expect(result.console.enabled).toBe(false);
      expect(result.categories.engine.level).toBe('warn');
    });

    it('should warn about unknown presets', () => {
      const result = merger.mergeConfig({}, 'unknown-preset', {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown preset requested: unknown-preset'
      );
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should apply configuration overrides', () => {
      const overrides = {
        enabled: false,
        mode: 'test',
        categories: {
          engine: { enabled: false, level: 'error' },
        },
      };

      const result = merger.mergeConfig(overrides, null, {});

      expect(result.enabled).toBe(false);
      expect(result.mode).toBe('test');
      expect(result.categories.engine.enabled).toBe(false);
      expect(result.categories.engine.level).toBe('error');
      // Should preserve other default categories
      expect(result.categories.ui).toEqual(DEFAULT_CONFIG.categories.ui);
    });

    it('should apply environment variable overrides', () => {
      const envVars = {
        DEBUG_LOG_MODE: 'remote',
        DEBUG_LOG_ENABLED: 'false',
        DEBUG_LOG_ENDPOINT: 'http://custom-endpoint:8080/logs',
        DEBUG_LOG_BATCH_SIZE: '200',
        DEBUG_LOG_CONSOLE_COLORS: 'false',
      };

      const result = merger.mergeConfig({}, null, envVars);

      expect(result.mode).toBe('remote');
      expect(result.enabled).toBe(false);
      expect(result.remote.endpoint).toBe('http://custom-endpoint:8080/logs');
      expect(result.remote.batchSize).toBe(200);
      expect(result.console.useColors).toBe(false);
    });

    it('should apply category-specific environment variables', () => {
      const envVars = {
        DEBUG_LOG_CATEGORY_ENGINE_ENABLED: 'false',
        DEBUG_LOG_CATEGORY_ENGINE_LEVEL: 'error',
        DEBUG_LOG_CATEGORY_UI_ENABLED: 'true',
        DEBUG_LOG_CATEGORY_UI_LEVEL: 'debug',
      };

      const result = merger.mergeConfig({}, null, envVars);

      expect(result.categories.engine.enabled).toBe(false);
      expect(result.categories.engine.level).toBe('error');
      expect(result.categories.ui.enabled).toBe(true);
      expect(result.categories.ui.level).toBe('debug');
    });

    it('should skip override merging when overrides are not an object', () => {
      const result = merger.mergeConfig(null, null, {});

      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should treat missing env vars as empty object during merge', () => {
      const result = merger.mergeConfig({}, null, null);

      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should report zero categories when overrides remove them', () => {
      const overrides = { categories: null };

      const result = merger.mergeConfig(overrides, null, {});

      expect(result.categories).toBeNull();
    });

    it('should default to process environment when env vars argument is omitted', () => {
      const savedEnv = {};

      for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }

      try {
        const result = merger.mergeConfig();

        expect(result).toEqual(DEFAULT_CONFIG);
      } finally {
        for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
          if (savedEnv[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = savedEnv[key];
          }
        }
      }
    });

    it('should handle missing environment variables object gracefully', () => {
      const baseConfig = { sample: 'value' };
      const result = merger.applyEnvironmentVariables(baseConfig, null);

      expect(result).toBe(baseConfig);
    });

    it('should create category containers when applying new category environment variables', () => {
      const envVars = {
        DEBUG_LOG_CATEGORY_NEW_FEATURE_ENABLED: 'true',
        DEBUG_LOG_CATEGORY_NEW_FEATURE_LEVEL: 'warn',
        DEBUG_LOG_CATEGORY_NEW_FEATURE_THRESHOLD: 'verbose',
      };

      const result = merger.applyEnvironmentVariables({}, envVars);

      expect(result.categories.new_feature).toEqual({
        enabled: true,
        level: 'warn',
      });
    });

    it('should ignore category environment variables with unsupported suffixes', () => {
      const envVars = {
        DEBUG_LOG_CATEGORY_ENGINE_MODE: 'verbose',
      };

      const result = merger.applyEnvironmentVariables({}, envVars);

      expect(result.categories).toBeUndefined();
    });

    it('should respect precedence: env vars > overrides > preset > defaults', () => {
      const overrides = { mode: 'hybrid' };
      const envVars = { DEBUG_LOG_MODE: 'remote' };

      const result = merger.mergeConfig(overrides, 'development', envVars);

      // Environment variable should win
      expect(result.mode).toBe('remote');

      // Development preset should be applied for other settings
      expect(result.console.showTimestamp).toBe(true);

      // Default values should be preserved where not overridden
      expect(result.enabled).toBe(DEFAULT_CONFIG.enabled);
    });

    it('should handle merge exceptions gracefully', () => {
      // Mock deepMerge to throw an error during merging
      const originalDeepMerge = merger.deepMerge;
      merger.deepMerge = jest.fn(() => {
        throw new Error('Property access error');
      });

      expect(() => {
        merger.mergeConfig({}, null, {});
      }).toThrow('Configuration merge failed: Property access error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during configuration merge',
        expect.any(Error)
      );

      // Restore original method
      merger.deepMerge = originalDeepMerge;
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects deeply', () => {
      const target = {
        a: 1,
        b: {
          c: 2,
          d: 3,
        },
        e: [1, 2, 3],
      };

      const source = {
        a: 10, // Override primitive
        b: {
          c: 20, // Override nested primitive
          f: 4, // Add new nested property
        },
        e: [4, 5], // Replace array
        g: 'new', // Add new property
      };

      const result = merger.deepMerge(target, source);

      expect(result).toEqual({
        a: 10,
        b: {
          c: 20,
          d: 3,
          f: 4,
        },
        e: [4, 5],
        g: 'new',
      });
    });

    it('should handle null and undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: null, b: undefined, c: 3 };

      const result = merger.deepMerge(target, source);

      expect(result.a).toBe(null);
      expect(result.b).toBe(undefined);
      expect(result.c).toBe(3);
    });

    it('should handle arrays by replacing them', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [4, 5] };

      const result = merger.deepMerge(target, source);

      expect(result.items).toEqual([4, 5]);
    });

    it('should ignore inherited properties on the source object', () => {
      const proto = { inherited: 'value' };
      const source = Object.create(proto);
      source.own = 'prop';

      const result = merger.deepMerge({ own: 'original' }, source);

      expect(result.own).toBe('prop');
      expect(result).not.toHaveProperty('inherited');
    });

    it('should return cloned source when target is not an object', () => {
      const result = merger.deepMerge(null, { a: 1 });
      expect(result).toEqual({ a: 1 });

      const result2 = merger.deepMerge(undefined, { b: 2 });
      expect(result2).toEqual({ b: 2 });
    });

    it('should return target when source is not an object', () => {
      const target = { a: 1 };
      const result = merger.deepMerge(target, null);
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('deepClone', () => {
    it('should clone primitives', () => {
      expect(merger.deepClone(42)).toBe(42);
      expect(merger.deepClone('test')).toBe('test');
      expect(merger.deepClone(true)).toBe(true);
      expect(merger.deepClone(null)).toBe(null);
      expect(merger.deepClone(undefined)).toBe(undefined);
    });

    it('should clone arrays', () => {
      const array = [1, 2, { a: 3 }];
      const cloned = merger.deepClone(array);

      expect(cloned).toEqual(array);
      expect(cloned).not.toBe(array);
      expect(cloned[2]).not.toBe(array[2]); // Deep clone of objects in array
    });

    it('should clone dates', () => {
      const date = new Date('2023-01-01');
      const cloned = merger.deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('should clone nested objects', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4, { e: 5 }],
        },
      };

      const cloned = merger.deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
      expect(cloned.b.d[2]).not.toBe(obj.b.d[2]);
    });

    it('should ignore inherited properties when cloning objects', () => {
      const proto = { inherited: 'value' };
      const obj = Object.create(proto);
      obj.own = 'prop';

      const cloned = merger.deepClone(obj);

      expect(cloned).toEqual({ own: 'prop' });
      expect(cloned).not.toHaveProperty('inherited');
    });
  });

  describe('parseEnvironmentValue', () => {
    it('should parse boolean strings', () => {
      expect(merger.parseEnvironmentValue('true')).toBe(true);
      expect(merger.parseEnvironmentValue('false')).toBe(false);
      expect(merger.parseEnvironmentValue('TRUE')).toBe(true);
      expect(merger.parseEnvironmentValue('FALSE')).toBe(false);
      expect(merger.parseEnvironmentValue('  true  ')).toBe(true);
    });

    it('should parse integer strings', () => {
      expect(merger.parseEnvironmentValue('42')).toBe(42);
      expect(merger.parseEnvironmentValue('0')).toBe(0);
      expect(merger.parseEnvironmentValue('  123  ')).toBe(123);
    });

    it('should parse float strings', () => {
      expect(merger.parseEnvironmentValue('3.14')).toBe(3.14);
      expect(merger.parseEnvironmentValue('0.5')).toBe(0.5);
    });

    it('should preserve string values', () => {
      expect(merger.parseEnvironmentValue('hello')).toBe('hello');
      expect(merger.parseEnvironmentValue('true-ish')).toBe('true-ish');
      expect(merger.parseEnvironmentValue('123abc')).toBe('123abc');
    });

    it('should handle non-string input', () => {
      expect(merger.parseEnvironmentValue(42)).toBe(42);
      expect(merger.parseEnvironmentValue(true)).toBe(true);
      expect(merger.parseEnvironmentValue(null)).toBe(null);
    });
  });

  describe('setNestedValue and getNestedValue', () => {
    it('should set and get nested values', () => {
      const obj = {};

      merger.setNestedValue(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ a: { b: { c: 'value' } } });

      const retrieved = merger.getNestedValue(obj, 'a.b.c');
      expect(retrieved).toBe('value');
    });

    it('should handle existing nested structures', () => {
      const obj = { a: { x: 1 } };

      merger.setNestedValue(obj, 'a.b.c', 'value');
      expect(obj.a.x).toBe(1); // Preserve existing
      expect(obj.a.b.c).toBe('value');
    });

    it('should return default value for missing paths', () => {
      const obj = { a: { b: 1 } };

      expect(merger.getNestedValue(obj, 'a.b')).toBe(1);
      expect(merger.getNestedValue(obj, 'a.c')).toBe(undefined);
      expect(merger.getNestedValue(obj, 'a.c', 'default')).toBe('default');
      expect(merger.getNestedValue(obj, 'x.y.z', 'fallback')).toBe('fallback');
    });

    it('should handle null/undefined objects', () => {
      expect(merger.getNestedValue(null, 'a.b', 'default')).toBe('default');
      expect(merger.getNestedValue(undefined, 'a.b', 'default')).toBe(
        'default'
      );
    });
  });

  describe('mergeWithLegacySupport', () => {
    it('should merge with legacy configuration', () => {
      const legacyConfig = {
        logLevel: 'DEBUG',
      };

      const result = merger.mergeWithLegacySupport({}, legacyConfig, null, {});

      expect(result.logLevel).toBe('DEBUG');
      expect(result.enabled).toBe(true);
      expect(result.mode).toBe('development');
    });

    it('should handle legacy NONE log level', () => {
      const legacyConfig = {
        logLevel: 'NONE',
      };

      const result = merger.mergeWithLegacySupport({}, legacyConfig, null, {});

      expect(result.logLevel).toBe('NONE');
      expect(result.enabled).toBe(false);
      expect(result.mode).toBe('none');
    });

    it('should not override existing mode', () => {
      const currentConfig = { mode: 'hybrid' };
      const legacyConfig = { logLevel: 'INFO' };

      const result = merger.mergeWithLegacySupport(
        currentConfig,
        legacyConfig,
        null,
        {}
      );

      expect(result.mode).toBe('hybrid'); // Should preserve existing
      expect(result.logLevel).toBe('INFO');
    });

    it('should skip migration when legacy config lacks log level', () => {
      const currentConfig = { mode: 'development' };
      const legacyConfig = { someOtherSetting: true };

      const result = merger.mergeWithLegacySupport(
        currentConfig,
        legacyConfig,
        null,
        {}
      );

      expect(result).toEqual(
        expect.objectContaining({ mode: 'development', enabled: true })
      );
      expect(result.someOtherSetting).toBeUndefined();
    });

    it('should handle missing legacy config', () => {
      const result = merger.mergeWithLegacySupport(
        { mode: 'test' },
        null,
        null,
        {}
      );

      expect(result.mode).toBe('test');
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Migrating legacy configuration'
      );
    });

    it('should surface errors that occur during legacy configuration merge', () => {
      const originalMergeConfig = merger.mergeConfig;
      merger.mergeConfig = jest.fn(() => {
        throw new Error('merge boom');
      });

      expect(() =>
        merger.mergeWithLegacySupport({}, { logLevel: 'INFO' }, null, {})
      ).toThrow('Legacy configuration merge failed: merge boom');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during legacy configuration merge',
        expect.any(Error)
      );

      merger.mergeConfig = originalMergeConfig;
    });

    it('should use default arguments when called without parameters', () => {
      const result = merger.mergeWithLegacySupport(
        undefined,
        undefined,
        undefined,
        {}
      );

      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should respect process environment defaults when env vars omitted', () => {
      const savedEnv = {};

      for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }

      try {
        const result = merger.mergeWithLegacySupport(
          undefined,
          undefined,
          undefined
        );

        expect(result).toEqual(DEFAULT_CONFIG);
      } finally {
        for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
          if (savedEnv[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = savedEnv[key];
          }
        }
      }
    });
  });

  describe('mergeWithReport', () => {
    it('should generate merge report', () => {
      const overrides = { enabled: false };
      const envVars = { DEBUG_LOG_MODE: 'remote' };

      const report = merger.mergeWithReport(overrides, 'production', envVars);

      expect(report.config.enabled).toBe(false);
      expect(report.config.mode).toBe('remote');
      expect(report.appliedPreset).toBe('production');
      expect(report.appliedOverrides).toEqual(['enabled']);
      expect(report.appliedEnvVars).toContain('DEBUG_LOG_MODE');
      expect(report.warnings).toEqual([]);
    });

    it('should report unknown preset warnings', () => {
      const report = merger.mergeWithReport({}, 'unknown-preset');

      expect(report.appliedPreset).toBe(null);
      expect(report.warnings).toContain('Unknown preset: unknown-preset');
    });

    it('should handle empty inputs', () => {
      const report = merger.mergeWithReport({}, null, {});

      expect(report.appliedPreset).toBe(null);
      expect(report.appliedOverrides).toEqual([]);
      expect(report.appliedEnvVars).toEqual([]);
      expect(report.config).toEqual(DEFAULT_CONFIG);
    });

    it('should handle non-object overrides gracefully in reports', () => {
      const report = merger.mergeWithReport(null, null, null);

      expect(report.appliedOverrides).toEqual([]);
      expect(report.appliedEnvVars).toEqual([]);
      expect(report.config).toEqual(DEFAULT_CONFIG);
    });

    it('should default to process environment when env vars argument is omitted', () => {
      const savedEnv = {};

      for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }

      try {
        const report = merger.mergeWithReport();

        expect(report.appliedEnvVars).toEqual([]);
        expect(report.config).toEqual(DEFAULT_CONFIG);
      } finally {
        for (const key of Object.keys(ENV_VAR_MAPPINGS)) {
          if (savedEnv[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = savedEnv[key];
          }
        }
      }
    });

    it('should log and rethrow errors during report generation', () => {
      const originalMergeConfig = merger.mergeConfig;
      const failure = new Error('report boom');
      merger.mergeConfig = jest.fn(() => {
        throw failure;
      });

      expect(() =>
        merger.mergeWithReport({}, null, { DEBUG_LOG_MODE: 'remote' })
      ).toThrow(failure);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error generating configuration merge report',
        expect.any(Error)
      );

      merger.mergeConfig = originalMergeConfig;
    });
  });
});
