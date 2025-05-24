// tests/llms/strategies/ollamaNativeJsonStrategy.test.js
// --- FILE START ---

import {OllamaNativeJsonStrategy} from '../../../src/llms/strategies/ollamaNativeJsonStrategy.js';
import {LLMStrategyError} from '../../../src/llms/errors/LLMStrategyError.js';
// Assuming ConfigurationError might be locally defined or imported if shared
// For this test, we can define a simple version if not easily importable
// from the strategy's perspective or a common errors module.
class ConfigurationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "ConfigurationError";
        this.llmId = details.llmId;
        this.problematicField = details.problematicField;
    }
}

import {BaseChatLLMStrategy} from '../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {BaseCompletionLLMStrategy} from '../../../src/llms/strategies/base/baseCompletionLLMStrategy.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

jest.mock('../../../src/llms/strategies/base/baseChatLLMStrategy.js');
jest.mock('../../../src/llms/strategies/base/baseCompletionLLMStrategy.js');

describe('OllamaNativeJsonStrategy', () => {
    let mockHttpClient;
    let mockLogger;
    let strategy;

    const mockGameSummary = "Current game state summary for Ollama.";
    const mockApiKey = "ollama-api-key-if-needed"; // Typically null

    const baseLlmConfigChat = {
        id: 'ollama-chat-test-llm',
        endpointUrl: 'http://localhost:11434/api/chat',
        modelIdentifier: 'llama3-chat',
        apiType: 'ollama',
        promptFrame: {system: "System prompt for Ollama chat"},
        defaultParameters: {temperature: 0.5},
    };

    const baseLlmConfigGenerate = {
        id: 'ollama-generate-test-llm',
        endpointUrl: 'http://localhost:11434/api/generate',
        modelIdentifier: 'llama3-generate',
        apiType: 'ollama',
        promptFrame: "Prompt frame for Ollama generate: {{gameSummary}}",
        defaultParameters: {top_p: 0.9},
    };

    const mockConstructedChatPayloadPart = {messages: [{role: "user", content: mockGameSummary}]};
    const mockConstructedGeneratePayloadPart = {prompt: mockGameSummary};
    const mockJsonResponseString = JSON.stringify({action: "ollama_action", speech: "hello from ollama"});

    beforeEach(() => {
        mockHttpClient = {request: jest.fn()};
        mockLogger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()};

        // Clear all instances and calls to constructor and all methods:
        BaseChatLLMStrategy.mockClear();
        BaseCompletionLLMStrategy.mockClear();

        // Setup mock implementations for _constructPromptPayload
        BaseChatLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue(mockConstructedChatPayloadPart);
        BaseCompletionLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue(mockConstructedGeneratePayloadPart);

        strategy = new OllamaNativeJsonStrategy({httpClient: mockHttpClient, logger: mockLogger});
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            expect(strategy).toBeInstanceOf(OllamaNativeJsonStrategy);
            expect(mockLogger.debug).toHaveBeenCalledWith('OllamaNativeJsonStrategy: Instance created.');
        });

        it('should throw an error if httpClient is invalid', () => {
            expect(() => new OllamaNativeJsonStrategy({httpClient: null, logger: mockLogger}))
                .toThrow('OllamaNativeJsonStrategy: Constructor requires a valid IHttpClient instance.');
            expect(() => new OllamaNativeJsonStrategy({httpClient: {}, logger: mockLogger}))
                .toThrow('OllamaNativeJsonStrategy: Constructor requires a valid IHttpClient instance.');
        });

        it('should throw an error if logger is invalid', () => {
            expect(() => new OllamaNativeJsonStrategy({httpClient: mockHttpClient, logger: null}))
                .toThrow('OllamaNativeJsonStrategy: Constructor requires a valid ILogger instance.');
        });
    });

    describe('execute', () => {
        describe('Input Validations', () => {
            it('should throw ConfigurationError if llmConfig is missing', async () => {
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: null,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new ConfigurationError("llmConfig is required.", {llmId: "N/A"}));
            });

            it('should throw ConfigurationError if llmConfig.apiType is not "ollama"', async () => {
                const invalidConfig = {...baseLlmConfigChat, apiType: 'openai'};
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: invalidConfig,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new ConfigurationError(`Invalid apiType '${invalidConfig.apiType}'. OllamaNativeJsonStrategy only supports 'ollama'.`, {
                        llmId: invalidConfig.id,
                        problematicField: 'apiType',
                        fieldValue: invalidConfig.apiType
                    }));
            });

            it('should throw LLMStrategyError if gameSummary is missing or not a string', async () => {
                await expect(strategy.execute({
                    gameSummary: null,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id));
                await expect(strategy.execute({
                    gameSummary: 123,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id));
            });

            it('should throw ConfigurationError if llmConfig.endpointUrl is missing', async () => {
                const invalidConfig = {...baseLlmConfigChat, endpointUrl: null};
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: invalidConfig,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new ConfigurationError(`'endpointUrl' is missing or invalid in llmConfig for LLM '${invalidConfig.id}'.`, {
                        llmId: invalidConfig.id,
                        problematicField: 'endpointUrl'
                    }));
            });

            it('should throw ConfigurationError if llmConfig.modelIdentifier is missing', async () => {
                const invalidConfig = {...baseLlmConfigChat, modelIdentifier: null};
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: invalidConfig,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new ConfigurationError(`'modelIdentifier' is missing or invalid in llmConfig for LLM '${invalidConfig.id}'.`, {
                        llmId: invalidConfig.id,
                        problematicField: 'modelIdentifier'
                    }));
            });

            it('should wrap and throw LLMStrategyError if prompt construction fails', async () => {
                const constructionError = new Error("Prompt construction failed!");
                BaseChatLLMStrategy.prototype._constructPromptPayload.mockImplementationOnce(() => {
                    throw constructionError;
                });
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Prompt construction failed for LLM '${baseLlmConfigChat.id}': ${constructionError.message}`, baseLlmConfigChat.id, constructionError));
            });
        });

        describe('Successful Execution - Chat Style (/api/chat)', () => {
            beforeEach(() => {
                mockHttpClient.request.mockResolvedValue({message: {content: mockJsonResponseString}});
            });

            it('should use BaseChatLLMStrategy and make correct API call', async () => {
                const result = await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                });
                expect(result).toBe(mockJsonResponseString);
                expect(BaseChatLLMStrategy).toHaveBeenCalledTimes(1);
                expect(BaseChatLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigChat.promptFrame, baseLlmConfigChat);
                expect(BaseCompletionLLMStrategy).not.toHaveBeenCalled();

                expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
                const requestCall = mockHttpClient.request.mock.calls[0];
                const requestUrl = requestCall[0];
                const requestOptions = requestCall[1];
                const requestBody = JSON.parse(requestOptions.body);

                expect(requestUrl).toBe(baseLlmConfigChat.endpointUrl);
                expect(requestOptions.method).toBe('POST');
                expect(requestOptions.headers['Content-Type']).toBe('application/json');
                expect(requestBody.model).toBe(baseLlmConfigChat.modelIdentifier);
                expect(requestBody.messages).toEqual(mockConstructedChatPayloadPart.messages);
                expect(requestBody.format).toBe("json");
                expect(requestBody.stream).toBe(false);
                expect(requestBody.temperature).toBe(baseLlmConfigChat.defaultParameters.temperature);
            });

            it('should include providerSpecificHeaders in the request', async () => {
                const configWithHeaders = {
                    ...baseLlmConfigChat,
                    providerSpecificHeaders: {'X-Custom-Ollama': 'ChatValue'}
                };
                await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: configWithHeaders,
                    apiKey: null,
                    environmentContext: {}
                });
                expect(mockHttpClient.request.mock.calls[0][1].headers['X-Custom-Ollama']).toBe('ChatValue');
            });

            it('should log a warning if an apiKey is provided', async () => {
                await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: mockApiKey,
                    environmentContext: {}
                });
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`An apiKey was provided for Ollama LLM '${baseLlmConfigChat.id}'`),
                    {llmId: baseLlmConfigChat.id}
                );
            });
        });

        describe('Successful Execution - Generate Style (/api/generate)', () => {
            beforeEach(() => {
                mockHttpClient.request.mockResolvedValue({response: mockJsonResponseString});
            });

            it('should use BaseCompletionLLMStrategy and make correct API call', async () => {
                const result = await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigGenerate,
                    apiKey: null,
                    environmentContext: {}
                });
                expect(result).toBe(mockJsonResponseString);
                expect(BaseCompletionLLMStrategy).toHaveBeenCalledTimes(1);
                expect(BaseCompletionLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigGenerate.promptFrame, baseLlmConfigGenerate);
                expect(BaseChatLLMStrategy).not.toHaveBeenCalled();


                expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
                const requestCall = mockHttpClient.request.mock.calls[0];
                const requestUrl = requestCall[0];
                const requestOptions = requestCall[1];
                const requestBody = JSON.parse(requestOptions.body);

                expect(requestUrl).toBe(baseLlmConfigGenerate.endpointUrl);
                expect(requestBody.model).toBe(baseLlmConfigGenerate.modelIdentifier);
                expect(requestBody.prompt).toEqual(mockConstructedGeneratePayloadPart.prompt);
                expect(requestBody.format).toBe("json");
                expect(requestBody.stream).toBe(false);
                expect(requestBody.top_p).toBe(baseLlmConfigGenerate.defaultParameters.top_p);
            });
        });


        describe('Response Parsing and Error Handling', () => {
            it('should throw LLMStrategyError if httpClient.request throws', async () => {
                const networkError = new Error("Ollama network failed");
                mockHttpClient.request.mockRejectedValueOnce(networkError);
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`API call or response processing failed for LLM '${baseLlmConfigChat.id}'. Error: ${networkError.message}`, baseLlmConfigChat.id, networkError));
            });

            it('should throw LLMStrategyError if API response is null or undefined', async () => {
                mockHttpClient.request.mockResolvedValueOnce(null);
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id, {responseData: null}));
            });

            it('should throw LLMStrategyError if API response has no expected fields (chat style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({other_field: "some_value"});
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id, {responseData: {other_field: "some_value"}}));
            });

            it('should throw LLMStrategyError if API response has no expected fields (generate style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({other_field: "some_value"});
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigGenerate,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigGenerate.id}'.`, baseLlmConfigGenerate.id, {responseData: {other_field: "some_value"}}));
            });


            it('should throw LLMStrategyError if message.content is empty string (chat style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({message: {content: "  "}}); // Whitespace only
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id, {responseData: {message: {content: "  "}}}));
            });

            it('should throw LLMStrategyError if response is empty string (generate style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({response: "  "}); // Whitespace only
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigGenerate,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigGenerate.id}'.`, baseLlmConfigGenerate.id, {responseData: {response: "  "}}));
            });

            it('should throw LLMStrategyError if message.content is not a string (chat style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({message: {content: 123}});
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigChat.id}'.`, baseLlmConfigChat.id, {responseData: {message: {content: 123}}}));
            });

            it('should throw LLMStrategyError if response is not a string (generate style)', async () => {
                mockHttpClient.request.mockResolvedValueOnce({response: {}});
                await expect(strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigGenerate,
                    apiKey: null,
                    environmentContext: {}
                }))
                    .rejects.toThrow(new LLMStrategyError(`Failed to extract JSON content from expected fields (responseData.message.content or responseData.response) for LLM '${baseLlmConfigGenerate.id}'.`, baseLlmConfigGenerate.id, {responseData: {response: {}}}));
            });

            it('should correctly extract from responseData.response if responseData.message.content is missing (e.g. generate endpoint with chat-style config)', async () => {
                // Simulating a generate-style response for a chat-configured endpoint (less likely but good to test robustness)
                mockHttpClient.request.mockResolvedValueOnce({response: mockJsonResponseString});
                const result = await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigChat,
                    apiKey: null,
                    environmentContext: {}
                });
                expect(result).toBe(mockJsonResponseString);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    expect.stringContaining(`Extracted JSON string from responseData.response (likely /api/generate)`),
                    expect.anything() // or specific object { llmId: baseLlmConfigChat.id }
                );
            });

            it('should correctly extract from responseData.message.content if responseData.response is missing (e.g. chat endpoint with generate-style config)', async () => {
                // Simulating a chat-style response for a generate-configured endpoint
                mockHttpClient.request.mockResolvedValueOnce({message: {content: mockJsonResponseString}});
                const result = await strategy.execute({
                    gameSummary: mockGameSummary,
                    llmConfig: baseLlmConfigGenerate,
                    apiKey: null,
                    environmentContext: {}
                });
                expect(result).toBe(mockJsonResponseString);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    expect.stringContaining(`Extracted JSON string from responseData.message.content (likely /api/chat)`),
                    expect.anything() // or specific object { llmId: baseLlmConfigGenerate.id }
                );
            });
        });
    });
});
// --- FILE END ---