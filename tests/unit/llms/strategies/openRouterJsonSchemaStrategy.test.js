// tests/llms/strategies/openRouterJsonSchemaStrategy.test.js
// --- FILE START ---

import { OpenRouterJsonSchemaStrategy } from '../../../../src/llms/strategies/openRouterJsonSchemaStrategy.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';
import { ConfigurationError } from '../../../../src/errors/configurationError';
import { OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA } from '../../../../src/llms/constants/llmConstants.js';
import { BaseChatLLMStrategy } from '../../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

describe('OpenRouterJsonSchemaStrategy', () => {
  let mockHttpClient;
  let mockLogger;
  let mockEnvironmentContext;
  let strategy;
  let constructPromptPayloadSpy;

  const mockGameSummary = 'Current game state for OpenRouter.';
  const mockApiKey = 'test-openrouter-api-key';

  // MODIFICATION: Removed promptFrame and updated mockConstructedMessages
  const baseLlmConfig = {
    configId: 'openrouter-test-llm',
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelIdentifier: 'google/gemma-7b-it',
    apiType: 'openrouter',
    // promptFrame removed
    defaultParameters: { temperature: 0.5, top_p: 0.9 },
    providerSpecificHeaders: {
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'Test App',
    },
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    apiKeyFileName: 'openrouter_key.txt',
    jsonOutputStrategy: {
      method: 'openrouter_json_schema',
      jsonSchema: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema,
    },
    displayName: 'Test OpenRouter LLM',
    promptElements: [],
    promptAssemblyOrder: [],
  };

  // MODIFICATION: Updated to reflect new behavior of _constructPromptPayload
  const mockConstructedMessages = [
    { role: 'user', content: mockGameSummary.trim() }, // gameSummary is trimmed in the actual method
  ];
  const mockBaseMessagesPayload = { messages: mockConstructedMessages };

  const expectedOutputJsonString = JSON.stringify({
    action: 'move north',
    speech: 'Heading north!',
  });
  const expectedOutputJsonObject = {
    action: 'move east',
    speech: 'Going east.',
  };

  beforeEach(() => {
    mockHttpClient = { request: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockEnvironmentContext = {
      isClient: jest.fn().mockReturnValue(false),
      getProxyServerUrl: jest
        .fn()
        .mockReturnValue('http://localhost:3001/proxy'),
    };

    // Spy on the actual implementation in BaseChatLLMStrategy
    constructPromptPayloadSpy = jest
      .spyOn(BaseChatLLMStrategy.prototype, '_constructPromptPayload')
      .mockReturnValue(mockBaseMessagesPayload); // This spy now returns the simplified message structure

    strategy = new OpenRouterJsonSchemaStrategy({
      httpClient: mockHttpClient,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should successfully create an instance with valid dependencies', () => {
      expect(strategy).toBeInstanceOf(OpenRouterJsonSchemaStrategy);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OpenRouterJsonSchemaStrategy initialized.'
      );
    });

    it('should throw an error if httpClient is not provided', () => {
      expect(
        () =>
          new OpenRouterJsonSchemaStrategy({
            httpClient: null,
            logger: mockLogger,
          })
      ).toThrow(
        'OpenRouterJsonSchemaStrategy: httpClient dependency is required.'
      );
    });
  });

  describe('execute', () => {
    describe('Input and Configuration Validations', () => {
      it('should throw ConfigurationError if llmConfig is missing', async () => {
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: null,
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new ConfigurationError(
            'OpenRouterJsonSchemaStrategy: Missing llmConfig. Cannot proceed.',
            { llmId: 'Unknown (llmConfig missing)' }
          )
        );
      });

      it('should throw ConfigurationError if environmentContext is missing', async () => {
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: null,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new ConfigurationError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Missing environmentContext. Cannot proceed.`,
            { llmId: baseLlmConfig.configId }
          )
        );
      });

      it('should throw ConfigurationError if apiType is not "openrouter"', async () => {
        const wrongApiTypeConfig = {
          ...baseLlmConfig,
          configId: 'wrong-api-type-llm',
          apiType: 'openai',
        };
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: wrongApiTypeConfig,
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new ConfigurationError(
            `OpenRouterJsonSchemaStrategy (${wrongApiTypeConfig.configId}): Invalid apiType 'openai'. This strategy is specific to 'openrouter'.`,
            {
              llmId: wrongApiTypeConfig.configId,
              problematicField: 'apiType',
              fieldValue: 'openai',
            }
          )
        );
      });

      it('should throw ConfigurationError if apiKey is missing for server-side call', async () => {
        mockEnvironmentContext.isClient.mockReturnValue(false);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: null,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new ConfigurationError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): API key is missing for server-side/direct OpenRouter call. An API key must be configured and provided.`,
            {
              llmId: baseLlmConfig.configId,
              problematicField: 'apiKey',
            }
          )
        );
      });
    });

    describe('Successful Execution - Direct API Call (Server-side)', () => {
      beforeEach(() => {
        mockEnvironmentContext.isClient.mockReturnValue(false);
        mockHttpClient.request.mockResolvedValue({
          choices: [{ message: { content: expectedOutputJsonString } }],
        });
      });

      it('should make a direct API call with correct payload and headers', async () => {
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig }, // Pass a copy of the modified baseLlmConfig
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);

        expect(result).toBe(expectedOutputJsonString);
        // MODIFICATION: Updated expectation for constructPromptPayloadSpy call
        expect(constructPromptPayloadSpy).toHaveBeenCalledWith(
          mockGameSummary,
          params.llmConfig
        );
        expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

        const requestArgs = mockHttpClient.request.mock.calls[0];
        const targetUrl = requestArgs[0];
        const requestOptions = requestArgs[1];
        const requestBody = JSON.parse(requestOptions.body);

        expect(targetUrl).toBe(baseLlmConfig.endpointUrl);
        expect(requestOptions.method).toBe('POST');
        expect(requestOptions.headers['Content-Type']).toBe('application/json');
        expect(requestOptions.headers['Authorization']).toBe(
          `Bearer ${mockApiKey}`
        );
        expect(requestOptions.headers['HTTP-Referer']).toBe(
          baseLlmConfig.providerSpecificHeaders['HTTP-Referer']
        );
        expect(requestOptions.headers['X-Title']).toBe(
          baseLlmConfig.providerSpecificHeaders['X-Title']
        );

        expect(requestBody.model).toBe(baseLlmConfig.modelIdentifier);
        // MODIFICATION: requestBody.messages should now match the updated mockConstructedMessages
        expect(requestBody.messages).toEqual(mockConstructedMessages);
        expect(requestBody.temperature).toBe(
          baseLlmConfig.defaultParameters.temperature
        );
        expect(requestBody.response_format.type).toBe('json_schema');
        expect(requestBody.response_format.json_schema).toEqual(
          baseLlmConfig.jsonOutputStrategy.jsonSchema
        );
      });

      it('should extract from message.content when it is an object', async () => {
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [{ message: { content: expectedOutputJsonObject } }],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);
        expect(result).toBe(JSON.stringify(expectedOutputJsonObject));
      });

      it('should call _extractJsonOutput during execute', async () => {
        const response = {
          choices: [{ message: { content: expectedOutputJsonString } }],
        };
        mockHttpClient.request.mockResolvedValueOnce(response);
        const extractionSpy = jest
          .spyOn(strategy, '_extractJsonOutput')
          .mockResolvedValue(expectedOutputJsonString);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);
        expect(result).toBe(expectedOutputJsonString);
        expect(extractionSpy).toHaveBeenCalledWith(
          response,
          params.llmConfig,
          expect.any(Object)
        );
      });
    });

    describe('Successful Execution - Proxied API Call (Client-side)', () => {
      const proxyUrl = 'http://localhost:3001/custom-proxy';
      beforeEach(() => {
        mockEnvironmentContext.isClient.mockReturnValue(true);
        mockEnvironmentContext.getProxyServerUrl.mockReturnValue(proxyUrl);
        mockHttpClient.request.mockResolvedValue({
          choices: [{ message: { content: expectedOutputJsonString } }],
        });
      });

      it('should make a proxied API call with wrapped payload and no Authorization header', async () => {
        const currentTestLlmConfig = { ...baseLlmConfig };
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: currentTestLlmConfig,
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);
        expect(result).toBe(expectedOutputJsonString);
        expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

        const requestArgs = mockHttpClient.request.mock.calls[0];
        const targetUrl = requestArgs[0];
        const requestOptions = requestArgs[1];
        const finalPayloadSentToProxy = JSON.parse(requestOptions.body);

        expect(targetUrl).toBe(proxyUrl);
        expect(requestOptions.method).toBe('POST');
        expect(requestOptions.headers['Content-Type']).toBe('application/json');
        expect(requestOptions.headers['Authorization']).toBeUndefined();
        expect(requestOptions.headers['HTTP-Referer']).toBe(
          currentTestLlmConfig.providerSpecificHeaders['HTTP-Referer']
        );
        expect(requestOptions.headers['X-Title']).toBe(
          currentTestLlmConfig.providerSpecificHeaders['X-Title']
        );

        expect(finalPayloadSentToProxy.llmId).toBe(
          currentTestLlmConfig.configId
        );
        expect(finalPayloadSentToProxy.targetHeaders).toEqual(
          currentTestLlmConfig.providerSpecificHeaders
        );

        const actualTargetPayload = finalPayloadSentToProxy.targetPayload;
        expect(actualTargetPayload.model).toBe(
          currentTestLlmConfig.modelIdentifier
        );
        // MODIFICATION: actualTargetPayload.messages should match updated mockConstructedMessages
        expect(actualTargetPayload.messages).toEqual(mockConstructedMessages);
        expect(actualTargetPayload.temperature).toBe(
          currentTestLlmConfig.defaultParameters.temperature
        );
        expect(actualTargetPayload.response_format.type).toBe('json_schema');
        expect(actualTargetPayload.response_format.json_schema).toEqual(
          currentTestLlmConfig.jsonOutputStrategy.jsonSchema
        );

        expect(finalPayloadSentToProxy.targetLlmConfig).toBeUndefined();
        expect(finalPayloadSentToProxy.llmRequestPayload).toBeUndefined();
      });
    });

    describe('Response Extraction - Fallback to tool_calls', () => {
      beforeEach(() => {
        mockEnvironmentContext.isClient.mockReturnValue(false);
      });

      it('should extract from tool_calls if message.content is missing', async () => {
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name,
                      arguments: expectedOutputJsonString,
                    },
                  },
                ],
              },
            },
          ],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);
        expect(result).toBe(expectedOutputJsonString);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): message.content is missing. Will check tool_calls fallback.`
          ),
          expect.objectContaining({ llmId: baseLlmConfig.configId })
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): message.content not usable, attempting tool_calls fallback.`
          ),
          expect.objectContaining({ llmId: baseLlmConfig.configId })
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Extracted JSON string from tool_calls fallback`
          ),
          expect.objectContaining({
            llmId: baseLlmConfig.configId,
            functionName: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name,
          })
        );
      });

      it('should extract from tool_calls if message.content is an empty string', async () => {
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name,
                      arguments: expectedOutputJsonString,
                    },
                  },
                ],
              },
            },
          ],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        const result = await strategy.execute(params);
        expect(result).toBe(expectedOutputJsonString);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): message.content was an empty string. Will check tool_calls fallback.`
          ),
          expect.objectContaining({ llmId: baseLlmConfig.configId })
        );
      });

      it('should ignore tool_calls if function name does not match schema name', async () => {
        const wrongToolName = 'wrong_tool_name';
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: wrongToolName,
                      arguments: expectedOutputJsonString,
                    },
                  },
                ],
              },
            },
          ],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Failed to extract JSON content from OpenRouter response. Neither message.content nor a valid tool_call fallback was usable.`,
            baseLlmConfig.configId,
            null,
            expect.anything()
          )
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): tool_calls structure for fallback did not match expected schema or arguments were empty. Expected function name '${OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name}'.`
          ),
          expect.objectContaining({
            llmId: baseLlmConfig.configId,
            expectedToolName: OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name,
            toolCallDetails: expect.objectContaining({
              functionName: wrongToolName,
            }),
          })
        );
      });
    });

    describe('Error Handling in Response Processing', () => {
      beforeEach(() => {
        mockEnvironmentContext.isClient.mockReturnValue(false);
      });

      it('should throw LLMStrategyError if choices array is missing', async () => {
        const responseData = {};
        mockHttpClient.request.mockResolvedValueOnce(responseData);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Response structure did not contain 'choices[0].message'.`,
            baseLlmConfig.configId,
            null,
            expect.objectContaining({
              responsePreview: JSON.stringify(responseData).substring(0, 500),
            })
          )
        );
      });

      it('should throw LLMStrategyError if message is missing in choices[0]', async () => {
        const responseData = { choices: [{}] };
        mockHttpClient.request.mockResolvedValueOnce(responseData);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Response structure did not contain 'choices[0].message'.`,
            baseLlmConfig.configId,
            null,
            expect.objectContaining({
              responsePreview: JSON.stringify(responseData).substring(0, 500),
            })
          )
        );
      });

      it('should throw LLMStrategyError if message.content and tool_calls are unusable', async () => {
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [{ message: { content: null, tool_calls: [] } }],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Failed to extract JSON content from OpenRouter response. Neither message.content nor a valid tool_call fallback was usable.`,
            baseLlmConfig.configId,
            null,
            expect.anything()
          )
        );
      });

      it('should throw LLMStrategyError if message.content is unexpected type and tool_calls are unusable', async () => {
        const contentValue = 123;
        mockHttpClient.request.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: contentValue, // Unexpected type
                tool_calls: [
                  {
                    type: 'function',
                    function: { name: 'wrong_name', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): Failed to extract JSON content from OpenRouter response. Neither message.content nor a valid tool_call fallback was usable.`,
            baseLlmConfig.configId,
            null,
            expect.anything()
          )
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): message.content was present but not a non-empty string or object (type: ${typeof contentValue}, value: ${contentValue}). Will check tool_calls fallback.`
          ),
          expect.objectContaining({
            llmId: baseLlmConfig.configId,
            contentType: typeof contentValue,
            contentValue: contentValue,
          })
        );
      });
    });

    describe('API Call Error Handling', () => {
      it('should propagate HttpClientError from httpClient.request', async () => {
        const httpError = new Error('API Network Failure');
        httpError.name = 'HttpClientError';
        // @ts-ignore
        httpError.status = 500;
        // @ts-ignore
        httpError.url = baseLlmConfig.endpointUrl;
        mockHttpClient.request.mockRejectedValueOnce(httpError);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };

        await expect(strategy.execute(params)).rejects.toThrow(httpError);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): HttpClientError occurred during API call to '${baseLlmConfig.endpointUrl}'. Status: ${httpError.status}. Message: ${httpError.message}`
          ),
          expect.objectContaining({
            llmId: baseLlmConfig.configId,
            url: httpError.url,
            status: httpError.status,
            originalErrorName: httpError.name,
            originalErrorMessage: httpError.message,
          })
        );
      });

      it('should wrap generic error from httpClient.request in LLMStrategyError', async () => {
        const genericError = new Error('Some other weird error');
        mockHttpClient.request.mockRejectedValueOnce(genericError);
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          new LLMStrategyError(
            `OpenRouterJsonSchemaStrategy (${baseLlmConfig.configId}): An unexpected error occurred during API call or response processing for endpoint '${baseLlmConfig.endpointUrl}'. Original message: ${genericError.message}`,
            baseLlmConfig.configId,
            genericError,
            expect.anything()
          )
        );
      });

      it('should correctly handle prompt construction error', async () => {
        const constructionError = new Error(
          'Failed to construct prompt payload'
        );
        constructPromptPayloadSpy.mockImplementationOnce(() => {
          throw constructionError;
        });
        const params = {
          gameSummary: mockGameSummary,
          llmConfig: { ...baseLlmConfig },
          apiKey: mockApiKey,
          environmentContext: mockEnvironmentContext,
        };
        await expect(strategy.execute(params)).rejects.toThrow(
          constructionError
        );
      });
    });
  });
});
// --- FILE END ---
