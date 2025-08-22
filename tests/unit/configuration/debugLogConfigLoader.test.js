// tests/unit/configuration/debugLogConfigLoader.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DebugLogConfigLoader } from '../../../src/configuration/debugLogConfigLoader.js';
import * as httpUtils from '../../../src/utils/httpUtils.js';

// Mock dependencies
jest.mock('../../../src/utils/httpUtils.js');

describe('DebugLogConfigLoader', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleDebugSpy;
  let consoleInfoSpy;
  let mockLogger;
  let mockSafeEventDispatcher;

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

      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(httpUtils.fetchWithRetry).toHaveBeenCalledWith(
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

      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig(customPath);

      expect(result).toEqual(mockConfig);
      expect(httpUtils.fetchWithRetry).toHaveBeenCalledWith(
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
      httpUtils.fetchWithRetry.mockResolvedValue({});

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration file from config/debug-logging-config.json is empty'
        )
      );
    });

    it('should return error for malformed JSON (not an object)', async () => {
      httpUtils.fetchWithRetry.mockResolvedValue('invalid json string');

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

      httpUtils.fetchWithRetry.mockResolvedValue(invalidConfig);

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

      httpUtils.fetchWithRetry.mockResolvedValue(invalidConfig);

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

      httpUtils.fetchWithRetry.mockResolvedValue(invalidConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBeUndefined();
      expect(result).toEqual(invalidConfig);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("'enabled'")
      );
      // Verify the warning message contains the required text
      const warnCall = mockLogger.warn.mock.calls[0][0];
      expect(warnCall).toContain('must be a boolean');
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchError = new Error('Network error');
      httpUtils.fetchWithRetry.mockRejectedValue(fetchError);

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
      httpUtils.fetchWithRetry.mockRejectedValue(parseError);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('Failed to load or parse');
      expect(result.stage).toBe('parse');
      expect(result.originalError).toBe(parseError);
    });

    it('should work without a logger (using console)', async () => {
      const mockConfig = { enabled: true, mode: 'production' };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader();
      const result = await loader.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should create a no-op event dispatcher if not provided', async () => {
      const mockConfig = { enabled: true };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const result = await loader.loadConfig();

      expect(result).toEqual(mockConfig);
      // Verify fetchWithRetry was called with a dispatcher (even if it's a no-op)
      expect(httpUtils.fetchWithRetry).toHaveBeenCalledWith(
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
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(true);
    });

    it('should return false when config is explicitly disabled', async () => {
      const mockConfig = { enabled: false, mode: 'development' };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(false);
    });

    it('should return true when enabled is not specified (default)', async () => {
      const mockConfig = { mode: 'development' };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(true);
    });

    it('should return false when config fails to load', async () => {
      httpUtils.fetchWithRetry.mockRejectedValue(new Error('Load failed'));

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const isEnabled = await loader.isEnabled();

      expect(isEnabled).toBe(false);
    });
  });

  describe('getMode', () => {
    it('should return the configured mode', async () => {
      const mockConfig = { enabled: true, mode: 'production' };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const mode = await loader.getMode();

      expect(mode).toBe('production');
    });

    it('should return null when mode is not configured', async () => {
      const mockConfig = { enabled: true };
      httpUtils.fetchWithRetry.mockResolvedValue(mockConfig);

      const loader = new DebugLogConfigLoader({ logger: mockLogger });
      const mode = await loader.getMode();

      expect(mode).toBeNull();
    });

    it('should return null when config fails to load', async () => {
      httpUtils.fetchWithRetry.mockRejectedValue(new Error('Load failed'));

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
});
