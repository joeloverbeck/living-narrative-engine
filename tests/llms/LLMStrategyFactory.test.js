// tests/llms/LLMStrategyFactory.test.js
// --- CORRECTED FILE START ---
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { LLMStrategyFactory } from '../../src/llms/LLMStrategyFactory.js';
import { ConfigurationError } from '../../src/turns/adapters/configurableLLMAdapter.js';
import { LLMStrategyFactoryError } from '../../src/llms/errors/LLMStrategyFactoryError.js';

// Import concrete strategies to check instanceof and to mock their modules
import { OpenRouterJsonSchemaStrategy } from '../../src/llms/strategies/openRouterJsonSchemaStrategy.js';
import { OpenRouterToolCallingStrategy } from '../../src/llms/strategies/openRouterToolCallingStrategy.js';

/**
 * @typedef {import('../../src/interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../src/interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../src/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType
 */

// Mock the concrete strategy modules
jest.mock('../../src/llms/strategies/openRouterJsonSchemaStrategy.js');
jest.mock('../../src/llms/strategies/openRouterToolCallingStrategy.js');

/** @returns {jest.Mocked<ILogger>} */
const mockLoggerInstance = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/** @returns {jest.Mocked<IHttpClient>} */
const mockHttpClientInstance = () => ({
  request: jest.fn(),
});

// Helper function to create a minimal valid LLMModelConfigType
/**
 * @param {object} overrides - Object to override default mock dependencyInjection properties.
 * @returns {LLMModelConfigType}
 */
const createMockLlmConfig = (overrides) => {
  const defaultConfig = {
    // Use configId as the primary identifier
    configId: overrides.id || overrides.configId || 'default-test-id', // Prioritize overrides.id for backward compatibility in test data
    displayName: 'Test LLM',
    modelIdentifier: 'test-model',
    endpointUrl: 'http://example.com/api',
    apiType: 'openrouter', // Default apiType
    jsonOutputStrategy: { method: 'openrouter_json_schema' }, // Default strategy
    promptElements: [],
    promptAssemblyOrder: [],
    // Add other mandatory fields from LLMModelConfigType with default values if necessary
  };
  // If 'id' was passed in overrides (from old test data), ensure it's mapped to configId if configId isn't already set
  const finalConfig = { ...defaultConfig, ...overrides };
  if (overrides.id && !overrides.configId) {
    finalConfig.configId = overrides.id;
  }
  delete finalConfig.id; // Ensure 'id' is not on the final object if it was just for mapping
  return finalConfig;
};

