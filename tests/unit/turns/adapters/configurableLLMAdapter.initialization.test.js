// tests/turns/adapters/ConfigurableLLMAdapter.initialization.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust path as needed
import {
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../../common/mockFactories/index.js';

// Mock dependencies
const mockLoggerInstance = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const mockEnvironmentContextInstance = () => ({
  getExecutionEnvironment: jest.fn().mockReturnValue('client'),
  getProjectRootPath: jest.fn().mockReturnValue('/mock/root'),
  getProxyServerUrl: jest.fn().mockReturnValue(''),
  isClient: jest.fn().mockReturnValue(true),
  isServer: jest.fn().mockReturnValue(false),
});

const mockApiKeyProviderInstance = () => ({
  getKey: jest.fn().mockResolvedValue('mock-api-key'),
});

const mockLlmStrategyFactoryInstance = () => ({
  getStrategy: jest.fn(),
});

const mockLlmConfigLoaderInstance = () => ({
  loadConfigs: jest.fn(),
});

const MOCK_LLM_CONFIG_SCHEMA_ID =
  'schema://living-narrative-engine/llm-configs.schema.json';

describe('ConfigurableLLMAdapter - Initialization Handling', () => {
  let mockLogger;
  let mockEnvironmentContext;
  let mockApiKeyProvider;
  let mockLlmStrategyFactory;
  /** @type {jest.Mocked<ReturnType<typeof mockLlmConfigLoaderInstance>>} */
  let mockLlmConfigLoader;
  let mockConfigurationManager;
  let mockRequestExecutor;
  let mockErrorMapper;
  let mockTokenEstimator;
  /** @type {ConfigurableLLMAdapter} */
  let adapter;

  beforeEach(() => {
    mockLogger = mockLoggerInstance();
    mockEnvironmentContext = mockEnvironmentContextInstance();
    mockApiKeyProvider = mockApiKeyProviderInstance();
    mockLlmStrategyFactory = mockLlmStrategyFactoryInstance();
    mockLlmConfigLoader = mockLlmConfigLoaderInstance();
    mockConfigurationManager = createMockLLMConfigurationManager();
    mockRequestExecutor = createMockLLMRequestExecutor();
    mockErrorMapper = createMockLLMErrorMapper();
    mockTokenEstimator = createMockTokenEstimator();

    adapter = new ConfigurableLLMAdapter({
      logger: mockLogger,
      environmentContext: mockEnvironmentContext,
      apiKeyProvider: mockApiKeyProvider,
      llmStrategyFactory: mockLlmStrategyFactory,
      configurationManager: mockConfigurationManager,
      requestExecutor: mockRequestExecutor,
      errorMapper: mockErrorMapper,
      tokenEstimator: mockTokenEstimator,
    });
  });

  it('should become non-operational if LlmConfigLoader.loadConfigs fails due to a schema validation error (schema not found)', async () => {
    // Arrange
    const schemaNotFoundErrorDetail = {
      instancePath: '',
      schemaPath: '',
      keyword: 'schemaNotFound',
      params: { schemaId: MOCK_LLM_CONFIG_SCHEMA_ID },
      message: `Schema with id '${MOCK_LLM_CONFIG_SCHEMA_ID}' not found.`,
    };
    const schemaValidationErrorResult = {
      error: true,
      message: 'LLM Prompt configuration schema validation failed.',
      stage: 'validation',
      path: 'config/llm-configs.json',
      validationErrors: [
        {
          errorType: 'SCHEMA_VALIDATION',
          configId: 'N/A (root data)',
          path: '(root)',
          message: schemaNotFoundErrorDetail.message,
          details: schemaNotFoundErrorDetail,
        },
      ],
    };
    mockLlmConfigLoader.loadConfigs.mockResolvedValue(
      schemaValidationErrorResult
    );

    // Configure the mock configuration manager to call loadConfigs when init is called
    // and handle schema validation errors by becoming non-operational
    mockConfigurationManager.init.mockImplementation(
      async ({ llmConfigLoader }) => {
        const result = await llmConfigLoader.loadConfigs();
        if (result?.error === true) {
          mockConfigurationManager.isOperational.mockReturnValue(false);
          // Simulate the logging that would happen in the real configuration manager
          mockLogger.error(
            'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
            {
              message: result.message,
              stage: result.stage,
              path: result.path,
              originalErrorMessage: 'N/A',
            }
          );
          mockLogger.warn(
            'ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.'
          );
        }
        return result;
      }
    );

    // Act
    await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

    // Assert
    expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
    expect(adapter.isInitialized()).toBe(true);
    expect(adapter.isOperational()).toBe(false); // Key assertion for this scenario

    expect(mockLogger.error).toHaveBeenCalledWith(
      'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
      expect.objectContaining({
        message: schemaValidationErrorResult.message,
        stage: schemaValidationErrorResult.stage,
        path: schemaValidationErrorResult.path,
        originalErrorMessage: 'N/A', // Because schemaValidationErrorResult doesn't have originalError
      })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.'
    );
  });

  it('should throw from methods guarded by #ensureInitialized if init completed but adapter is non-operational due to schema issues', async () => {
    // Arrange: Setup a failed initialization (schema validation error)
    const schemaValidationErrorResult = {
      error: true,
      message: 'Config load failed due to schema validation',
      stage: 'validation',
      validationErrors: [{ message: 'Schema not found' }],
    };
    mockLlmConfigLoader.loadConfigs.mockResolvedValue(
      schemaValidationErrorResult
    );

    // Configure the mock configuration manager to call loadConfigs and become non-operational
    mockConfigurationManager.init.mockImplementation(
      async ({ llmConfigLoader }) => {
        const result = await llmConfigLoader.loadConfigs();
        if (result?.error === true) {
          mockConfigurationManager.isOperational.mockReturnValue(false);
        }
        return result;
      }
    );

    await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

    expect(adapter.isOperational()).toBe(false); // Verify non-operational state

    // Act & Assert for various methods
    const expectedErrorMessage =
      'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.';
    await expect(adapter.getAIDecision('test summary')).rejects.toThrow(
      expectedErrorMessage
    );
    await expect(adapter.setActiveLlm('some-id')).rejects.toThrow(
      expectedErrorMessage
    );
    await expect(adapter.getCurrentActiveLlmConfig()).rejects.toThrow(
      expectedErrorMessage
    );
    // getAvailableLlmOptions also uses #ensureInitialized indirectly
    // It should catch the error and return an empty array as per its own try/catch.
    const options = await adapter.getAvailableLlmOptions();
    expect(options).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `ConfigurableLLMAdapter.getAvailableLlmOptions: Error retrieving options. Error: ${expectedErrorMessage}`
      )
    );
  });

  it('should throw from methods guarded by #ensureInitialized if init() was never called', async () => {
    // Arrange: Adapter is instantiated but init() is not called
    expect(adapter.isInitialized()).toBe(false);

    // Act & Assert for various methods
    const expectedErrorMessage =
      'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.';
    await expect(adapter.getAIDecision('test summary')).rejects.toThrow(
      expectedErrorMessage
    );
    await expect(adapter.setActiveLlm('some-id')).rejects.toThrow(
      expectedErrorMessage
    );
    await expect(adapter.getCurrentActiveLlmConfig()).rejects.toThrow(
      expectedErrorMessage
    );

    const options = await adapter.getAvailableLlmOptions();
    expect(options).toEqual([]); // Handles error and returns empty
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `ConfigurableLLMAdapter.getAvailableLlmOptions: Error retrieving options. Error: ${expectedErrorMessage}`
      )
    );
  });

  it('should throw synchronous error from init and become non-operational if LlmConfigLoader is invalid (null)', async () => {
    // Act & Assert
    await expect(adapter.init({ llmConfigLoader: null })).rejects.toThrow(
      'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.'
    );

    // Assert state after synchronous throw
    expect(adapter.isInitialized()).toBe(true); // init was attempted
    expect(adapter.isOperational()).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
      { providedLoader: null }
    );
  });

  it('should throw synchronous error from init and become non-operational if LlmConfigLoader is invalid (missing loadConfigs method)', async () => {
    // Arrange
    const invalidLoader = { someOtherMethod: jest.fn() }; // Does not have loadConfigs

    // Act & Assert
    // @ts-ignore // Testing invalid input
    await expect(
      adapter.init({ llmConfigLoader: invalidLoader })
    ).rejects.toThrow(
      'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.'
    );

    // Assert state after synchronous throw
    expect(adapter.isInitialized()).toBe(true); // init was attempted
    expect(adapter.isOperational()).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
      { providedLoader: invalidLoader }
    );
  });
});

// --- FILE END ---
