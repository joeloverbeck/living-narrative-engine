import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BaseOpenRouterStrategy } from '../../../../../src/llms/strategies/base/baseOpenRouterStrategy.js';
import { ConfigurationError } from '../../../../../src/errors/configurationError.js';
import { LLMStrategyError } from '../../../../../src/llms/errors/LLMStrategyError.js';
import { DefaultToolSchemaHandler } from '../../../../../src/llms/strategies/toolSchemaHandlers/defaultToolSchemaHandler.js';

// Mock the DefaultToolSchemaHandler
jest.mock(
  '../../../../../src/llms/strategies/toolSchemaHandlers/defaultToolSchemaHandler.js'
);

// Create a concrete implementation for testing abstract class
class TestOpenRouterStrategy extends BaseOpenRouterStrategy {
  _buildProviderRequestPayloadAdditions(
    baseMessagesPayload,
    llmConfig,
    requestOptions = {}
  ) {
    if (this.testShouldCallSuper) {
      return super._buildProviderRequestPayloadAdditions(
        baseMessagesPayload,
        llmConfig,
        requestOptions
      );
    }
    return { test: 'additions' };
  }

  async _extractJsonOutput(responseData, llmConfig, providerRequestPayload) {
    if (this.testShouldCallSuper) {
      return super._extractJsonOutput(
        responseData,
        llmConfig,
        providerRequestPayload
      );
    }
    if (this.testExtractedValue !== undefined) {
      return this.testExtractedValue;
    }
    return '{"test": "json"}';
  }
}

