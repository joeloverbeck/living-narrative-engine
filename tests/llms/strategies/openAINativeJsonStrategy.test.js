// tests/llms/strategies/openAINativeJsonStrategy.test.js
// --- FILE START ---

import {OpenAINativeJsonStrategy} from '../../../src/llms/strategies/OpenAINativeJsonStrategy.js';
import {LLMStrategyError} from '../../../src/llms/errors/LLMStrategyError.js';
import {ConfigurationError} from '../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust path if necessary
import {BaseChatLLMStrategy} from '../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

jest.mock('../../../src/llms/strategies/base/baseChatLLMStrategy.js');

describe('OpenAINativeJsonStrategy', () => {
    let mockHttpClient;
    let mockLogger;
    let mockEnvironmentContext;
    let strategy;

    const mockGameSummary = "The troll is guarding the bridge. You see a shiny sword nearby.";
    const mockApiKey = "sk-test-openai-api-key";

    const baseLlmConfig = {
        id: 'openai-json-test-llm',
        displayName: 'OpenAI JSON Test LLM',
        apiType: 'openai',
        modelIdentifier: 'gpt-3.5-turbo-1106', // A model that supports JSON mode
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        promptFrame: {
            system: "You are a helpful assistant. Respond in JSON.",
            user: "Based on the following summary, provide a JSON object: {{gameSummary}}"
        },
        defaultParameters: {temperature: 0.5, max_tokens: 500},
        providerSpecificHeaders: {'X-Custom-Test-Header': 'TestValue'},
        apiKeyEnvVar: 'TEST_OPENAI_API_KEY_ENV',
        apiKeyFileName: 'test_openai_api_key.txt',
    };

    const mockConstructedMessages = [
        {role: "system", content: "You are a helpful assistant. Respond in JSON."},
        {role: "user", content: `Based on the following summary, provide a JSON object: ${mockGameSummary}`}
    ];
    const mockBaseMessagesPayload = {messages: mockConstructedMessages};
    const mockJsonResponseString = JSON.stringify({action: "take_sword", reason: "It looks shiny and useful."});

    beforeEach(() => {
        mockHttpClient = {request: jest.fn()};
        mockLogger = {debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()};
        mockEnvironmentContext = {isClient: jest.fn(), getProxyServerUrl: jest.fn()};

        BaseChatLLMStrategy.mockClear();
        BaseChatLLMStrategy.prototype._constructPromptPayload = jest.fn().mockReturnValue(mockBaseMessagesPayload);

        strategy = new OpenAINativeJsonStrategy({httpClient: mockHttpClient, logger: mockLogger});
    });

    describe('Constructor', () => {
        it('should successfully create an instance with valid dependencies', () => {
            expect(strategy).toBeInstanceOf(OpenAINativeJsonStrategy);
            expect(mockLogger.debug).toHaveBeenCalledWith('OpenAINativeJsonStrategy: Instance created.');
        });

        it('should throw an error if httpClient is invalid or missing request function', () => {
            const expectedErrorMsg = 'OpenAINativeJsonStrategy: Constructor requires a valid IHttpClient instance.';
            expect(() => new OpenAINativeJsonStrategy({
                httpClient: null,
                logger: mockLogger
            })).toThrow(expectedErrorMsg);
            expect(() => new OpenAINativeJsonStrategy({httpClient: {}, logger: mockLogger})).toThrow(expectedErrorMsg);
        });

        it('should throw an error if logger is invalid or missing methods', () => {
            const expectedErrorMsg = 'OpenAINativeJsonStrategy: Constructor requires a valid ILogger instance.';
            expect(() => new OpenAINativeJsonStrategy({
                httpClient: mockHttpClient,
                logger: null
            })).toThrow(expectedErrorMsg);
            expect(() => new OpenAINativeJsonStrategy({
                httpClient: mockHttpClient,
                logger: {}
            })).toThrow(expectedErrorMsg);
            expect(() => new OpenAINativeJsonStrategy({
                httpClient: mockHttpClient, logger: {
                    info: () => {
                    } // Missing .error, for example
                }
            })).toThrow(expectedErrorMsg);
        });
    });

    describe('execute - Input Validations', () => {
        it('should throw ConfigurationError if llmConfig is missing', async () => {
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: null,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new ConfigurationError('llmConfig is required.', {llmId: 'UnknownLLM'}));
        });

        it('should throw ConfigurationError if llmConfig.apiType is not "openai"', async () => {
            const wrongApiTypeConfig = {...baseLlmConfig, apiType: 'anthropic'};
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: wrongApiTypeConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new ConfigurationError(`Invalid apiType 'anthropic'. OpenAINativeJsonStrategy only supports 'openai'.`, {
                    llmId: wrongApiTypeConfig.id,
                    problematicField: 'apiType',
                    fieldValue: 'anthropic'
                }));
        });

        it('should throw ConfigurationError if environmentContext is missing', async () => {
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: null
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new ConfigurationError('environmentContext is required.', {llmId: baseLlmConfig.id}));
        });

        it('should throw LLMStrategyError if gameSummary is not a string', async () => {
            const params = {
                gameSummary: 123,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${baseLlmConfig.id}'.`, baseLlmConfig.id));
        });
        it('should throw LLMStrategyError if gameSummary is null', async () => {
            const params = {
                gameSummary: null,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new LLMStrategyError(`'gameSummary' is required and must be a string for LLM '${baseLlmConfig.id}'.`, baseLlmConfig.id));
        });

        it('should throw LLMStrategyError if prompt construction fails to produce messages', async () => {
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce({messages: []}); // Empty messages array
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new LLMStrategyError(`Prompt construction failed to produce messages for LLM '${baseLlmConfig.id}'.`, baseLlmConfig.id));
        });

        it('should throw LLMStrategyError if prompt construction returns null', async () => {
            BaseChatLLMStrategy.prototype._constructPromptPayload.mockReturnValueOnce(null);
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await expect(strategy.execute(params))
                .rejects.toThrow(new LLMStrategyError(`Prompt construction failed to produce messages for LLM '${baseLlmConfig.id}'.`, baseLlmConfig.id));
        });

        it('should wrap and throw LLMStrategyError if _constructPromptPayload itself throws', async () => {
            const constructionError = new Error("Boom! Prompt construction failed.");
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
                .rejects.toThrow(new LLMStrategyError(`Prompt construction failed for LLM '${baseLlmConfig.id}': ${constructionError.message}`, baseLlmConfig.id, constructionError));
        });
    });

    describe('execute - Successful Execution (Direct API Call - Server-side)', () => {
        beforeEach(() => {
            mockEnvironmentContext.isClient.mockReturnValue(false); // Server-side
            mockHttpClient.request.mockResolvedValue({
                choices: [{message: {content: mockJsonResponseString}}]
            });
        });

        it('should correctly call _constructPromptPayload', async () => {
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            await strategy.execute(params);
            expect(BaseChatLLMStrategy.prototype._constructPromptPayload).toHaveBeenCalledWith(mockGameSummary, baseLlmConfig.promptFrame, baseLlmConfig);
        });

        it('should form correct OpenAI API payload and make a direct call with API key', async () => {
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: mockApiKey,
                environmentContext: mockEnvironmentContext
            };
            const result = await strategy.execute(params);

            expect(result).toBe(mockJsonResponseString);
            expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
            const [requestUrl, requestOptions] = mockHttpClient.request.mock.calls[0];
            const requestBody = JSON.parse(requestOptions.body);

            expect(requestUrl).toBe(baseLlmConfig.endpointUrl);
            expect(requestOptions.method).toBe('POST');
            expect(requestOptions.headers['Content-Type']).toBe('application/json');
            expect(requestOptions.headers['Authorization']).toBe(`Bearer ${mockApiKey}`);
            expect(requestOptions.headers['X-Custom-Test-Header']).toBe(baseLlmConfig.providerSpecificHeaders['X-Custom-Test-Header']);

            expect(requestBody.model).toBe(baseLlmConfig.modelIdentifier);
            expect(requestBody.messages).toEqual(mockConstructedMessages);
            expect(requestBody.response_format).toEqual({type: "json_object"});
            expect(requestBody.temperature).toBe(baseLlmConfig.defaultParameters.temperature);
            expect(requestBody.max_tokens).toBe(baseLlmConfig.defaultParameters.max_tokens);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Making API call to '${baseLlmConfig.endpointUrl}'. Note: Prompt must instruct model to output JSON for this mode.`),
                expect.any(Object)
            );
        });

        it('should make a direct call without Authorization header and warn if apiKey is null', async () => {
            const params = {
                gameSummary: mockGameSummary,
                llmConfig: baseLlmConfig,
                apiKey: null,
                environmentContext: mockEnvironmentContext
            };
            await strategy.execute(params);

            const [, requestOptions] = mockHttpClient.request.mock.calls[0];
            expect(requestOptions.headers['Authorization']).toBeUndefined();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `OpenAINativeJsonStrategy (${baseLlmConfig.id}): API key is not provided for a server-side/direct call. The API call might fail if authentication is required by '${baseLlmConfig.endpointUrl}'.`
            );
        });
    });

    // Next chunk will include client-side (proxied) tests and error handling for response/API calls
});
// --- FILE END ---