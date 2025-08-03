/**
 * @file Unit tests for configurationStages.js
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { initializeGlobalConfigStage } from '../../../../src/bootstrapper/stages/configurationStages.js';

// Mock the dependencies
jest.mock('../../../../src/entities/utils/configUtils.js');
jest.mock('../../../../src/utils/bootstrapperHelpers.js');

import { initializeGlobalConfig } from '../../../../src/entities/utils/configUtils.js';
import { stageSuccess, stageFailure } from '../../../../src/utils/bootstrapperHelpers.js';

describe('configurationStages - initializeGlobalConfigStage', () => {
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Setup default mock implementations
    initializeGlobalConfig.mockImplementation(() => {
      // Mock successful initialization
    });

    stageSuccess.mockReturnValue({
      success: true,
      payload: undefined,
    });

    stageFailure.mockReturnValue({
      success: false,
      error: new Error('Stage failed'),
      phase: 'Global Configuration Initialization',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success scenarios', () => {
    it('should successfully initialize global configuration with default parameters', async () => {
      // Act
      const result = await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledWith(mockLogger, {});
      expect(stageSuccess).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should successfully initialize global configuration with user config', async () => {
      // Arrange
      const userConfig = { 
        customSetting: 'testValue',
        anotherSetting: 123
      };

      // Act
      const result = await initializeGlobalConfigStage(mockLogger, userConfig);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledWith(mockLogger, userConfig);
      expect(stageSuccess).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should log appropriate debug messages during successful initialization', async () => {
      // Arrange
      const userConfig = { testKey: 'testValue' };

      // Act
      await initializeGlobalConfigStage(mockLogger, userConfig);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Bootstrap Stage: Initializing Global Configuration...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration Stage: Initializing global configuration provider...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration Stage: Global configuration provider initialized successfully.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration Stage: Configuration system is now available for all services.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Bootstrap Stage: Initializing Global Configuration... DONE. Configuration system available.'
      );
    });

    it('should log configuration summary with user config details', async () => {
      // Arrange
      const userConfig = { 
        setting1: 'value1',
        setting2: 'value2'
      };

      // Act
      await initializeGlobalConfigStage(mockLogger, userConfig);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration Stage: Configuration initialized with the following settings:',
        {
          hasUserConfig: true,
          userConfigKeys: ['setting1', 'setting2'],
        }
      );
    });

    it('should log configuration summary with no user config', async () => {
      // Act
      await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration Stage: Configuration initialized with the following settings:',
        {
          hasUserConfig: false,
          userConfigKeys: [],
        }
      );
    });
  });

  describe('Error scenarios', () => {
    it('should handle errors during configuration initialization', async () => {
      // Arrange
      const configError = new Error('Configuration initialization failed');
      initializeGlobalConfig.mockImplementation(() => {
        throw configError;
      });

      stageFailure.mockReturnValue({
        success: false,
        error: configError,
        phase: 'Global Configuration Initialization',
      });

      // Act
      const result = await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration Stage: Fatal error during global configuration initialization.',
        configError
      );
      expect(stageFailure).toHaveBeenCalledWith(
        'Global Configuration Initialization',
        'Fatal Error during global configuration initialization: Configuration initialization failed.',
        configError
      );
      expect(result.success).toBe(false);
    });

    it('should propagate custom error messages in failure stage', async () => {
      // Arrange
      const customError = new Error('Custom configuration error');
      initializeGlobalConfig.mockImplementation(() => {
        throw customError;
      });

      // Act
      await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(stageFailure).toHaveBeenCalledWith(
        'Global Configuration Initialization',
        'Fatal Error during global configuration initialization: Custom configuration error.',
        customError
      );
    });

    it('should handle errors gracefully with user config present', async () => {
      // Arrange
      const userConfig = { failingSetting: 'badValue' };
      const configError = new Error('Invalid user configuration');
      initializeGlobalConfig.mockImplementation(() => {
        throw configError;
      });

      // Act
      const result = await initializeGlobalConfigStage(mockLogger, userConfig);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledWith(mockLogger, userConfig);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration Stage: Fatal error during global configuration initialization.',
        configError
      );
      expect(result.success).toBe(false);
    });
  });

  describe('Parameter validation', () => {
    it('should fail gracefully with null logger', async () => {
      // Note: The function requires a valid logger, testing actual behavior
      // Act & Assert - should reject due to null logger
      await expect(initializeGlobalConfigStage(null)).rejects.toThrow();
    });

    it('should handle undefined userConfig parameter', async () => {
      // Act
      await initializeGlobalConfigStage(mockLogger, undefined);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledWith(mockLogger, {});
    });

    it('should handle null userConfig parameter', async () => {
      // Act
      await initializeGlobalConfigStage(mockLogger, null);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledWith(mockLogger, null);
    });
  });

  describe('Integration behavior', () => {
    it('should call initializeGlobalConfig exactly once', async () => {
      // Act
      await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(initializeGlobalConfig).toHaveBeenCalledTimes(1);
    });

    it('should call stageSuccess exactly once on successful execution', async () => {
      // Act
      await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(stageSuccess).toHaveBeenCalledTimes(1);
      expect(stageFailure).not.toHaveBeenCalled();
    });

    it('should call stageFailure exactly once on error', async () => {
      // Arrange
      initializeGlobalConfig.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Act
      await initializeGlobalConfigStage(mockLogger);

      // Assert
      expect(stageFailure).toHaveBeenCalledTimes(1);
      expect(stageSuccess).not.toHaveBeenCalled();
    });
  });
});