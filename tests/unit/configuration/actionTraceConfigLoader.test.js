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
});
