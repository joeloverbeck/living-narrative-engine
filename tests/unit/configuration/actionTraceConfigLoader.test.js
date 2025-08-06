/**
 * @file Unit tests for ActionTraceConfigLoader
 * @see src/configuration/actionTraceConfigLoader.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';

describe('ActionTraceConfigLoader', () => {
  let loader;
  let mockTraceConfigLoader;
  let mockLogger;
  let mockValidator;

  beforeEach(() => {
    // Reset mocks
    mockTraceConfigLoader = {
      loadConfig: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    mockValidator = {
      validate: jest.fn(),
    };

    loader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: mockLogger,
      validator: mockValidator,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(
        () =>
          new ActionTraceConfigLoader({
            traceConfigLoader: null,
            logger: mockLogger,
            validator: mockValidator,
          })
      ).toThrow();

      expect(
        () =>
          new ActionTraceConfigLoader({
            traceConfigLoader: mockTraceConfigLoader,
            logger: null,
            validator: mockValidator,
          })
      ).toThrow();

      expect(
        () =>
          new ActionTraceConfigLoader({
            traceConfigLoader: mockTraceConfigLoader,
            logger: mockLogger,
            validator: null,
          })
      ).toThrow();
    });
  });

  describe('loadConfig', () => {
    it('should load action tracing configuration from trace config', async () => {
      const mockConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces/actions',
          verbosity: 'detailed',
          includeComponentData: false,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 50,
          rotationPolicy: 'count',
          maxFileAge: 7200,
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const config = await loader.loadConfig();

      expect(config).toEqual(mockConfig.actionTracing);
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalled();
      expect(mockValidator.validate).toHaveBeenCalledWith(
        'action-trace-config',
        { actionTracing: mockConfig.actionTracing }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Action tracing configuration loaded',
        expect.objectContaining({
          enabled: true,
          tracedActionsCount: 1,
          outputDirectory: './traces/actions',
        })
      );
    });

    it('should return defaults when actionTracing section is missing', async () => {
      const mockConfig = {
        traceAnalysisEnabled: false,
        // No actionTracing section
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const config = await loader.loadConfig();

      expect(config.enabled).toBe(false);
      expect(config.tracedActions).toEqual([]);
      expect(config.outputDirectory).toBe('./traces/actions');
      expect(config.verbosity).toBe('standard');
      expect(config.includeComponentData).toBe(true);
      expect(config.maxTraceFiles).toBe(100);
      expect(config.rotationPolicy).toBe('age');
      expect(config.maxFileAge).toBe(86400);
    });

    it('should handle error results from TraceConfigLoader', async () => {
      const errorResult = {
        error: true,
        message: 'Failed to load config',
        stage: 'fetch',
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(errorResult);

      const config = await loader.loadConfig();

      expect(config).toEqual(
        expect.objectContaining({
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces/actions',
        })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load trace configuration, using defaults',
        errorResult
      );
    });

    it('should cache configuration after first load', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          outputDirectory: './traces',
          verbosity: 'verbose',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const config1 = await loader.loadConfig();
      const config2 = await loader.loadConfig();

      expect(config1).toBe(config2); // Same reference
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors gracefully', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: 'invalid', // Should be boolean
          tracedActions: 'invalid', // Should be array
          outputDirectory: './traces',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errors: [{ message: 'Invalid type for enabled' }],
      });

      const config = await loader.loadConfig();

      expect(config).toEqual(
        expect.objectContaining({
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces/actions',
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid action tracing configuration, using defaults',
        expect.objectContaining({
          errors: [{ message: 'Invalid type for enabled' }],
        })
      );
    });

    it('should handle exceptions gracefully', async () => {
      const error = new Error('Unexpected error');
      mockTraceConfigLoader.loadConfig.mockRejectedValue(error);

      const config = await loader.loadConfig();

      expect(config).toEqual(
        expect.objectContaining({
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces/actions',
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load action tracing configuration',
        error
      );
    });
  });

  describe('reloadConfig', () => {
    it('should clear cache and reload configuration', async () => {
      const mockConfig1 = {
        actionTracing: {
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces1',
        },
      };

      const mockConfig2 = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*'],
          outputDirectory: './traces2',
        },
      };

      mockValidator.validate.mockResolvedValue({ isValid: true });
      mockTraceConfigLoader.loadConfig
        .mockResolvedValueOnce(mockConfig1)
        .mockResolvedValueOnce(mockConfig2);

      const config1 = await loader.loadConfig();
      expect(config1.outputDirectory).toBe('./traces1');

      const config2 = await loader.reloadConfig();
      expect(config2.outputDirectory).toBe('./traces2');
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('isEnabled', () => {
    it('should return true when action tracing is enabled', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const enabled = await loader.isEnabled();
      expect(enabled).toBe(true);
    });

    it('should return false when action tracing is disabled', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const enabled = await loader.isEnabled();
      expect(enabled).toBe(false);
    });

    it('should return false when configuration is missing', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({});
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const enabled = await loader.isEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe('getConfigValue', () => {
    it('should return specific configuration value', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack'],
          outputDirectory: './custom-traces',
          verbosity: 'minimal',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const verbosity = await loader.getConfigValue('verbosity');
      expect(verbosity).toBe('minimal');

      const outputDir = await loader.getConfigValue('outputDirectory');
      expect(outputDir).toBe('./custom-traces');

      const tracedActions = await loader.getConfigValue('tracedActions');
      expect(tracedActions).toEqual(['core:go', 'core:attack']);
    });
  });

  describe('shouldTraceAction', () => {
    it('should return false when tracing is disabled', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: false,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const shouldTrace = await loader.shouldTraceAction('core:go');
      expect(shouldTrace).toBe(false);
    });

    it('should match exact action IDs', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('core:go')).toBe(true);
      expect(await loader.shouldTraceAction('core:attack')).toBe(true);
      expect(await loader.shouldTraceAction('core:examine')).toBe(false);
      expect(await loader.shouldTraceAction('custom:action')).toBe(false);
    });

    it('should match wildcard pattern *', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('core:go')).toBe(true);
      expect(await loader.shouldTraceAction('custom:action')).toBe(true);
      expect(await loader.shouldTraceAction('any:thing')).toBe(true);
    });

    it('should match mod-specific wildcards', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*', 'custom:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('core:go')).toBe(true);
      expect(await loader.shouldTraceAction('core:attack')).toBe(true);
      expect(await loader.shouldTraceAction('custom:action')).toBe(true);
      expect(await loader.shouldTraceAction('custom:other')).toBe(true);
      expect(await loader.shouldTraceAction('different:action')).toBe(false);
    });

    it('should handle mixed patterns', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'custom:*', 'specific:action'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('core:go')).toBe(true);
      expect(await loader.shouldTraceAction('core:attack')).toBe(false);
      expect(await loader.shouldTraceAction('custom:anything')).toBe(true);
      expect(await loader.shouldTraceAction('specific:action')).toBe(true);
      expect(await loader.shouldTraceAction('specific:other')).toBe(false);
    });
  });

  describe('Performance Optimizations', () => {
    it('should use O(1) exact matching with Set', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack', 'core:examine'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load config to build optimized structures
      await loader.loadConfig();

      // Test that exact matches are fast
      const start = performance.now();
      const result = await loader.shouldTraceAction('core:go');
      const duration = performance.now() - start;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(1); // <1ms requirement
    });

    it('should provide verbosity configuration methods', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'detailed',
          includeComponentData: false,
          includePrerequisites: true,
          includeTargets: false,
          outputDirectory: './traces',
          rotationPolicy: 'count',
          maxTraceFiles: 50,
          maxFileAge: 3600,
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.getVerbosityLevel()).toBe('detailed');

      const inclusion = await loader.getInclusionConfig();
      expect(inclusion).toEqual({
        includeComponentData: false,
        includePrerequisites: true,
        includeTargets: false,
      });

      expect(await loader.getOutputDirectory()).toBe('./traces');

      const rotation = await loader.getRotationConfig();
      expect(rotation).toEqual({
        rotationPolicy: 'count',
        maxTraceFiles: 50,
        maxFileAge: 3600,
      });
    });

    it('should provide performance statistics', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'custom:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load config and perform some lookups
      await loader.loadConfig();
      await loader.shouldTraceAction('core:go'); // exact match
      await loader.shouldTraceAction('custom:action'); // wildcard match
      await loader.shouldTraceAction('nonexistent:action'); // no match

      const stats = loader.getStatistics();
      expect(stats).toHaveProperty('exactMatches');
      expect(stats).toHaveProperty('wildcardMatches');
      expect(stats).toHaveProperty('totalLookups');
      expect(stats).toHaveProperty('averageLookupTime');
      expect(stats).toHaveProperty('tracedActionsCount');
      expect(stats).toHaveProperty('wildcardPatternsCount');

      expect(stats.exactMatches).toBe(1);
      expect(stats.wildcardMatches).toBe(1);
      expect(stats.totalLookups).toBe(3);
      expect(stats.tracedActionsCount).toBe(1); // 'core:go'
      expect(stats.wildcardPatternsCount).toBe(1); // 'custom:*'
    });

    it('should filter data by verbosity level', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'detailed',
          includeComponentData: true,
          includePrerequisites: false,
          includeTargets: true,
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const data = {
        timestamp: Date.now(),
        actionId: 'core:go',
        result: 'success',
        executionTime: 150,
        success: true,
        componentData: { some: 'data' },
        prerequisites: { prereq: 'info' },
        targets: { target: 'info' },
        debugInfo: { debug: 'info' },
        stackTrace: 'stack trace',
      };

      const filtered = await loader.filterDataByVerbosity(data);

      expect(filtered).toHaveProperty('timestamp');
      expect(filtered).toHaveProperty('actionId', 'core:go');
      expect(filtered).toHaveProperty('result', 'success');
      expect(filtered).toHaveProperty('executionTime', 150);
      expect(filtered).toHaveProperty('success', true);
      expect(filtered).toHaveProperty('componentData'); // included at detailed level
      expect(filtered).not.toHaveProperty('prerequisites'); // includePrerequisites: false
      expect(filtered).toHaveProperty('targets'); // includeTargets: true
      expect(filtered).not.toHaveProperty('debugInfo'); // only at verbose level
      expect(filtered).not.toHaveProperty('stackTrace'); // only at verbose level
    });

    it('should reset statistics', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Perform a lookup to generate stats
      await loader.loadConfig();
      await loader.shouldTraceAction('core:go');

      let stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(1);

      // Reset and verify
      loader.resetStatistics();
      stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(0);
      expect(stats.exactMatches).toBe(0);
      expect(stats.wildcardMatches).toBe(0);
      expect(stats.averageLookupTime).toBe(0);
    });

    it('should handle wildcard patterns efficiently with pre-compiled regex', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*', 'custom:*', 'mod1:*', 'mod2:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load config to build optimized structures
      await loader.loadConfig();

      // Test multiple wildcard matches
      const start = performance.now();
      const results = await Promise.all([
        loader.shouldTraceAction('core:something'),
        loader.shouldTraceAction('custom:anything'),
        loader.shouldTraceAction('mod1:action'),
        loader.shouldTraceAction('mod2:behavior'),
        loader.shouldTraceAction('nonexistent:action'),
      ]);
      const duration = performance.now() - start;

      expect(results).toEqual([true, true, true, true, false]);
      expect(duration).toBeLessThan(5); // Should be very fast even with multiple patterns
    });
  });

  describe('Enhanced Wildcard Patterns', () => {
    describe('general wildcard patterns', () => {
      it('should support prefix wildcard patterns', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['core:go*', 'test:move*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        expect(await loader.shouldTraceAction('core:go')).toBe(true);
        expect(await loader.shouldTraceAction('core:go_north')).toBe(true);
        expect(await loader.shouldTraceAction('core:go_south')).toBe(true);
        expect(await loader.shouldTraceAction('test:move_forward')).toBe(true);
        expect(await loader.shouldTraceAction('core:attack')).toBe(false);
      });

      it('should support suffix wildcard patterns', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['*_debug', '*_test'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        expect(await loader.shouldTraceAction('core:go_debug')).toBe(true);
        expect(await loader.shouldTraceAction('test:attack_debug')).toBe(true);
        expect(await loader.shouldTraceAction('custom:action_test')).toBe(true);
        expect(await loader.shouldTraceAction('core:go')).toBe(false);
      });

      it('should support complex wildcard patterns', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['core:*_action', 'test:debug_*', '*:move_*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        expect(await loader.shouldTraceAction('core:attack_action')).toBe(true);
        expect(await loader.shouldTraceAction('test:debug_info')).toBe(true);
        expect(await loader.shouldTraceAction('any:move_forward')).toBe(true);
        expect(await loader.shouldTraceAction('core:attack')).toBe(false);
      });
    });

    describe('pattern validation', () => {
      it('should warn about invalid patterns', async () => {
        const mockLogger = {
          warn: jest.fn(),
          debug: jest.fn(),
          info: jest.fn(),
          error: jest.fn(),
        };
        const loaderWithMockLogger = new ActionTraceConfigLoader({
          traceConfigLoader: mockTraceConfigLoader,
          logger: mockLogger,
          validator: mockValidator,
        });

        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['InvalidMod:action', 'core:**action', ''],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        await loaderWithMockLogger.shouldTraceAction('core:go');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid pattern')
        );
      });
    });

    describe('pattern testing utilities', () => {
      it('should test individual patterns', () => {
        const result = loader.testPattern('core:go*', 'core:go_north');

        expect(result).toEqual({
          matches: true,
          patternType: 'general',
          explanation: "Matches pattern 'core:go*' using regex",
        });
      });

      it('should test exact patterns', () => {
        const result = loader.testPattern('core:go', 'core:go');

        expect(result).toEqual({
          matches: true,
          patternType: 'exact',
          explanation: 'Exact string match',
        });
      });

      it('should test universal wildcard', () => {
        const result = loader.testPattern('*', 'any:action');

        expect(result).toEqual({
          matches: true,
          patternType: 'all',
          explanation: 'Matches all actions',
        });
      });

      it('should test mod wildcard patterns', () => {
        const result = loader.testPattern('core:*', 'core:go_north');

        expect(result).toEqual({
          matches: true,
          patternType: 'mod',
          explanation: "Matches actions starting with 'core:'",
        });
      });

      it('should return matching patterns for action ID', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['*', 'core:*', 'core:go*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        const result = await loader.getMatchingPatterns('core:go_north');

        expect(result.matches).toBe(true);
        expect(result.matchingPatterns).toHaveLength(3);
        expect(result.matchingPatterns[0].pattern).toBe('*');
        expect(result.matchingPatterns[1].pattern).toBe('core:*');
        expect(result.matchingPatterns[2].pattern).toBe('core:go*');
      });

      it('should return no matches for non-matching action', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['core:*', 'test:debug*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        const result = await loader.getMatchingPatterns('other:unrelated');

        expect(result.matches).toBe(false);
        expect(result.matchingPatterns).toHaveLength(0);
      });
    });

    describe('performance with enhanced patterns', () => {
      it('should maintain performance with complex patterns', async () => {
        const patterns = [
          ...Array.from({ length: 100 }, (_, i) => `mod${i}:action${i}`),
          ...Array.from({ length: 50 }, (_, i) => `wildcard${i}:*`),
          ...Array.from({ length: 25 }, (_, i) => `prefix${i}:action*`),
          ...Array.from({ length: 25 }, (_, i) => `*_suffix${i}`),
        ];

        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: patterns,
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        const testActions = [
          'mod50:action50',
          'wildcard25:anything',
          'prefix10:action_test',
          'core:action_suffix15',
        ];

        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
          const action = testActions[i % testActions.length];
          await loader.shouldTraceAction(action);
        }

        const duration = performance.now() - start;
        const avgTime = duration / 1000;

        expect(avgTime).toBeLessThan(1); // Less than 1ms per check
      });
    });
  });
});
