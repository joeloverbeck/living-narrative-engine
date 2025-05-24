// tests/llms/strategies/anthropicToolCallingStrategy.test.js
// --- FILE START ---

import {AnthropicToolCallingStrategy} from '../../../src/llms/strategies/anthropicToolCallingStrategy.js';
import {LLMStrategyError} from '../../../src/llms/errors/LLMStrategyError.js';
import {
    ANTHROPIC_TOOL_NAME,
    GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA,
    DEFAULT_ANTHROPIC_VERSION
} from '../../../src/llms/constants/llmConstants.js';
import {BaseChatLLMStrategy} from '../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

jest.mock('../../../src/llms/strategies/base/baseChatLLMStrategy.js');

describe('AnthropicToolCallingStrategy', () => {
    let mockHttpClient;
    let mockLogger;
    let mockEnvironmentContext;
    let strategy;

    const mockGameSummary = "Current game state summary for Anthropic.";
    const mockApiKey = "test-anthropic-api-key";
    const baseLlmConfig = {
        id: 'anthropic-test-llm',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        modelIdentifier: 'claude-3-opus-20240229',
        apiType: 'anthropic',
        promptFrame: {system: "System prompt for Anthropic", user: "User prefix: {{gameSummary}}"},
        defaultParameters: {max_tokens: 1024, temperature: 0.6},
        providerSpecificHeaders: {},
    };

    const mockConstructedMessagesArray = [
        {role: "user", content: `System prompt for Anthropic\nUser prefix: ${mockGameSummary}`}
    ];
    const mockBaseMessagesPayloadObject = {messages: mockConstructedMessagesArray};

    const expectedToolInputObject = {action: "anthropic_action", speech: "hello from claude"};
    const expectedToolInputString = JSON.stringify(expectedToolInputObject);

    beforeEach(() => {
        mockHttpClient = {request: jest.fn()};
        mockLogger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()};
        mockEnvironmentContext = {isClient: jest.fn(), getProxyServerUrl: jest.fn()};

        BaseChatLLMStrategy.mockClear();
        BaseChatLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue(mockBaseMessagesPayloadObject);

        strategy = new AnthropicToolCallingStrategy({httpClient: mockHttpClient, logger: mockLogger});
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            expect(strategy).toBeInstanceOf(AnthropicToolCallingStrategy);
            expect(mockLogger.debug).toHaveBeenCalledWith('AnthropicToolCallingStrategy: Instance created.');
        });

        it('should throw an error if httpClient is invalid', () => {
            const expectedErrorMsg = 'AnthropicToolCallingStrategy: httpClient dependency is required.';
            expect(() => new AnthropicToolCallingStrategy({
                httpClient: null,
                logger: mockLogger
            })).toThrow(expectedErrorMsg);
        });

        it('should throw an error if logger is invalid', () => {
            const expectedErrorMsg = 'AnthropicToolCallingStrategy: logger dependency is required.';
            expect(() => new AnthropicToolCallingStrategy({
                httpClient: mockHttpClient,
                logger: null
            })).toThrow(expectedErrorMsg);
        });
    });

    describe('execute', () => {
        describe('Input Validations', () => {
            it('should throw LLMStrategyError if llmConfig is missing or null', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: null,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: 'llmConfig is required.',
                        llmId: {llmId: "N/A"} // Adjusted to match observed error structure
                    });
            });

            it('should throw LLMStrategyError if environmentContext is missing or null', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: null
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: 'environmentContext is required.',
                        llmId: {llmId: baseLlmConfig.id} // Adjusted
                    });
            });

            it('should wrap and throw LLMStrategyError if _constructPromptPayload throws', async () => {
                const constructionError = new Error("Anthropic prompt construction failed!");
                BaseChatLLMStrategy.prototype._constructPromptPayload.mockImplementationOnce(() => {
                    throw constructionError;
                });
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                await expect(strategy.execute(params))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `AnthropicToolCallingStrategy failed: ${constructionError.message}`,
                        llmId: { // Adjusted: llmId property contains the details object
                            llmId: baseLlmConfig.id,
                            originalError: {
                                name: constructionError.name,
                                message: constructionError.message
                            }
                        }
                    });
            });
        });

        describe('Successful Execution - Direct API Call (Server-side or no proxy needed)', () => {
            beforeEach(() => {
                mockEnvironmentContext.isClient.mockReturnValue(false);
                mockHttpClient.request.mockResolvedValue({
                    type: "message", role: "assistant", model: baseLlmConfig.modelIdentifier,
                    content: [
                        {type: "text", text: "Okay, I will use the tool."},
                        {type: "tool_use", id: "toolu_01", name: ANTHROPIC_TOOL_NAME, input: expectedToolInputObject}
                    ],
                    stop_reason: "tool_use", usage: {input_tokens: 100, output_tokens: 50}
                });
            });

            it('should make a direct API call with correct payload and headers', async () => {
                const params = {
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                };
                const result = await strategy.execute(params);
                expect(result).toBe(expectedToolInputString);
                const requestArgs = mockHttpClient.request.mock.calls[0];
                expect(requestArgs[0]).toBe(baseLlmConfig.endpointUrl);
                expect(requestArgs[1].headers['x-api-key']).toBe(mockApiKey);
                expect(requestArgs[1].headers['anthropic-version']).toBe(DEFAULT_ANTHROPIC_VERSION);
            });

            it('should use anthropic-version from providerSpecificHeaders', async () => {
                const specificVersion = "2023-07-15-custom";
                const configWithVersion = {
                    ...baseLlmConfig,
                    providerSpecificHeaders: {'anthropic-version': specificVersion}
                };
                await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: configWithVersion,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                });
                expect(mockHttpClient.request.mock.calls[0][1].headers['anthropic-version']).toBe(specificVersion);
            });

            it('should make a direct API call without x-api-key header and warn if apiKey is null (for cloud service)', async () => {
                const cloudLlmConfig = {...baseLlmConfig, endpointUrl: "https://api.anthropic.com/v1/messages"};
                await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: cloudLlmConfig,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                });
                expect(mockHttpClient.request.mock.calls[0][1].headers['x-api-key']).toBeUndefined();
                expect(mockLogger.warn).toHaveBeenCalledWith( // Adjusted to match exact log message
                    `AnthropicToolCallingStrategy: API key is not provided for a server-side/direct cloud call to LLM '${cloudLlmConfig.id}' at '${cloudLlmConfig.endpointUrl}'. The API call might fail if authentication is required by the endpoint.`
                );
            });
        });

        describe('Successful Execution - Proxied API Call (Client-side)', () => {
            const proxyUrl = 'http://localhost:8000/anthropic-proxy-test';
            const clientLlmConfig = {...baseLlmConfig, apiKeyEnvVar: 'ANTHROPIC_API_KEY_VAR_CLIENT'};
            beforeEach(() => {
                mockEnvironmentContext.isClient.mockReturnValue(true);
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue(proxyUrl);
                mockHttpClient.request.mockResolvedValue({
                    type: "message", role: "assistant",
                    content: [{
                        type: "tool_use",
                        name: ANTHROPIC_TOOL_NAME,
                        input: expectedToolInputObject,
                        id: "tool_proxied_123"
                    }],
                    stop_reason: "tool_use",
                });
            });

            it('should make a proxied API call with wrapped payload and minimal headers to proxy', async () => {
                await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: clientLlmConfig,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                });
                const requestArgs = mockHttpClient.request.mock.calls[0];
                expect(requestArgs[0]).toBe(proxyUrl);
                expect(requestArgs[1].headers['Content-Type']).toBe('application/json');
                expect(requestArgs[1].headers['x-api-key']).toBeUndefined();
                const finalPayloadToProxy = JSON.parse(requestArgs[1].body);
                expect(finalPayloadToProxy.targetLlmConfig.apiKeyEnvVar).toBe(clientLlmConfig.apiKeyEnvVar);
                expect(finalPayloadToProxy.targetLlmConfig.providerSpecificHeaders['anthropic-version']).toBe(DEFAULT_ANTHROPIC_VERSION);
            });

            it('should throw LLMStrategyError if proxy URL is not configured on client', async () => {
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue(null);
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: clientLlmConfig,
                    apiKey: null,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `Proxy server URL not configured for client-side Anthropic call.`,
                        llmId: { // Adjusted
                            llmId: clientLlmConfig.id,
                            missingConfig: "proxyServerUrl"
                        }
                    });
            });
        });

        describe('Response Parsing and Error Handling', () => {
            beforeEach(() => mockEnvironmentContext.isClient.mockReturnValue(false));

            it('should throw LLMStrategyError if API response is null', async () => {
                mockHttpClient.request.mockResolvedValueOnce(null);
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError', message: `Anthropic API response was null or undefined.`,
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            response: null
                        }
                    });
            });

            it('should throw LLMStrategyError if API response has .error field', async () => {
                const errorObj = {type: 'authentication_error', message: 'Invalid API key'};
                mockHttpClient.request.mockResolvedValueOnce({error: errorObj});
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `Anthropic API Error: ${errorObj.type} - ${errorObj.message}`,
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            apiError: errorObj
                        }
                    });
            });

            it('should throw LLMStrategyError if stop_reason is not "tool_use"', async () => {
                mockHttpClient.request.mockResolvedValueOnce({stop_reason: "end_turn", content: []}); // content is empty array
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError', message: expect.stringContaining("Actual stop_reason: 'end_turn'"),
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            responsePreview: "{\"stop_reason\":\"end_turn\",\"content\":[]}"
                        }
                    });
            });

            it('should throw LLMStrategyError if response content is not an array', async () => {
                mockHttpClient.request.mockResolvedValueOnce({stop_reason: "tool_use", content: {}}); // content is object
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError', message: expect.stringContaining("Response content was not an array"),
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            responsePreview: "{\"stop_reason\":\"tool_use\",\"content\":{}}"
                        }
                    });
            });

            it('should throw LLMStrategyError if no tool_use block with correct name is found', async () => {
                mockHttpClient.request.mockResolvedValueOnce({
                    stop_reason: "tool_use",
                    content: [{type: "tool_use", name: "wrong_tool", input: {}}]
                });
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: expect.stringContaining("did not contain expected tool_use block"),
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            responsePreview: "{\"stop_reason\":\"tool_use\",\"content\":[{\"type\":\"tool_use\",\"name\":\"wrong_tool\",\"input\":{}}]}"
                        }
                    });
            });

            it('should throw LLMStrategyError if tool_use block input is not an object', async () => {
                mockHttpClient.request.mockResolvedValueOnce({
                    stop_reason: "tool_use",
                    content: [{type: "tool_use", name: ANTHROPIC_TOOL_NAME, input: "string"}]
                });
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: expect.stringContaining("did not contain expected tool_use block or input object"),
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            responsePreview: "{\"stop_reason\":\"tool_use\",\"content\":[{\"type\":\"tool_use\",\"name\":\"get_game_ai_action_speech\",\"input\":\"string\"}]}"
                        }
                    });
            });

            it('should throw LLMStrategyError if tool_use block input is null', async () => {
                mockHttpClient.request.mockResolvedValueOnce({
                    stop_reason: "tool_use",
                    content: [{type: "tool_use", name: ANTHROPIC_TOOL_NAME, input: null, id: "tool_z"}]
                });
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: expect.stringContaining(`did not contain expected tool_use block or input object`),
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            responsePreview: "{\"stop_reason\":\"tool_use\",\"content\":[{\"type\":\"tool_use\",\"name\":\"get_game_ai_action_speech\",\"input\":null,\"id\":\"tool_z\"}]}"
                        }
                    });
            });


            it('should wrap generic error from httpClient.request in LLMStrategyError', async () => {
                const networkError = new Error("Simulated network failure for Anthropic");
                mockHttpClient.request.mockRejectedValueOnce(networkError);
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfig,
                    apiKey: mockApiKey,
                    environmentContext: mockEnvironmentContext
                }))
                    .rejects.toMatchObject({
                        name: 'LLMStrategyError',
                        message: `AnthropicToolCallingStrategy failed: ${networkError.message}`,
                        llmId: { // Adjusted
                            llmId: baseLlmConfig.id,
                            originalError: {name: networkError.name, message: networkError.message}
                        }
                    });
            });
        });
    });
});
// --- FILE END ---