// tests/turns/adapters/configurableLLMAdapter.test.js
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
    id: 'test-llm-2', // Corrected: ensure this id is unique if used as a distinct model config
    displayName: 'Test LLM 2 (Cloud)',
    apiType: CLOUD_API_TYPES[0], // Pick a cloud API type
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.5},
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
};


describe('ConfigurableLLMAdapter', () => {
    let adapter;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Default mock implementations for mockEnvironmentContext
        mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
        mockEnvironmentContext.isServer.mockReturnValue(true);
        mockEnvironmentContext.isClient.mockReturnValue(false);
        // Provide default returns for other mockEnvironmentContext methods used in corrected tests
        mockEnvironmentContext.getProjectRootPath.mockReturnValue('/test/root');
        mockEnvironmentContext.getProxyServerUrl.mockReturnValue('http://proxy.test');


        mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
    });

    describe('Constructor', () => {
        it('should successfully instantiate when all valid dependencies are provided', () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ConfigurableLLMAdapter: Instance created.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Execution environment: server.'));
        });

        it('should throw an Error if logger is missing', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    // logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.');
        });

        it('should throw an Error if logger is invalid (missing methods)', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: {info: jest.fn()}, // missing error, warn, debug
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.');
        });

        it('should throw an Error if environmentContext is missing', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    // environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.');
            expect(mockLogger.error).toHaveBeenCalledWith('ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.');
        });

        it('should throw an Error if environmentContext is invalid (missing methods)', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: {getExecutionEnvironment: 'not a function'},
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.');
        });


        it('should throw an Error if apiKeyProvider is missing', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    // apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.');
            expect(mockLogger.error).toHaveBeenCalledWith('ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.');
        });

        it('should throw an Error if apiKeyProvider is invalid (missing getKey method)', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: {getKey: 'not-a-function'},
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.');
        });

        it('should throw an Error if llmStrategyFactory is missing', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    // llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.');
            expect(mockLogger.error).toHaveBeenCalledWith('ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.');
        });

        it('should throw an Error if llmStrategyFactory is invalid (missing getStrategy method)', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: {getStrategy: 'not-a-function'},
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.');
        });
    });

    describe('init() Method', () => {
        /** @type {import('../../../src/services/llmConfigLoader.js').LLMConfigurationFile} */
        const mockSuccessConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig,
                'test-llm-2': sampleLlmModelConfig2,
            },
        };

        /** @type {import('../../../src/services/llmConfigLoader.js').LoadConfigsErrorResult} */
        const mockErrorConfigPayload = {
            error: true,
            message: 'Failed to load configs',
            stage: 'parsing',
            path: 'path/to/config.json',
            originalError: new Error('Original parse error'),
        };

        beforeEach(() => {
            // Ensure adapter is created before each init test, but don't init it yet.
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            // Reset LlmConfigLoader mock calls specifically for init tests
            mockLlmConfigLoader.loadConfigs.mockReset();
        });

        it('should successfully initialize, load configs, and set default LLM', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockSuccessConfigPayload);

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(true);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(mockSuccessConfigPayload);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
            expect(adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization started with LlmConfigLoader.');
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configurations loaded successfully.',
                expect.objectContaining({numberOfConfigs: 2, defaultLlmId: 'test-llm-1'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("LLM configuration 'test-llm-1' (Test LLM 1) set as active by default.")
            );
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization complete and adapter is operational.');
        });

        it('should successfully initialize and set no default LLM if defaultLlmId is not in configs', async () => {
            const configsNoMatchingDefault = {
                ...mockSuccessConfigPayload,
                defaultLlmId: 'non-existent-llm',
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNoMatchingDefault);

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isOperational()).toBe(true);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(adapter.getCurrentActiveLlmConfig()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultLlmId' (\"non-existent-llm\") is specified in configurations, but no LLM configuration with this ID exists.")
            );
        });

        it('should successfully initialize and set no default LLM if defaultLlmId is null or empty string', async () => {
            const configsNullDefault = {
                ...mockSuccessConfigPayload,
                defaultLlmId: null,
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNullDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
            );

            // Re-instantiate for the empty string case
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            const configsEmptyDefault = {
                ...mockSuccessConfigPayload,
                defaultLlmId: "   ",
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsEmptyDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultLlmId' found in configurations but it is not a valid non-empty string")
            );
        });


        it('should handle initialization failure if LlmConfigLoader.loadConfigs returns an error result', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockErrorConfigPayload);

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(adapter.getCurrentActiveLlmConfig()).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
                expect.objectContaining({message: mockErrorConfigPayload.message})
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs returns an unexpected structure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({someUnexpectedProperty: true}); // Not LLMConfigurationFile or LoadConfigsErrorResult

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                {configResult: {someUnexpectedProperty: true}}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
        });


        it('should handle initialization failure if LlmConfigLoader.loadConfigs throws an exception', async () => {
            const loadException = new Error('Unexpected load exception');
            mockLlmConfigLoader.loadConfigs.mockRejectedValue(loadException);

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.',
                expect.objectContaining({errorMessage: loadException.message})
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
        });

        it('should throw an error and set states if llmConfigLoader is invalid or missing', async () => {
            await expect(adapter.init({llmConfigLoader: null}))
                .rejects.toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
                {providedLoader: null}
            );

            // Re-instantiate for the invalid loader case
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            const invalidLoader = {loadConfigs: 'not-a-function'};
            await expect(adapter.init({llmConfigLoader: invalidLoader}))
                .rejects.toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
                {providedLoader: invalidLoader}
            );
        });

        it('should skip re-initialization if already initialized and operational', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockSuccessConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // First successful init

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            mockLogger.info.mockClear(); // Clear logs from first init

            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // Attempt re-init

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1); // Should not be called again
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Already initialized and operational. Skipping re-initialization.');
            expect(adapter.isOperational()).toBe(true); // Still operational
        });

        it('should throw an error if attempting to re-initialize after a critical configuration loading failure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockErrorConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // First init fails critically

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);

            await expect(adapter.init({llmConfigLoader: mockLlmConfigLoader})) // Attempt re-init
                .rejects.toThrow('ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure.');
            expect(mockLogger.error).toHaveBeenCalledWith('ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure.');
        });
    });

    describe('Configuration Management (setActiveLlm, getCurrentActiveLlmConfig, #setDefaultActiveLlm)', () => {
        /** @type {import('../../../src/services/llmConfigLoader.js').LLMConfigurationFile} */
        const mockFullConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig,
                'test-llm-2': sampleLlmModelConfig2,
                'llm-no-display': {
                    id: 'llm-no-display',
                    apiType: 'openai',
                    modelIdentifier: 'gpt-text',
                    endpointUrl: 'url3'
                    // no displayName
                }
            },
        };

        beforeEach(async () => {
            // Reset and re-initialize adapter for these tests
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockFullConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            // Clear mocks that might have been called during init
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
        });

        describe('setActiveLlm()', () => {
            it('should successfully set an active LLM with a valid ID and update config', () => {
                const result = adapter.setActiveLlm('test-llm-2');
                expect(result).toBe(true);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-2');
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'test-llm-2' (Test LLM 2 (Cloud))."
                );
            });

            it('should log display name as N/A if not present when setting active LLM', () => {
                adapter.setActiveLlm('llm-no-display');
                expect(mockLogger.info).toHaveBeenCalledWith(
                    expect.stringContaining("(N/A)")
                );
            });


            it('should return false and log error if LLM ID is invalid (null, empty, non-string)', () => {
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = adapter.getCurrentActiveLlmConfig();

                expect(adapter.setActiveLlm(null)).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: 'null'"));
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
                mockLogger.error.mockClear();

                expect(adapter.setActiveLlm('')).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: ''"));
                mockLogger.error.mockClear();

                expect(adapter.setActiveLlm('   ')).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: '   '"));
                mockLogger.error.mockClear();

                expect(adapter.setActiveLlm(123)).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: '123'"));
            });

            it('should return false and log error if LLM ID does not exist in configs', () => {
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = adapter.getCurrentActiveLlmConfig();

                const result = adapter.setActiveLlm('non-existent-llm');
                expect(result).toBe(false);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm'. Active LLM remains unchanged ('test-llm-1')."
                );
            });

            it('should return false and log error if called when adapter is not operational', async () => {
                // Create a new non-operational adapter
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                // Manually set to initialized but not operational (simulating a failed init)
                // These direct assignments to private fields are unreliable for testing native private fields.
                // The adapter's state will be as set by its constructor/init method.
                // If init is not called, isInitialized and isOperational are false.
                // If init fails, isOperational becomes false.

                // To test this properly, init the adapter in a way that it becomes non-operational.
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader});


                mockLogger.error.mockClear(); // Clear errors from init
                const result = nonOpAdapter.setActiveLlm('test-llm-1');
                expect(result).toBe(false);
                expect(nonOpAdapter.isOperational()).toBe(false); // Verify it's indeed not operational
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Adapter is not operational. Cannot set LLM ID 'test-llm-1'."
                );
            });

            // Corrected Test for Failure 1
            it('should return false and log "Adapter is not operational" if init resulted in non-operational state due to bad config structure', async () => {
                const localAdapter = new ConfigurableLLMAdapter({ // re-init for fresh state
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                // This config {llms: null} will cause init() to set #isOperational to false
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({llms: null});
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                // Pre-check: adapter should be non-operational
                expect(localAdapter.isOperational()).toBe(false);

                // The test originally tried to force __isOperational = true and __llmConfigs = null
                // and expected "LLM configurations are not loaded".
                // However, with #isOperational being false (correctly set by init),
                // the "Adapter is not operational" message is the correct first check that setActiveLlm hits.
                mockLogger.error.mockClear(); // Clear errors from init (like 'unexpected structure')

                const result = localAdapter.setActiveLlm('test-llm-1');
                expect(result).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Adapter is not operational. Cannot set LLM ID 'test-llm-1'."
                );

                // Test the second case from original test, also expecting "Adapter is not operational"
                // if we re-initialize similarly leading to non-operational state
                const anotherLocalAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                // This config { llmConfigs: {llms: null} } will also cause init to set #isOperational to false
                // (Assuming the adapter handles nested structures like this as an error or unexpected)
                // More directly, make loadConfigs return an error structure.
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "Simulated load error"});
                await anotherLocalAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(anotherLocalAdapter.isOperational()).toBe(false);

                mockLogger.error.mockClear();
                const result2 = anotherLocalAdapter.setActiveLlm('test-llm-1');
                expect(result2).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Adapter is not operational. Cannot set LLM ID 'test-llm-1'."
                );
            });
        });

        describe('getCurrentActiveLlmConfig()', () => {
            it('should return the correct config object when an LLM is active', () => {
                // Default from init is test-llm-1
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);
                adapter.setActiveLlm('test-llm-2');
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
            });

            it('should return null if no LLM is currently active (e.g., after init with no default and no setActiveLlm call)', async () => {
                const localAdapter = new ConfigurableLLMAdapter({ // New adapter
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                const noDefaultConfig = {...mockFullConfigPayload, defaultLlmId: null};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(noDefaultConfig);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.debug).toHaveBeenCalledWith( // This log is from getCurrentActiveLlmConfig
                    'ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.'
                );
            });

            it('should return null and log warning if adapter is not operational', async () => {
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                // Make it non-operational through init
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(nonOpAdapter.isOperational()).toBe(false);

                // Manually setting __currentActiveLlmConfig here is unreliable for testing private fields.
                // The method should return null if not operational, regardless of what __currentActiveLlmConfig might be.
                // nonOpAdapter._ConfigurableLLMAdapter__currentActiveLlmConfig = sampleLlmModelConfig;

                mockLogger.warn.mockClear(); // Clear warnings from init
                expect(nonOpAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.getCurrentActiveLlmConfig: Adapter is not operational. Returning null.'
                );
            });
        });

        describe('#setDefaultActiveLlm (tested via init outcomes)', () => {
            it('should set default LLM if defaultLlmId is present and valid in configs during init', async () => {
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
                expect(adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);

                mockLogger.info.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockFullConfigPayload);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: LLM configuration 'test-llm-1' (Test LLM 1) set as active by default."
                );
            });

            it('should set no default LLM if defaultLlmId is specified but not found in configs during init', async () => {
                mockLogger.warn.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configWithBadDefault = {
                    ...mockFullConfigPayload,
                    defaultLlmId: 'non-existent-default',
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithBadDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(localAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: 'defaultLlmId' (\"non-existent-default\") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set."
                );
            });

            it('should set no default LLM if defaultLlmId is not specified in configs during init', async () => {
                mockLogger.info.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configNoDefault = {...mockFullConfigPayload, defaultLlmId: undefined};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configNoDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(localAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
                );
            });

            // Corrected Test for Failure 2
            it('should NOT warn from #setDefaultActiveLlm about unloaded configs if init proceeds normally, and active LLM should be null if no default', async () => {
                mockLogger.warn.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
                // Simulate a config that allows init to proceed and call #setDefaultActiveLlm,
                // but doesn't specify a defaultLlmId.
                // The original test tried to make #llmConfigs null when #setDefaultActiveLlm is called,
                // but init's flow prevents this for the path that calls #setDefaultActiveLlm.
                const configWithoutDefault = {llms: {'some-llm': sampleLlmModelConfig}}; // No defaultLlmId

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithoutDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                // The specific warning "Cannot set default active LLM because configurations are not loaded"
                // is not expected here because if init calls #setDefaultActiveLlm, configs are considered loaded.
                expect(mockLogger.warn).not.toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: Cannot set default active LLM because configurations are not loaded.'
                );
                // Instead, a different log (info or warn) about *no default being set* is expected if no defaultLlmId
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
                );
                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            });
        });
    });

    describe('Utility/State Methods', () => {
        let freshAdapter;

        beforeEach(() => {
            freshAdapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();

            // Ensure mocks for environmentContext are set for freshAdapter related tests
            mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
            mockEnvironmentContext.getProjectRootPath.mockReturnValue('/test/root');
            mockEnvironmentContext.getProxyServerUrl.mockReturnValue('http://proxy.test');
        });

        describe('isInitialized() and isOperational()', () => {
            it('isInitialized() should be false before init, true after', async () => {
                expect(freshAdapter.isInitialized()).toBe(false);
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({llms: {}});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isInitialized()).toBe(true);
            });

            it('isOperational() should be false before init', () => {
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be true after successful init', async () => {
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({llms: {'test': sampleLlmModelConfig}});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isOperational()).toBe(true);
            });

            it('isOperational() should be false after failed init (config load error)', async () => {
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be false after failed init (config loader invalid)', async () => {
                try {
                    await freshAdapter.init({llmConfigLoader: null});
                } catch (e) {
                    // Expected to throw
                }
                expect(freshAdapter.isOperational()).toBe(false);
            });
        });

        describe('_FOR_TESTING_ONLY Methods', () => {
            const testConfigs = {defaultLlmId: 'test-id', llms: {'test-id': sampleLlmModelConfig}};
            // A different config to be used for 'another-id'
            const anotherLlmConfig = {...sampleLlmModelConfig2, id: 'another-id', displayName: 'Another LLM'};


            it('getLoadedConfigs_FOR_TESTING_ONLY() returns null before/failed init, configs after success', async () => {
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(testConfigs);
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(testConfigs);

                const failedInitAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await failedInitAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(failedInitAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            });

            // Corrected Test for Failure 3
            it('getActiveLlmId_FOR_TESTING_ONLY() returns null initially, then active ID, and respects failed setActiveLlm', async () => {
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(testConfigs);
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-id');

                // Attempt to set an LLM ID that does NOT exist in the configs loaded by init.
                // The original test tried to modify internal __llmConfigs, which is unreliable.
                // Here, we test based on the configs `freshAdapter` actually has.
                const setActiveResult = freshAdapter.setActiveLlm('another-id');
                expect(setActiveResult).toBe(false); // This should fail as 'another-id' is not in `testConfigs`

                // The active LLM ID should remain 'test-id' because setActiveLlm failed.
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-id');
            });


            it('getExecutionEnvironment_FOR_TESTING_ONLY() returns environment from context', () => {
                // mockEnvironmentContext.getExecutionEnvironment is already mocked in the top beforeEach
                // or can be set specifically if needed.
                mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('client');
                const clientAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(clientAdapter.getExecutionEnvironment_FOR_TESTING_ONLY()).toBe('client');

                mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
                const serverAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(serverAdapter.getExecutionEnvironment_FOR_TESTING_ONLY()).toBe('server');
            });

            // Corrected Test for Failure 4
            it('getExecutionEnvironment_FOR_TESTING_ONLY() returns environment from context (constructor ensures context exists)', () => {
                // The original test tried to nullify internal #environmentContext, which is unreliable.
                // The constructor ensures #environmentContext is valid. This test now confirms the normal path.
                // `freshAdapter` uses `mockEnvironmentContext` where `getExecutionEnvironment` returns 'server' (from its beforeEach).
                expect(freshAdapter.getExecutionEnvironment_FOR_TESTING_ONLY()).toBe('server');
                // The error for missing context should not be logged in normal operation.
                expect(mockLogger.error).not.toHaveBeenCalledWith("getExecutionEnvironment_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            });


            it('getProjectRootPath_FOR_TESTING_ONLY() returns path from context', () => {
                mockEnvironmentContext.getProjectRootPath.mockReturnValue('/custom/path');
                const newAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(newAdapter.getProjectRootPath_FOR_TESTING_ONLY()).toBe('/custom/path');
            });

            // Corrected Test for Failure 5
            it('getProjectRootPath_FOR_TESTING_ONLY() returns path from context (constructor ensures context exists)', () => {
                // `freshAdapter` uses `mockEnvironmentContext` where `getProjectRootPath` returns '/test/root' (from its beforeEach).
                expect(freshAdapter.getProjectRootPath_FOR_TESTING_ONLY()).toBe('/test/root');
                expect(mockLogger.error).not.toHaveBeenCalledWith("getProjectRootPath_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            });


            it('getProxyServerUrl_FOR_TESTING_ONLY() returns URL from context', () => {
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue('http://custom.proxy');
                const newAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger,
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(newAdapter.getProxyServerUrl_FOR_TESTING_ONLY()).toBe('http://custom.proxy');
            });

            // Corrected Test for Failure 6
            it('getProxyServerUrl_FOR_TESTING_ONLY() returns URL from context (constructor ensures context exists)', () => {
                // `freshAdapter` uses `mockEnvironmentContext` where `getProxyServerUrl` returns 'http://proxy.test' (from its beforeEach).
                expect(freshAdapter.getProxyServerUrl_FOR_TESTING_ONLY()).toBe('http://proxy.test');
                expect(mockLogger.error).not.toHaveBeenCalledWith("getProxyServerUrl_FOR_TESTING_ONLY: #environmentContext is not initialized.");
            });


            it('getEnvironmentContext_FOR_TESTING_ONLY() returns the EnvironmentContext instance', () => {
                expect(freshAdapter.getEnvironmentContext_FOR_TESTING_ONLY()).toBe(mockEnvironmentContext);
            });

            it('getApiKeyProvider_FOR_TESTING_ONLY() returns the IApiKeyProvider instance', () => {
                expect(freshAdapter.getApiKeyProvider_FOR_TESTING_ONLY()).toBe(mockApiKeyProvider);
            });

            it('getLlmStrategyFactory_FOR_TESTING_ONLY() returns the LLMStrategyFactory instance', () => {
                expect(freshAdapter.getLlmStrategyFactory_FOR_TESTING_ONLY()).toBe(mockLlmStrategyFactory);
            });
        });
    });
});

// --- FILE END ---