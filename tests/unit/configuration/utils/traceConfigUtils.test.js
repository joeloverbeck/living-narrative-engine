import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  loadAndApplyTraceConfig,
  getTraceConfiguration,
  isTraceAnalysisEnabled,
} from '../../../../src/configuration/utils/traceConfigUtils.js';
import { TraceConfigLoader } from '../../../../src/configuration/traceConfigLoader.js';

jest.mock('../../../../src/configuration/traceConfigLoader.js');

describe('traceConfigUtils', () => {
  let mockContainer;
  let mockLogger;
  let mockTokens;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSafeEventDispatcher = { dispatch: jest.fn() };
    
    mockContainer = {
      resolve: jest.fn().mockImplementation((token) => {
        if (token === 'ISafeEventDispatcher') {
          return mockSafeEventDispatcher;
        }
        throw new Error(`Token ${token} not registered`);
      }),
      register: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTokens = {
      ISafeEventDispatcher: 'ISafeEventDispatcher',
      ITraceConfiguration: 'ITraceConfiguration',
    };
  });

  describe('loadAndApplyTraceConfig', () => {
    it('should load and register configuration when successful', async () => {
      const mockConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: { enabled: true },
        visualization: { enabled: true },
        analysis: { enabled: true },
      };

      const mockLoadConfig = jest.fn().mockResolvedValue(mockConfig);
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(
        mockContainer,
        mockLogger,
        mockTokens,
        'TestPrefix'
      );

      expect(TraceConfigLoader).toHaveBeenCalledWith({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      expect(mockLoadConfig).toHaveBeenCalled();
      expect(mockContainer.register).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration,
        mockConfig
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Analysis enabled: true')
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Performance: true, Visualization: true, Analysis: true')
      );
    });

    it('should handle disabled trace analysis', async () => {
      const mockConfig = {
        traceAnalysisEnabled: false,
      };

      const mockLoadConfig = jest.fn().mockResolvedValue(mockConfig);
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(mockContainer, mockLogger, mockTokens);

      expect(mockContainer.register).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration,
        mockConfig
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('disabled by configuration')
      );
    });

    it('should use default config on load error', async () => {
      const mockError = {
        error: true,
        message: 'Failed to load',
      };

      const mockLoadConfig = jest.fn().mockResolvedValue(mockError);
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(mockContainer, mockLogger, mockTokens);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load trace configuration')
      );

      expect(mockContainer.register).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration,
        { traceAnalysisEnabled: false }
      );
    });

    it('should use default config when no configuration specified', async () => {
      const mockLoadConfig = jest.fn().mockResolvedValue({});
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(mockContainer, mockLogger, mockTokens);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No trace configuration specified')
      );

      expect(mockContainer.register).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration,
        { traceAnalysisEnabled: false }
      );
    });

    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected error');
      const mockLoadConfig = jest.fn().mockRejectedValue(error);
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(mockContainer, mockLogger, mockTokens);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error'),
        error
      );

      expect(mockContainer.register).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration,
        { traceAnalysisEnabled: false }
      );
    });

    it('should handle partial configurations', async () => {
      const mockConfig = {
        traceAnalysisEnabled: true,
        // Missing optional sections
      };

      const mockLoadConfig = jest.fn().mockResolvedValue(mockConfig);
      TraceConfigLoader.mockImplementation(() => ({
        loadConfig: mockLoadConfig,
      }));

      await loadAndApplyTraceConfig(mockContainer, mockLogger, mockTokens);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Performance: true, Visualization: true, Analysis: true')
      );
    });
  });

  describe('getTraceConfiguration', () => {
    it('should return configuration from container', () => {
      const mockConfig = { traceAnalysisEnabled: true };
      mockContainer.resolve.mockReturnValue(mockConfig);

      const result = getTraceConfiguration(mockContainer, mockTokens);

      expect(result).toBe(mockConfig);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        mockTokens.ITraceConfiguration
      );
    });

    it('should return default configuration when not found', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = getTraceConfiguration(mockContainer, mockTokens);

      expect(result).toEqual({ traceAnalysisEnabled: false });
    });
  });

  describe('isTraceAnalysisEnabled', () => {
    it('should return true when enabled', () => {
      mockContainer.resolve.mockReturnValue({ traceAnalysisEnabled: true });

      const result = isTraceAnalysisEnabled(mockContainer, mockTokens);

      expect(result).toBe(true);
    });

    it('should return false when disabled', () => {
      mockContainer.resolve.mockReturnValue({ traceAnalysisEnabled: false });

      const result = isTraceAnalysisEnabled(mockContainer, mockTokens);

      expect(result).toBe(false);
    });

    it('should return false when configuration not found', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = isTraceAnalysisEnabled(mockContainer, mockTokens);

      expect(result).toBe(false);
    });
  });
});