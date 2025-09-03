import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { loadAndApplyLoggerConfig } from '../../../../src/configuration/utils/loggerConfigUtils.js';
import { LoggerConfigLoader } from '../../../../src/configuration/loggerConfigLoader.js';

jest.mock('../../../../src/configuration/loggerConfigLoader.js');

const mockLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLogLevel: jest.fn(),
});

describe('loggerConfigUtils', () => {
  describe('loadAndApplyLoggerConfig', () => {
    let mockContainer;
    let logger;
    let mockTokens;
    let mockEventDispatcher;
    let mockLoggerConfigLoader;

    beforeEach(() => {
      jest.clearAllMocks();

      logger = mockLogger();
      mockEventDispatcher = { dispatch: jest.fn() };
      mockTokens = { ISafeEventDispatcher: Symbol('ISafeEventDispatcher') };
      mockContainer = {
        resolve: jest.fn().mockReturnValue(mockEventDispatcher),
      };

      mockLoggerConfigLoader = {
        loadConfig: jest.fn(),
      };
      LoggerConfigLoader.mockImplementation(() => mockLoggerConfigLoader);
    });

    it('should load and apply logger configuration successfully', async () => {
      mockLoggerConfigLoader.loadConfig.mockResolvedValue({
        logLevel: 'DEBUG',
      });

      await loadAndApplyLoggerConfig(mockContainer, logger, mockTokens);

      expect(LoggerConfigLoader).toHaveBeenCalledWith({
        logger,
        safeEventDispatcher: mockEventDispatcher,
      });
      expect(mockLoggerConfigLoader.loadConfig).toHaveBeenCalled();
      expect(logger.setLogLevel).toHaveBeenCalledWith('DEBUG');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Logger configuration loaded successfully')
      );
    });

    it('should use custom config prefix in log messages', async () => {
      mockLoggerConfigLoader.loadConfig.mockResolvedValue({
        logLevel: 'INFO',
      });

      await loadAndApplyLoggerConfig(
        mockContainer,
        logger,
        mockTokens,
        'CustomPrefix'
      );

      // Should attempt to load logger configuration
      expect(logger.debug).toHaveBeenCalledWith(
        '[CustomPrefix] Attempting to load logger configuration...'
      );
      // Should load the config successfully
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[CustomPrefix] Logger configuration loaded successfully'
        )
      );
    });

    it('should warn when logLevel is not a string', async () => {
      mockLoggerConfigLoader.loadConfig.mockResolvedValue({
        logLevel: 123,
      });

      await loadAndApplyLoggerConfig(mockContainer, logger, mockTokens);

      expect(logger.setLogLevel).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("logLevel' is not a string")
      );
    });

    it('should handle error in configuration loading', async () => {
      mockLoggerConfigLoader.loadConfig.mockResolvedValue({
        error: true,
        message: 'Failed to fetch config',
        path: 'config.json',
        stage: 'fetch',
      });

      await loadAndApplyLoggerConfig(mockContainer, logger, mockTokens);

      expect(logger.setLogLevel).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load logger configuration')
      );
    });

    it('should handle empty configuration gracefully', async () => {
      mockLoggerConfigLoader.loadConfig.mockResolvedValue({});

      await loadAndApplyLoggerConfig(mockContainer, logger, mockTokens);

      expect(logger.setLogLevel).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no specific logLevel found')
      );
    });

    it('should handle exceptions during configuration loading', async () => {
      const error = new Error('Network error');
      mockLoggerConfigLoader.loadConfig.mockRejectedValue(error);

      await loadAndApplyLoggerConfig(mockContainer, logger, mockTokens);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR'),
        expect.objectContaining({
          message: 'Network error',
        })
      );
    });
  });
});
