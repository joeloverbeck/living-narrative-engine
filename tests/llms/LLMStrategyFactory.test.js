// tests/llms/LLMStrategyFactory.test.js
// --- CORRECTED FILE START ---
import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LLMStrategyFactory} from '../../src/llms/LLMStrategyFactory.js';
import {ConfigurationError} from '../../src/turns/adapters/configurableLLMAdapter.js';
import {LLMStrategyFactoryError} from '../../src/llms/errors/LLMStrategyFactoryError.js';

// Import concrete strategies to check instanceof and to mock their modules
import {OpenRouterJsonSchemaStrategy} from '../../src/llms/strategies/openRouterJsonSchemaStrategy.js';
import {OpenRouterToolCallingStrategy} from '../../src/llms/strategies/openRouterToolCallingStrategy.js';
// DefaultPromptEngineeringStrategy import removed

/**
 * @typedef {import('../../src/interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../src/interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../src/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfigType
 */

// Mock the concrete strategy modules
jest.mock('../../src/llms/strategies/openRouterJsonSchemaStrategy.js');
jest.mock('../../src/llms/strategies/openRouterToolCallingStrategy.js');
// DefaultPromptEngineeringStrategy mock removed

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

        // Clear all mocks
        OpenRouterJsonSchemaStrategy.mockClear();
        OpenRouterToolCallingStrategy.mockClear();
        // DefaultPromptEngineeringStrategy.mockClear() removed;

        factory = new LLMStrategyFactory({httpClient, logger});
    });

    describe('Constructor', () => {
        test('should correctly store injected IHttpClient and ILogger and log creation', () => {
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
                const tempLogger = mockLoggerInstance(); // Use a fresh logger for this specific sub-test
                expect(() => new LLMStrategyFactory({
                    httpClient: /** @type {any} */ (invalidClient),
                    logger: tempLogger
                }))
                    .toThrow("LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).");
                expect(tempLogger.error).toHaveBeenCalledWith("LLMStrategyFactory: Constructor requires a valid httpClient instance conforming to IHttpClient (must have a request method).");
            });
        });
    });

    describe('getStrategy Method', () => {
        const successfulTestCases = [
            {
                description: 'OpenRouter JSON Schema',
                config: {
                    id: 'or-schema',
                    apiType: 'openrouter',
                    jsonOutputStrategy: {method: 'openrouter_json_schema'}
                },
                ExpectedStrategy: OpenRouterJsonSchemaStrategy,
                expectedApiTypeLog: 'openrouter',
                expectedEffectiveMethod: 'openrouter_json_schema', // Test expects this field in log
                expectedConfiguredMethodLog: 'openrouter_json_schema'
            },
            {
                description: 'OpenRouter Tool Calling',
                config: {
                    id: 'or-tool',
                    apiType: 'openrouter',
                    jsonOutputStrategy: {method: 'openrouter_tool_calling'}
                },
                ExpectedStrategy: OpenRouterToolCallingStrategy,
                expectedApiTypeLog: 'openrouter',
                expectedEffectiveMethod: 'openrouter_tool_calling', // Test expects this field in log
                expectedConfiguredMethodLog: 'openrouter_tool_calling'
            }
        ];

        successfulTestCases.forEach(({
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
                    // Adjusted to match current factory log which includes effectiveMethod (same as configuredMethod here)
                    `LLMStrategyFactory: Selected strategy '${ExpectedStrategy.name}' for LLM ID '${config.id}'. Details: apiType='${expectedApiTypeLog}', effectiveMethod='${expectedEffectiveMethod}', configuredMethod='${expectedConfiguredMethodLog}'.`
                );
            });
        });

        // These test cases expect an error because the apiType is not in strategyMappings
        // The error message format for these was updated in the factory and should now pass
        const unsupportedApiTypePlusSpecificMethodTestCases = [
            {
                description: 'OpenAI Tool Calling (specific, now unsupported)',
                config: {id: 'oai-tool', apiType: 'openai', jsonOutputStrategy: {method: 'tool_calling'}},
            },
            {
                description: 'Anthropic Tool Calling (specific, now unsupported)',
                config: {id: 'ant-tool', apiType: 'anthropic', jsonOutputStrategy: {method: 'tool_calling'}},
            },
            {
                description: 'OpenAI Native JSON Mode (specific, now unsupported)',
                config: {id: 'oai-json', apiType: 'openai', jsonOutputStrategy: {method: 'native_json_mode'}},
            },
            {
                description: 'Ollama Native JSON Mode (specific, now unsupported)',
                config: {id: 'ollama-json', apiType: 'ollama', jsonOutputStrategy: {method: 'native_json_mode'}},
            },
            {
                description: "apiType is 'openai' and method is unrecognized (specific, now unsupported)",
                config: {
                    id: 'fallback-unrec-method-openai',
                    apiType: 'openai',
                    jsonOutputStrategy: {method: 'unknown_method'}
                },
            },
            {
                description: "apiType is 'anthropic' and method is unrecognized (specific, now unsupported)",
                config: {
                    id: 'fallback-unrec-method-ant',
                    apiType: 'anthropic',
                    jsonOutputStrategy: {method: 'some_other_method'}
                },
            },
            {
                description: "apiType is 'ollama' and method is unmapped (specific, now unsupported)",
                config: {
                    id: 'fallback-unrec-method-ollama',
                    apiType: 'ollama',
                    jsonOutputStrategy: {method: 'tool_calling_for_ollama_maybe'}
                },
            }
        ];

        unsupportedApiTypePlusSpecificMethodTestCases.forEach(({description, config}) => {
            test(`should throw LLMStrategyFactoryError when ${description}`, () => {
                const expectedApiType = config.apiType.toLowerCase();
                const expectedJsonOutputMethod = config.jsonOutputStrategy.method.toLowerCase();
                // This is the expected error message string from the factory for unknown apiTypes
                const expectedThrownErrorMessage = `Unsupported apiType: '${expectedApiType}' (LLM ID: '${config.id}'). No strategy can be determined. Supported API types for specialized strategies are: openrouter.`;

                /** @type {LLMStrategyFactoryError | null} */
                let thrownError = null;
                try {
                    factory.getStrategy(/** @type {LLMModelConfigType} */ (config));
                } catch (e) {
                    if (e instanceof LLMStrategyFactoryError) {
                        thrownError = e;
                    } else {
                        throw e;
                    }
                }

                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedThrownErrorMessage);
                expect(thrownError?.apiType).toBe(expectedApiType);
                expect(thrownError?.jsonOutputMethod).toBe(expectedJsonOutputMethod);

                expect(logger.error).toHaveBeenCalledTimes(1);
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMStrategyFactory: ${expectedThrownErrorMessage}`, // Logger prepends "LLMStrategyFactory: "
                    { // Context for logger
                        apiType: expectedApiType,
                        jsonOutputMethod: expectedJsonOutputMethod
                    }
                );
            });
        });

        // Renamed describe block
        describe('Error Handling for Invalid or Obsolete Method Configurations', () => {
            test('should throw LLMStrategyFactoryError if jsonOutputStrategy.method is missing', () => {
                const config = {id: 'missing-method', apiType: 'openrouter', jsonOutputStrategy: {}};
                const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${config.id}' (apiType: '${config.apiType}') but was missing or empty. A specific method must be configured.`;
                let thrownError = null;

                try {
                    factory.getStrategy(config);
                } catch (e) {
                    thrownError = e;
                }

                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBeUndefined();
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
                    llmId: config.id,
                    apiType: config.apiType,
                    llmConfigJsonOutputStrategy: config.jsonOutputStrategy
                });
            });

            test('should throw LLMStrategyFactoryError if jsonOutputStrategy.method is an empty string', () => {
                const config = {id: 'empty-method', apiType: 'openrouter', jsonOutputStrategy: {method: '   '}};
                const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${config.id}' (apiType: '${config.apiType}') but was missing or empty. A specific method must be configured.`;
                let thrownError = null;

                try {
                    factory.getStrategy(config);
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBe(''); // configuredMethod becomes ''
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
                    llmId: config.id,
                    apiType: config.apiType,
                    llmConfigJsonOutputStrategy: config.jsonOutputStrategy
                });
            });

            test('should throw LLMStrategyFactoryError if jsonOutputStrategy is missing', () => {
                const config = {id: 'missing-strategy-obj', apiType: 'openrouter'};
                const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${config.id}' (apiType: '${config.apiType}') but was missing or empty. A specific method must be configured.`;
                let thrownError = null;

                try {
                    factory.getStrategy(config);
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBeUndefined();
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
                    llmId: config.id,
                    apiType: config.apiType,
                    llmConfigJsonOutputStrategy: undefined
                });
            });

            test("should throw LLMStrategyFactoryError if method is explicitly 'prompt_engineering'", () => {
                const config = {
                    id: 'explicit-prompt-eng',
                    apiType: 'openrouter', // Can be any apiType
                    jsonOutputStrategy: {method: 'prompt_engineering'}
                };
                const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' cannot be 'prompt_engineering' for LLM ID '${config.id}' (apiType: '${config.apiType}'). This strategy is no longer supported as an explicit choice. Please configure a specific JSON output strategy (e.g., 'openrouter_json_schema', 'openrouter_tool_calling', etc.).`;
                let thrownError = null;

                try {
                    factory.getStrategy(config);
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBe('prompt_engineering');
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
                    llmId: config.id,
                    apiType: config.apiType,
                    configuredMethod: 'prompt_engineering'
                });
            });

            test('should throw LLMStrategyFactoryError if apiType is known (e.g., openrouter) but method is unrecognized', () => {
                const config = {
                    id: 'or-unrec-method',
                    apiType: 'openrouter',
                    jsonOutputStrategy: {method: 'non_existent_or_method'}
                };
                const expectedThrownErrorMessage = `Unrecognized jsonOutputStrategy.method: '${config.jsonOutputStrategy.method}' for apiType '${config.apiType}' (LLM ID: '${config.id}'). Supported methods for this apiType are: [openrouter_json_schema, openrouter_tool_calling]. Full list of supported API types and methods: openrouter: [openrouter_json_schema, openrouter_tool_calling].`;
                let thrownError = null;

                try {
                    factory.getStrategy(config);
                } catch (e) {
                    thrownError = e;
                }

                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedThrownErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBe(config.jsonOutputStrategy.method);
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMStrategyFactory: ${expectedThrownErrorMessage}`,
                    {
                        apiType: config.apiType,
                        jsonOutputMethod: config.jsonOutputStrategy.method,
                        llmId: config.id,
                        availableApiTypes: ['openrouter'],
                        availableMethodsForApiType: ['openrouter_json_schema', 'openrouter_tool_calling']
                    }
                );
            });
        });

        describe('Basic Error Handling (from original tests)', () => {
            test('should throw ConfigurationError if llmConfig is null', () => {
                expect(() => factory.getStrategy(null))
                    .toThrow(new ConfigurationError("LLMStrategyFactory: llmConfig is invalid or missing a non-empty apiType."));
                expect(logger.error).toHaveBeenCalledTimes(1);
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

            // This test case is from the original `unsupportedApiTypePlusSpecificMethodTestCases`
            // It verifies the error for a completely unsupported apiType.
            test('should throw LLMStrategyFactoryError for an unsupported apiType (not in strategyMappings)', () => {
                const unsupportedConfig = {
                    id: 'unsupported-api',
                    apiType: 'megacorp_llm', // Not in strategyMappings
                    jsonOutputStrategy: {method: 'proprietary_mode'}
                };
                const expectedApiType = unsupportedConfig.apiType.toLowerCase();
                const expectedJsonOutputMethod = unsupportedConfig.jsonOutputStrategy.method.toLowerCase();
                const expectedThrownErrorMessage = `Unsupported apiType: '${expectedApiType}' (LLM ID: '${unsupportedConfig.id}'). No strategy can be determined. Supported API types for specialized strategies are: openrouter.`;
                let thrownError = null;

                try {
                    factory.getStrategy(/** @type {LLMModelConfigType} */ (unsupportedConfig));
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedThrownErrorMessage);
                expect(thrownError?.apiType).toBe(expectedApiType);
                expect(thrownError?.jsonOutputMethod).toBe(expectedJsonOutputMethod);
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMStrategyFactory: ${expectedThrownErrorMessage}`,
                    {apiType: expectedApiType, jsonOutputMethod: expectedJsonOutputMethod}
                );
            });

            // This test replaces the old:
            // 'should use DefaultPromptEngineeringStrategy if apiType is unsupported but method defaults to prompt_engineering'
            test('should throw LLMStrategyFactoryError if apiType is unsupported and jsonOutputStrategy.method is missing', () => {
                const config = {id: 'unknown-api-no-method', apiType: 'very_new_llm_provider'}; // Method missing
                const expectedErrorMessage = `LLMStrategyFactory: 'jsonOutputStrategy.method' is required in llmConfig for LLM ID '${config.id}' (apiType: '${config.apiType}') but was missing or empty. A specific method must be configured.`;
                let thrownError = null;

                try {
                    factory.getStrategy(/** @type {LLMModelConfigType} */(config));
                } catch (e) {
                    thrownError = e;
                }

                expect(thrownError).toBeInstanceOf(LLMStrategyFactoryError);
                expect(thrownError?.message).toBe(expectedErrorMessage);
                expect(thrownError?.apiType).toBe(config.apiType);
                expect(thrownError?.jsonOutputMethod).toBeUndefined();
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMessage, {
                    llmId: config.id,
                    apiType: config.apiType,
                    llmConfigJsonOutputStrategy: undefined
                });
            });
        });

        test('logging of debug and info messages during successful OpenRouter strategy determination', () => {
            const config = {
                id: 'log-test-or',
                apiType: 'openrouter',
                jsonOutputStrategy: {method: 'openrouter_json_schema'}
            };
            factory.getStrategy(/** @type {LLMModelConfigType} */(config));

            expect(logger.debug).toHaveBeenCalledWith(
                `LLMStrategyFactory: Determining strategy for LLM ID: '${config.id}', apiType: '${config.apiType}'.`,
                expect.objectContaining({
                    configuredJsonMethod: 'openrouter_json_schema',
                    fullConfigJsonStrategy: config.jsonOutputStrategy
                })
            );
            // Log message updated to match the factory's current output
            expect(logger.info).toHaveBeenCalledWith(
                `LLMStrategyFactory: Selected strategy 'OpenRouterJsonSchemaStrategy' for LLM ID '${config.id}'. Details: apiType='openrouter', effectiveMethod='openrouter_json_schema', configuredMethod='openrouter_json_schema'.`
            );
        });
    });
});
// --- CORRECTED FILE END ---