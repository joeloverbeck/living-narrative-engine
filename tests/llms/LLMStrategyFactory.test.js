// tests/llms/LLMStrategyFactory.test.js
// --- NEW FILE START ---
import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LLMStrategyFactory} from '../../src/llms/LLMStrategyFactory.js';
import {ConfigurationError} from '../../src/turns/adapters/configurableLLMAdapter.js';
import {LLMStrategyFactoryError} from '../../src/llms/errors/LLMStrategyFactoryError.js';

// Import concrete strategies to check instanceof and to mock their modules
import {OpenAIToolCallingStrategy} from '../../src/llms/strategies/OpenAIToolCallingStrategy.js';
import {AnthropicToolCallingStrategy} from '../../src/llms/strategies/AnthropicToolCallingStrategy.js';
import {OpenRouterJsonSchemaStrategy} from '../../src/llms/strategies/OpenRouterJsonSchemaStrategy.js';
import {OpenAINativeJsonStrategy} from '../../src/llms/strategies/OpenAINativeJsonStrategy.js';
import {OllamaNativeJsonStrategy} from '../../src/llms/strategies/OllamaNativeJsonStrategy.js';
import {DefaultPromptEngineeringStrategy} from '../../src/llms/strategies/DefaultPromptEngineeringStrategy.js';

/**
 * @typedef {import('../../../src/interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../../src/interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType
 */

