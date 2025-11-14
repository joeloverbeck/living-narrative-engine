/**
 * @file Unit tests for debug logging default configuration
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_CONFIG,
  CONFIG_PRESETS,
  migrateOldConfig,
  ENV_VAR_MAPPINGS,
} from '../../../../src/logging/config/defaultConfig.js';

describe('Default Configuration', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have required top-level properties', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('enabled');
      expect(DEFAULT_CONFIG).toHaveProperty('mode');
      expect(DEFAULT_CONFIG).toHaveProperty('remote');
      expect(DEFAULT_CONFIG).toHaveProperty('categories');
      expect(DEFAULT_CONFIG).toHaveProperty('console');
      expect(DEFAULT_CONFIG).toHaveProperty('performance');
    });

    it('should have valid enabled property', () => {
      expect(typeof DEFAULT_CONFIG.enabled).toBe('boolean');
      expect(DEFAULT_CONFIG.enabled).toBe(true);
    });

    it('should have valid mode', () => {
      expect(typeof DEFAULT_CONFIG.mode).toBe('string');
      expect([
        'console',
        'remote',
        'hybrid',
        'test',
        'none',
        'development',
        'production',
      ]).toContain(DEFAULT_CONFIG.mode);
    });

    it('should have complete remote configuration', () => {
      const remote = DEFAULT_CONFIG.remote;
      expect(remote).toHaveProperty('endpoint');
      expect(remote).toHaveProperty('batchSize');
      expect(remote).toHaveProperty('flushInterval');
      expect(remote).toHaveProperty('retryAttempts');
      expect(remote).toHaveProperty('circuitBreakerThreshold');

      expect(typeof remote.endpoint).toBe('string');
      expect(typeof remote.batchSize).toBe('number');
      expect(typeof remote.flushInterval).toBe('number');
      expect(typeof remote.retryAttempts).toBe('number');
      expect(typeof remote.circuitBreakerThreshold).toBe('number');

      expect(remote.batchSize).toBeGreaterThan(0);
      expect(remote.flushInterval).toBeGreaterThan(0);
      expect(remote.retryAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should have comprehensive categories', () => {
      const categories = DEFAULT_CONFIG.categories;

      // Check for expected categories
      const expectedCategories = [
        'engine',
        'ui',
        'ecs',
        'ai',
        'persistence',
        'anatomy',
        'actions',
        'turns',
        'events',
        'validation',
        'general',
        'entities',
        'llm',
      ];

      expectedCategories.forEach((category) => {
        expect(categories).toHaveProperty(category);
        expect(categories[category]).toHaveProperty('enabled');
        expect(categories[category]).toHaveProperty('level');
        expect(typeof categories[category].enabled).toBe('boolean');
        expect(typeof categories[category].level).toBe('string');
        expect(['debug', 'info', 'warn', 'error', 'none']).toContain(
          categories[category].level
        );
      });
    });

    it('should have valid console configuration', () => {
      const console = DEFAULT_CONFIG.console;
      expect(console).toHaveProperty('enabled');
      expect(console).toHaveProperty('useColors');
      expect(console).toHaveProperty('showTimestamp');
      expect(console).toHaveProperty('showCategory');
      expect(console).toHaveProperty('groupSimilar');

      expect(typeof console.enabled).toBe('boolean');
      expect(typeof console.useColors).toBe('boolean');
      expect(typeof console.showTimestamp).toBe('boolean');
      expect(typeof console.showCategory).toBe('boolean');
      expect(typeof console.groupSimilar).toBe('boolean');
    });

    it('should have valid performance configuration', () => {
      const performance = DEFAULT_CONFIG.performance;
      expect(performance).toHaveProperty('enableMetrics');
      expect(performance).toHaveProperty('metricsInterval');
      expect(performance).toHaveProperty('memoryWarningThreshold');
      expect(performance).toHaveProperty('slowLogThreshold');

      expect(typeof performance.enableMetrics).toBe('boolean');
      expect(typeof performance.metricsInterval).toBe('number');
      expect(typeof performance.memoryWarningThreshold).toBe('number');
      expect(typeof performance.slowLogThreshold).toBe('number');

      expect(performance.metricsInterval).toBeGreaterThan(0);
      expect(performance.memoryWarningThreshold).toBeGreaterThan(0);
      expect(performance.slowLogThreshold).toBeGreaterThan(0);
    });
  });

  describe('CONFIG_PRESETS', () => {
    it('should contain expected presets', () => {
      const expectedPresets = [
        'production',
        'development',
        'test',
        'debugging',
        'silent',
      ];
      expectedPresets.forEach((preset) => {
        expect(CONFIG_PRESETS).toHaveProperty(preset);
        expect(typeof CONFIG_PRESETS[preset]).toBe('object');
      });
    });

    describe('production preset', () => {
      const production = CONFIG_PRESETS.production;

      it('should be optimized for production', () => {
        expect(production.mode).toBe('remote');
        expect(production.fallbackToConsole).toBe(false);
        expect(production.console.enabled).toBe(false);
        expect(production.logLevel).toBe('WARN');
      });

      it('should have warn/error levels for categories', () => {
        Object.values(production.categories).forEach((category) => {
          expect(['warn', 'error']).toContain(category.level);
        });
      });

      it('should have production-optimized remote settings', () => {
        expect(production.remote.batchSize).toBeLessThanOrEqual(
          DEFAULT_CONFIG.remote.batchSize
        );
        expect(production.remote.flushInterval).toBeGreaterThanOrEqual(
          DEFAULT_CONFIG.remote.flushInterval
        );
        expect(production.remote.retryAttempts).toBeGreaterThanOrEqual(
          DEFAULT_CONFIG.remote.retryAttempts
        );
      });
    });

    describe('development preset', () => {
      const development = CONFIG_PRESETS.development;

      it('should be optimized for development', () => {
        expect(development.mode).toBe('hybrid');
        expect(development.console.enabled).toBe(true);
        expect(development.console.showTimestamp).toBe(true);
        expect(development.logLevel).toBe('INFO'); // Changed from DEBUG to prevent console overload
      });

      it('should have info levels for most categories', () => {
        // Development now uses INFO by default with namespace-based debug logging
        const infoCategories = Object.values(development.categories).filter(
          (cat) => cat.level === 'info'
        );
        expect(infoCategories.length).toBeGreaterThan(5);
      });

      it('should have debugNamespaces configuration', () => {
        expect(development.debugNamespaces).toBeDefined();
        expect(development.debugNamespaces.enabled).toBeInstanceOf(Set);
        expect(development.debugNamespaces.global).toBe(false);
      });
    });

    describe('test preset', () => {
      const test = CONFIG_PRESETS.test;

      it('should disable most logging for tests', () => {
        expect(test.mode).toBe('test');
        expect(test.enabled).toBe(false);
        expect(test.console.enabled).toBe(false);
      });

      it('should disable most categories', () => {
        const enabledCategories = Object.values(test.categories).filter(
          (cat) => cat.enabled
        );
        expect(enabledCategories.length).toBeLessThanOrEqual(2);
      });
    });

    describe('debugging preset', () => {
      const debugging = CONFIG_PRESETS.debugging;

      it('should enable everything for debugging', () => {
        expect(debugging.mode).toBe('hybrid');
        expect(debugging.console.enabled).toBe(true);
        expect(debugging.console.groupSimilar).toBe(false);
      });

      it('should have debug level for all categories', () => {
        Object.values(debugging.categories).forEach((category) => {
          expect(category.level).toBe('debug');
          expect(category.enabled).toBe(true);
        });
      });

      it('should have sensitive performance monitoring', () => {
        expect(debugging.performance.slowLogThreshold).toBeLessThan(
          DEFAULT_CONFIG.performance.slowLogThreshold
        );
      });
    });

    describe('silent preset', () => {
      const silent = CONFIG_PRESETS.silent;

      it('should disable all logging', () => {
        expect(silent.mode).toBe('none');
        expect(silent.enabled).toBe(false);
        expect(silent.console.enabled).toBe(false);
        expect(silent.performance.enableMetrics).toBe(false);
      });

      it('should disable all categories', () => {
        Object.values(silent.categories).forEach((category) => {
          expect(category.enabled).toBe(false);
          expect(category.level).toBe('none');
        });
      });
    });
  });

  describe('migrateOldConfig', () => {
    it('should return default config for null input', () => {
      const result = migrateOldConfig(null);
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should return default config for undefined input', () => {
      const result = migrateOldConfig(undefined);
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should return default config for non-object input', () => {
      const result = migrateOldConfig('invalid');
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should migrate logLevel to new format', () => {
      const oldConfig = { logLevel: 'DEBUG' };
      const result = migrateOldConfig(oldConfig);

      expect(result.enabled).toBe(true);
      expect(result.mode).toBe('console');
      expect(result.logLevel).toBe('DEBUG');
      expect(result.categories.general).toEqual({
        enabled: true,
        level: 'debug',
      });
    });

    it('should handle NONE logLevel', () => {
      const oldConfig = { logLevel: 'NONE' };
      const result = migrateOldConfig(oldConfig);

      expect(result.enabled).toBe(false);
      expect(result.mode).toBe('none');
      expect(result.logLevel).toBe('NONE');
    });

    it('should not create categories for NONE logLevel', () => {
      const oldConfig = { logLevel: 'NONE' };
      const result = migrateOldConfig(oldConfig);

      expect(result.categories).toBeUndefined();
    });

    it('should handle missing logLevel gracefully', () => {
      const oldConfig = { someOtherProperty: 'value' };
      const result = migrateOldConfig(oldConfig);

      expect(result.enabled).toBe(true);
      expect(result.mode).toBe('console');
      expect(result.fallbackToConsole).toBe(true);
    });
  });

  describe('ENV_VAR_MAPPINGS', () => {
    it('should have valid environment variable mappings', () => {
      expect(typeof ENV_VAR_MAPPINGS).toBe('object');
      expect(Object.keys(ENV_VAR_MAPPINGS).length).toBeGreaterThan(0);
    });

    it('should map to valid configuration paths', () => {
      const validPaths = [
        'enabled',
        'mode',
        'logLevel',
        'remote.endpoint',
        'remote.batchSize',
        'remote.flushInterval',
        'remote.retryAttempts',
        'remote.circuitBreakerThreshold',
        'remote.requestTimeout',
        'console.enabled',
        'console.useColors',
        'console.showTimestamp',
        'console.showCategory',
        'performance.enableMetrics',
        'performance.slowLogThreshold',
        'criticalLogging.soundEnabled',
        'criticalLogging.minimumLevel',
        'debugNamespaces', // Namespace-based debug logging
      ];

      Object.values(ENV_VAR_MAPPINGS).forEach((path) => {
        expect(validPaths).toContain(path);
      });
    });

    it('should have DEBUG_LOG prefix for all variables except DEBUG_NAMESPACES', () => {
      Object.keys(ENV_VAR_MAPPINGS).forEach((envVar) => {
        // DEBUG_NAMESPACES is an exception - it's a legacy/alternative prefix for namespace control
        if (envVar === 'DEBUG_NAMESPACES') {
          expect(envVar).toBe('DEBUG_NAMESPACES');
        } else {
          expect(envVar.startsWith('DEBUG_LOG_')).toBe(true);
        }
      });
    });

    it('should include essential configuration mappings', () => {
      expect(ENV_VAR_MAPPINGS).toHaveProperty('DEBUG_LOG_ENABLED');
      expect(ENV_VAR_MAPPINGS).toHaveProperty('DEBUG_LOG_MODE');
      expect(ENV_VAR_MAPPINGS).toHaveProperty('DEBUG_LOG_ENDPOINT');
      expect(ENV_VAR_MAPPINGS).toHaveProperty('DEBUG_LOG_LEVEL');
    });
  });

  describe('Configuration consistency', () => {
    it('should have consistent category structure across presets', () => {
      const defaultCategories = Object.keys(DEFAULT_CONFIG.categories);

      Object.entries(CONFIG_PRESETS).forEach(([presetName, preset]) => {
        if (preset.categories) {
          const presetCategories = Object.keys(preset.categories);

          // All categories in preset should exist in default
          presetCategories.forEach((category) => {
            expect(defaultCategories).toContain(category);
          });
        }
      });
    });

    it('should have valid remote configuration in presets', () => {
      Object.entries(CONFIG_PRESETS).forEach(([presetName, preset]) => {
        if (preset.remote) {
          if (preset.remote.batchSize !== undefined) {
            expect(typeof preset.remote.batchSize).toBe('number');
            expect(preset.remote.batchSize).toBeGreaterThan(0);
          }
          if (preset.remote.flushInterval !== undefined) {
            expect(typeof preset.remote.flushInterval).toBe('number');
            expect(preset.remote.flushInterval).toBeGreaterThan(0);
          }
        }
      });
    });

    it('should have valid modes in presets', () => {
      const validModes = [
        'console',
        'remote',
        'hybrid',
        'test',
        'none',
        'development',
        'production',
      ];

      Object.entries(CONFIG_PRESETS).forEach(([presetName, preset]) => {
        if (preset.mode) {
          expect(validModes).toContain(preset.mode);
        }
      });
    });
  });
});
