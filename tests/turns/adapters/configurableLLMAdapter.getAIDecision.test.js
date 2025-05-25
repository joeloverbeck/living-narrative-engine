// tests/turns/adapters/configurableLLMAdapter.getAIDecision.test.js
// --- FILE START ---

import {jest, beforeEach, describe, expect, it} from '@jest/globals';
import {ConfigurableLLMAdapter, ConfigurationError} from '../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust path as needed
import {CLOUD_API_TYPES} from '../../../src/llms/constants/llmConstants.js'; // Adjust path as needed

// Mock dependencies
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockEnvironmentContext = {
    getExecutionEnvironment: jest.fn(),
    getProjectRootPath: jest.fn(),
    getProxyServerUrl: jest.fn(),
    isClient: jest.fn(),
    isServer: jest.fn(),
};

const mockApiKeyProvider = {
    getKey: jest.fn(),
};

const mockLlmStrategyFactory = {
    getStrategy: jest.fn(),
};

const mockLlmConfigLoader = {
    loadConfigs: jest.fn(),
};

const mockLlmStrategy = {
    execute: jest.fn(),
};

// Mock for LLMModelConfig (sample, can be expanded in tests)
/** @type {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} */
const sampleLlmModelConfig = {
    id: 'test-llm-1',
    displayName: 'Test LLM 1',
    apiType: 'openai',
    modelIdentifier: 'gpt-3.5-turbo',
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.7},
    jsonOutputStrategy: {method: 'native_json'},
};

/** @type {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} */
const sampleLlmModelConfig2 = {
    id: 'test-llm-2',
    displayName: 'Test LLM 2 (Cloud)',
    apiType: CLOUD_API_TYPES[0] || 'anthropic', // Pick a cloud API type
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.5},
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    jsonOutputStrategy: {method: 'native_json'}, // Added for consistency
};


