// tests/unit/configuration/debugLogConfigLoader.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DebugLogConfigLoader } from '../../../src/configuration/debugLogConfigLoader.js';
import * as utilsIndex from '../../../src/utils/index.js';

// Mock dependencies - mock the index file, not httpUtils directly
jest.mock('../../../src/utils/index.js');

describe('DebugLogConfigLoader', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleDebugSpy;
  let consoleInfoSpy;
  let mockLogger;
  let mockSafeEventDispatcher;

  // Helper function to create expected enhanced config with default categorization
  const createEnhancedConfig = (baseConfig) => {
    const enhanced = { ...baseConfig };
    
    // Only add categorization if not already present
    if (!enhanced.categorization) {
      enhanced.categorization = {
        strategy: 'hybrid',
        enableStackTraceExtraction: true,
        fallbackCategory: 'general',
        sourceMappings: {
          'src/actions': 'actions',
          'src/logic': 'logic',
          'src/entities': 'entities',
          'src/ai': 'ai',
          'src/domUI': 'domUI',
          'src/engine': 'engine',
          'src/events': 'events',
          'src/loaders': 'loaders',
          'src/scopeDsl': 'scopeDsl',
          'src/initializers': 'initializers',
          'src/dependencyInjection': 'dependencyInjection',
          'src/logging': 'logging',
          'src/configuration': 'configuration',
          'src/utils': 'utils',
          'src/constants': 'constants',
          'src/storage': 'storage',
          'src/types': 'types',
          'src/alerting': 'alerting',
          'src/context': 'context',
          'src/turns': 'turns',
          'src/adapters': 'adapters',
          'src/query': 'query',
          'src/characterBuilder': 'characterBuilder',
          'src/prompting': 'prompting',
          'src/anatomy': 'anatomy',
          'src/scheduling': 'scheduling',
          'src/errors': 'errors',
          'src/interfaces': 'interfaces',
          'src/clothing': 'clothing',
          'src/input': 'input',
          'src/testing': 'testing',
          'src/modding': 'modding',
          'src/persistence': 'persistence',
          'src/data': 'data',
          'src/shared': 'shared',
          'src/bootstrapper': 'bootstrapper',
          'src/commands': 'commands',
          'src/thematicDirection': 'thematicDirection',
          'src/models': 'models',
          'src/llms': 'llms',
          'src/validation': 'validation',
          'src/pathing': 'pathing',
          'src/formatting': 'formatting',
          'src/ports': 'ports',
          'src/shutdown': 'shutdown',
          'src/clichesGenerator': 'clichesGenerator',
          'src/coreMotivationsGenerator': 'coreMotivationsGenerator',
          'src/thematicDirectionsManager': 'thematicDirectionsManager',
          'src/services': 'services',
          'tests': 'tests',
          'llm-proxy-server': 'llm-proxy',
        },
        migration: {
          mode: 'progressive',
          preserveOldPatterns: true,
          enableDualCategorization: false,
        },
        performance: {
          stackTrace: {
            enabled: true,
            skipFrames: 4,
            maxDepth: 20,
            cache: {
              enabled: true,
              maxSize: 200,
              ttl: 300000,
            },
          },
          fileOperations: {
            bufferSize: 100,
            flushInterval: 1000,
            parallelWrites: true,
            maxFileHandles: 50,
          },
        },
      };
    }
    
    return enhanced;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock event dispatcher
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Reset environment variables
    delete process.env.DEBUG_LOG_CONFIG_PATH;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      const loader = new DebugLogConfigLoader();
      expect(loader).toBeDefined();
    });

    it('should accept custom logger', () => {
      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      expect(loader).toBeDefined();
    });

    it('should accept custom config path', () => {
      const customPath = 'custom/path/debug-config.json';
      const loader = new DebugLogConfigLoader({ configPath: customPath });
      expect(loader).toBeDefined();
    });

    it('should prioritize environment variable for config path', () => {
      process.env.DEBUG_LOG_CONFIG_PATH = 'env/path/debug-config.json';
      const loader = new DebugLogConfigLoader({
        configPath: 'custom/path.json',
        logger: mockLogger,
      });
      expect(loader).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('env/path/debug-config.json')
      );
    });

    it('should work without safeEventDispatcher', () => {
      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      expect(loader).toBeDefined();
    });
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', async () => {
      const mockConfig = {
        enabled: true,
        mode: 'development',
        logLevel: 'DEBUG',
        remote: {
          endpoint: 'http://localhost:3001/api/debug-log',
        },
        categories: {
          engine: { enabled: true, level: 'debug' },
        },
      };

      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result).toEqual(createEnhancedConfig(mockConfig));
      expect(utilsIndex.fetchWithRetry).toHaveBeenCalledWith(
        'config/debug-logging-config.json',
        { method: 'GET', headers: { Accept: 'application/json' } },
        2,
        300,
        1000,
        expect.any(Object),
        mockLogger
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully loaded debug configuration')
      );
    });

    it('should use custom file path when provided', async () => {
      const customPath = 'custom/debug-config.json';
      const mockConfig = { enabled: true, mode: 'console' };

      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig(customPath);

      expect(result).toEqual(createEnhancedConfig(mockConfig));
      expect(utilsIndex.fetchWithRetry).toHaveBeenCalledWith(
        customPath,
        expect.any(Object),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
        mockLogger
      );
    });

    it('should return empty object for empty config file', async () => {
      utilsIndex.fetchWithRetry.mockResolvedValue({});

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      // Empty configs return empty object without enhancement (early return in code)
      expect(result).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration file from config/debug-logging-config.json is empty'
        )
      );
    });

    it('should return error for malformed JSON (not an object)', async () => {
      utilsIndex.fetchWithRetry.mockResolvedValue('invalid json string');

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('malformed');
      expect(result.stage).toBe('validation');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should validate mode field is a string', async () => {
      const invalidConfig = {
        enabled: true,
        mode: 123, // Should be a string
      };

      utilsIndex.fetchWithRetry.mockResolvedValue(invalidConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain("'mode'");
      expect(result.message).toContain('must be a string');
      expect(result.stage).toBe('validation');
    });

    it('should validate logLevel field is a string', async () => {
      const invalidConfig = {
        enabled: true,
        logLevel: false, // Should be a string
      };

      utilsIndex.fetchWithRetry.mockResolvedValue(invalidConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain("'logLevel'");
      expect(result.message).toContain('must be a string');
      expect(result.stage).toBe('validation');
    });

    it('should warn but not fail for invalid enabled field', async () => {
      const invalidConfig = {
        enabled: 'true', // Should be a boolean
        mode: 'development',
      };

      utilsIndex.fetchWithRetry.mockResolvedValue(invalidConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBeUndefined();
      expect(result).toEqual(createEnhancedConfig(invalidConfig));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("'enabled'")
      );
      // Verify the warning message contains the required text
      const warnCall = mockLogger.warn.mock.calls[0][0];
      expect(warnCall).toContain('must be a boolean');
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchError = new Error('Network error');
      utilsIndex.fetchWithRetry.mockRejectedValue(fetchError);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('Failed to load or parse');
      expect(result.message).toContain('Network error');
      expect(result.stage).toBe('fetch');
      expect(result.originalError).toBe(fetchError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle parse errors gracefully', async () => {
      const parseError = new Error('Unexpected token in JSON');
      utilsIndex.fetchWithRetry.mockRejectedValue(parseError);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('Failed to load or parse');
      expect(result.stage).toBe('parse');
      expect(result.originalError).toBe(parseError);
    });

    it('should work without a logger (using console)', async () => {
      const mockConfig = { enabled: true, mode: 'production' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader();
      const result = await loader.loadConfig();

      expect(result).toEqual(createEnhancedConfig(mockConfig));
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should create a no-op event dispatcher if not provided', async () => {
      const mockConfig = { enabled: true };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result).toEqual(createEnhancedConfig(mockConfig));
      // Verify fetchWithRetry was called with a dispatcher (even if it's a no-op)
      expect(utilsIndex.fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          dispatch: expect.any(Function),
        }),
        mockLogger
      );
    });
  });

  describe('isEnabled', () => {
    it('should return true when config is enabled', async () => {
      const mockConfig = { enabled: true, mode: 'development' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(true);
    });

    it('should return false when config is explicitly disabled', async () => {
      const mockConfig = { enabled: false, mode: 'development' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(false);
    });

    it('should return true when enabled is not specified (default)', async () => {
      const mockConfig = { mode: 'development' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(true);
    });

    it('should return false when config fails to load', async () => {
      utilsIndex.fetchWithRetry.mockRejectedValue(new Error('Load failed'));

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(false);
    });
  });

  describe('getMode', () => {
    it('should return the configured mode', async () => {
      const mockConfig = { enabled: true, mode: 'production' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const mode = await loader.getMode();

      expect(mode).toBe('production');
    });

    it('should return null when mode is not configured', async () => {
      const mockConfig = { enabled: true };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const mode = await loader.getMode();

      expect(mode).toBeNull();
    });

    it('should return null when config fails to load', async () => {
      utilsIndex.fetchWithRetry.mockRejectedValue(new Error('Load failed'));

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const mode = await loader.getMode();

      expect(mode).toBeNull();
    });
  });

  describe('environment variables', () => {
    it('should use DEBUG_LOG_CONFIG_PATH when set', () => {
      const envPath = 'env/config/debug.json';
      process.env.DEBUG_LOG_CONFIG_PATH = envPath;

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      expect(loader).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[DebugLogConfigLoader] Using environment-specified config path: ${envPath}`
      );
    });

    it('should ignore empty DEBUG_LOG_CONFIG_PATH', () => {
      process.env.DEBUG_LOG_CONFIG_PATH = '   ';

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      expect(loader).toBeDefined();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Using environment-specified')
      );
    });
  });

  describe('source-based migration support', () => {
    it('should apply default categorization settings when none exist', async () => {
      const mockConfig = { enabled: true, mode: 'development' };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config.categorization).toBeDefined();
      expect(config.categorization.strategy).toBe('hybrid');
      expect(config.categorization.enableStackTraceExtraction).toBe(true);
      expect(config.categorization.sourceMappings).toBeDefined();
      expect(config.categorization.fallbackCategory).toBe('general');
    });

    it('should preserve existing categorization settings', async () => {
      const mockConfig = {
        enabled: true,
        mode: 'development',
        categorization: {
          strategy: 'source-based',
          enableStackTraceExtraction: false,
          sourceMappings: { 'custom/path': 'custom' },
          fallbackCategory: 'custom-fallback',
        },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config.categorization.strategy).toBe('source-based');
      expect(config.categorization.enableStackTraceExtraction).toBe(false);
      expect(config.categorization.sourceMappings).toEqual({ 'custom/path': 'custom' });
      expect(config.categorization.fallbackCategory).toBe('custom-fallback');
    });

    it('should apply default source mappings when missing', async () => {
      const mockConfig = {
        enabled: true,
        categorization: { strategy: 'source-based' },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config.categorization.sourceMappings).toBeDefined();
      expect(config.categorization.sourceMappings['src/actions']).toBe('actions');
      expect(config.categorization.sourceMappings['src/entities']).toBe('entities');
      expect(config.categorization.sourceMappings['tests']).toBe('tests');
      expect(Object.keys(config.categorization.sourceMappings).length).toBeGreaterThan(40);
    });

    it('should apply default migration settings', async () => {
      const mockConfig = { enabled: true, categorization: {} };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config.categorization.migration).toBeDefined();
      expect(config.categorization.migration.mode).toBe('progressive');
      expect(config.categorization.migration.preserveOldPatterns).toBe(true);
      expect(config.categorization.migration.enableDualCategorization).toBe(false);
    });

    it('should apply default performance settings', async () => {
      const mockConfig = { enabled: true, categorization: {} };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config.categorization.performance).toBeDefined();
      expect(config.categorization.performance.stackTrace).toBeDefined();
      expect(config.categorization.performance.stackTrace.enabled).toBe(true);
      expect(config.categorization.performance.stackTrace.skipFrames).toBe(4);
      expect(config.categorization.performance.fileOperations).toBeDefined();
      expect(config.categorization.performance.fileOperations.bufferSize).toBe(100);
    });

    it('should log appropriate warnings for different strategies', async () => {
      const mockConfig = {
        enabled: true,
        categorization: { strategy: 'source-based' },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      await loader.loadConfig();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DebugLogConfigLoader] Source-based categorization active - pattern-based categorization disabled'
      );
    });

    it('should log debug messages for hybrid strategy', async () => {
      const mockConfig = {
        enabled: true,
        categorization: { strategy: 'hybrid' },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      await loader.loadConfig();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DebugLogConfigLoader] Hybrid categorization mode - using both source and pattern-based routing'
      );
    });

    it('should validate categorization configuration', async () => {
      const mockConfig = {
        enabled: true,
        categorization: {
          strategy: 'invalid-strategy',
          sourceMappings: null,
          fallbackCategory: '',
        },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      await loader.loadConfig();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('categorization\' configuration has issues')
      );
    });

    it('should handle categorization validation gracefully', async () => {
      const mockConfig = {
        enabled: true,
        categorization: { invalid: 'structure' },
      };
      utilsIndex.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const config = await loader.loadConfig();

      expect(config).toBeDefined();
      expect(config.categorization.strategy).toBe('hybrid'); // Default applied
    });
  });
});
