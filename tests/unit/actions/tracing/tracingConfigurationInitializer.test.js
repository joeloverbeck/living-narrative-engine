/**
 * @file Unit tests for TracingConfigurationInitializer
 * @description Tests the coordination of action tracing system initialization and configuration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TracingConfigurationInitializer from '../../../../src/actions/tracing/tracingConfigurationInitializer.js';

describe('TracingConfigurationInitializer', () => {
  let mockConfigLoader;
  let mockActionTraceFilter;
  let mockActionTraceOutputService;
  let mockLogger;
  let initializer;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock dependencies
    mockConfigLoader = {
      loadConfig: jest.fn(),
      reloadConfig: jest.fn(),
      isEnabled: jest.fn(),
      getOutputDirectory: jest.fn(),
    };

    mockActionTraceFilter = {
      updateFromConfig: jest.fn(),
      isEnabled: jest.fn(),
      getConfigurationSummary: jest.fn(),
    };

    mockActionTraceOutputService = {
      enableFileOutput: jest.fn(),
      updateConfiguration: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Default mock implementations
    mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
      enabled: false,
      tracedActionCount: 0,
      tracedActions: [],
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        initializer = new TracingConfigurationInitializer({
          configLoader: mockConfigLoader,
          actionTraceFilter: mockActionTraceFilter,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: mockLogger,
        });
      }).not.toThrow();

      expect(initializer).toBeInstanceOf(TracingConfigurationInitializer);
    });

    it('should throw error when configLoader is missing', () => {
      expect(() => {
        new TracingConfigurationInitializer({
          configLoader: null,
          actionTraceFilter: mockActionTraceFilter,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: mockLogger,
        });
      }).toThrow(/IActionTraceConfigLoader/);
    });

    it('should throw error when configLoader lacks required methods', () => {
      const invalidConfigLoader = { someMethod: jest.fn() };

      expect(() => {
        new TracingConfigurationInitializer({
          configLoader: invalidConfigLoader,
          actionTraceFilter: mockActionTraceFilter,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: mockLogger,
        });
      }).toThrow(/IActionTraceConfigLoader/);
    });

    it('should throw error when actionTraceFilter is missing', () => {
      expect(() => {
        new TracingConfigurationInitializer({
          configLoader: mockConfigLoader,
          actionTraceFilter: null,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: mockLogger,
        });
      }).toThrow(/IActionTraceFilter/);
    });

    it('should throw error when actionTraceFilter lacks required methods', () => {
      const invalidFilter = { someMethod: jest.fn() };

      expect(() => {
        new TracingConfigurationInitializer({
          configLoader: mockConfigLoader,
          actionTraceFilter: invalidFilter,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: mockLogger,
        });
      }).toThrow(/IActionTraceFilter/);
    });

    it('should handle missing logger gracefully with default logger', () => {
      expect(() => {
        initializer = new TracingConfigurationInitializer({
          configLoader: mockConfigLoader,
          actionTraceFilter: mockActionTraceFilter,
          actionTraceOutputService: mockActionTraceOutputService,
          logger: null,
        });
      }).not.toThrow();
    });

    it('should work without actionTraceOutputService', () => {
      expect(() => {
        initializer = new TracingConfigurationInitializer({
          configLoader: mockConfigLoader,
          actionTraceFilter: mockActionTraceFilter,
          actionTraceOutputService: null,
          logger: mockLogger,
        });
      }).not.toThrow();
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: mockActionTraceOutputService,
        logger: mockLogger,
      });
    });

    it('should successfully initialize with valid configuration', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1', 'action2'],
        outputDirectory: './traces',
        verbosity: 'verbose',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: true,
        tracedActionCount: 2,
        tracedActions: ['action1', 'action2'],
      });
      mockActionTraceOutputService.enableFileOutput.mockReturnValue(true);

      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(result.config).toEqual(mockConfig);
      expect(result.initializationTime).toBeGreaterThanOrEqual(0);
      expect(result.diagnostics).toBeDefined();

      expect(mockConfigLoader.loadConfig).toHaveBeenCalledTimes(2); // Once for init, once for validation
      expect(mockActionTraceFilter.updateFromConfig).toHaveBeenCalledWith(
        mockConfig
      );
      expect(
        mockActionTraceOutputService.enableFileOutput
      ).toHaveBeenCalledWith('./traces');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialization complete'),
        expect.any(Object)
      );
    });

    it('should handle already initialized state', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // First initialization
      const firstResult = await initializer.initialize();
      expect(firstResult.success).toBe(true);
      expect(firstResult.message).toContain('successfully');

      // Second initialization attempt should return "Already initialized"
      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already initialized');

      // Verify loadConfig was only called twice (both during first init for loading and validation)
      expect(mockConfigLoader.loadConfig).toHaveBeenCalledTimes(2);
    });

    it('should return same promise for concurrent initialization calls', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Start two concurrent initializations - they should share the same promise
      const promise1 = initializer.initialize();
      const promise2 = initializer.initialize();

      // Wait for both to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should have the same successful result
      expect(result1).toEqual(result2);
      expect(result1.success).toBe(true);
      expect(result1.message).toContain('successfully');

      // Verify that loadConfig was only called twice (once for init, once for validation)
      expect(mockConfigLoader.loadConfig).toHaveBeenCalledTimes(2);
    });

    it('should handle configuration loading error', async () => {
      const error = new Error('Failed to load config');
      mockConfigLoader.loadConfig.mockRejectedValue(error);

      const result = await initializer.initialize();

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
      expect(result.error).toBe(error.message);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null configuration', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null);

      const result = await initializer.initialize();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Configuration loading returned null');
    });

    it('should handle disabled tracing with pre-configured actions', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: ['action1', 'action2'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: false,
        tracedActionCount: 2,
        tracedActions: ['action1', 'action2'],
      });

      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('pre-configured but disabled'),
        expect.any(Object)
      );
    });

    it('should handle file output configuration failure', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceOutputService.enableFileOutput.mockReturnValue(false);

      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to configure file output')
      );
    });

    it('should skip file output configuration when tracing is disabled', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      await initializer.initialize();

      expect(
        mockActionTraceOutputService.enableFileOutput
      ).not.toHaveBeenCalled();
    });

    it('should skip file output when actionTraceOutputService is not provided', async () => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: null,
        logger: mockLogger,
      });

      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      const result = await initializer.initialize();

      expect(result.success).toBe(true);
      // Should not throw even without output service
    });
  });

  describe('validateAndDiagnose()', () => {
    beforeEach(() => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: mockActionTraceOutputService,
        logger: mockLogger,
      });
    });

    it('should validate correct configuration', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: true,
        tracedActionCount: 1,
        tracedActions: ['action1'],
      });

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(true);
      expect(diagnosis.issues).toHaveLength(0);
      expect(diagnosis.status.enabled).toBe(true);
      expect(diagnosis.status.tracedActions).toEqual(['action1']);
    });

    it('should detect missing configuration', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null);

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(false);
      expect(diagnosis.issues).toContain(
        'Configuration loading returned null or undefined'
      );
      expect(diagnosis.recommendations).toContain(
        'Check if config/trace-config.json exists and is valid JSON'
      );
    });

    it('should detect enabled tracing without actions configured', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: true,
        tracedActionCount: 0,
        tracedActions: [],
      });

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(false);
      expect(diagnosis.issues).toContain(
        'Tracing is enabled but no actions configured for tracing'
      );
    });

    it('should detect enabled tracing without output directory', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: true,
        tracedActionCount: 1,
        tracedActions: ['action1'],
      });

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(false);
      expect(diagnosis.issues).toContain(
        'Tracing is enabled but no output directory specified'
      );
    });

    it('should allow pre-configured but disabled state', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: ['action1', 'action2'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: false,
        tracedActionCount: 2,
        tracedActions: ['action1', 'action2'],
      });

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(true);
      expect(diagnosis.issues).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tracing configuration ready but disabled',
        expect.objectContaining({
          enabled: false,
          tracedActionsConfigured: 2,
        })
      );
    });

    it('should detect filter state mismatch', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: false, // Mismatch with config
        tracedActionCount: 1,
        tracedActions: ['action1'],
      });

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(false);
      expect(diagnosis.issues).toContain(
        'Filter enabled state does not match configuration'
      );
    });

    it('should handle validation errors gracefully', async () => {
      const error = new Error('Validation failed');
      mockConfigLoader.loadConfig.mockRejectedValue(error);

      const diagnosis = await initializer.validateAndDiagnose();

      expect(diagnosis.configurationValid).toBe(false);
      expect(diagnosis.issues).toContain(
        `Configuration validation failed: ${error.message}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('isInitialized()', () => {
    beforeEach(() => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: mockActionTraceOutputService,
        logger: mockLogger,
      });
    });

    it('should return false before initialization', () => {
      expect(initializer.isInitialized()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      await initializer.initialize();

      expect(initializer.isInitialized()).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      mockConfigLoader.loadConfig.mockRejectedValue(new Error('Failed'));

      await initializer.initialize();

      expect(initializer.isInitialized()).toBe(false);
    });
  });

  describe('getStatus()', () => {
    beforeEach(() => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: mockActionTraceOutputService,
        logger: mockLogger,
      });
    });

    it('should return complete status when initialized', async () => {
      const mockConfig = {
        enabled: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'verbose',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: true,
        tracedActionCount: 1,
        tracedActions: ['action1'],
      });

      await initializer.initialize();
      const status = await initializer.getStatus();

      expect(status).toEqual({
        initialized: true,
        configLoaded: true,
        enabled: true,
        filterConfigured: true,
        tracedActions: ['action1'],
        outputDirectory: './traces',
        verbosity: 'verbose',
      });
    });

    it('should return status when not initialized', async () => {
      const mockConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockActionTraceFilter.getConfigurationSummary.mockReturnValue({
        enabled: false,
        tracedActionCount: 0,
        tracedActions: [],
      });

      const status = await initializer.getStatus();

      expect(status).toEqual({
        initialized: false,
        configLoaded: true,
        enabled: false,
        filterConfigured: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Status error');
      mockConfigLoader.loadConfig.mockRejectedValue(error);

      const status = await initializer.getStatus();

      expect(status).toEqual({
        initialized: false,
        configLoaded: false,
        enabled: false,
        error: error.message,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get tracing status',
        error
      );
    });
  });

  describe('reloadConfiguration()', () => {
    beforeEach(() => {
      initializer = new TracingConfigurationInitializer({
        configLoader: mockConfigLoader,
        actionTraceFilter: mockActionTraceFilter,
        actionTraceOutputService: mockActionTraceOutputService,
        logger: mockLogger,
      });
    });

    it('should successfully reload configuration', async () => {
      const newConfig = {
        enabled: true,
        tracedActions: ['action3', 'action4'],
        outputDirectory: './new-traces',
        verbosity: 'debug',
      };

      mockConfigLoader.reloadConfig.mockResolvedValue(newConfig);

      const result = await initializer.reloadConfiguration();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Configuration reloaded successfully');
      expect(result.config).toEqual(newConfig);
      expect(mockActionTraceFilter.updateFromConfig).toHaveBeenCalledWith(
        newConfig
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration reloaded successfully'
      );
    });

    it('should handle reload errors', async () => {
      const error = new Error('Reload failed');
      mockConfigLoader.reloadConfig.mockRejectedValue(error);

      const result = await initializer.reloadConfiguration();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to reload configuration');
      expect(result.error).toBe(error.message);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to reload configuration',
        error
      );
    });

    it('should update filter even when reloading disabled configuration', async () => {
      const newConfig = {
        enabled: false,
        tracedActions: [],
        outputDirectory: null,
        verbosity: 'standard',
      };

      mockConfigLoader.reloadConfig.mockResolvedValue(newConfig);

      const result = await initializer.reloadConfiguration();

      expect(result.success).toBe(true);
      expect(mockActionTraceFilter.updateFromConfig).toHaveBeenCalledWith(
        newConfig
      );
    });
  });
});
