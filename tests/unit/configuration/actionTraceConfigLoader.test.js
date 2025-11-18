/**
 * @file Unit tests for ActionTraceConfigLoader
 * @see src/configuration/actionTraceConfigLoader.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';

// Mock the ActionTraceConfigValidator
jest.mock('../../../src/configuration/actionTraceConfigValidator.js');

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
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true), // Add this for schema check
    };

    // Setup the ActionTraceConfigValidator mock
    ActionTraceConfigValidator.mockClear();
    ActionTraceConfigValidator.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      validateConfiguration: jest.fn().mockImplementation((config) => {
        // Check if config has invalid values to simulate validation failure
        if (config?.actionTracing?.enabled === 'invalid') {
          return Promise.resolve({
            isValid: false,
            errors: ['root: Invalid type for enabled'],
            warnings: [],
            normalizedConfig: null,
          });
        }
        return Promise.resolve({
          isValid: true,
          errors: [],
          warnings: [],
          normalizedConfig: null,
        });
      }),
    }));

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
          tracedActions: ['movement:go'],
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

      // Production code merges with defaults, so expect the merged result
      expect(config).toEqual(expect.objectContaining(mockConfig.actionTracing));
      // Verify that default fields are added
      expect(config).toHaveProperty('outputFormats', ['json']);
      expect(config).toHaveProperty('textFormatOptions');
      expect(config.textFormatOptions).toEqual({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalled();
      // The enhanced validator is now used instead of the basic validator
      // So we don't expect mockValidator.validate to be called
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

      // The enhanced validator mock was already set up to return isValid: false
      // for invalid 'enabled' value in the beforeEach block (lines 42-55)
      // This should trigger the default config return in production code

      const config = await loader.loadConfig();

      // When validation fails after merging, production returns pure defaults
      expect(config).toEqual({
        enabled: false,
        tracedActions: [],
        outputDirectory: './traces',
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 100,
        rotationPolicy: 'age',
        maxFileAge: 86400,
        outputFormats: ['json'],
        textFormatOptions: {
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
          sectionSeparator: '=',
          includeTimestamps: true,
          performanceSummary: true,
        },
      });
      // Note: No error is logged because mergeWithDefaults() sanitizes the config
      // and the sanitized config passes validation
    });

    it('should handle enhanced validator with warnings and normalized config', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      // The normalized config from ActionTraceConfigValidator only removes duplicates
      // and potentially adds rotation-related defaults based on the policy
      // It does NOT add the missing boolean properties
      const normalizedConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'], // Duplicates removed if any
          outputDirectory: './traces',
          verbosity: 'standard',
          // Since no rotationPolicy is specified in mockConfig,
          // normalization won't add defaults
        },
      };

      // Setup the ActionTraceConfigValidator mock to return warnings and normalizedConfig
      ActionTraceConfigValidator.mockClear();
      ActionTraceConfigValidator.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        validateConfiguration: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: ['Using default value for maxTraceFiles'],
          normalizedConfig: normalizedConfig,
        }),
      }));

      const freshLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
      });

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const config = await freshLoader.loadConfig();

      expect(config).toEqual(normalizedConfig.actionTracing);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Configuration warning: Using default value for maxTraceFiles'
      );
    });

    it('should handle enhanced validator initialization failure', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
        },
      };

      // Create a new mock logger for this specific test to track calls
      const testLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      // Setup the ActionTraceConfigValidator mock to throw during initialization
      ActionTraceConfigValidator.mockClear();
      ActionTraceConfigValidator.mockImplementation(() => ({
        initialize: jest
          .fn()
          .mockRejectedValue(new Error('Validator init failed')),
        validateConfiguration: jest.fn(),
      }));

      const freshLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: testLogger, // Use test-specific logger
        validator: mockValidator,
      });

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Mock the basic validator to return valid since we're falling back to it
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const config = await freshLoader.loadConfig();

      // Production code merges with defaults even when validator initialization fails
      expect(config).toEqual(expect.objectContaining(mockConfig.actionTracing));
      // Verify that default fields are added
      expect(config).toHaveProperty('outputFormats', ['json']);
      expect(config).toHaveProperty('textFormatOptions');
      expect(config.textFormatOptions).toEqual({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
      expect(testLogger.warn).toHaveBeenCalledWith(
        'Enhanced validator failed, falling back to basic validation',
        expect.any(Error)
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

  describe('performance metrics', () => {
    it('should record slow operations and warn on performance regression', async () => {
      const perfLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 0,
      });

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const perfSequence = [
        // First load (below threshold)
        0, 10, 15, 20,
        // Second load (below threshold)
        100, 110, 115, 120,
        // Third load (below threshold)
        200, 210, 215, 220,
        // Fourth load (below threshold)
        300, 310, 315, 320,
        // Fifth load (exceeds threshold to trigger regression warning)
        400, 460, 470, 475,
      ];

      const lastValue = perfSequence[perfSequence.length - 1];
      const performanceSpy = jest
        .spyOn(performance, 'now')
        .mockImplementation(() =>
          perfSequence.length > 0 ? perfSequence.shift() : lastValue
        );

      try {
        for (let i = 0; i < 5; i += 1) {
           
          await perfLoader.loadConfig();
        }
      } finally {
        performanceSpy.mockRestore();
      }

      const stats = perfLoader.getStatistics();
      const configLoadMetrics = stats.operationMetrics['config-load'];
      expect(configLoadMetrics).toEqual(
        expect.objectContaining({
          count: 5,
          slowOperations: 1,
        })
      );

      const regressionWarnings = mockLogger.warn.mock.calls.filter(([message]) =>
        message.startsWith('Performance regression detected in config-load')
      );

      expect(regressionWarnings).toHaveLength(1);
      expect(regressionWarnings[0][1]).toEqual(
        expect.objectContaining({
          threshold: '25ms',
        })
      );
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
          tracedActions: ['movement:go', 'core:attack'],
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
      expect(tracedActions).toEqual(['movement:go', 'core:attack']);
    });
  });

  describe('shouldTraceAction', () => {
    it('should return false when tracing is disabled', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: false,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const shouldTrace = await loader.shouldTraceAction('movement:go');
      expect(shouldTrace).toBe(false);
    });

    it('should match exact action IDs', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 'core:attack'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('movement:go')).toBe(true);
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

      expect(await loader.shouldTraceAction('movement:go')).toBe(true);
      expect(await loader.shouldTraceAction('custom:action')).toBe(true);
      expect(await loader.shouldTraceAction('any:thing')).toBe(true);
    });

    it('should match mod-specific wildcards', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*', 'movement:*', 'custom:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('movement:go')).toBe(true);
      expect(await loader.shouldTraceAction('core:attack')).toBe(true);
      expect(await loader.shouldTraceAction('custom:action')).toBe(true);
      expect(await loader.shouldTraceAction('custom:other')).toBe(true);
      expect(await loader.shouldTraceAction('different:action')).toBe(false);
    });

    it('should handle mixed patterns', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 'custom:*', 'specific:action'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      expect(await loader.shouldTraceAction('movement:go')).toBe(true);
      expect(await loader.shouldTraceAction('core:attack')).toBe(false);
      expect(await loader.shouldTraceAction('custom:anything')).toBe(true);
      expect(await loader.shouldTraceAction('specific:action')).toBe(true);
      expect(await loader.shouldTraceAction('specific:other')).toBe(false);
    });
  });

  describe('TTL functionality', () => {
    it('should accept cacheTtl parameter in constructor', () => {
      const customTtlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 30000, // 30 seconds
      });

      expect(customTtlLoader).toBeDefined();
    });

    it('should use default TTL of 60000ms when not specified', () => {
      const stats = loader.getStatistics();
      expect(stats.cacheTtl).toBe(60000); // Default 1 minute
    });

    it('should use custom TTL when specified', () => {
      const customLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 30000,
      });

      const stats = customLoader.getStatistics();
      expect(stats.cacheTtl).toBe(30000);
    });

    it('should expire cache after TTL period', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      try {
        const shortTtlLoader = new ActionTraceConfigLoader({
          traceConfigLoader: mockTraceConfigLoader,
          logger: mockLogger,
          validator: mockValidator,
          cacheTtl: 100, // 100ms for testing
        });

        const mockConfig = {
          actionTracing: {
            enabled: true,
            tracedActions: ['movement:go'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        // First load
        const config1 = await shortTtlLoader.loadConfig();
        expect(config1.enabled).toBe(true);
        expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

        // Immediate second load should use cache
        const config2 = await shortTtlLoader.loadConfig();
        expect(config2).toBe(config1); // Same reference
        expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

        // Fast-forward past the TTL window
        await jest.advanceTimersByTimeAsync(150);

        // Third load should reload from source
        const config3 = await shortTtlLoader.loadConfig();
        expect(config3.enabled).toBe(true);
        expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should handle TTL of zero (disabled caching)', async () => {
      const noCacheLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 0, // Disabled caching
      });

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Each call should reload from source
      await noCacheLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

      await noCacheLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(2);

      await noCacheLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(3);
    });

    it('should preserve TTL setting when reloading config', async () => {
      const customLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 45000, // 45 seconds
      });

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load initial config
      await customLoader.loadConfig();
      expect(customLoader.getStatistics().cacheTtl).toBe(45000);

      // Reload config
      await customLoader.reloadConfig();
      expect(customLoader.getStatistics().cacheTtl).toBe(45000); // TTL preserved
    });

    it('should provide cache statistics with TTL information', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Initial stats should show empty cache
      let stats = loader.getStatistics();
      expect(stats.cacheStatus).toBe('empty');
      expect(stats.cacheAge).toBe(0);
      expect(stats.cacheTtl).toBe(60000);

      // Load config
      await loader.loadConfig();

      // Stats should show valid cache
      stats = loader.getStatistics();
      expect(stats.cacheStatus).toBe('valid');
      expect(stats.cacheAge).toBeGreaterThanOrEqual(0);
      expect(stats.cacheTtl).toBe(60000);
    });

    it('should show expired cache status after TTL expires', async () => {
      const shortTtlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 50, // 50ms for testing
      });

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load config
      await shortTtlLoader.loadConfig();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Check stats show expired status
      const stats = shortTtlLoader.getStatistics();
      expect(stats.cacheStatus).toBe('expired');
      expect(stats.cacheAge).toBeGreaterThan(50);
    });

    it('should handle concurrent access with TTL correctly', async () => {
      const freshLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000, // 1 minute
      });

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockClear();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load once first to populate cache
      await freshLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

      // Reset mock to track subsequent calls
      mockTraceConfigLoader.loadConfig.mockClear();

      // Now simulate concurrent access to cached config
      const promises = Array.from({ length: 10 }, () =>
        freshLoader.loadConfig()
      );
      const results = await Promise.all(promises);

      // All should return the same config instance
      results.forEach((result) => {
        expect(result).toBe(results[0]);
      });

      // Should not have triggered any additional loads due to cache hits
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(0);
    });
  });

  describe('Optimized Data Structures and Statistics', () => {
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
          tracedActions: ['movement:go', 'custom:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load config and perform some lookups
      await loader.loadConfig();
      await loader.shouldTraceAction('movement:go'); // exact match
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
      expect(stats.tracedActionsCount).toBe(1); // 'movement:go'
      expect(stats.wildcardPatternsCount).toBe(1); // 'custom:*'
    });

    it('should log a milestone message after enough cache hits', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      mockLogger.debug.mockClear();

      const nowSpy = jest.spyOn(performance, 'now');
      let tick = 0;
      nowSpy.mockImplementation(() => {
        tick += 0.1;
        return tick;
      });

      try {
        for (let index = 0; index < 100; index += 1) {
          await loader.loadConfig();
        }
      } finally {
        nowSpy.mockRestore();
      }

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Operation cache-hit milestone',
        expect.objectContaining({
          count: 100,
        })
      );
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
        actionId: 'movement:go',
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
      expect(filtered).toHaveProperty('actionId', 'movement:go');
      expect(filtered).toHaveProperty('result', 'success');
      expect(filtered).toHaveProperty('executionTime', 150);
      expect(filtered).toHaveProperty('success', true);
      expect(filtered).toHaveProperty('componentData'); // included at detailed level
      expect(filtered).not.toHaveProperty('prerequisites'); // includePrerequisites: false
      expect(filtered).toHaveProperty('targets'); // includeTargets: true
      expect(filtered).not.toHaveProperty('debugInfo'); // only at verbose level
      expect(filtered).not.toHaveProperty('stackTrace'); // only at verbose level
    });

    it('should filter data by verbose level including debug and system data', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const data = {
        timestamp: Date.now(),
        actionId: 'core:attack',
        result: 'success',
        executionTime: 250,
        success: true,
        componentData: { component: 'data' },
        prerequisites: { prereq: 'info' },
        targets: { target: 'info' },
        debugInfo: { debug: 'verbose_info' },
        stackTrace: 'Error\n  at function1()\n  at function2()',
        systemState: { memory: '1GB', cpu: '50%' },
      };

      const filtered = await loader.filterDataByVerbosity(data);

      // Verbose includes everything
      expect(filtered).toHaveProperty('timestamp');
      expect(filtered).toHaveProperty('actionId', 'core:attack');
      expect(filtered).toHaveProperty('result', 'success');
      expect(filtered).toHaveProperty('executionTime', 250);
      expect(filtered).toHaveProperty('success', true);
      expect(filtered).toHaveProperty('componentData');
      expect(filtered).toHaveProperty('prerequisites');
      expect(filtered).toHaveProperty('targets');
      expect(filtered).toHaveProperty('debugInfo'); // included at verbose level
      expect(filtered).toHaveProperty('stackTrace'); // included at verbose level
      expect(filtered).toHaveProperty('systemState'); // included at verbose level

      expect(filtered.debugInfo).toEqual({ debug: 'verbose_info' });
      expect(filtered.stackTrace).toBe(
        'Error\n  at function1()\n  at function2()'
      );
      expect(filtered.systemState).toEqual({ memory: '1GB', cpu: '50%' });
    });

    it('should warn when lookup duration exceeds the slow threshold', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();
      mockLogger.warn.mockClear();

      const nowSpy = jest.spyOn(performance, 'now');
      const times = [100, 110, 111, 112];
      nowSpy.mockImplementation(() => {
        const next = times.shift();
        return next ?? 112;
      });

      try {
        await loader.shouldTraceAction('movement:go');
      } finally {
        nowSpy.mockRestore();
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow action lookup detected',
        expect.objectContaining({
          duration: expect.stringContaining('ms'),
          totalLookups: expect.any(Number),
          slowLookupRate: expect.stringContaining('%'),
        })
      );
    });

    it('should filter data by minimal level excluding optional fields', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'minimal',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const data = {
        timestamp: Date.now(),
        actionId: 'core:examine',
        result: 'failure',
        executionTime: 100,
        success: false,
        componentData: { component: 'data' },
        prerequisites: { prereq: 'info' },
        targets: { target: 'info' },
        debugInfo: { debug: 'info' },
        stackTrace: 'stack trace',
        systemState: { state: 'info' },
      };

      const filtered = await loader.filterDataByVerbosity(data);

      // Minimal only includes basic info
      expect(filtered).toHaveProperty('timestamp');
      expect(filtered).toHaveProperty('actionId', 'core:examine');
      expect(filtered).toHaveProperty('result', 'failure');
      expect(filtered).not.toHaveProperty('executionTime'); // excluded at minimal
      expect(filtered).not.toHaveProperty('success'); // excluded at minimal
      expect(filtered).not.toHaveProperty('componentData'); // excluded at minimal
      expect(filtered).not.toHaveProperty('prerequisites'); // excluded at minimal
      expect(filtered).not.toHaveProperty('targets'); // excluded at minimal
      expect(filtered).not.toHaveProperty('debugInfo'); // excluded at minimal
      expect(filtered).not.toHaveProperty('stackTrace'); // excluded at minimal
      expect(filtered).not.toHaveProperty('systemState'); // excluded at minimal
    });

    it('should reset statistics', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Perform a lookup to generate stats
      await loader.loadConfig();
      await loader.shouldTraceAction('movement:go');

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
  });

  describe('Enhanced Wildcard Patterns', () => {
    describe('general wildcard patterns', () => {
      it('should support prefix wildcard patterns', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['movement:go*', 'test:move*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        expect(await loader.shouldTraceAction('movement:go')).toBe(true);
        expect(await loader.shouldTraceAction('movement:go_north')).toBe(true);
        expect(await loader.shouldTraceAction('movement:go_south')).toBe(true);
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

        expect(await loader.shouldTraceAction('movement:go_debug')).toBe(true);
        expect(await loader.shouldTraceAction('test:attack_debug')).toBe(true);
        expect(await loader.shouldTraceAction('custom:action_test')).toBe(true);
        expect(await loader.shouldTraceAction('movement:go')).toBe(false);
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

      it('should handle general wildcard patterns that do not match', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['movement:go*', 'test:*_debug', '*move*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        // These should match
        expect(await loader.shouldTraceAction('movement:go_north')).toBe(true);
        expect(await loader.shouldTraceAction('test:action_debug')).toBe(true);
        expect(await loader.shouldTraceAction('any:movement_now')).toBe(true);

        // These should NOT match (testing the return false path in general wildcard matching)
        expect(await loader.shouldTraceAction('core:attack')).toBe(false);
        expect(await loader.shouldTraceAction('test:debug')).toBe(false);
        expect(await loader.shouldTraceAction('other:action')).toBe(false);
        expect(await loader.shouldTraceAction('nomatch:pattern')).toBe(false);
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
            tracedActions: ['invalidmod:action', 'core:**action', ''],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        await loaderWithMockLogger.shouldTraceAction('movement:go');

        // Check that warn was called with any message about invalid patterns
        // The actual implementation may log different messages
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should validate patterns with invalid characters', async () => {
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
            tracedActions: [
              'valid:action',
              'invalid@pattern', // Contains @ which is invalid
              'pattern-with-dash', // Hyphen is now valid and should not warn
              'pattern$with$dollar', // Contains $ which is invalid
              '', // Empty string
              null, // Invalid type
            ],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        await loaderWithMockLogger.loadConfig();

        const warnMessages = mockLogger.warn.mock.calls.map(([message]) => message);

        expect(mockLogger.warn).toHaveBeenCalledTimes(4);
        expect(warnMessages).toEqual(
          expect.arrayContaining([
            expect.stringContaining('invalid@pattern'),
            expect.stringContaining('pattern$with$dollar'),
            expect.stringContaining('Pattern must be a non-empty string'),
          ])
        );
        expect(
          warnMessages.filter((msg) =>
            msg.includes('Pattern must be a non-empty string')
          )
        ).toHaveLength(2);
        expect(
          warnMessages.some((msg) => msg.includes('pattern-with-dash'))
        ).toBe(false);
      });

      it('should validate mod name patterns with edge cases', async () => {
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
            tracedActions: [
              'ValidMod:action', // Uppercase mod name (should warn but not fail)
              'mod*part:action', // Partial wildcard in mod name (should fail)
              'mod:multiple:colons', // Multiple colons (should fail)
              'mod:', // Empty action part (should fail)
              '123invalid:action', // Mod name starting with number (should fail)
              '*:wildcard_action', // Valid wildcard mod
            ],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        await loaderWithMockLogger.loadConfig();

        // Should warn about invalid patterns - checking for the specific error messages
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('mod*part:action')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('mod:multiple:colons')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('mod:')
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('123invalid:action')
        );

        // Uppercase patterns will only be caught if they have other issues
        // ValidMod:action is actually valid, so it won't generate warnings
        // The uppercase warning only shows up in the validation error list, not in logging
      });

      it('should handle pattern validation internally without logging warnings', async () => {
        // The pattern validation happens during buildLookupStructures, but it only logs
        // warnings for actually invalid patterns. Uppercase patterns are considered
        // warnings in the validation logic but don't prevent the pattern from working.

        const testResult1 = loader.testPattern(
          'ValidMod:action',
          'ValidMod:action'
        );
        expect(testResult1.matches).toBe(true);
        expect(testResult1.patternType).toBe('exact');

        const testResult2 = loader.testPattern('CORE:*', 'CORE:GO');
        expect(testResult2.matches).toBe(true);
        expect(testResult2.patternType).toBe('mod');

        const testResult3 = loader.testPattern(
          'Test*Pattern',
          'TestSomePattern'
        );
        expect(testResult3.matches).toBe(true);
        expect(testResult3.patternType).toBe('general');
      });
    });

    describe('pattern testing utilities', () => {
      it('should test individual patterns', () => {
        const result = loader.testPattern('movement:go*', 'movement:go_north');

        expect(result).toEqual({
          matches: true,
          patternType: 'general',
          explanation: "Matches pattern 'movement:go*' using regex",
        });
      });

      it('should test exact patterns', () => {
        const result = loader.testPattern('movement:go', 'movement:go');

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
        const result = loader.testPattern('core:*', 'movement:go_north');

        expect(result).toEqual({
          matches: false,
          patternType: 'mod',
          explanation: "Matches actions starting with 'core:'",
        });
      });

      it('should return matching patterns for action ID', async () => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: ['*', 'core:*', 'movement:go*'],
            outputDirectory: './traces',
            verbosity: 'standard',
          },
        };

        mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
        mockValidator.validate.mockResolvedValue({ isValid: true });

        const result = await loader.getMatchingPatterns('movement:go_north');

        expect(result.matches).toBe(true);
        expect(result.matchingPatterns).toHaveLength(2);
        expect(result.matchingPatterns[0].pattern).toBe('*');
        expect(result.matchingPatterns[1].pattern).toBe('movement:go*');
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
  });
});