describe('LLMStrategyFactory', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {jest.Mocked<IHttpClient>} */
  let httpClient;
  /** @type {LLMStrategyFactory} */
  let factory;

  beforeEach(() => {
    logger = mockLoggerInstance();
    httpClient = mockHttpClientInstance();

    OpenRouterJsonSchemaStrategy.mockClear();
    OpenRouterToolCallingStrategy.mockClear();

    factory = new LLMStrategyFactory({ httpClient, logger });
  });

  describe('Constructor', () => {
    test('should correctly store injected IHttpClient and ILogger and log creation', () => {
      expect(factory).toBeInstanceOf(LLMStrategyFactory);
      expect(logger.debug).toHaveBeenCalledWith(
        'LLMStrategyFactory: Instance created and dependencies stored.'
      );
    });

    test('should throw error if logger is invalid or missing', () => {
      const invalidLoggers = [null, undefined, {}, { info: 'not a function' }];
      invalidLoggers.forEach((invalidLogger) => {
        expect(
          () =>
            new LLMStrategyFactory({
              httpClient,
              logger: /** @type {any} */ (invalidLogger),
            })
        ).toThrow(
          'LLMStrategyFactory: Constructor requires a valid logger instance with info, warn, error, and debug methods.'
        );
      });
    });

    test('should throw error if httpClient is invalid or missing', () => {
      const invalidHttpClients = [
        null,
        undefined,
        {},
        { request: 'not a function' },
      ];
      invalidHttpClients.forEach((invalidClient) => {
        const tempLogger = mockLoggerInstance();
        expect(
          () =>
            new LLMStrategyFactory({
              httpClient: /** @type {any} */ (invalidClient),
              logger: tempLogger,
            })
        ).toThrow(
          'LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).'
        );
        expect(tempLogger.error).toHaveBeenCalledWith(
          'LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).'
        );
      });
    });
  });

  describe('getStrategy Method', () => {
    const successfulTestCases = [
      {
        description: 'OpenRouter JSON Schema',
        configOverrides: {
          // Use overrides
          configId: 'or-schema', // Changed from id
          apiType: 'openrouter',
          jsonOutputStrategy: { method: 'openrouter_json_schema' },
        },
        ExpectedStrategy: OpenRouterJsonSchemaStrategy,
        expectedApiTypeLog: 'openrouter',
        expectedEffectiveMethod: 'openrouter_json_schema',
        expectedConfiguredMethodLog: 'openrouter_json_schema',
      },
      {
        description: 'OpenRouter Tool Calling',
        configOverrides: {
          // Use overrides
          configId: 'or-tool', // Changed from id
          apiType: 'openrouter',
          jsonOutputStrategy: { method: 'openrouter_tool_calling' },
        },
        ExpectedStrategy: OpenRouterToolCallingStrategy,
        expectedApiTypeLog: 'openrouter',
        expectedEffectiveMethod: 'openrouter_tool_calling',
        expectedConfiguredMethodLog: 'openrouter_tool_calling',
      },
    ];

    successfulTestCases.forEach(
      ({
        description,
        configOverrides,
        ExpectedStrategy,
        expectedApiTypeLog,
        expectedEffectiveMethod,
        expectedConfiguredMethodLog,
      }) => {
        test(`should create ${description} and inject dependencies`, () => {
          const mockConfig = createMockLlmConfig(configOverrides);
          const strategy = factory.getStrategy(mockConfig);

          expect(strategy).toBeInstanceOf(ExpectedStrategy);
          expect(ExpectedStrategy).toHaveBeenCalledTimes(1);
          expect(ExpectedStrategy).toHaveBeenCalledWith({ httpClient, logger });
          expect(logger.info).toHaveBeenCalledWith(
            `LLMStrategyFactory: Selected strategy '${ExpectedStrategy.name}' for LLM ID '${mockConfig.configId}'. Details: apiType='${expectedApiTypeLog}', effectiveMethod='${expectedEffectiveMethod}', configuredMethod='${expectedConfiguredMethodLog}'.`
          );
        });
      }
    );

    const unsupportedApiTypePlusSpecificMethodTestCases = [
      {
        description: 'OpenAI Tool Calling (specific, now unsupported)',
        configOverrides: {
          configId: 'oai-tool',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
      {
        description: 'Anthropic Tool Calling (specific, now unsupported)',
        configOverrides: {
          configId: 'ant-tool',
          apiType: 'anthropic',
          jsonOutputStrategy: { method: 'tool_calling' },
        },
      },
      {
        description: 'OpenAI Native JSON Mode (specific, now unsupported)',
        configOverrides: {
          configId: 'oai-json',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'native_json_mode' },
        },
      },
      {
        description: 'Ollama Native JSON Mode (specific, now unsupported)',
        configOverrides: {
          configId: 'ollama-json',
          apiType: 'ollama',
          jsonOutputStrategy: { method: 'native_json_mode' },
        },
      },
      {
        description:
          "apiType is 'openai' and method is unrecognized (specific, now unsupported)",
        configOverrides: {
          configId: 'fallback-unrec-method-openai',
          apiType: 'openai',
          jsonOutputStrategy: { method: 'unknown_method' },
        },
      },
      {
        description:
          "apiType is 'anthropic' and method is unrecognized (specific, now unsupported)",
        configOverrides: {
          configId: 'fallback-unrec-method-ant',
          apiType: 'anthropic',
          jsonOutputStrategy: { method: 'some_other_method' },
        },
      },
      {
        description:
          "apiType is 'ollama' and method is unmapped (specific, now unsupported)",
        configOverrides: {
          configId: 'fallback-unrec-method-ollama',
          apiType: 'ollama',
          jsonOutputStrategy: { method: 'tool_calling_for_ollama_maybe' },
        },
      },
    ];

    unsupportedApiTypePlusSpecificMethodTestCases.forEach(
      ({ description, configOverrides }) => {
        test(`should throw LLMStrategyFactoryError when ${description}`, () => {
          const mockConfig = createMockLlmConfig(configOverrides);
          const expectedApiType = mockConfig.apiType.toLowerCase();
          const expectedJsonOutputMethod =
            mockConfig.jsonOutputStrategy.method.toLowerCase();
          const expectedThrownErrorMessage = `Unsupported apiType: '${expectedApiType}' (LLM ID: '${mockConfig.configId}'). No strategy can be determined. Supported API types for specialized strategies are: openrouter.`;

          let thrownError = null;
          try {
            factory.getStrategy(mockConfig);
          } catch (e) {
            if (e instanceof LLMStrategyFactoryError) {
              thrownError = e;
            } else {
              throw e; // Re-throw if it's not the expected error type
            }
          }

          expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
          expect(thrownError?.message).toBe(expectedThrownErrorMessage);
          expect(thrownError?.apiType).toBe(expectedApiType);
          expect(thrownError?.jsonOutputMethod).toBe(expectedJsonOutputMethod);

          expect(logger.error).toHaveBeenCalledTimes(1);
          expect(logger.error).toHaveBeenCalledWith(
            `LLMStrategyFactory: ${expectedThrownErrorMessage}`,
            {
              apiType: expectedApiType,
              jsonOutputMethod: expectedJsonOutputMethod,
            }
          );
        });
      }
    );

    describe('Error Handling for Invalid or Obsolete Method Configurations', () => {
      test('should throw LLMStrategyFactoryError if jsonOutputStrategy.method is missing', () => {
        const configOverrides = {
          configId: 'missing-method',
          apiType: 'openrouter',
          jsonOutputStrategy: {},
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${mockConfig.configId}' (apiType: '${mockConfig.apiType}') but was missing or empty. A specific method must be configured.`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }

        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBeUndefined(); // method is undefined
        expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
          llmId: mockConfig.configId,
          apiType: mockConfig.apiType,
          llmConfigJsonOutputStrategy: mockConfig.jsonOutputStrategy,
        });
      });

      test('should throw LLMStrategyFactoryError if jsonOutputStrategy.method is an empty string', () => {
        const configOverrides = {
          configId: 'empty-method',
          apiType: 'openrouter',
          jsonOutputStrategy: { method: '   ' },
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${mockConfig.configId}' (apiType: '${mockConfig.apiType}') but was missing or empty. A specific method must be configured.`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }
        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBe('');
        expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
          llmId: mockConfig.configId,
          apiType: mockConfig.apiType,
          llmConfigJsonOutputStrategy: mockConfig.jsonOutputStrategy,
        });
      });

      test('should throw LLMStrategyFactoryError if jsonOutputStrategy is missing', () => {
        const configOverrides = {
          configId: 'missing-strategy-obj',
          apiType: 'openrouter',
          jsonOutputStrategy: undefined,
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        // Explicitly remove jsonOutputStrategy for this test case after mock creation if createMockLlmConfig adds it by default
        delete mockConfig.jsonOutputStrategy;

        const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${mockConfig.configId}' (apiType: '${mockConfig.apiType}') but was missing or empty. A specific method must be configured.`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }
        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
          llmId: mockConfig.configId,
          apiType: mockConfig.apiType,
          llmConfigJsonOutputStrategy: undefined,
        });
      });

      test("should throw LLMStrategyFactoryError if method is explicitly 'prompt_engineering'", () => {
        const configOverrides = {
          configId: 'explicit-prompt-eng',
          apiType: 'openrouter',
          jsonOutputStrategy: { method: 'prompt_engineering' },
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' cannot be 'prompt_engineering' for LLM ID '${mockConfig.configId}' (apiType: '${mockConfig.apiType}'). This strategy is no longer supported as an explicit choice. Please configure a specific JSON output strategy (e.g., 'openrouter_json_schema', 'openrouter_tool_calling', etc.).`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }
        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBe('prompt_engineering');
        expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
          llmId: mockConfig.configId,
          apiType: mockConfig.apiType,
          configuredMethod: 'prompt_engineering',
        });
      });

      test('should throw LLMStrategyFactoryError if apiType is known (e.g., openrouter) but method is unrecognized', () => {
        const configOverrides = {
          configId: 'or-unrec-method',
          apiType: 'openrouter',
          jsonOutputStrategy: { method: 'non_existent_or_method' },
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        const expectedThrownErrorMessage = `Unrecognized jsonOutputStrategy.method: '${mockConfig.jsonOutputStrategy.method}' for apiType '${mockConfig.apiType}' (LLM ID: '${mockConfig.configId}'). Supported methods for this apiType are: [openrouter_json_schema, openrouter_tool_calling]. Full list of supported API types and methods: openrouter: [openrouter_json_schema, openrouter_tool_calling].`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }

        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedThrownErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBe(
          mockConfig.jsonOutputStrategy.method
        );
        expect(logger.error).toHaveBeenCalledWith(
          `LLMStrategyFactory: ${expectedThrownErrorMessage}`,
          {
            apiType: mockConfig.apiType,
            jsonOutputMethod: mockConfig.jsonOutputStrategy.method,
            llmId: mockConfig.configId, // Ensure llmId is logged
            availableApiTypes: ['openrouter'],
            availableMethodsForApiType: [
              'openrouter_json_schema',
              'openrouter_tool_calling',
            ],
          }
        );
      });
    });

    describe('Basic Error Handling (from original tests)', () => {
      test('should throw ConfigurationError if llmConfig is null', () => {
        expect(() => factory.getStrategy(null)).toThrow(
          new ConfigurationError(
            'LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.'
          )
        );
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
          'LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.',
          { receivedConfig: null }
        );
      });

      test('should throw ConfigurationError if llmConfig is missing apiType', () => {
        const invalidConfig = createMockLlmConfig({
          configId: 'invalid-no-apiType',
          apiType: undefined,
        });
        // @ts-ignore
        delete invalidConfig.apiType; // Ensure apiType is truly missing
        expect(() => factory.getStrategy(invalidConfig)).toThrow(
          new ConfigurationError(
            'LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.'
          )
        );
      });

      test('should throw ConfigurationError if llmConfig.apiType is an empty string', () => {
        const invalidConfig = createMockLlmConfig({
          configId: 'invalid-empty-apiType',
          apiType: '   ',
        });
        expect(() => factory.getStrategy(invalidConfig)).toThrow(
          new ConfigurationError(
            'LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.'
          )
        );
      });

      test('should throw LLMStrategyFactoryError for an unsupported apiType (not in strategyMappings)', () => {
        const unsupportedConfigOverrides = {
          configId: 'unsupported-api',
          apiType: 'megacorp_llm',
          jsonOutputStrategy: { method: 'proprietary_mode' },
        };
        const mockConfig = createMockLlmConfig(unsupportedConfigOverrides);
        const expectedApiType = mockConfig.apiType.toLowerCase();
        const expectedJsonOutputMethod =
          mockConfig.jsonOutputStrategy.method.toLowerCase();
        const expectedThrownErrorMessage = `Unsupported apiType: '${expectedApiType}' (LLM ID: '${mockConfig.configId}'). No strategy can be determined. Supported API types for specialized strategies are: openrouter.`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }
        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedThrownErrorMessage);
        expect(thrownError?.apiType).toBe(expectedApiType);
        expect(thrownError?.jsonOutputMethod).toBe(expectedJsonOutputMethod);
        expect(logger.error).toHaveBeenCalledWith(
          `LLMStrategyFactory: ${expectedThrownErrorMessage}`,
          {
            apiType: expectedApiType,
            jsonOutputMethod: expectedJsonOutputMethod,
          }
        );
      });

      test('should throw LLMStrategyFactoryError if apiType is unsupported and jsonOutputStrategy.method is missing', () => {
        const configOverrides = {
          configId: 'unknown-api-no-method',
          apiType: 'very_new_llm_provider',
          jsonOutputStrategy: {},
        };
        const mockConfig = createMockLlmConfig(configOverrides);
        const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${mockConfig.configId}' (apiType: '${mockConfig.apiType}') but was missing or empty. A specific method must be configured.`;
        let thrownError = null;

        try {
          factory.getStrategy(mockConfig);
        } catch (e) {
          thrownError = e;
        }

        expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
        expect(thrownError?.message).toBe(expectedErrorMessage);
        expect(thrownError?.apiType).toBe(mockConfig.apiType);
        expect(thrownError?.jsonOutputMethod).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
          llmId: mockConfig.configId,
          apiType: mockConfig.apiType,
          llmConfigJsonOutputStrategy: mockConfig.jsonOutputStrategy,
        });
      });
    });

    test('logging of debug and info messages during successful OpenRouter strategy determination', () => {
      const configOverrides = {
        configId: 'log-test-or',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };
      const mockConfig = createMockLlmConfig(configOverrides);
      factory.getStrategy(mockConfig);

      expect(logger.debug).toHaveBeenCalledWith(
        `LLMStrategyFactory: Determining strategy for LLM ID: '${mockConfig.configId}', apiType: '${mockConfig.apiType}'.`,
        expect.objectContaining({
          configuredJsonMethod: 'openrouter_json_schema',
          fullConfigJsonStrategy: mockConfig.jsonOutputStrategy,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        `LLMStrategyFactory: Selected strategy 'OpenRouterJsonSchemaStrategy' for LLM ID '${mockConfig.configId}'. Details: apiType='openrouter', effectiveMethod='openrouter_json_schema', configuredMethod='openrouter_json_schema'.`
      );
    });
  });
});
// --- CORRECTED FILE END ---