// Mock the concrete strategy modules with correct casing
jest.mock('../../src/llms/strategies/openAIToolCallingStrategy.js');
jest.mock('../../src/llms/strategies/anthropicToolCallingStrategy.js');
jest.mock('../../src/llms/strategies/openRouterJsonSchemaStrategy.js');
jest.mock('../../src/llms/strategies/openAINativeJsonStrategy.js');
jest.mock('../../src/llms/strategies/ollamaNativeJsonStrategy.js');
jest.mock('../../src/llms/strategies/defaultPromptEngineeringStrategy.js');

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

        OpenAIToolCallingStrategy.mockClear();
        AnthropicToolCallingStrategy.mockClear();
        OpenRouterJsonSchemaStrategy.mockClear();
        OpenAINativeJsonStrategy.mockClear();
        OllamaNativeJsonStrategy.mockClear();
        DefaultPromptEngineeringStrategy.mockClear();
    });

    describe('Constructor', () => {
        test('should correctly store injected IHttpClient and ILogger and log creation', () => {
            factory = new LLMStrategyFactory({httpClient, logger});
            expect(factory).toBeInstanceOf(LLMStrategyFactory);
            expect(logger.debug).toHaveBeenCalledWith("LLMStrategyFactory: Instance created and dependencies stored.");
        });

        test('should throw error if logger is invalid or missing', () => {
            const invalidLoggers = [null, undefined, {}, {info: 'not a function'}];
            invalidLoggers.forEach(invalidLogger => {
                expect(() => new LLMStrategyFactory({httpClient, logger: /** @type {any} */ (invalidLogger)}))
                    .toThrow("LLMStrategyFactory: Constructor requires a valid logger instance with info, warn, error, and debug methods.");
            });
        });

        test('should throw error if httpClient is invalid or missing', () => {
            const invalidHttpClients = [null, undefined, {}, {request: 'not a function'}];
            invalidHttpClients.forEach(invalidClient => {
                expect(() => new LLMStrategyFactory({httpClient: /** @type {any} */ (invalidClient), logger}))
                    .toThrow("LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).");
                expect(logger.error).toHaveBeenCalledWith("LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).");
            });
        });
    });

    describe('getStrategy Method', () => {
        beforeEach(() => {
            factory = new LLMStrategyFactory({httpClient, logger});
        });

        const testCases = [
            {
                description: 'OpenAI Tool Calling',
                config: {id: 'oai-tool', apiType: 'openai', jsonOutputStrategy: {method: 'tool_calling'}},
                ExpectedStrategy: OpenAIToolCallingStrategy,
                expectedApiTypeLog: 'openai',
                expectedEffectiveMethod: 'tool_calling',
                expectedConfiguredMethodLog: 'tool_calling'
            },
            {
                description: 'Anthropic Tool Calling',
                config: {id: 'ant-tool', apiType: 'anthropic', jsonOutputStrategy: {method: 'tool_calling'}},
                ExpectedStrategy: AnthropicToolCallingStrategy,
                expectedApiTypeLog: 'anthropic',
                expectedEffectiveMethod: 'tool_calling',
                expectedConfiguredMethodLog: 'tool_calling'
            },
            {
                description: 'OpenRouter JSON Schema',
                config: {
                    id: 'or-schema',
                    apiType: 'openrouter',
                    jsonOutputStrategy: {method: 'openrouter_json_schema'}
                },
                ExpectedStrategy: OpenRouterJsonSchemaStrategy,
                expectedApiTypeLog: 'openrouter',
                expectedEffectiveMethod: 'openrouter_json_schema',
                expectedConfiguredMethodLog: 'openrouter_json_schema'
            },
            {
                description: 'OpenAI Native JSON Mode',
                config: {id: 'oai-json', apiType: 'openai', jsonOutputStrategy: {method: 'native_json_mode'}},
                ExpectedStrategy: OpenAINativeJsonStrategy,
                expectedApiTypeLog: 'openai',
                expectedEffectiveMethod: 'native_json_mode',
                expectedConfiguredMethodLog: 'native_json_mode'
            },
            {
                description: 'Ollama Native JSON Mode',
                config: {id: 'ollama-json', apiType: 'ollama', jsonOutputStrategy: {method: 'native_json_mode'}},
                ExpectedStrategy: OllamaNativeJsonStrategy,
                expectedApiTypeLog: 'ollama',
                expectedEffectiveMethod: 'native_json_mode',
                expectedConfiguredMethodLog: 'native_json_mode'
            }
        ];

        testCases.forEach(({
                               description,
                               config,
                               ExpectedStrategy,
                               expectedApiTypeLog,
                               expectedEffectiveMethod,
                               expectedConfiguredMethodLog
                           }) => {
            test(`should create ${description} and inject dependencies`, () => {
                const strategy = factory.getStrategy(/** @type {LLMModelConfigType} */ (config));

                expect(strategy).toBeInstanceOf(ExpectedStrategy);
                expect(ExpectedStrategy).toHaveBeenCalledTimes(1);
                expect(ExpectedStrategy).toHaveBeenCalledWith({httpClient, logger});
                expect(logger.info).toHaveBeenCalledWith(
                    `LLMStrategyFactory: Selected strategy '${ExpectedStrategy.name}' for LLM ID '${config.id}'. Details: apiType='${expectedApiTypeLog}', effectiveMethod='${expectedEffectiveMethod}', configuredMethod='${expectedConfiguredMethodLog}'.`
                );
            });
        });

        describe('Fallback to DefaultPromptEngineeringStrategy', () => {
            const fallbackTestCases = [
                {
                    description: 'jsonOutputStrategy.method is missing',
                    config: {id: 'fallback-missing-method', apiType: 'openai', jsonOutputStrategy: {}},
                    logInfoMsg: /LLMStrategyFactory: jsonOutputStrategy.method is missing or empty for LLM ID 'fallback-missing-method' \(apiType: 'openai'\). Defaulting to 'prompt_engineering'./,
                    expectedConfiguredMethodLog: 'N/A'
                },
                {
                    description: 'jsonOutputStrategy.method is an empty string',
                    config: {id: 'fallback-empty-method', apiType: 'openai', jsonOutputStrategy: {method: '  '}},
                    logInfoMsg: /LLMStrategyFactory: jsonOutputStrategy.method is missing or empty for LLM ID 'fallback-empty-method' \(apiType: 'openai'\). Defaulting to 'prompt_engineering'./,
                    expectedConfiguredMethodLog: 'N/A' // because it was empty and became 'prompt_engineering'
                },
                {
                    description: 'jsonOutputStrategy is missing',
                    config: {id: 'fallback-missing-strategy-obj', apiType: 'openai'},
                    logInfoMsg: /LLMStrategyFactory: jsonOutputStrategy.method is missing or empty for LLM ID 'fallback-missing-strategy-obj' \(apiType: 'openai'\). Defaulting to 'prompt_engineering'./,
                    expectedConfiguredMethodLog: 'N/A'
                },
                {
                    description: 'jsonOutputStrategy.method is unrecognized for a known apiType (openai)',
                    config: {
                        id: 'fallback-unrec-method-openai',
                        apiType: 'openai',
                        jsonOutputStrategy: {method: 'unknown_method'}
                    },
                    logWarnMsg: /LLMStrategyFactory: Unrecognized jsonOutputStrategy.method 'unknown_method' for apiType 'openai' \(LLM ID: 'fallback-unrec-method-openai'\). Falling back to DefaultPromptEngineeringStrategy./,
                    expectedConfiguredMethodLog: 'unknown_method'
                },
                {
                    description: 'jsonOutputStrategy.method is unrecognized for a known apiType (anthropic)',
                    config: {
                        id: 'fallback-unrec-method-ant',
                        apiType: 'anthropic',
                        jsonOutputStrategy: {method: 'some_other_method'}
                    },
                    logWarnMsg: /LLMStrategyFactory: Unrecognized jsonOutputStrategy.method 'some_other_method' for apiType 'anthropic' \(LLM ID: 'fallback-unrec-method-ant'\). Falling back to DefaultPromptEngineeringStrategy./,
                    expectedConfiguredMethodLog: 'some_other_method'
                },
                {
                    description: 'apiType is known but method is unmapped for it',
                    config: {
                        id: 'fallback-unrec-method-ollama',
                        apiType: 'ollama',
                        jsonOutputStrategy: {method: 'tool_calling_for_ollama_maybe'}
                    },
                    logWarnMsg: /LLMStrategyFactory: Unrecognized jsonOutputStrategy.method 'tool_calling_for_ollama_maybe' for apiType 'ollama' \(LLM ID: 'fallback-unrec-method-ollama'\). Falling back to DefaultPromptEngineeringStrategy./,
                    expectedConfiguredMethodLog: 'tool_calling_for_ollama_maybe'
                },
                {
                    description: 'apiType is known, method is explicitly prompt_engineering',
                    config: {
                        id: 'explicit-prompt-eng',
                        apiType: 'openai',
                        jsonOutputStrategy: {method: 'prompt_engineering'}
                    },
                    expectedConfiguredMethodLog: 'prompt_engineering'
                }
            ];

            fallbackTestCases.forEach(({description, config, logInfoMsg, logWarnMsg, expectedConfiguredMethodLog}) => {
                test(`should use DefaultPromptEngineeringStrategy when ${description}`, () => {
                    const strategy = factory.getStrategy(/** @type {LLMModelConfigType} */ (config));

                    expect(strategy).toBeInstanceOf(DefaultPromptEngineeringStrategy);
                    expect(DefaultPromptEngineeringStrategy).toHaveBeenCalledTimes(1);
                    expect(DefaultPromptEngineeringStrategy).toHaveBeenCalledWith({httpClient, logger});

                    if (logInfoMsg) {
                        expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(logInfoMsg));
                    }
                    if (logWarnMsg) {
                        expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(logWarnMsg));
                    }
                    expect(logger.info).toHaveBeenCalledWith(
                        `LLMStrategyFactory: Selected strategy 'DefaultPromptEngineeringStrategy' for LLM ID '${config.id}'. Details: apiType='${config.apiType.toLowerCase()}', effectiveMethod='prompt_engineering', configuredMethod='${expectedConfiguredMethodLog}'.`
                    );
                });
            });
        });

        describe('Error Handling', () => {
            test('should throw ConfigurationError if llmConfig is null', () => {
                expect(() => factory.getStrategy(null))
                    .toThrow(new ConfigurationError("LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType."));
                expect(logger.error).toHaveBeenCalledWith(
                    "LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType.",
                    {receivedConfig: null}
                );
            });

            test('should throw ConfigurationError if llmConfig is missing apiType', () => {
                const invalidConfig = {id: 'invalid'};
                expect(() => factory.getStrategy(/** @type {LLMModelConfigType} */(invalidConfig)))
                    .toThrow(new ConfigurationError("LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType."));
            });

            test('should throw ConfigurationError if llmConfig.apiType is an empty string', () => {
                const invalidConfig = {id: 'invalid-empty-apiType', apiType: '   '};
                expect(() => factory.getStrategy(/** @type {LLMModelConfigType} */(invalidConfig)))
                    .toThrow(new ConfigurationError("LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType."));
            });

            test('should throw LLMStrategyFactoryError for an unsupported apiType if method is not prompt_engineering', () => {
                const unsupportedConfig = {
                    id: 'unsupported-api',
                    apiType: 'megacorp_llm',
                    jsonOutputStrategy: {method: 'proprietary_mode'}
                };
                expect(() => factory.getStrategy(/** @type {LLMModelConfigType} */(unsupportedConfig)))
                    .toThrow(LLMStrategyFactoryError);
                expect(() => factory.getStrategy(/** @type {LLMModelConfigType} */(unsupportedConfig)))
                    .toThrow(/Unsupported apiType: 'megacorp_llm'/);
            });

            test('should use DefaultPromptEngineeringStrategy if apiType is unsupported but method defaults to prompt_engineering', () => {
                const config = {id: 'unknown-api-prompt-eng', apiType: 'very_new_llm_provider'}; // No jsonOutputStrategy
                const strategy = factory.getStrategy(/** @type {LLMModelConfigType} */(config));

                expect(strategy).toBeInstanceOf(DefaultPromptEngineeringStrategy);
                expect(DefaultPromptEngineeringStrategy).toHaveBeenCalledWith({httpClient, logger});
                expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/LLMStrategyFactory: jsonOutputStrategy.method is missing or empty for LLM ID 'unknown-api-prompt-eng' \(apiType: 'very_new_llm_provider'\). Defaulting to 'prompt_engineering'./));
                expect(logger.info).toHaveBeenCalledWith(
                    `LLMStrategyFactory: Selected strategy 'DefaultPromptEngineeringStrategy' for LLM ID '${config.id}'. Details: apiType='${config.apiType.toLowerCase()}', effectiveMethod='prompt_engineering', configuredMethod='N/A'.`
                );
                expect(logger.error).not.toHaveBeenCalledWith(expect.stringMatching(/Unsupported apiType: 'very_new_llm_provider'/));
            });
        });

        test('logging of debug and info messages during successful strategy determination', () => {
            const config = {id: 'log-test', apiType: 'openai', jsonOutputStrategy: {method: 'tool_calling'}};
            factory.getStrategy(/** @type {LLMModelConfigType} */(config));

            expect(logger.debug).toHaveBeenCalledWith(
                `LLMStrategyFactory: Determining strategy for LLM ID: '${config.id}', apiType: '${config.apiType}'.`,
                expect.objectContaining({configuredJsonMethod: 'tool_calling'})
            );
            // This specific log is checked in the parameterized tests, ensuring it's called correctly there.
            // We can verify it's called at least once with some info content if needed more generally.
            expect(logger.info).toHaveBeenCalledWith(
                `LLMStrategyFactory: Selected strategy 'OpenAIToolCallingStrategy' for LLM ID '${config.id}'. Details: apiType='openai', effectiveMethod='tool_calling', configuredMethod='tool_calling'.`
            );
        });
    });
});
// --- CORRECTED FILE END ---