describe('BaseOpenRouterStrategy', () => {
  let mockHttpClient;
  let mockLogger;
  let strategy;
  let mockToolSchemaHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpClient = {
      request: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockToolSchemaHandler = {
      buildDefaultToolSchema: jest.fn().mockReturnValue({ schema: 'test' }),
    };

    DefaultToolSchemaHandler.mockImplementation(() => mockToolSchemaHandler);

    strategy = new TestOpenRouterStrategy({
      httpClient: mockHttpClient,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize successfully with valid dependencies', () => {
      expect(strategy).toBeDefined();
      expect(DefaultToolSchemaHandler).toHaveBeenCalledWith({
        logger: mockLogger,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestOpenRouterStrategy initialized.'
      );
    });

    it('should throw error when httpClient is not provided', () => {
      expect(() => {
        new TestOpenRouterStrategy({ logger: mockLogger });
      }).toThrow('TestOpenRouterStrategy: httpClient dependency is required.');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TestOpenRouterStrategy: httpClient dependency is required.'
      );
    });

    it('should throw error when httpClient is null', () => {
      expect(() => {
        new TestOpenRouterStrategy({ httpClient: null, logger: mockLogger });
      }).toThrow('TestOpenRouterStrategy: httpClient dependency is required.');
    });
  });

  describe('abstract methods', () => {
    describe('_buildProviderRequestPayloadAdditions', () => {
      it('should throw error when not overridden by subclass', () => {
        strategy.testShouldCallSuper = true;
        const llmConfig = { configId: 'test-llm' };

        expect(() => {
          strategy._buildProviderRequestPayloadAdditions({}, llmConfig, {});
        }).toThrow(
          'TestOpenRouterStrategy._buildProviderRequestPayloadAdditions: Method not implemented. Subclasses must override this method.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy._buildProviderRequestPayloadAdditions: Method not implemented. Subclasses must override this method.',
          { llmId: 'test-llm' }
        );
      });

      it('should use default empty object for requestOptions when not provided', () => {
        strategy.testShouldCallSuper = true;
        const llmConfig = { configId: 'test-llm' };

        expect(() => {
          strategy._buildProviderRequestPayloadAdditions({}, llmConfig);
        }).toThrow(
          'TestOpenRouterStrategy._buildProviderRequestPayloadAdditions: Method not implemented. Subclasses must override this method.'
        );
      });
    });

    describe('_extractJsonOutput', () => {
      it('should throw error when not overridden by subclass', async () => {
        strategy.testShouldCallSuper = true;
        const llmConfig = { configId: 'test-llm' };

        await expect(
          strategy._extractJsonOutput({}, llmConfig, {})
        ).rejects.toThrow(
          'TestOpenRouterStrategy._extractJsonOutput: Method not implemented. Subclasses must override this method.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy._extractJsonOutput: Method not implemented. Subclasses must override this method.',
          { llmId: 'test-llm' }
        );
      });
    });
  });

  describe('tool schema methods', () => {
    describe('buildToolSchema', () => {
      it('should return null when tools array is empty', () => {
        const result = strategy.buildToolSchema([]);
        expect(result).toBeNull();
      });

      it('should return null when tools is null', () => {
        const result = strategy.buildToolSchema(null);
        expect(result).toBeNull();
      });

      it('should return null when tools is not an array', () => {
        const result = strategy.buildToolSchema('not-an-array');
        expect(result).toBeNull();
      });

      it('should build default tool schema for valid tools array', () => {
        const tools = [{ name: 'tool1' }];
        const requestOptions = { someOption: true };

        const result = strategy.buildToolSchema(tools, requestOptions);

        expect(
          mockToolSchemaHandler.buildDefaultToolSchema
        ).toHaveBeenCalledWith('unknown', requestOptions);
        expect(result).toEqual({ schema: 'test' });
      });

      it('should handle error from tool schema handler', () => {
        const tools = [{ name: 'tool1' }];
        mockToolSchemaHandler.buildDefaultToolSchema.mockImplementation(() => {
          throw new Error('Schema error');
        });

        const result = strategy.buildToolSchema(tools);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy: Error building default tool schema: Schema error',
          { error: 'Schema error' }
        );
        expect(result).toBeNull();
      });
    });

    describe('requiresCustomToolSchema', () => {
      it('should return true by default', () => {
        expect(strategy.requiresCustomToolSchema()).toBe(true);
      });
    });

    describe('_getToolSchemaHandler', () => {
      it('should return the tool schema handler instance', () => {
        const handler = strategy._getToolSchemaHandler();
        expect(handler).toBe(mockToolSchemaHandler);
      });
    });
  });

  describe('execute method', () => {
    let validParams;

    beforeEach(() => {
      validParams = {
        gameSummary: 'Test game summary',
        llmConfig: {
          configId: 'test-llm',
          apiType: 'openrouter',
          modelIdentifier: 'test-model',
          endpointUrl: 'https://api.openrouter.ai/v1/chat/completions',
          defaultParameters: { temperature: 0.7 },
        },
        apiKey: 'test-api-key',
        environmentContext: {
          isClient: () => false,
          isServer: () => true,
          getProxyServerUrl: () => 'http://proxy.url',
          getExecutionEnvironment: () => 'server',
          getProjectRootPath: () => '/test/project/root',
        },
      };

      mockHttpClient.request.mockResolvedValue({
        choices: [{ message: { content: '{"test": "response"}' } }],
      });
    });

    describe('parameter validation', () => {
      it('should throw ConfigurationError when llmConfig is missing', async () => {
        const params = { ...validParams, llmConfig: null };

        await expect(strategy.execute(params)).rejects.toThrow(
          ConfigurationError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy: Missing llmConfig. Cannot proceed.'
        );
      });

      it('should throw ConfigurationError when environmentContext is missing', async () => {
        const params = { ...validParams, environmentContext: null };

        await expect(strategy.execute(params)).rejects.toThrow(
          ConfigurationError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy (test-llm): Missing environmentContext. Cannot proceed.',
          { llmId: 'test-llm' }
        );
      });

      it('should throw ConfigurationError when apiType is not openrouter', async () => {
        const params = {
          ...validParams,
          llmConfig: { ...validParams.llmConfig, apiType: 'openai' },
        };

        await expect(strategy.execute(params)).rejects.toThrow(
          ConfigurationError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          "TestOpenRouterStrategy (test-llm): Invalid apiType 'openai'. This strategy is specific to 'openrouter'.",
          {
            llmId: 'test-llm',
            problematicField: 'apiType',
            fieldValue: 'openai',
          }
        );
      });
    });

    describe('client-side execution', () => {
      it('should use proxy URL for client-side execution', async () => {
        const params = {
          ...validParams,
          environmentContext: {
            isClient: () => true,
            isServer: () => false,
            getProxyServerUrl: () => 'http://proxy.url',
            getExecutionEnvironment: () => 'client',
            getProjectRootPath: () => null,
          },
        };

        await strategy.execute(params);

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          'http://proxy.url',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"llmId":"test-llm"'),
          })
        );
      });
    });

    describe('server-side execution', () => {
      it('should use direct URL with API key for server-side execution', async () => {
        await strategy.execute(validParams);

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          'https://api.openrouter.ai/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-api-key',
            },
          })
        );
      });

      it('should throw ConfigurationError when API key is missing for server-side', async () => {
        const params = { ...validParams, apiKey: null };

        await expect(strategy.execute(params)).rejects.toThrow(
          ConfigurationError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestOpenRouterStrategy (test-llm): API key is missing for server-side/direct OpenRouter call. An API key must be configured and provided.',
          { llmId: 'test-llm', problematicField: 'apiKey' }
        );
      });
    });

    describe('request options', () => {
      it('should pass request options to payload builder', async () => {
        const requestOptions = { customOption: true };
        const params = { ...validParams, requestOptions };

        jest.spyOn(strategy, '_buildProviderRequestPayloadAdditions');

        await strategy.execute(params);

        expect(
          strategy._buildProviderRequestPayloadAdditions
        ).toHaveBeenCalledWith(
          expect.any(Object),
          validParams.llmConfig,
          requestOptions
        );
      });
    });

    describe('abort signal', () => {
      it('should pass abort signal to HTTP request', async () => {
        const abortSignal = new AbortController().signal;
        const params = { ...validParams, abortSignal };

        await strategy.execute(params);

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ abortSignal })
        );
      });
    });

    describe('JSON extraction error handling', () => {
      it('should throw LLMStrategyError when extraction returns null', async () => {
        strategy.testExtractedValue = null;

        await expect(strategy.execute(validParams)).rejects.toThrow(
          LLMStrategyError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to extract usable JSON content'),
          expect.objectContaining({
            llmId: 'test-llm',
            returnedValue: null,
          })
        );
      });

      it('should throw LLMStrategyError when extraction returns empty string', async () => {
        strategy.testExtractedValue = '   ';

        await expect(strategy.execute(validParams)).rejects.toThrow(
          LLMStrategyError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to extract usable JSON content'),
          expect.objectContaining({
            llmId: 'test-llm',
            returnedValue: '   ',
          })
        );
      });

      it('should throw LLMStrategyError when extraction returns non-string', async () => {
        strategy.testExtractedValue = 123;

        await expect(strategy.execute(validParams)).rejects.toThrow(
          LLMStrategyError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to extract usable JSON content'),
          expect.objectContaining({
            llmId: 'test-llm',
            returnedValue: 123,
          })
        );
      });
    });

    describe('HTTP client error handling', () => {
      it('should rethrow HttpClientError with logging', async () => {
        const httpError = new Error('HTTP Error');
        httpError.name = 'HttpClientError';
        httpError.status = 500;
        httpError.response = 'Server error';
        httpError.url = validParams.llmConfig.endpointUrl;

        mockHttpClient.request.mockRejectedValue(httpError);

        await expect(strategy.execute(validParams)).rejects.toThrow(httpError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('HttpClientError occurred during API call'),
          expect.objectContaining({
            llmId: 'test-llm',
            status: 500,
            responseBody: 'Server error',
          })
        );
      });

      it('should detect HttpClientError by properties when name is not HttpClientError', async () => {
        const httpError = new Error('HTTP Error');
        httpError.status = 404;
        httpError.response = 'Not found';
        httpError.url = validParams.llmConfig.endpointUrl;
        // Note: name is 'Error', not 'HttpClientError'

        mockHttpClient.request.mockRejectedValue(httpError);

        await expect(strategy.execute(validParams)).rejects.toThrow(httpError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('HttpClientError occurred during API call'),
          expect.objectContaining({
            llmId: 'test-llm',
            status: 404,
            responseBody: 'Not found',
          })
        );
      });

      it('should wrap unexpected errors in LLMStrategyError', async () => {
        const unexpectedError = new Error('Unexpected error');
        mockHttpClient.request.mockRejectedValue(unexpectedError);

        await expect(strategy.execute(validParams)).rejects.toThrow(
          LLMStrategyError
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'An unexpected error occurred during API call'
          ),
          expect.objectContaining({
            llmId: 'test-llm',
            originalErrorMessage: 'Unexpected error',
          })
        );
      });

      it('should not wrap ConfigurationError', async () => {
        const configError = new ConfigurationError('Config error');
        mockHttpClient.request.mockRejectedValue(configError);

        await expect(strategy.execute(validParams)).rejects.toThrow(
          ConfigurationError
        );
      });

      it('should not wrap LLMStrategyError', async () => {
        const strategyError = new LLMStrategyError(
          'Strategy error',
          'test-llm'
        );
        mockHttpClient.request.mockRejectedValue(strategyError);

        await expect(strategy.execute(validParams)).rejects.toThrow(
          LLMStrategyError
        );
      });
    });

    describe('successful execution', () => {
      it('should return extracted JSON string on success', async () => {
        const result = await strategy.execute(validParams);

        expect(result).toBe('{"test": "json"}');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Successfully extracted JSON string'),
          { llmId: 'test-llm' }
        );
      });

      it('should handle different message content types in debug logging', async () => {
        // Mock _constructPromptPayload to return different content types
        jest.spyOn(strategy, '_constructPromptPayload').mockReturnValue({
          messages: [
            { role: 'user', content: 'short' }, // Short string
            { role: 'assistant', content: 'a'.repeat(100) }, // Long string
            { role: 'system', content: null }, // Null content
            { role: 'user', content: undefined }, // Undefined content
            { role: 'assistant', content: ['image data'] }, // Array content
            { role: 'system', content: { type: 'object' } }, // Object content
          ],
        });

        await strategy.execute(validParams);

        // Check that debug was called with proper content previews
        const debugCall = mockLogger.debug.mock.calls.find((call) =>
          call[0].includes('Constructed base prompt payload')
        );

        expect(debugCall).toBeDefined();
        const messagesPreview = debugCall[1].messagesPreview;

        expect(messagesPreview[0].contentPreview).toBe('short');
        expect(messagesPreview[1].contentPreview).toBe('a'.repeat(70) + '...');
        expect(messagesPreview[2].contentPreview).toBe(
          '[content is null/undefined]'
        );
        expect(messagesPreview[3].contentPreview).toBe(
          '[content is null/undefined]'
        );
        expect(messagesPreview[4].contentPreview).toBe(
          '[content is an array (e.g., vision input)]'
        );
        expect(messagesPreview[5].contentPreview).toBe(
          '[content not a simple string]'
        );
      });

      it('should include provider-specific headers in request', async () => {
        const params = {
          ...validParams,
          llmConfig: {
            ...validParams.llmConfig,
            providerSpecificHeaders: { 'X-Custom': 'value' },
          },
        };

        await strategy.execute(params);

        expect(mockHttpClient.request).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Custom': 'value',
            }),
          })
        );
      });

      it('should merge default parameters into request payload', async () => {
        await strategy.execute(validParams);

        const callBody = JSON.parse(
          mockHttpClient.request.mock.calls[0][1].body
        );
        expect(callBody).toMatchObject({
          temperature: 0.7,
          model: 'test-model',
        });
      });

      it('should handle missing defaultParameters gracefully', async () => {
        const params = {
          ...validParams,
          llmConfig: {
            ...validParams.llmConfig,
            defaultParameters: undefined,
          },
        };

        await strategy.execute(params);

        const callBody = JSON.parse(
          mockHttpClient.request.mock.calls[0][1].body
        );
        expect(callBody).toMatchObject({
          model: 'test-model',
        });
        expect(callBody.temperature).toBeUndefined();
      });

      it('should handle HttpClientError with missing status', async () => {
        const httpError = new Error('HTTP Error');
        httpError.name = 'HttpClientError';
        // No status property
        httpError.response = 'Server error';
        httpError.url = validParams.llmConfig.endpointUrl;

        mockHttpClient.request.mockRejectedValue(httpError);

        await expect(strategy.execute(validParams)).rejects.toThrow(httpError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Status: N/A'),
          expect.objectContaining({
            llmId: 'test-llm',
            status: undefined,
          })
        );
      });

      it('should override defaultParameters with requestOptions parameters', async () => {
        const paramsWithRequestOptions = {
          ...validParams,
          requestOptions: {
            temperature: 0.9,
            maxTokens: 2000,
            topP: 0.95,
            toolSchema: {
              type: 'object',
              properties: { test: { type: 'string' } },
            },
            toolName: 'test_tool',
            toolDescription: 'Test tool description',
          },
        };

        // Default parameters include temperature: 0.7
        expect(validParams.llmConfig.defaultParameters.temperature).toBe(0.7);

        await strategy.execute(paramsWithRequestOptions);

        const callBody = JSON.parse(
          mockHttpClient.request.mock.calls[0][1].body
        );

        // Request options temperature should override default
        expect(callBody.temperature).toBe(0.9);
        expect(callBody.max_tokens).toBe(2000);
        expect(callBody.top_p).toBe(0.95);
        expect(callBody.model).toBe('test-model');
      });

      it('should apply requestOptions temperature even without defaultParameters', async () => {
        const paramsWithoutDefaults = {
          ...validParams,
          llmConfig: {
            ...validParams.llmConfig,
            defaultParameters: undefined,
          },
          requestOptions: {
            temperature: 0.8,
            maxTokens: 1500,
          },
        };

        await strategy.execute(paramsWithoutDefaults);

        const callBody = JSON.parse(
          mockHttpClient.request.mock.calls[0][1].body
        );

        // Request options should be applied even without defaults
        expect(callBody.temperature).toBe(0.8);
        expect(callBody.max_tokens).toBe(1500);
      });
    });
  });
});
