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
    apiType: CLOUD_API_TYPES[0], // Pick a cloud API type
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.5},
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    jsonOutputStrategy: {method: 'native_json'}, // Added for consistency
};


describe('ConfigurableLLMAdapter', () => {
    let adapter;

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


        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockApiKeyProvider.getKey.mockReset();
            mockLlmStrategyFactory.getStrategy.mockReset();
            mockLlmStrategy.execute.mockReset();

            mockLlmConfigLoader.loadConfigs.mockResolvedValue(getOperationalConfigs());
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            mockLlmStrategy.execute.mockResolvedValue(mockSuccessDecision);
            mockApiKeyProvider.getKey.mockResolvedValue('test-api-key-retrieved');
            mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
            mockEnvironmentContext.isServer.mockReturnValue(true);
            mockEnvironmentContext.isClient.mockReturnValue(false);
        });

        describe('Initial State Checks', () => {
            it('should throw Error if called before init()', async () => {
                const uninitializedAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                await expect(uninitializedAdapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new Error("Adapter not initialized. Call init() first."));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Adapter not initialized."));
            });

            it('should throw Error if called when not operational', async () => {
                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                    error: true,
                    message: "Failed to load",
                    stage: "test"
                });
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new Error("Adapter is not operational due to configuration loading issues."));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Adapter is not operational"));
            });

            it('should throw ConfigurationError if no activeConfig is set', async () => {
                const noDefaultConfigs = {...getOperationalConfigs(), defaultLlmId: null};
                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(noDefaultConfigs);
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError("No active LLM configuration is set. Use setActiveLlm() or set a defaultLlmId."));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("No active LLM configuration is set."));
            });
        });

        describe('Active Configuration Validation (Ticket 21)', () => {
            const createInvalidConfig = (overrides) => {
                const baseConfig = {...getOperationalConfigs().llms['test-llm-operational']};
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
                const testConfigKey = 'config-under-test';
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(ConfigurationError);
                try {
                    await adapter.getAIDecision(gameSummary);
                } catch (e) {
                    const actualIdInError = currentInvalidConf.id;
                    expect(e.message).toContain(`Active LLM config '${actualIdInError}' is missing essential field(s) or has invalid structure`);
                    expect(e.message).toContain(expectedMsgPart);
                    expect(e.llmId).toBe(actualIdInError);
                    expect(e.problematicFields.some(f => f.reason === 'Missing or invalid')).toBe(true);
                }
            });

            it('should throw ConfigurationError if jsonOutputStrategy is not an object when provided', async () => {
                const currentInvalidConf = createInvalidConfig({jsonOutputStrategy: "not-an-object"});
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-jos-type';
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                // CORRECTED: Pass dependencies to the constructor
                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});

                await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(ConfigurationError);
                try {
                    await adapter.getAIDecision(gameSummary);
                } catch (e) {
                    expect(e.message).toContain(`Active LLM config '${currentInvalidConf.id}'`);
                    expect(e.message).toContain("jsonOutputStrategy: Must be an object if provided");
                    expect(e.llmId).toBe(currentInvalidConf.id);
                }
            });

            it('should throw ConfigurationError if jsonOutputStrategy.method is invalid when provided', async () => {
                const currentInvalidConf = createInvalidConfig({jsonOutputStrategy: {method: "  "}}); // whitespace
                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-jos-method-format';
                tempConfigs.llms[testConfigKey] = currentInvalidConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);
                // CORRECTED: Pass dependencies to the constructor
                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});

                await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(ConfigurationError);
                try {
                    await adapter.getAIDecision(gameSummary);
                } catch (e) {
                    expect(e.message).toContain(`Active LLM config '${currentInvalidConf.id}'`);
                    expect(e.message).toContain("jsonOutputStrategy.method: Must be a non-empty string if provided");
                    expect(e.llmId).toBe(currentInvalidConf.id);
                }
            });
        });

        describe('API Key Retrieval', () => {
            it('should call IApiKeyProvider.getKey with correct activeConfig and environmentContext', async () => {
                await adapter.getAIDecision(gameSummary);
                const expectedActiveConfig = getOperationalConfigs().llms['test-llm-operational'];
                expect(mockApiKeyProvider.getKey).toHaveBeenCalledWith(expectedActiveConfig, mockEnvironmentContext);
            });

            it('should throw ConfigurationError if API key is required (cloud API on server) but getKey returns null', async () => {
                adapter.setActiveLlm('test-llm-cloud-server-requires-key');
                mockApiKeyProvider.getKey.mockResolvedValue(null);
                mockEnvironmentContext.isServer.mockReturnValue(true);

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        "API key retrieval failed or key is missing for LLM 'test-llm-cloud-server-requires-key' which requires it in the current environment (server-side cloud API).",
                        {llmId: 'test-llm-cloud-server-requires-key'}
                    ));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("API key retrieval failed or key is missing for LLM 'test-llm-cloud-server-requires-key'"));
            });

            it('should proceed with null API key if not strictly required (local LLM)', async () => {
                adapter.setActiveLlm('test-llm-local-no-key-needed');
                mockApiKeyProvider.getKey.mockResolvedValue(null);

                await adapter.getAIDecision(gameSummary);
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith(expect.objectContaining({apiKey: null}));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("API key not required or not found for LLM 'test-llm-local-no-key-needed'"));
            });

            it('should proceed with null API key if not strictly required (cloud API on client - assuming proxy handles key)', async () => {
                adapter.setActiveLlm('test-llm-cloud-server-requires-key');
                mockApiKeyProvider.getKey.mockResolvedValue(null);
                mockEnvironmentContext.isServer.mockReturnValue(false);
                mockEnvironmentContext.isClient.mockReturnValue(true);

                await adapter.getAIDecision(gameSummary);
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith(expect.objectContaining({apiKey: null}));
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("API key not required or not found for LLM 'test-llm-cloud-server-requires-key'"));
            });

            it('should log info if API key is retrieved successfully', async () => {
                mockApiKeyProvider.getKey.mockResolvedValue('a-valid-key-123');
                adapter.setActiveLlm('test-llm-cloud-server-requires-key');

                await adapter.getAIDecision(gameSummary);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.getAIDecision: API key retrieved successfully for LLM 'test-llm-cloud-server-requires-key'."
                );
            });
        });

        describe('Strategy Factory Interaction', () => {
            it('should call LLMStrategyFactory.getStrategy with the correct activeConfig', async () => {
                await adapter.getAIDecision(gameSummary);
                const expectedActiveConfig = getOperationalConfigs().llms['test-llm-operational'];
                expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(expectedActiveConfig);
            });

            it('should throw ConfigurationError if factory.getStrategy throws an error', async () => {
                const factoryError = new Error("Factory failed to create strategy");
                mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
                    throw factoryError;
                });

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        "Failed to get strategy from factory for LLM 'test-llm-operational': Factory failed to create strategy",
                        {llmId: 'test-llm-operational'}
                    ));
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("LLMStrategyFactory failed to provide a strategy for LLM 'test-llm-operational'. Error: Factory failed to create strategy"),
                    expect.objectContaining({originalError: factoryError})
                );
            });

            it('should throw ConfigurationError if factory.getStrategy returns null/undefined', async () => {
                mockLlmStrategyFactory.getStrategy.mockReturnValue(null);
                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(new ConfigurationError(
                        "No suitable LLM strategy found for configuration 'test-llm-operational'. LLMStrategyFactory returned null/undefined.",
                        {llmId: 'test-llm-operational'}
                    ));
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("No suitable LLM strategy found for configuration 'test-llm-operational'"));
            });
        });

        describe('Strategy Execution', () => {
            it('should call strategy.execute with correct parameters', async () => {
                const apiKeyToUse = 'key-for-strategy';
                mockApiKeyProvider.getKey.mockResolvedValue(apiKeyToUse);

                await adapter.getAIDecision(gameSummary);

                const expectedActiveConfig = getOperationalConfigs().llms['test-llm-operational'];
                expect(mockLlmStrategy.execute).toHaveBeenCalledWith({
                    gameSummary,
                    llmConfig: expectedActiveConfig,
                    apiKey: apiKeyToUse,
                    environmentContext: mockEnvironmentContext,
                });
            });

            it('should return the JSON string from strategy.execute', async () => {
                const strategyResponse = JSON.stringify({strategy: "response"});
                mockLlmStrategy.execute.mockResolvedValue(strategyResponse);

                const result = await adapter.getAIDecision(gameSummary);
                expect(result).toBe(strategyResponse);
            });
        });

        describe('Error Propagation', () => {
            it('should catch, log, and re-throw errors from IApiKeyProvider.getKey', async () => {
                const apiKeyError = new Error("API Key Provider Error");
                mockApiKeyProvider.getKey.mockRejectedValue(apiKeyError);

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(apiKeyError);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("Error during decision processing for LLM 'test-llm-operational'. Error: API Key Provider Error"),
                    expect.objectContaining({llmId: 'test-llm-operational', errorName: 'Error'})
                );
            });

            it('should catch, log, and re-throw errors from LLMStrategyFactory.getStrategy (if not ConfigurationError)', async () => {
                const factoryGenericError = new Error("Factory generic meltdown");
                mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
                    throw factoryGenericError;
                });

                mockLogger.error.mockClear();

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(ConfigurationError);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("LLMStrategyFactory failed to provide a strategy for LLM 'test-llm-operational'. Error: Factory generic meltdown"),
                    expect.objectContaining({originalError: factoryGenericError})
                );
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("Error during decision processing for LLM 'test-llm-operational'. Error: Failed to get strategy from factory for LLM 'test-llm-operational': Factory generic meltdown"),
                    expect.objectContaining({llmId: 'test-llm-operational', errorName: 'ConfigurationError'})
                );
            });


            it('should catch, log, and re-throw errors from strategy.execute', async () => {
                const strategyExecuteError = new Error("Strategy Execution Failed");
                mockLlmStrategy.execute.mockRejectedValue(strategyExecuteError);

                await expect(adapter.getAIDecision(gameSummary))
                    .rejects.toThrow(strategyExecuteError);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("Error during decision processing for LLM 'test-llm-operational'. Error: Strategy Execution Failed"),
                    expect.objectContaining({llmId: 'test-llm-operational', errorName: 'Error'})
                );
            });

            it('should re-throw ConfigurationError from validation steps directly', async () => {
                const invalidIdConf = {...getOperationalConfigs().llms['test-llm-operational'], id: null};

                const tempConfigs = getOperationalConfigs();
                const testConfigKey = 'invalid-for-direct-rethrow';
                tempConfigs.llms[testConfigKey] = invalidIdConf;
                tempConfigs.defaultLlmId = testConfigKey;

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);

                adapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                await adapter.init({llmConfigLoader: mockLlmConfigLoader});
                mockLogger.error.mockClear();


                let thrownError;
                try {
                    await adapter.getAIDecision(gameSummary);
                } catch (e) {
                    thrownError = e;
                }
                expect(thrownError).toBeInstanceOf(ConfigurationError);
                expect(thrownError.message).toContain("Active LLM config 'null' is missing essential field(s)");
                expect(thrownError.llmId).toBeNull();

                expect(mockLogger.error).toHaveBeenCalledTimes(2);
                // This is the inner log from the validation block in getAIDecision
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.getAIDecision: Active LLM config 'null' is missing essential field(s) or has invalid structure: id: Missing or invalid"
                );
                // This is the outer catch log from getAIDecision
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining("Error during decision processing for LLM 'unknown'. Error: Active LLM config 'null' is missing essential field(s) or has invalid structure: id: Missing or invalid"),
                    expect.objectContaining({llmId: 'unknown', errorName: 'ConfigurationError'})
                );
            });
        });
    });
});

// --- FILE END ---