import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TraceConfigLoader } from '../../../src/configuration/traceConfigLoader.js';
import { fetchWithRetry } from '../../../src/utils';

jest.mock('../../../src/utils', () => ({
  fetchWithRetry: jest.fn(),
}));

const mockLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
});

describe('TraceConfigLoader', () => {
  /** @type {TraceConfigLoader} */
  let loader;
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;
  let dispatcherMock;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(true) };
  });

  describe('constructor', () => {
    it('should create loader with required dependencies', () => {
      loader = new TraceConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });

      expect(loader).toBeDefined();
    });

    it('should throw error if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new TraceConfigLoader({
            logger,
          })
      ).toThrow('TraceConfigLoader requires a valid ISafeEventDispatcher');
    });

    it('should accept custom config path', () => {
      const customPath = 'custom/trace-config.json';
      loader = new TraceConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
        configPath: customPath,
      });

      expect(loader).toBeDefined();
    });
  });

  describe('loadConfig', () => {
    beforeEach(() => {
      loader = new TraceConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });
    });

    it('should load valid configuration successfully', async () => {
      const mockConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          enabled: true,
          thresholds: {
            slowOperationMs: 100,
            criticalOperationMs: 500,
          },
        },
      };

      fetchWithRetry.mockResolvedValueOnce(mockConfig);

      const result = await loader.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        'config/trace-config.json',
        { method: 'GET', headers: { Accept: 'application/json' } },
        2,
        300,
        1000,
        dispatcherMock,
        logger
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Configuration loaded successfully')
      );
    });

    it('should return empty object for empty configuration file', async () => {
      fetchWithRetry.mockResolvedValueOnce({});

      const result = await loader.loadConfig();

      expect(result).toEqual({});
    });

    it('should return error for malformed JSON', async () => {
      fetchWithRetry.mockResolvedValueOnce('not an object');

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('malformed');
      expect(result.stage).toBe('validation');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should validate traceAnalysisEnabled type', async () => {
      const invalidConfig = {
        traceAnalysisEnabled: 'true', // Should be boolean
      };

      fetchWithRetry.mockResolvedValueOnce(invalidConfig);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('must be a boolean');
      expect(result.stage).toBe('validation');
    });

    it('should validate performance threshold types', async () => {
      const invalidConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          thresholds: {
            slowOperationMs: 'invalid', // Should be number
          },
        },
      };

      fetchWithRetry.mockResolvedValueOnce(invalidConfig);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('must be a non-negative number');
    });

    it('should validate sampling rate range', async () => {
      const invalidConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          sampling: {
            rate: 1.5, // Should be between 0 and 1
          },
        },
      };

      fetchWithRetry.mockResolvedValueOnce(invalidConfig);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('must be a number between 0 and 1');
    });

    it('should validate sampling strategy', async () => {
      const invalidConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          sampling: {
            strategy: 'invalid_strategy',
          },
        },
      };

      fetchWithRetry.mockResolvedValueOnce(invalidConfig);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('must be one of');
    });

    it('should validate performance monitoring object structure', async () => {
      const invalidConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: 'enabled',
      };

      fetchWithRetry.mockResolvedValueOnce(invalidConfig);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('must be an object');
      expect(result.stage).toBe('validation');
    });

    it('should handle fetch errors', async () => {
      const fetchError = new Error('Network error');
      fetchWithRetry.mockRejectedValueOnce(fetchError);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.message).toContain('Network error');
      expect(result.stage).toBe('fetch');
      expect(result.originalError).toBe(fetchError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle parse errors', async () => {
      const parseError = new Error('Unexpected token in JSON');
      fetchWithRetry.mockRejectedValueOnce(parseError);

      const result = await loader.loadConfig();

      expect(result.error).toBe(true);
      expect(result.stage).toBe('parse');
    });

    it('should use custom file path when provided', async () => {
      const customPath = 'custom/trace-config.json';
      const mockConfig = { traceAnalysisEnabled: false };

      fetchWithRetry.mockResolvedValueOnce(mockConfig);

      const result = await loader.loadConfig(customPath);

      expect(result).toEqual(mockConfig);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        customPath,
        expect.any(Object),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('isAnyTracingEnabled', () => {
    beforeEach(() => {
      loader = new TraceConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });
    });

    it('returns false when loadConfig resolves to an error result', async () => {
      fetchWithRetry.mockResolvedValueOnce({ error: true, message: 'failed' });

      const result = await loader.isAnyTracingEnabled();

      expect(result).toBe(false);
    });

    it('returns true when any tracing feature is enabled', async () => {
      const config = {
        traceAnalysisEnabled: false,
        performanceMonitoring: { enabled: false },
        visualization: { enabled: false },
        analysis: { enabled: false },
        actionTracing: { enabled: true },
      };

      fetchWithRetry.mockResolvedValueOnce(config);

      const result = await loader.isAnyTracingEnabled();

      expect(result).toBe(true);
    });
  });

  describe('getActionTracingConfig', () => {
    beforeEach(() => {
      loader = new TraceConfigLoader({
        logger,
        safeEventDispatcher: dispatcherMock,
      });
    });

    it('returns null when config load fails', async () => {
      fetchWithRetry.mockResolvedValueOnce({ error: true, message: 'failed' });

      const result = await loader.getActionTracingConfig();

      expect(result).toBeNull();
    });

    it('returns action tracing configuration when available', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['action-1'],
        },
      };

      fetchWithRetry.mockResolvedValueOnce(config);

      const result = await loader.getActionTracingConfig();

      expect(result).toEqual(config.actionTracing);
    });
  });
});
