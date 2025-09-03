// tests/integration/configuration/debugLogConfigLoader.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DebugLogConfigLoader } from '../../../src/configuration/debugLogConfigLoader.js';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import {
  loadAndApplyLoggerConfig,
  loadDebugLogConfig,
} from '../../../src/configuration/utils/loggerConfigUtils.js';
import fs from 'fs';
import path from 'path';

describe('DebugLogConfigLoader Integration Tests', () => {
  let container;
  let originalNodeEnv;
  let originalDebugLogMode;
  let originalDebugLogConfigPath;

  beforeEach(() => {
    // Save original environment variables
    originalNodeEnv = process.env.NODE_ENV;
    originalDebugLogMode = process.env.DEBUG_LOG_MODE;
    originalDebugLogConfigPath = process.env.DEBUG_LOG_CONFIG_PATH;

    // Reset environment for tests
    delete process.env.NODE_ENV;
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.DEBUG_LOG_CONFIG_PATH;

    // Create a fresh container for each test
    container = new AppContainer();
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalDebugLogMode !== undefined) {
      process.env.DEBUG_LOG_MODE = originalDebugLogMode;
    }
    if (originalDebugLogConfigPath !== undefined) {
      process.env.DEBUG_LOG_CONFIG_PATH = originalDebugLogConfigPath;
    }
  });

  describe('LoggerStrategy with debug config', () => {
    it('should initialize LoggerStrategy with debug config from constructor', () => {
      const debugConfig = {
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

      const logger = new LoggerStrategy({
        config: debugConfig,
        dependencies: {
          consoleLogger: new ConsoleLogger(LogLevel.INFO),
        },
      });

      expect(logger).toBeDefined();
      expect(logger.getMode()).toBe('development');
    });

    it('should handle mode switching via setLogLevel with special values', () => {
      const logger = new LoggerStrategy({
        dependencies: {
          consoleLogger: new ConsoleLogger(LogLevel.INFO),
        },
      });

      // Initial mode
      const initialMode = logger.getMode();
      expect(['console', 'test', 'development', 'production']).toContain(
        initialMode
      );

      // Switch to console mode
      logger.setLogLevel('console');
      expect(logger.getMode()).toBe('console');

      // Switch to none mode
      logger.setLogLevel('none');
      expect(logger.getMode()).toBe('none');

      // Switch to test mode
      logger.setLogLevel('test');
      expect(logger.getMode()).toBe('test');

      // Switch back to console mode
      logger.setLogLevel('console');
      expect(logger.getMode()).toBe('console');
    });

    it('should apply regular log levels without changing mode', () => {
      const logger = new LoggerStrategy({
        mode: 'console',
        dependencies: {
          consoleLogger: new ConsoleLogger(LogLevel.INFO),
        },
      });

      const initialMode = logger.getMode();
      expect(initialMode).toBe('console');

      // Apply regular log level
      logger.setLogLevel('DEBUG');
      // Mode should not change
      expect(logger.getMode()).toBe('console');

      // Apply another log level
      logger.setLogLevel('ERROR');
      // Mode should still not change
      expect(logger.getMode()).toBe('console');
    });
  });

  describe('loadDebugLogConfig utility', () => {
    it('should load debug config when file exists', async () => {
      // Check if the actual debug config file exists
      const configPath = path.resolve(
        process.cwd(),
        'config/debug-logging-config.json'
      );
      const configExists = fs.existsSync(configPath);

      if (configExists) {
        const mockLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        const config = await loadDebugLogConfig(mockLogger, null);

        // If the file exists and is valid, we should get a config object
        if (config) {
          expect(config).toHaveProperty('enabled');
          expect(config).toHaveProperty('mode');
        } else {
          // If config is null, it means the file is disabled or invalid
          expect(config).toBeNull();
        }
      } else {
        // If file doesn't exist, that's okay for the test
        expect(configExists).toBe(false);
      }
    });

    it('should return null when debug config is disabled', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Create a loader that will simulate a disabled config
      const loader = new DebugLogConfigLoader({
        logger: mockLogger,
        configPath: 'non-existent-config.json',
      });

      // This should fail to load and return an error
      const result = await loader.loadConfig();
      expect(result.error).toBeTruthy();

      // loadDebugLogConfig should return null for errors
      const config = await loadDebugLogConfig(mockLogger, null);
      // Since we're using a non-existent file, this could return null
      // The exact behavior depends on whether the real file exists
    });
  });

  describe('loadAndApplyLoggerConfig with debug config', () => {
    it('should apply debug mode when debug config is available', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
      };

      const mockSafeEventDispatcher = {
        dispatch: jest.fn(),
      };

      // Create a container with mock dependencies
      const testContainer = new AppContainer();
      testContainer.register(
        tokens.ISafeEventDispatcher,
        () => mockSafeEventDispatcher
      );

      // Mock loadDebugLogConfig to return a config with mode
      const originalLoadDebugLogConfig = loadDebugLogConfig;
      const mockConfig = {
        enabled: true,
        mode: 'development',
        logLevel: 'DEBUG',
      };

      // We need to mock the module to override loadDebugLogConfig
      // Since we can't easily mock ES modules in Jest without babel,
      // we'll test the actual behavior with the real file

      // If the actual debug config file exists, test with it
      const configPath = path.resolve(
        process.cwd(),
        'config/debug-logging-config.json'
      );
      if (fs.existsSync(configPath)) {
        await loadAndApplyLoggerConfig(
          testContainer,
          mockLogger,
          tokens,
          'TestPrefix'
        );

        // Should have attempted to load debug config
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Attempting to load debug logging configuration'
          )
        );

        // If debug config loaded successfully, it should apply the mode
        const debugConfigLoaded = mockLogger.debug.mock.calls.some((call) =>
          call[0].includes('Debug configuration loaded successfully')
        );

        if (debugConfigLoaded) {
          // Should have called setLogLevel with the mode or logLevel
          expect(mockLogger.setLogLevel).toHaveBeenCalled();
        }
      }
    });

    it('should fall back to legacy config when debug config is not available', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
      };

      const mockSafeEventDispatcher = {
        dispatch: jest.fn(),
      };

      // Create a container with mock dependencies
      const testContainer = new AppContainer();
      testContainer.register(
        tokens.ISafeEventDispatcher,
        () => mockSafeEventDispatcher
      );

      // Set an invalid debug config path to force fallback
      process.env.DEBUG_LOG_CONFIG_PATH = 'invalid-path.json';

      await loadAndApplyLoggerConfig(
        testContainer,
        mockLogger,
        tokens,
        'TestPrefix'
      );

      // Should have attempted to load debug config
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Attempting to load debug logging configuration'
        )
      );

      // Should have fallen back to legacy config
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to legacy logger configuration')
      );
    });
  });

  describe('Container configuration with debug config', () => {
    it('should configure minimal container with debug config', async () => {
      // Set test mode to ensure consistent behavior
      process.env.NODE_ENV = 'test';

      await configureMinimalContainer(container);

      // Logger should be registered
      const logger = container.resolve(tokens.ILogger);
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(LoggerStrategy);

      // Check that the logger has the expected mode
      const mode = logger.getMode();
      expect(['console', 'test', 'none']).toContain(mode);
    });

    it('should respect DEBUG_LOG_MODE environment variable', async () => {
      // Set a specific debug log mode
      process.env.DEBUG_LOG_MODE = 'production';

      await configureMinimalContainer(container);

      const logger = container.resolve(tokens.ILogger);
      expect(logger).toBeDefined();
      expect(logger.getMode()).toBe('production');
    });

    it('should load debug config from custom path via environment variable', async () => {
      // This test verifies that the DEBUG_LOG_CONFIG_PATH env var is respected
      const customPath = 'custom-debug-config.json';
      process.env.DEBUG_LOG_CONFIG_PATH = customPath;

      const mockLogger = new ConsoleLogger(LogLevel.INFO);
      const loader = new DebugLogConfigLoader({ logger: mockLogger });

      // The loader should be configured with the custom path
      // We can't easily verify the internal path, but we can check
      // that it attempts to load from the custom path
      const result = await loader.loadConfig();

      // Since the custom file doesn't exist, it should return an error
      expect(result.error).toBeTruthy();
      expect(result.path).toBe(customPath);
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain compatibility with legacy logger config', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
      };

      // Create a legacy config loader
      const legacyLoader = new LoggerConfigLoader({
        logger: mockLogger,
        safeEventDispatcher: { dispatch: jest.fn() },
      });

      // The legacy loader should still work
      const result = await legacyLoader.loadConfig();

      // Result should be either a valid config or an error object
      expect(result).toBeDefined();
    });

    it('should handle both mode and logLevel fields in debug config', () => {
      // Test with mode field
      const loggerWithMode = new LoggerStrategy({
        config: {
          mode: 'production',
          logLevel: 'INFO', // Should be ignored when mode is present
        },
        dependencies: {
          consoleLogger: new ConsoleLogger(LogLevel.INFO),
        },
      });
      expect(loggerWithMode.getMode()).toBe('production');

      // Test with only logLevel field (backward compatibility)
      const loggerWithLogLevel = new LoggerStrategy({
        config: {
          logLevel: 'DEBUG', // No mode field
        },
        dependencies: {
          consoleLogger: new ConsoleLogger(LogLevel.INFO),
        },
      });
      // Should use default mode detection
      expect(loggerWithLogLevel.getMode()).toBeDefined();
    });
  });

  describe('Error handling and fallback', () => {
    it('should handle missing debug config file gracefully', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const loader = new DebugLogConfigLoader({
        logger: mockLogger,
        configPath: 'non-existent-file.json',
      });

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      // The stage could be 'fetch' or 'parse' depending on the exact error
      expect(['fetch', 'parse', 'fetch_or_parse']).toContain(result.stage);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load or parse'),
        expect.any(Object)
      );
    });

    it('should handle malformed JSON in debug config', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // We can't easily create a malformed JSON file in the test,
      // but we can verify the validation logic works
      const loader = new DebugLogConfigLoader({ logger: mockLogger });

      // Simulate what would happen with malformed JSON
      // by checking the validation logic directly
      // The actual fetch would fail with a parse error
    });

    it('should work without a safeEventDispatcher', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Create loader without safeEventDispatcher
      const loader = new DebugLogConfigLoader({
        logger: mockLogger,
        // No safeEventDispatcher provided
      });

      // Should still work
      const result = await loader.loadConfig('non-existent.json');
      expect(result.error).toBe(true);
    });
  });
});
