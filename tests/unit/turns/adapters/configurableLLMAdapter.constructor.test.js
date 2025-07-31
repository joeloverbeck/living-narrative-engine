/**
 * @file Tests for ConfigurableLLMAdapter constructor validation
 * @see src/turns/adapters/configurableLLMAdapter.js
 */

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../../common/mockFactories/index.js';

describe('ConfigurableLLMAdapter - Constructor Validation', () => {
  let mockLogger;
  let mockEnvironmentContext;
  let mockApiKeyProvider;
  let mockLlmStrategyFactory;
  let mockConfigurationManager;
  let mockRequestExecutor;
  let mockErrorMapper;
  let mockTokenEstimator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create valid mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEnvironmentContext = {
      getExecutionEnvironment: jest.fn().mockReturnValue('server'),
      getProjectRootPath: jest.fn().mockReturnValue('/test/root'),
      getProxyServerUrl: jest.fn().mockReturnValue('http://proxy.test'),
      isClient: jest.fn().mockReturnValue(false),
      isServer: jest.fn().mockReturnValue(true),
    };

    mockApiKeyProvider = {
      getKey: jest.fn().mockResolvedValue('mock-api-key'),
    };

    mockLlmStrategyFactory = {
      getStrategy: jest.fn(),
    };

    mockConfigurationManager = createMockLLMConfigurationManager();
    mockRequestExecutor = createMockLLMRequestExecutor();
    mockErrorMapper = createMockLLMErrorMapper();
    mockTokenEstimator = createMockTokenEstimator();
  });

  describe('Service dependency validation', () => {
    it('should throw an Error if configurationManager is missing', () => {
      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: null,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );
    });

    it('should throw an Error if configurationManager is invalid (missing getActiveConfiguration method)', () => {
      const invalidConfigManager = {
        init: jest.fn(),
        // Missing getActiveConfiguration method
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: invalidConfigManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );
    });

    it('should throw an Error if configurationManager.getActiveConfiguration is not a function', () => {
      const invalidConfigManager = {
        getActiveConfiguration: 'not a function',
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: invalidConfigManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
      );
    });

    it('should throw an Error if requestExecutor is missing', () => {
      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: null,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );
    });

    it('should throw an Error if requestExecutor is invalid (missing executeRequest method)', () => {
      const invalidRequestExecutor = {
        someOtherMethod: jest.fn(),
        // Missing executeRequest method
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: invalidRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );
    });

    it('should throw an Error if requestExecutor.executeRequest is not a function', () => {
      const invalidRequestExecutor = {
        executeRequest: 'not a function',
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: invalidRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
      );
    });

    it('should throw an Error if errorMapper is missing', () => {
      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: null,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );
    });

    it('should throw an Error if errorMapper is invalid (missing mapHttpError method)', () => {
      const invalidErrorMapper = {
        logError: jest.fn(),
        // Missing mapHttpError method
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: invalidErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );
    });

    it('should throw an Error if errorMapper.mapHttpError is not a function', () => {
      const invalidErrorMapper = {
        mapHttpError: 'not a function',
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: invalidErrorMapper,
          tokenEstimator: mockTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.'
      );
    });

    it('should throw an Error if tokenEstimator is missing', () => {
      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: null,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );
    });

    it('should throw an Error if tokenEstimator is invalid (missing estimateTokens method)', () => {
      const invalidTokenEstimator = {
        getTokenBudget: jest.fn(),
        // Missing estimateTokens method
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: invalidTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );
    });

    it('should throw an Error if tokenEstimator.estimateTokens is not a function', () => {
      const invalidTokenEstimator = {
        estimateTokens: 'not a function',
      };

      expect(() => {
        new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
          configurationManager: mockConfigurationManager,
          requestExecutor: mockRequestExecutor,
          errorMapper: mockErrorMapper,
          tokenEstimator: invalidTokenEstimator,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.'
      );
    });
  });

  describe('initialLlmId parameter handling', () => {
    it('should accept and store a valid string initialLlmId', () => {
      const adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 'test-llm-id',
      });

      expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ConfigurableLLMAdapter: Instance created')
      );
    });

    it('should handle initialLlmId being null', () => {
      const adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: null,
      });

      expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn and treat invalid type initialLlmId as null', () => {
      const adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 123, // Invalid type
      });

      expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Constructor received an invalid type for initialLlmId (expected string or null). Received: number. Ignoring.'
      );
    });

    it('should warn and treat empty string initialLlmId as null', () => {
      const adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: '   ', // Empty/whitespace string
      });

      expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided.'
      );
    });
  });
});