describe('ConfigurableLLMAdapter', () => {
    let adapter; // This will be set in the beforeEach of the inner describe block

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Default mock implementations
        mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
        mockEnvironmentContext.isServer.mockReturnValue(true);
        mockEnvironmentContext.isClient.mockReturnValue(false);
        mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
    });

    describe('getAIDecision() Method', () => {
        const gameSummary = "The game is afoot!";
        const mockSuccessDecision = JSON.stringify({action: "proceed", speech: "Let's go!"});

        /** @type {import('../../../src/services/llmConfigLoader.js').LLMConfigurationFile} */
        const operationalConfigs = {
            defaultLlmId: 'test-llm-operational',
            llms: {
                'test-llm-operational': {
                    id: 'test-llm-operational',
                    displayName: 'Operational LLM',
                    apiType: 'openai',
                    modelIdentifier: 'gpt-op',
                    endpointUrl: 'https://api.example.com/operational',
                    promptFrame: {system: "Sys", user: "User: {{gameSummary}}"},
                    jsonOutputStrategy: {method: 'native_json'},
                },
                'test-llm-cloud-server-requires-key': {
                    id: 'test-llm-cloud-server-requires-key',
                    displayName: 'Cloud LLM For Key Test',
                    apiType: CLOUD_API_TYPES[0] || 'some-cloud-api',
                    modelIdentifier: 'cloud-model-key',
                    endpointUrl: 'https://api.cloud.example.com/keytest',
                    promptFrame: {system: "Sys", user: "User: {{gameSummary}}"},
                    apiKeyEnvVar: 'TEST_CLOUD_KEY_VAR',
                    jsonOutputStrategy: {method: 'native_json'},
                },
                'test-llm-local-no-key-needed': {
                    id: 'test-llm-local-no-key-needed',
                    displayName: 'Local LLM No Key',
                    apiType: 'local-ollama',
                    modelIdentifier: 'local-model',
                    endpointUrl: 'http://localhost:11434/api/generate',
                    promptFrame: {system: "Sys", user: "User: {{gameSummary}}"},
                    jsonOutputStrategy: {method: 'native_json'},
                }
            },
        };

        const getOperationalConfigs = () => JSON.parse(JSON.stringify(operationalConfigs));

        // This beforeEach sets up a generally operational adapter for most tests in this describe block
        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            // Clear log mocks specifically for each test run after construction
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();

            mockApiKeyProvider.getKey.mockReset(); // Reset for specific test expectations
            mockLlmStrategyFactory.getStrategy.mockReset().mockReturnValue(mockLlmStrategy); // Ensure it's reset and returns mock strategy
            mockLlmStrategy.execute.mockReset(); // Reset for specific test expectations
            mockLlmConfigLoader.loadConfigs.mockReset(); // Reset for specific test expectations


            mockLlmConfigLoader.loadConfigs.mockResolvedValue(getOperationalConfigs());
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            // Clear logs again after init as init logs some info
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();


            // Default mocks for successful execution paths
            mockLlmStrategy.execute.mockResolvedValue(mockSuccessDecision);
            mockApiKeyProvider.getKey.mockResolvedValue('test-api-key-retrieved');
            // mockLlmStrategyFactory.getStrategy is already set to return mockLlmStrategy

            // Default environment for most getAIDecision tests
            mockEnvironmentContext.isServer.mockReturnValue(true);
            mockEnvironmentContext.isClient.mockReturnValue(false);
        });

        describe('Initial State Checks', () => {
            it('should throw Error if called before init()', async () => {
                const uninitializedAdapter = new ConfigurableLLMAdapter({ // Instantiate with all deps
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLogger.error.mockClear(); // Clear constructor log if any, focus on getAIDecision's error
                await expect(uninitializedAdapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new Error("ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter."));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter."));
            });

            it('should throw Error if called when not operational', async () => {
                // Create a new adapter instance for this specific non-operational scenario
                const nonOperationalAdapter = new ConfigurableLLMAdapter({ // Instantiate with all deps
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLogger.error.mockClear(); // Clear constructor log

                mockLlmConfigLoader.loadConfigs.mockResolvedValue({ // Configure LlmConfigLoader for this specific adapter
                    error: true,
                    message: "Failed to load",
                    stage: "test"
                });
                await nonOperationalAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(nonOperationalAdapter.isOperational()).toBe(false); // Verify it's indeed not operational

                mockLogger.error.mockClear(); // Clear init logs
                await expect(nonOperationalAdapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new Error("ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs."));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs."));
            });

            it('should throw ConfigurationError if no activeConfig is set', async () => {
                const adapterWithNoDefault = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLogger.error.mockClear();

                const noDefaultConfigs = {...getOperationalConfigs(), defaultLlmId: null};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(noDefaultConfigs);
                await adapterWithNoDefault.init({llmConfigLoader: mockLlmConfigLoader});
                expect(adapterWithNoDefault.isOperational()).toBe(true);
                expect(await adapterWithNoDefault.getCurrentActiveLlmConfig()).toBeNull();

                mockLogger.error.mockClear();
                const expectedErrorMessage = "No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultLlmId is in config.";
                await expect(adapterWithNoDefault.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(expectedErrorMessage));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`ConfigurableLLMAdapter.getAIDecision: ${expectedErrorMessage}`));
            });
        });

        describe('Active Configuration Validation (Ticket 21)', () => {
            const createInvalidConfig = (overrides) => {
                const baseConfig = JSON.parse(JSON.stringify(getOperationalConfigs().llms['test-llm-operational']));
                return {
                    ...baseConfig,
                    ...overrides
                };
            }

            it.each([
                [{id: null}, "id: Missing or invalid"],
                [{id: "  "}, "id: Missing or invalid"],
                [{endpointUrl: null}, "endpointUrl: Missing or invalid"],
                [{endpointUrl: "  "}, "endpointUrl: Missing or invalid"],
                [{modelIdentifier: null}, "modelIdentifier: Missing or invalid"],
                [{modelIdentifier: "  "}, "modelIdentifier: Missing or invalid"],
                [{apiType: null}, "apiType: Missing or invalid"],
                [{apiType: "  "}, "apiType: Missing or invalid"],
            ])('should throw ConfigurationError if activeConfig field is invalid: %p', async (invalidFieldOverride, expectedMsgPart) => {
                const currentInvalidConf = createInvalidConfig(invalidFieldOverride);
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = `config-under-test-${JSON.stringify(invalidFieldOverride)}`;
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                const testAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                await testAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                mockLogger.error.mockClear();

                await expect(testAdapter.getAIDecision(gameSummary))
                    .rejects.toThrow(ConfigurationError);

                try {
                    await testAdapter.getAIDecision(gameSummary);
                } catch (e) {
                    // This logic determines how the ID part of the error message is displayed by the source code
                    const idDisplayInErrorMessage = currentInvalidConf.id || 'unknown';

                    expect(e.message).toContain(`Active LLM config '${idDisplayInErrorMessage}' is invalid:`);
                    expect(e.message).toContain(expectedMsgPart);
                    expect(e.llmId).toBe(currentInvalidConf.id);
                    expect(e.problematicFields.some(f => f.reason === 'Missing or invalid' && expectedMsgPart.startsWith(f.field))).toBe(true);
                }
            });

            it('should throw ConfigurationError if jsonOutputStrategy is not an object when provided', async () => {
                const currentInvalidConf = createInvalidConfig({jsonOutputStrategy: "not-an-object"});
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-jos-type';
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                const testAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                await testAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                mockLogger.error.mockClear();

                await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(ConfigurationError);
                try {
                    await testAdapter.getAIDecision(gameSummary);
                } catch (e) {
                    expect(e.message).toContain(`Active LLM config '${currentInvalidConf.id}' is invalid:`);
                    expect(e.message).toContain("jsonOutputStrategy: Must be an object if provided");
                    expect(e.llmId).toBe(currentInvalidConf.id);
                    expect(e.problematicFields.some(f => f.field === 'jsonOutputStrategy' && f.reason === 'Must be an object if provided')).toBe(true);
                }
            });

            it('should throw ConfigurationError if jsonOutputStrategy.method is invalid when provided', async () => {
                const currentInvalidConf = createInvalidConfig({jsonOutputStrategy: {method: "  "}});
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-jos-method-format';
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                const testAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                await testAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                mockLogger.error.mockClear();

                await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(ConfigurationError);
                try {
                    await testAdapter.getAIDecision(gameSummary);
                } catch (e) {
                    expect(e.message).toContain(`Active LLM config '${currentInvalidConf.id}' is invalid:`);
                    expect(e.message).toContain("jsonOutputStrategy.method: Must be a non-empty string if provided");
                    expect(e.llmId).toBe(currentInvalidConf.id);
                    expect(e.problematicFields.some(f => f.field === 'jsonOutputStrategy.method' && f.reason === 'Must be a non-empty string if provided')).toBe(true);
                }
            });
        });

        describe('API Key Retrieval', () => {
            it('should call IApiKeyProvider.getKey with correct activeConfig and environmentContext', async () => {
                await adapter.setActiveLlm('test-llm-operational');
                // Clear info logs from setActiveLlm if any
                mockLogger.info.mockClear();
                await adapter.getAIDecision(gameSummary);
                const expectedActiveConfig = getOperationalConfigs().llms['test-llm-operational'];
                expect(mockApiKeyProvider.getKey).toHaveBeenCalledWith(expectedActiveConfig, mockEnvironmentContext);
            });

            it('should throw ConfigurationError if API key is required (cloud API on server) but getKey returns null', async () => {
                const llmId = 'test-llm-cloud-server-requires-key';
                await adapter.setActiveLlm(llmId);
                mockApiKeyProvider.getKey.mockResolvedValue(null);
                mockEnvironmentContext.isServer.mockReturnValue(true);
                mockLogger.error.mockClear();
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                const expectedErrorMessage = `API key missing for server-side cloud LLM '${llmId}'.`;
                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        expectedErrorMessage,
                        {llmId: llmId, problematicField: 'apiKey'}
                    ));
                // The error is thrown from within getAIDecision, then caught by the main catch block which logs it.
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${expectedErrorMessage}`),
                    expect.objectContaining({
                        llmId: llmId,
                        errorName: 'ConfigurationError',
                        problematicFields: undefined // The error object does NOT have problematicFields (plural) set here
                    })
                );
            });

            it('should proceed with null API key if not strictly required (local LLM)', async () => {
                await adapter.setActiveLlm('test-llm-local-no-key-needed');
                mockApiKeyProvider.getKey.mockResolvedValue(null);
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                await adapter.getAIDecision(gameSummary);
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith(expect.objectContaining({apiKey: null}));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("API key not required or not found for LLM 'test-llm-local-no-key-needed'"));
            });

            it('should proceed with null API key if not strictly required (cloud API on client - assuming proxy handles key)', async () => {
                await adapter.setActiveLlm('test-llm-cloud-server-requires-key');
                mockApiKeyProvider.getKey.mockResolvedValue(null);
                mockEnvironmentContext.isServer.mockReturnValue(false);
                mockEnvironmentContext.isClient.mockReturnValue(true);
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                await adapter.getAIDecision(gameSummary);
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith(expect.objectContaining({apiKey: null}));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("API key not required or not found for LLM 'test-llm-cloud-server-requires-key'"));
            });

            it('should log info if API key is retrieved successfully', async () => {
                const llmId = 'test-llm-cloud-server-requires-key';
                await adapter.setActiveLlm(llmId);
                mockApiKeyProvider.getKey.mockResolvedValue('a-valid-key-123');
                mockEnvironmentContext.isServer.mockReturnValue(true);
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                await adapter.getAIDecision(gameSummary);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    `API key retrieved for LLM '${llmId}'.`
                );
            });
        });

        describe('Strategy Factory Interaction', () => {
            it('should call LLMStrategyFactory.getStrategy with the correct activeConfig', async () => {
                await adapter.setActiveLlm('test-llm-operational');
                mockLogger.info.mockClear(); // Clear setActiveLlm log
                await adapter.getAIDecision(gameSummary);
                const expectedActiveConfig = getOperationalConfigs().llms['test-llm-operational'];
                expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(expectedActiveConfig);
            });

            it('should throw ConfigurationError if factory.getStrategy throws an error', async () => {
                const llmId = 'test-llm-operational';
                await adapter.setActiveLlm(llmId);
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                const factoryError = new Error("Factory failed to create strategy");
                mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
                    throw factoryError;
                });
                mockLogger.error.mockClear();

                const expectedWrappedErrorMessage = `Failed to get strategy from factory for LLM '${llmId}': ${factoryError.message}`;
                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        expectedWrappedErrorMessage,
                        {llmId: llmId}
                    ));

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${expectedWrappedErrorMessage}`),
                    expect.objectContaining({llmId: llmId, errorName: 'ConfigurationError'}) // problematicFields will be undefined
                );
            });

            it('should throw ConfigurationError if factory.getStrategy returns null/undefined', async () => {
                const llmId = 'test-llm-operational';
                await adapter.setActiveLlm(llmId);
                mockLogger.info.mockClear(); // Clear setActiveLlm log

                mockLlmStrategyFactory.getStrategy.mockReturnValue(null);
                mockLogger.error.mockClear();

                const expectedErrorMessage = `No suitable LLM strategy for config '${llmId}'.`;
                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        expectedErrorMessage,
                        {llmId: llmId}
                    ));
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${expectedErrorMessage}`),
                    expect.objectContaining({
                        llmId: llmId,
                        errorName: 'ConfigurationError',
                        problematicFields: undefined // ConfigurationError constructed without problematicFields here
                    })
                );
            });
        });

        describe('Strategy Execution', () => {
            it('should call strategy.execute with correct parameters', async () => {
                const apiKeyToUse = 'key-for-strategy';
                mockApiKeyProvider.getKey.mockResolvedValue(apiKeyToUse);
                const llmId = 'test-llm-operational';
                await adapter.setActiveLlm(llmId);
                mockLogger.info.mockClear(); // Clear setActiveLlm log & API key log

                await adapter.getAIDecision(gameSummary);

                const expectedActiveConfig = getOperationalConfigs().llms[llmId];
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith({
                    gameSummary,
                    llmConfig: expectedActiveConfig,
                    apiKey: apiKeyToUse,
                    environmentContext: mockEnvironmentContext,
                });
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Executing strategy for LLM '${llmId}'.`));
            });

            it('should return the JSON string from strategy.execute', async () => {
                const strategyResponse = JSON.stringify({strategy: "response"});
                mockLlmStrategy.execute.mockResolvedValue(strategyResponse);
                mockLogger.info.mockClear();


                const result = await adapter.getAIDecision(gameSummary);
                expect(result).toBe(strategyResponse);
            });
        });

        describe('Error Propagation', () => {
            const llmId = 'test-llm-operational';
            beforeEach(async () => {
                await adapter.setActiveLlm(llmId);
                mockLogger.info.mockClear();
                mockLogger.error.mockClear();
            });

            it('should catch, log, and re-throw errors from IApiKeyProvider.getKey', async () => {
                const apiKeyError = new Error("API Key Provider Error");
                mockApiKeyProvider.getKey.mockRejectedValue(apiKeyError);

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(apiKeyError);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${apiKeyError.message}`),
                    expect.objectContaining({
                        llmId: llmId,
                        errorName: apiKeyError.name,
                        errorDetails: expect.objectContaining({message: apiKeyError.message})
                    })
                );
            });

            it('should catch, log, and re-throw ConfigurationError when LLMStrategyFactory.getStrategy throws non-ConfigurationError', async () => {
                const factoryGenericError = new Error("Factory generic meltdown");
                mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
                    throw factoryGenericError;
                });

                const expectedWrappedMessage = `Failed to get strategy from factory for LLM '${llmId}': ${factoryGenericError.message}`;
                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(expectedWrappedMessage, {llmId}));

                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${expectedWrappedMessage}`),
                    expect.objectContaining({llmId: llmId, errorName: 'ConfigurationError'})
                );
            });


            it('should catch, log, and re-throw errors from strategy.execute', async () => {
                const strategyExecuteError = new Error("Strategy Execution Failed");
                mockLlmStrategy.execute.mockRejectedValue(strategyExecuteError);

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(strategyExecuteError);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM '${llmId}': ${strategyExecuteError.message}`),
                    expect.objectContaining({
                        llmId: llmId,
                        errorName: strategyExecuteError.name,
                        errorDetails: expect.objectContaining({message: strategyExecuteError.message})
                    })
                );
            });

            it('should re-throw ConfigurationError from validation steps directly, and log it once via main catch', async () => {
                const invalidIdConf = {...getOperationalConfigs().llms['test-llm-operational'], id: null};
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-for-direct-rethrow';
                tempConfigs.llms[testConfigKey] = invalidIdConf;
                tempConfigs.defaultLlmId = testConfigKey;
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);

                const testAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                await testAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                mockLogger.error.mockClear();

                let thrownError;
                const expectedValidationErrorMessage = `Active LLM config 'unknown' is invalid: id: Missing or invalid`;
                try {
                    await testAdapter.getAIDecision(gameSummary);
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(ConfigurationError);
                expect(thrownError.message).toBe(expectedValidationErrorMessage);
                expect(thrownError.llmId).toBeNull();
                expect(thrownError.problematicFields).toEqual(expect.arrayContaining([
                    expect.objectContaining({field: 'id', reason: 'Missing or invalid'})
                ]));

                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`Error during getAIDecision for LLM 'unknown': ${expectedValidationErrorMessage}`),
                    expect.objectContaining({
                        llmId: 'unknown',
                        errorName: 'ConfigurationError',
                        problematicFields: thrownError.problematicFields
                    })
                );
            });
        });
    });
});

// --- FILE END ---