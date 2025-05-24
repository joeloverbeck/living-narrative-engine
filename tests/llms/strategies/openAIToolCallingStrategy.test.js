// tests/llms/strategies/openAIToolCallingStrategy.test.js
// --- FILE START ---

import {OpenAIToolCallingStrategy} from '../../../src/llms/strategies/openAIToolCallingStrategy.js';
import {LLMStrategyError} from '../../../src/llms/errors/LLMStrategyError.js';
import {
    OPENAI_TOOL_NAME,
    GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA
} from '../../../src/llms/constants/llmConstants.js';
import {BaseChatLLMStrategy} from '../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

jest.mock('../../../src/llms/strategies/base/baseChatLLMStrategy.js');

describe('OpenAIToolCallingStrategy', () => {
    let mockHttpClient;
    let mockLogger;
    let mockEnvironmentContext;
    let strategy;

    const mockGameSummary = "Current game state summary.";
    const mockApiKey = "test-api-key";
    const baseLlmConfig = {
        id: 'openai-test-llm',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        modelIdentifier: 'gpt-3.5-turbo',
        apiType: 'openai',
        promptFrame: {system: "System prompt", user: "User prefix: {{gameSummary}}"},
        defaultParameters: {temperature: 0.7},
        jsonOutputStrategy: {
            method: 'tool_calling',
            toolDescription: "Test tool description"
        },
    };

    const mockConstructedMessages = [
        {role: "system", content: "System prompt"},
        {role: "user", content: `User prefix: ${mockGameSummary}`}
    ];

    const expectedToolArguments = JSON.stringify({action: "test_action", speech: "hello world"});

    beforeEach(() => {
        mockHttpClient = {
            request: jest.fn()
        };
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        mockEnvironmentContext = {
            isClient: jest.fn(),
            getProxyServerUrl: jest.fn()
        };

        BaseChatLLMStrategy.mockClear();
        BaseChatLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue({messages: mockConstructedMessages});

        strategy = new OpenAIToolCallingStrategy({
            httpClient: mockHttpClient,
            logger: mockLogger
        });
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            expect(strategy).toBeInstanceOf(OpenAIToolCallingStrategy);
            expect(mockLogger.debug).toHaveBeenCalledWith('OpenAIToolCallingStrategy: Instance created.');
        });

        it('should throw an error if httpClient is invalid', () => {
            const expectedErrorMsg = 'OpenAIToolCallingStrategy: Constructor requires a valid IHttpClient instance.';
            expect(() => new OpenAIToolCallingStrategy({
                httpClient: null,
                logger: mockLogger
            })).toThrow(expectedErrorMsg);
            expect(() => new OpenAIToolCallingStrategy({httpClient: {}, logger: mockLogger})).toThrow(expectedErrorMsg);
        });

        it('should throw an error if logger is invalid', () => {
            const expectedErrorMsg = 'OpenAIToolCallingStrategy: Constructor requires a valid ILogger instance.';
            // Test with logger being null
            expect(() => new OpenAIToolCallingStrategy({
                httpClient: mockHttpClient,
                logger: null
            })).toThrow(expectedErrorMsg);
            // Test with logger being an empty object (which doesn't have .info, .error etc.)
            expect(() => new OpenAIToolCallingStrategy({
                httpClient: mockHttpClient,
                logger: {}
            })).toThrow(expectedErrorMsg);
        });
    });

    describe('execute', () => {
        describe('Input Validations', () => {
            it('should throw LLMStrategyError if gameSummary is missing', async () => {
                const params = {
                    gameSummary: null,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `'gameSummary' is required for LLM '${baseLlmConfig.id}'.`,
                        llmId: baseLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if llmConfig is missing', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: null,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                // The llmId will be 'UNKNOWN_LLM_CONFIG_ERROR' due to the fix
                const expectedLlmIdForError = 'UNKNOWN_LLM_CONFIG_ERROR';
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `'llmConfig' is required and must be an object.`,
                        llmId: expectedLlmIdForError
                    });
            });

            it('should throw LLMStrategyError if environmentContext is missing', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: null
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `'environmentContext' is required for LLM '${baseLlmConfig.id}'.`,
                        llmId: baseLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if prompt construction fails to produce messages', async () => {
                BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({someOtherProp: []}); // No messages
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                // This error is thrown directly from the try block
                const expectedError = new LLMStrategyError(`Prompt construction failed to produce messages for LLM '${baseLlmConfig.id}'.`, baseLlmConfig.id);
                await expect(strategy.execute(params)).rejects.toThrow(expectedError);
            });

            it('should throw LLMStrategyError if _constructPromptPayload throws (and wraps the error)', async () => {
                const constructionError = new Error("Prompt construction boom!");
                BaseChatLLMStrategy.prototype._constructPromptPayload.mockImplementationOnce(() => {
                    throw constructionError;
                });
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                // This error is thrown from the catch block, wrapping the original
                const expectedError = new LLMStrategyError(`Prompt construction failed for LLM '${baseLlmConfig.id}': ${constructionError.message}`, baseLlmConfig.id, constructionError);
                await expect(strategy.execute(params)).rejects.toThrow(expectedError);

            });
        });

        describe('Successful Execution - Direct API Call (Server-side or no proxy needed)', () => {
            // ... (no changes needed in this describe block, tests were passing) ...
            beforeEach(() => {
                mockEnvironmentContext.isClient.mockReturnValue(false); // Simulate server-side
                mockHttpClient.request.mockResolvedValue({
                    choices: [{
                        message: {
                            tool_calls: [{
                                type: "function",
                                function: {
                                    name: OPENAI_TOOL_NAME,
                                    arguments: expectedToolArguments
                                }
                            }]
                        }
                    }]
                });
            });

            it('should make a direct API call with correct payload and headers (with API key)', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                const result = await strategy.execute(params);

                expect(result).toBe(expectedToolArguments);
                expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
                const requestCall = mockHttpClient.request.mock.calls[0];
                const requestUrl = requestCall[0];
                const requestOptions = requestCall[1];
                const requestBody = JSON.parse(requestOptions.body);

                expect(requestUrl).toBe(baseLlmConfig.endpointUrl);
                expect(requestOptions.method).toBe('POST');
                expect(requestOptions.headers['Content-Type']).toBe('application/json');
                expect(requestOptions.headers['Authorization']).toBe(`Bearer ${mockApiKey}`);
                expect(requestBody.model).toBe(baseLlmConfig.modelIdentifier);
                expect(requestBody.messages).toEqual(mockConstructedMessages);
                expect(requestBody.tools[0].type).toBe("function");
                expect(requestBody.tools[0].function.name).toBe(OPENAI_TOOL_NAME);
                expect(requestBody.tools[0].function.description).toBe(baseLlmConfig.jsonOutputStrategy.toolDescription);
                expect(requestBody.tools[0].function.parameters).toEqual(GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA);
                expect(requestBody.tool_choice).toEqual({type: "function", function: {name: OPENAI_TOOL_NAME}});
                expect(requestBody.temperature).toBe(baseLlmConfig.defaultParameters.temperature);
            });

            it('should use default tool description if not provided in llmConfig', async () => {
                const configWithoutToolDesc = {...baseLlmConfig, jsonOutputStrategy: {method: 'tool_calling'}};
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: configWithoutToolDesc,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await strategy.execute(params);
                const requestBody = JSON.parse(mockHttpClient.request.mock.calls[0][1].body);
                expect(requestBody.tools[0].function.description).toBe("Extracts the character's next game action and speech based on the situation. Both action and speech are required.");
            });

            it('should make a direct API call without Authorization header if apiKey is null', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                };
                await strategy.execute(params);
                const requestOptions = mockHttpClient.request.mock.calls[0][1];
                expect(requestOptions.headers['Authorization']).toBeUndefined();
            });

            it('should include providerSpecificHeaders in the request', async () => {
                const configWithHeaders = {...baseLlmConfig, providerSpecificHeaders: {'X-Custom-Header': 'TestValue'}};
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: configWithHeaders,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await strategy.execute(params);
                const requestOptions = mockHttpClient.request.mock.calls[0][1];
                expect(requestOptions.headers['X-Custom-Header']).toBe('TestValue');
            });
        });

        describe('Successful Execution - Proxied API Call (Client-side)', () => {
            // ... (no changes needed in this describe block, tests were passing) ...
            const proxyUrl = 'http://localhost:3001/proxy';
            const clientLlmConfig = {
                ...baseLlmConfig,
                apiKeyEnvVar: 'OPENAI_API_KEY_VAR', // Indicate proxy should be used
            };

            beforeEach(() => {
                mockEnvironmentContext.isClient.mockReturnValue(true);
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue(proxyUrl);
                mockHttpClient.request.mockResolvedValue({ // Proxy response is the actual LLM response
                    choices: [{
                        message: {
                            tool_calls: [{
                                type: "function",
                                function: {
                                    name: OPENAI_TOOL_NAME,
                                    arguments: expectedToolArguments
                                }
                            }]
                        }
                    }]
                });
            });

            it('should make a proxied API call with wrapped payload and no direct Authorization header', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: clientLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                const result = await strategy.execute(params);

                expect(result).toBe(expectedToolArguments);
                expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
                const requestCall = mockHttpClient.request.mock.calls[0];
                const requestUrl = requestCall[0];
                const requestOptions = requestCall[1];
                const finalPayload = JSON.parse(requestOptions.body);

                expect(requestUrl).toBe(proxyUrl);
                expect(requestOptions.method).toBe('POST');
                expect(requestOptions.headers['Content-Type']).toBe('application/json');
                expect(requestOptions.headers['Authorization']).toBeUndefined();

                expect(finalPayload.targetLlmConfig.endpointUrl).toBe(clientLlmConfig.endpointUrl);
                expect(finalPayload.targetLlmConfig.modelIdentifier).toBe(clientLlmConfig.modelIdentifier);
                expect(finalPayload.targetLlmConfig.apiType).toBe(clientLlmConfig.apiType);
                expect(finalPayload.targetLlmConfig.apiKeyEnvVar).toBe(clientLlmConfig.apiKeyEnvVar);

                const originalPayload = finalPayload.llmRequestPayload;
                expect(originalPayload.model).toBe(clientLlmConfig.modelIdentifier);
                expect(originalPayload.messages).toEqual(mockConstructedMessages);
                expect(originalPayload.tools[0].function.name).toBe(OPENAI_TOOL_NAME);
            });

            it('should use apiKeyFileName if apiKeyEnvVar is not set for proxy', async () => {
                const configWithFile = {...clientLlmConfig, apiKeyEnvVar: null, apiKeyFileName: "keyfile.txt"};
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: configWithFile,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                };
                await strategy.execute(params);
                const finalPayload = JSON.parse(mockHttpClient.request.mock.calls[0][1].body);
                expect(finalPayload.targetLlmConfig.apiKeyFileName).toBe("keyfile.txt");
                expect(finalPayload.targetLlmConfig.apiKeyEnvVar).toBeNull();
            });

            it('should throw LLMStrategyError if proxy URL is not configured', async () => {
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue(null);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: clientLlmConfig,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `Client-side proxy URL not configured for LLM '${clientLlmConfig.id}'.`,
                        llmId: clientLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if client-side but no apiKeyEnvVar, apiKeyFileName, or direct apiKey is provided', async () => {
                const configNoKeySource = {...baseLlmConfig, apiKeyEnvVar: undefined, apiKeyFileName: undefined};
                mockEnvironmentContext.isClient.mockReturnValue(true);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: configNoKeySource,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `API key configuration missing for client-side proxied call to LLM '${configNoKeySource.id}'.`,
                        llmId: configNoKeySource.id
                    });
            });
        });

        describe('Response Parsing and Error Handling', () => {
            beforeEach(() => {
                mockEnvironmentContext.isClient.mockReturnValue(false);
            });

            it('should throw LLMStrategyError if API response is missing choices', async () => {
                mockHttpClient.request.mockResolvedValueOnce({});
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `OpenAI response for LLM '${baseLlmConfig.id}' missing 'choices' array or it's empty.`,
                        llmId: baseLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if choices[0].message is missing', async () => {
                mockHttpClient.request.mockResolvedValueOnce({choices: [{}]});
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `OpenAI response for LLM '${baseLlmConfig.id}' missing 'message' in choices[0].`,
                        llmId: baseLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if tool_calls is missing', async () => {
                mockHttpClient.request.mockResolvedValueOnce({choices: [{message: {}}]});
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `OpenAI response for LLM '${baseLlmConfig.id}' missing 'tool_calls' in message.`,
                        llmId: baseLlmConfig.id
                    });
            });

            it('should throw LLMStrategyError if tool_calls is empty', async () => {
                mockHttpClient.request.mockResolvedValueOnce({choices: [{message: {tool_calls: []}}]});
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `OpenAI response for LLM '${baseLlmConfig.id}' 'tool_calls' is empty or not an array.`,
                        llmId: baseLlmConfig.id
                    });
            });

            const expectedBaseMsg = `Unexpected tool_call structure or name for LLM '${baseLlmConfig.id}'. Expected function name '${OPENAI_TOOL_NAME}'.`;

            it('should throw LLMStrategyError if tool_call type is not "function"', async () => {
                const mockResponse = {
                    choices: [{
                        message: {
                            tool_calls: [{
                                type: "invalid_type",
                                function: {name: OPENAI_TOOL_NAME, arguments: "{}"}
                            }]
                        }
                    }]
                };
                mockHttpClient.request.mockResolvedValueOnce(mockResponse);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params)).rejects.toMatchObject({
                    name: 'LLMStrategyError',
                    message: `${expectedBaseMsg} Got type: invalid_type.`,
                    llmId: baseLlmConfig.id,
                    details: {responseData: mockResponse}
                });
            });

            it('should throw LLMStrategyError if tool_call function name does not match', async () => {
                const mockResponse = {
                    choices: [{
                        message: {
                            tool_calls: [{
                                type: "function",
                                function: {name: "wrong_tool_name", arguments: "{}"}
                            }]
                        }
                    }]
                };
                mockHttpClient.request.mockResolvedValueOnce(mockResponse);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params)).rejects.toMatchObject({
                    name: 'LLMStrategyError',
                    message: `${expectedBaseMsg} Got name: wrong_tool_name.`,
                    llmId: baseLlmConfig.id,
                    details: {responseData: mockResponse}
                });
            });

            it('should throw LLMStrategyError if tool_call function arguments are not a string', async () => {
                const mockResponse = {
                    choices: [{
                        message: {
                            tool_calls: [{
                                type: "function",
                                function: {name: OPENAI_TOOL_NAME, arguments: {}}
                            }]
                        }
                    }]
                };
                mockHttpClient.request.mockResolvedValueOnce(mockResponse);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params)).rejects.toMatchObject({
                    name: 'LLMStrategyError',
                    message: `${expectedBaseMsg} Arguments not a string.`,
                    llmId: baseLlmConfig.id,
                    details: {responseData: mockResponse}
                });
            });

            it('should throw LLMStrategyError if tool_call.function is missing', async () => {
                const mockResponse = {choices: [{message: {tool_calls: [{type: "function" /* no function property */}]}}]};
                mockHttpClient.request.mockResolvedValueOnce(mockResponse);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params)).rejects.toMatchObject({
                    name: 'LLMStrategyError',
                    message: `${expectedBaseMsg} 'function' property missing in tool_call.`,
                    llmId: baseLlmConfig.id,
                    details: {responseData: mockResponse}
                });
            });

            it('should propagate HttpClientError from httpClient.request', async () => {
                const httpError = new Error("Network failed");
                httpError.name = "HttpClientError";
                mockHttpClient.request.mockRejectedValueOnce(httpError);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params)).rejects.toThrow(httpError);
            });

            it('should wrap generic error from httpClient.request in LLMStrategyError', async () => {
                const genericError = new Error("Generic request failure");
                mockHttpClient.request.mockRejectedValueOnce(genericError);
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `API call failed for LLM '${baseLlmConfig.id}': ${genericError.message}`,
                        llmId: baseLlmConfig.id,
                        originalError: genericError
                    });
            });
        });
    });
});
// --- FILE END ---