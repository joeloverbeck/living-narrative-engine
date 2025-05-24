// tests/llms/strategies/defaultPromptEngineeringStrategy.test.js
// --- FILE START ---

import {DefaultPromptEngineeringStrategy} from '../../../src/llms/strategies/DefaultPromptEngineeringStrategy.js';
import {LLMStrategyError} from '../../../src/llms/errors/LLMStrategyError.js';
import {ConfigurationError} from '../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust if path is different
import {EnvironmentContext} from '../../../src/llms/environmentContext.js'; // Adjust if path is different
import {BaseChatLLMStrategy} from '../../../src/llms/strategies/base/BaseChatLLMStrategy.js';
import {BaseCompletionLLMStrategy} from '../../../src/llms/strategies/base/BaseCompletionLLMStrategy.js';
import {jest, beforeEach, describe, expect, it} from '@jest/globals';

// Mock base strategies
jest.mock('../../../src/llms/strategies/base/BaseChatLLMStrategy.js');
jest.mock('../../../src/llms/strategies/base/BaseCompletionLLMStrategy.js');

describe('DefaultPromptEngineeringStrategy', () => {
    let mockHttpClient;
    let mockLogger;
    let mockEnvironmentContext;
    let strategy; // Will be initialized in beforeEach

    const mockGameSummary = "The dragon sleeps on its hoard of gold.";
    const mockApiKey = "test-api-key-123";
    const mockExpectedJsonString = JSON.stringify({action: "steal_gold", speech: "Ssh, be quiet!"});

    const baseLlmConfigOpenAI = {
        id: 'openai-prompt-eng',
        apiType: 'openai',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        modelIdentifier: 'gpt-3.5-turbo-instruct',
        promptFrame: "System: You are an AI. User: {{gameSummary}}. Output JSON.",
        defaultParameters: {temperature: 0.3},
        providerSpecificHeaders: {'X-OpenAI-Custom': 'true'}
    };

    const baseLlmConfigAnthropic = {
        id: 'anthropic-prompt-eng',
        apiType: 'anthropic',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        modelIdentifier: 'claude-2',
        promptFrame: {system: "System prompt for Anthropic", user: "User: {{gameSummary}}. Output JSON."},
        defaultParameters: {max_tokens_to_sample: 300},
        providerSpecificHeaders: {'anthropic-version': '2023-06-01'}
    };

    const baseLlmConfigOllamaChat = {
        id: 'ollama-chat-prompt-eng',
        apiType: 'ollama',
        endpointUrl: 'http://localhost:11434/api/chat',
        modelIdentifier: 'llama2-chat',
        promptFrame: {system: "System prompt for Ollama", user: "User: {{gameSummary}}. Output JSON."},
        defaultParameters: {},
    };
    const baseLlmConfigOllamaGenerate = {
        id: 'ollama-generate-prompt-eng',
        apiType: 'ollama',
        endpointUrl: 'http://localhost:11434/api/generate',
        modelIdentifier: 'llama2-generate',
        promptFrame: "Prompt for Ollama: {{gameSummary}}. Output JSON.",
        defaultParameters: {stream: false},
    };

    const mockChatMessages = [{role: 'user', content: `System: You are an AI. User: ${mockGameSummary}. Output JSON.`}];
    const mockCompletionPrompt = `System: You are an AI. User: ${mockGameSummary}. Output JSON.`;


    beforeEach(() => {
        mockHttpClient = {request: jest.fn()};
        mockLogger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()};

        mockEnvironmentContext = {
            isClient: jest.fn().mockReturnValue(false),
            getProxyServerUrl: jest.fn().mockReturnValue('http://localhost:3001/proxy'),
        };

        BaseChatLLMStrategy.mockClear();
        BaseCompletionLLMStrategy.mockClear();
        BaseChatLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue({messages: mockChatMessages});
        BaseCompletionLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue({prompt: mockCompletionPrompt});

        strategy = new DefaultPromptEngineeringStrategy({httpClient: mockHttpClient, logger: mockLogger});
    });

    describe('Constructor', () => {
        it('should store IHttpClient and ILogger instances', () => {
            // Check that the constructor ran without error (strategy is created in beforeEach)
            // and that the logger (which is public on the base class) is set.
            expect(strategy.logger).toBe(mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith('DefaultPromptEngineeringStrategy: Instance created.');
            // The private #httpClient is implicitly tested by its usage in the execute method tests.
        });

        it('should throw if httpClient is invalid', () => {
            expect(() => new DefaultPromptEngineeringStrategy({httpClient: null, logger: mockLogger}))
                .toThrow('DefaultPromptEngineeringStrategy: Constructor requires a valid IHttpClient instance.');
            expect(() => new DefaultPromptEngineeringStrategy({httpClient: {}, logger: mockLogger}))
                .toThrow('DefaultPromptEngineeringStrategy: Constructor requires a valid IHttpClient instance.');
        });

        it('should throw if logger is invalid', () => {
            expect(() => new DefaultPromptEngineeringStrategy({httpClient: mockHttpClient, logger: null}))
                .toThrow('DefaultPromptEngineeringStrategy: Constructor requires a valid ILogger instance.');

            const incompleteLogger = {debug: jest.fn(), info: jest.fn() /* missing error, warn */};
            expect(() => new DefaultPromptEngineeringStrategy({httpClient: mockHttpClient, logger: incompleteLogger}))
                .toThrow('DefaultPromptEngineeringStrategy: Constructor requires a valid ILogger instance.');
        });
    });

    // ... (rest of the describe blocks and tests remain unchanged) ...

    describe('execute - Input Validations', () => {
        it('should throw ConfigurationError if llmConfig is missing', async () => {
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: null,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new ConfigurationError('llmConfig is required.', {llmId: 'UnknownLLM'}));
        });

        it('should throw ConfigurationError if environmentContext is missing', async () => {
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: null
            }))
                .rejects.toThrow(new ConfigurationError('environmentContext is required.', {llmId: baseLlmConfigOpenAI.id}));
        });

        it('should throw LLMStrategyError if gameSummary is not a string', async () => {
            await expect(strategy.execute({
                gameSummary: 123, // Not a string
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${baseLlmConfigOpenAI.id}'.`, baseLlmConfigOpenAI.id));
        });

        it('should throw LLMStrategyError if prompt construction fails to produce content', async () => {
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({messages: []}); // Empty messages
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError(`Prompt construction failed to produce content for LLM '${baseLlmConfigOpenAI.id}'.`, baseLlmConfigOpenAI.id));
        });
    });

    describe('Successful Execution - Direct API Call (Server-side)', () => {
        beforeEach(() => {
            mockEnvironmentContext.isClient.mockReturnValue(false);
            mockHttpClient.request.mockResolvedValue({choices: [{message: {content: mockExpectedJsonString}}]});
        });

        it('should use BaseChatLLMStrategy for OpenAI and form correct payload', async () => {
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
            expect(BaseChatLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigOpenAI.promptFrame, baseLlmConfigOpenAI);
            const requestArgs = mockHttpClient.request.mock.calls[0];
            expect(requestArgs[0]).toBe(baseLlmConfigOpenAI.endpointUrl);
            const requestBody = JSON.parse(requestArgs[1].body);
            expect(requestBody.model).toBe(baseLlmConfigOpenAI.modelIdentifier);
            expect(requestBody.messages).toEqual(mockChatMessages);
            expect(requestBody.temperature).toBe(baseLlmConfigOpenAI.defaultParameters.temperature);
            expect(requestArgs[1].headers['Authorization']).toBe(`Bearer ${mockApiKey}`);
            expect(requestArgs[1].headers['X-OpenAI-Custom']).toBe('true');
        });

        it('should use BaseChatLLMStrategy for Anthropic and form correct payload with x-api-key', async () => {
            const anthropicChatMessages = [{
                role: 'user',
                content: `System prompt for Anthropic\nUser: ${mockGameSummary}. Output JSON.`
            }];
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({messages: anthropicChatMessages});
            mockHttpClient.request.mockResolvedValueOnce({content: [{type: 'text', text: mockExpectedJsonString}]});

            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigAnthropic,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
            expect(BaseChatLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigAnthropic.promptFrame, baseLlmConfigAnthropic);
            const requestArgs = mockHttpClient.request.mock.calls[0];
            expect(requestArgs[0]).toBe(baseLlmConfigAnthropic.endpointUrl);
            const requestBody = JSON.parse(requestArgs[1].body);
            expect(requestBody.model).toBe(baseLlmConfigAnthropic.modelIdentifier);
            expect(requestBody.max_tokens_to_sample).toBe(baseLlmConfigAnthropic.defaultParameters.max_tokens_to_sample);
            expect(requestArgs[1].headers['x-api-key']).toBe(mockApiKey);
            expect(requestArgs[1].headers['anthropic-version']).toBe('2023-06-01');
        });

        it('should use BaseChatLLMStrategy for Ollama /api/chat', async () => {
            const ollamaChatMessages = [{
                role: 'user',
                content: `System prompt for Ollama\nUser: ${mockGameSummary}. Output JSON.`
            }];
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({messages: ollamaChatMessages});
            mockHttpClient.request.mockResolvedValueOnce({message: {content: mockExpectedJsonString}});

            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOllamaChat,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
            expect(BaseChatLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigOllamaChat.promptFrame, baseLlmConfigOllamaChat);
            const requestArgs = mockHttpClient.request.mock.calls[0];
            const requestBody = JSON.parse(requestArgs[1].body);
            expect(requestBody.model).toBe(baseLlmConfigOllamaChat.modelIdentifier);
            expect(requestBody.messages).toEqual(ollamaChatMessages);
            expect(requestArgs[1].headers['Authorization']).toBeUndefined();
        });

        it('should use BaseCompletionLLMStrategy for Ollama /api/generate', async () => {
            const ollamaGeneratePrompt = `Prompt for Ollama: ${mockGameSummary}. Output JSON.`;
            BaseCompletionLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({prompt: ollamaGeneratePrompt});
            mockHttpClient.request.mockResolvedValueOnce({response: mockExpectedJsonString});

            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOllamaGenerate,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
            expect(BaseCompletionLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfigOllamaGenerate.promptFrame, baseLlmConfigOllamaGenerate);
            const requestArgs = mockHttpClient.request.mock.calls[0];
            const requestBody = JSON.parse(requestArgs[1].body);
            expect(requestBody.model).toBe(baseLlmConfigOllamaGenerate.modelIdentifier);
            expect(requestBody.prompt).toEqual(ollamaGeneratePrompt);
            expect(requestBody.stream).toBe(false);
        });


        it('should warn if API key is not provided for a server-side cloud call', async () => {
            await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`API key is not provided for a server-side/direct cloud call to '${baseLlmConfigOpenAI.endpointUrl}'`),
            );
        });
    });

    describe('Successful Execution - Proxied API Call (Client-side)', () => {
        const proxyUrl = 'http://localhost:8080/llm-proxy';
        const clientLlmConfig = {...baseLlmConfigOpenAI, apiKeyEnvVar: 'OPENAI_KEY_VAR_TEST'};

        beforeEach(() => {
            mockEnvironmentContext.isClient.mockReturnValue(true);
            mockEnvironmentContext.getProxyServerUrl.mockReturnValue(proxyUrl);
            mockHttpClient.request.mockResolvedValue({choices: [{message: {content: mockExpectedJsonString}}]});
        });

        it('should make a proxied API call with wrapped payload', async () => {
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({messages: mockChatMessages});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: clientLlmConfig,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);

            const requestArgs = mockHttpClient.request.mock.calls[0];
            expect(requestArgs[0]).toBe(proxyUrl);
            const finalPayloadToProxy = JSON.parse(requestArgs[1].body);

            expect(finalPayloadToProxy.targetLlmConfig.endpointUrl).toBe(clientLlmConfig.endpointUrl);
            expect(finalPayloadToProxy.targetLlmConfig.apiKeyEnvVar).toBe(clientLlmConfig.apiKeyEnvVar);
            expect(finalPayloadToProxy.targetLlmConfig.providerSpecificHeaders).toEqual(clientLlmConfig.providerSpecificHeaders);
            expect(finalPayloadToProxy.llmRequestPayload.model).toBe(clientLlmConfig.modelIdentifier);
            expect(finalPayloadToProxy.llmRequestPayload.messages).toEqual(mockChatMessages);
            expect(requestArgs[1].headers['Authorization']).toBeUndefined();
        });

        it('should throw ConfigurationError if proxy URL not configured on client', async () => {
            mockEnvironmentContext.getProxyServerUrl.mockReturnValue(null);
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: clientLlmConfig,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new ConfigurationError('Client-side proxy URL not configured.', {
                    llmId: clientLlmConfig.id,
                    missingConfig: 'proxyServerUrl'
                }));
        });

        it('should throw ConfigurationError if API key source missing for client-side proxy call', async () => {
            const configNoKeySource = {...baseLlmConfigOpenAI, apiKeyEnvVar: undefined, apiKeyFileName: undefined};
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: configNoKeySource,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new ConfigurationError('API key configuration missing for client-side proxied call.', {llmId: configNoKeySource.id}));
        });
    });


    describe('Response Extraction Logic', () => {
        beforeEach(() => {
            mockEnvironmentContext.isClient.mockReturnValue(false);
        });

        it('extracts from choices[0].message.content (OpenAI chat)', async () => {
            mockHttpClient.request.mockResolvedValueOnce({choices: [{message: {content: mockExpectedJsonString}}]});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('extracts from choices[0].text (OpenAI older completion)', async () => {
            const olderOpenAIConfig = {
                ...baseLlmConfigOpenAI,
                apiType: 'openai',
                promptFrame: "Prompt: {{gameSummary}}"
            };
            BaseCompletionLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({prompt: `Prompt: ${mockGameSummary}`});
            mockHttpClient.request.mockResolvedValueOnce({choices: [{text: mockExpectedJsonString}]});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: olderOpenAIConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('extracts from content[0].text (Anthropic)', async () => {
            mockHttpClient.request.mockResolvedValueOnce({content: [{type: 'text', text: mockExpectedJsonString}]});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigAnthropic,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('extracts from message.content (Ollama chat)', async () => {
            mockHttpClient.request.mockResolvedValueOnce({message: {content: mockExpectedJsonString}});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOllamaChat,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('extracts from response (Ollama generate)', async () => {
            mockHttpClient.request.mockResolvedValueOnce({response: mockExpectedJsonString});
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOllamaGenerate,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('extracts from direct string response', async () => {
            const directStringConfig = {
                ...baseLlmConfigOpenAI,
                apiType: 'custom',
                endpointUrl: 'http://custom.api/complete',
                promptFrame: "{{gameSummary}}"
            };
            BaseCompletionLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({prompt: mockGameSummary});
            mockHttpClient.request.mockResolvedValueOnce(mockExpectedJsonString);
            const result = await strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: directStringConfig,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            });
            expect(result).toBe(mockExpectedJsonString);
        });

        it('throws LLMStrategyError if content is not a string or is empty after extraction', async () => {
            mockHttpClient.request.mockResolvedValueOnce({choices: [{message: {content: null}}]});
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError('Failed to extract usable content string from LLM response.', baseLlmConfigOpenAI.id));

            mockHttpClient.request.mockResolvedValueOnce({choices: [{message: {content: "   "}}]});
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError('Failed to extract usable content string from LLM response.', baseLlmConfigOpenAI.id));
        });

        it('throws LLMStrategyError if responseData is null', async () => {
            mockHttpClient.request.mockResolvedValueOnce(null);
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError('API response was null or undefined.', baseLlmConfigOpenAI.id));
        });

        it('throws LLMStrategyError if API returns an error object in responseData.error', async () => {
            const apiError = {message: "Invalid API request", code: 400};
            mockHttpClient.request.mockResolvedValueOnce({error: apiError});
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(new LLMStrategyError(`API Error: ${apiError.message}`, baseLlmConfigOpenAI.id));
        });
    });

    describe('Error Handling from httpClient.request', () => {
        it('should propagate LLMStrategyError directly', async () => {
            const originalError = new LLMStrategyError("Original LLM error from request", "some-llm-id");
            mockHttpClient.request.mockRejectedValueOnce(originalError);
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(originalError);
        });

        it('should propagate ConfigurationError directly', async () => {
            const originalError = new ConfigurationError("Original config error from request", {llmId: "some-llm-id"});
            mockHttpClient.request.mockRejectedValueOnce(originalError);
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toThrow(originalError);
        });

        it('should wrap generic errors from httpClient.request in LLMStrategyError', async () => {
            const genericError = new Error("Network hiccup during request");
            mockHttpClient.request.mockRejectedValueOnce(genericError);
            await expect(strategy.execute({
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfigOpenAI,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            }))
                .rejects.toMatchObject({
                    name: 'LLMStrategyError',
                    message: `DefaultPromptEngineeringStrategy (${baseLlmConfigOpenAI.id}) failed: ${genericError.message}`,
                    llmId: baseLlmConfigOpenAI.id,
                    originalError: genericError
                });
        });
    });
});
// --- FILE END ---