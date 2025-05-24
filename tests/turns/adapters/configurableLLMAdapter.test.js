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
    id: 'test-llm-2',
    displayName: 'Test LLM 2 (Cloud)',
    apiType: CLOUD_API_TYPES[0] || 'anthropic', // Pick a cloud API type
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.5},
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
};


describe('ConfigurableLLMAdapter', () => {
    let adapter;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
        mockEnvironmentContext.isServer.mockReturnValue(true);
        mockEnvironmentContext.isClient.mockReturnValue(false);
        mockEnvironmentContext.getProjectRootPath.mockReturnValue('/test/root');
        mockEnvironmentContext.getProxyServerUrl.mockReturnValue('http://proxy.test');
        mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
        mockLlmConfigLoader.loadConfigs.mockReset(); // Ensure this is reset
        mockApiKeyProvider.getKey.mockReset();
        mockLlmStrategy.execute.mockReset();
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
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            }); // Suppress console.error for this test
            expect(() => {
                new ConfigurableLLMAdapter({
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an Error if logger is invalid (missing methods)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: {info: jest.fn()},
                    environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider,
                    llmStrategyFactory: mockLlmStrategyFactory,
                });
            }).toThrow('ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an Error if environmentContext is missing', () => {
            expect(() => {
                new ConfigurableLLMAdapter({
                    logger: mockLogger,
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
        const mockSuccessConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig,
                'test-llm-2': sampleLlmModelConfig2,
            },
        };
        const mockErrorConfigPayload = {
            error: true, message: 'Failed to load configs', stage: 'parsing',
            path: 'path/to/config.json', originalError: new Error('Original parse error'),
        };

        beforeEach(() => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
        });

        it('should successfully initialize, load configs, and set default LLM', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockSuccessConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(true);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(mockSuccessConfigPayload);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig); // Awaited
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Actual asynchronous initialization started with LlmConfigLoader.'));
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configurations loaded successfully.',
                expect.objectContaining({numberOfConfigs: 2, defaultLlmId: 'test-llm-1'})
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("LLM configuration 'test-llm-1' (Test LLM 1) set as active by default.")
            );
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.');
        });

        it('should successfully initialize and set no default LLM if defaultLlmId is not in configs', async () => {
            const configsNoMatchingDefault = {...mockSuccessConfigPayload, defaultLlmId: 'non-existent-llm'};
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNoMatchingDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isOperational()).toBe(true);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(await adapter.getCurrentActiveLlmConfig()).toBeNull(); // Awaited
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultLlmId' (\"non-existent-llm\") is specified in configurations, but no LLM configuration with this ID exists.")
            );
        });

        it('should successfully initialize and set no default LLM if defaultLlmId is null or empty string', async () => {
            const configsNullDefault = {...mockSuccessConfigPayload, defaultLlmId: null};
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNullDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(await adapter.getCurrentActiveLlmConfig()).toBeNull(); // Awaited
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
            );

            adapter = new ConfigurableLLMAdapter({ // Re-instantiate
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            const configsEmptyDefault = {...mockSuccessConfigPayload, defaultLlmId: "   "};
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsEmptyDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(await adapter.getCurrentActiveLlmConfig()).toBeNull(); // Awaited
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultLlmId' found in configurations but it is not a valid non-empty string")
            );
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs returns an error result', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockErrorConfigPayload);
            // init itself doesn't throw here, but sets adapter to non-operational. The promise resolves.
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            // Calls to methods requiring operational status will now throw
            await expect(adapter.getCurrentActiveLlmConfig())
                .rejects
                .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
                expect.objectContaining({message: mockErrorConfigPayload.message})
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs returns an unexpected structure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({someUnexpectedProperty: true});
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                {configResult: {someUnexpectedProperty: true}}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization attempt complete, but the adapter is NON-OPERATIONAL due to configuration loading issues.');
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs throws an exception', async () => {
            const loadException = new Error('Unexpected load exception');
            mockLlmConfigLoader.loadConfigs.mockRejectedValue(loadException);
            // The init promise itself will reject
            await expect(adapter.init({llmConfigLoader: mockLlmConfigLoader})).rejects.toThrow(loadException);

            expect(adapter.isInitialized()).toBe(true); // Still marked as init attempt
            expect(adapter.isOperational()).toBe(false);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.',
                expect.objectContaining({errorMessage: loadException.message})
            );
            // The "NON-OPERATIONAL" warning might not be logged if the promise rejects early.
        });

        it('should throw an error synchronously and set states if llmConfigLoader is invalid or missing', () => {
            // Test null loader
            expect(() => adapter.init({llmConfigLoader: null}))
                .toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            // Check state after synchronous throw
            expect(adapter.isInitialized()).toBe(true); // Marked as init attempt by the sync part of init
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
                {providedLoader: null}
            );

            // Re-instantiate for the invalid loader case
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            const invalidLoader = {loadConfigs: 'not-a-function'};
            expect(() => adapter.init({llmConfigLoader: invalidLoader}))
                .toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.',
                {providedLoader: invalidLoader}
            );
        });

        it('should skip re-initialization logic if already initialized and operational', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockSuccessConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // First successful init

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            mockLogger.info.mockClear();

            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // Attempt re-init

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1); // Should not be called again
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Already initialized and operational from a previous successful call. Skipping re-initialization logic.');
            expect(adapter.isOperational()).toBe(true);
        });

        it('should throw an error if attempting to re-initialize after a critical configuration loading failure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockErrorConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // First init fails critically (sets non-operational)

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);

            // The init promise itself will reject
            await expect(adapter.init({llmConfigLoader: mockLlmConfigLoader}))
                .rejects.toThrow('ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.');
            expect(mockLogger.error).toHaveBeenCalledWith('ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.');
        });
    });

    describe('Configuration Management (setActiveLlm, getCurrentActiveLlmConfig, #setDefaultActiveLlm)', () => {
        const mockFullConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig,
                'test-llm-2': sampleLlmModelConfig2,
                'llm-no-display': {
                    id: 'llm-no-display', apiType: 'openai',
                    modelIdentifier: 'gpt-text', endpointUrl: 'url3'
                }
            },
        };

        beforeEach(async () => { // ASYNC
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockFullConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
        });

        describe('setActiveLlm()', () => {
            it('should successfully set an active LLM with a valid ID and update config', async () => { // ASYNC
                const result = await adapter.setActiveLlm('test-llm-2'); // AWAITED
                expect(result).toBe(true);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-2');
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2); // AWAITED
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'test-llm-2' (Test LLM 2 (Cloud))."
                );
            });

            it('should log display name as N/A if not present when setting active LLM', async () => { // ASYNC
                await adapter.setActiveLlm('llm-no-display'); // AWAITED
                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("(N/A)"));
            });

            it('should return false and log error if LLM ID is invalid (null, empty, non-string)', async () => { // ASYNC
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = await adapter.getCurrentActiveLlmConfig(); // AWAITED

                expect(await adapter.setActiveLlm(null)).toBe(false); // AWAITED
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: 'null'"));
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig); // AWAITED
                mockLogger.error.mockClear();

                expect(await adapter.setActiveLlm('')).toBe(false); // AWAITED
                // ...
                expect(await adapter.setActiveLlm('   ')).toBe(false); // AWAITED
                // ...
                expect(await adapter.setActiveLlm(123)).toBe(false); // AWAITED
            });

            it('should return false and log error if LLM ID does not exist in configs', async () => { // ASYNC
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = await adapter.getCurrentActiveLlmConfig(); // AWAITED

                const result = await adapter.setActiveLlm('non-existent-llm'); // AWAITED
                expect(result).toBe(false);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig); // AWAITED
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm'. Active LLM remains unchanged ('test-llm-1')."
                );
            });

            it('should throw error if called when adapter is not operational', async () => { // ASYNC
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(nonOpAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(nonOpAdapter.setActiveLlm('test-llm-1')) // AWAITED
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
                );
            });

            it('should throw error if init resulted in non-operational state when calling setActiveLlm', async () => { // ASYNC
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({llms: null}); // Makes it non-operational
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(localAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(localAdapter.setActiveLlm('test-llm-1')) // AWAITED
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
                );
            });
        });

        describe('getCurrentActiveLlmConfig()', () => {
            it('should return the correct config object when an LLM is active', async () => { // ASYNC
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig); // AWAITED
                await adapter.setActiveLlm('test-llm-2'); // AWAITED
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2); // AWAITED
            });

            it('should return null if no LLM is currently active (e.g., after init with no default and no setActiveLlm call)', async () => { // ASYNC
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const noDefaultConfig = {...mockFullConfigPayload, defaultLlmId: null};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(noDefaultConfig);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(localAdapter.isOperational()).toBe(true); // Should be operational even without a default

                expect(await localAdapter.getCurrentActiveLlmConfig()).toBeNull(); // AWAITED
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.'
                );
            });

            it('should throw error if adapter is not operational when calling getCurrentActiveLlmConfig', async () => { // ASYNC
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(nonOpAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(nonOpAdapter.getCurrentActiveLlmConfig()) // AWAITED
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
                );
            });
        });

        describe('#setDefaultActiveLlm (tested via init outcomes)', () => {
            it('should set default LLM if defaultLlmId is present and valid in configs during init', async () => { // ASYNC
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig); // AWAITED
                mockLogger.info.mockClear(); // Clear beforeEach init logs
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockFullConfigPayload);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: LLM configuration 'test-llm-1' (Test LLM 1) set as active by default."
                );
            });

            it('should set no default LLM if defaultLlmId is specified but not found in configs during init', async () => { // ASYNC
                mockLogger.warn.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configWithBadDefault = {...mockFullConfigPayload, defaultLlmId: 'non-existent-default'};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithBadDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(await localAdapter.getCurrentActiveLlmConfig()).toBeNull(); // AWAITED
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: 'defaultLlmId' (\"non-existent-default\") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set."
                );
            });

            it('should set no default LLM if defaultLlmId is not specified in configs during init', async () => { // ASYNC
                mockLogger.info.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configNoDefault = {...mockFullConfigPayload, defaultLlmId: undefined};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configNoDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(await localAdapter.getCurrentActiveLlmConfig()).toBeNull(); // AWAITED
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
                );
            });

            it('should NOT warn from #setDefaultActiveLlm about unloaded configs if init proceeds normally and configs are loaded', async () => { // ASYNC
                mockLogger.warn.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configWithoutDefault = {llms: {'some-llm': sampleLlmModelConfig}};
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithoutDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED

                expect(mockLogger.warn).not.toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: Cannot set default active LLM because configurations are not loaded.'
                );
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
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            // Clear mocks for freshAdapter tests if needed, already done in outer beforeEach
        });

        describe('isInitialized() and isOperational()', () => {
            it('isInitialized() should be false before init, true after init attempt', async () => { // ASYNC
                expect(freshAdapter.isInitialized()).toBe(false);
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({llms: {}}); // Minimal successful config
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(freshAdapter.isInitialized()).toBe(true);

                const anotherAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true}); // Failed config load
                await anotherAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(anotherAdapter.isInitialized()).toBe(true); // Still true as init attempt was made
            });

            it('isOperational() should be false before init', () => {
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be true after successful init', async () => { // ASYNC
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({llms: {'test': sampleLlmModelConfig}});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(freshAdapter.isOperational()).toBe(true);
            });

            it('isOperational() should be false after failed init (config load error)', async () => { // ASYNC
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be false after failed init (config loader invalid - sync throw)', () => { // SYNC for this specific init failure
                try {
                    freshAdapter.init({llmConfigLoader: null});
                } catch (e) { /* Expected */
                }
                expect(freshAdapter.isOperational()).toBe(false);
            });
        });

        describe('_FOR_TESTING_ONLY Methods', () => {
            const testConfigs = {defaultLlmId: 'test-id', llms: {'test-id': sampleLlmModelConfig}};

            it('getLoadedConfigs_FOR_TESTING_ONLY() returns null before/failed init, configs after success', async () => { // ASYNC
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(testConfigs);
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(testConfigs);

                const failedInitAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await failedInitAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(failedInitAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            });

            it('getActiveLlmId_FOR_TESTING_ONLY() returns null initially, then active ID, and respects failed setActiveLlm', async () => { // ASYNC
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                const fullTestConfigs = {
                    defaultLlmId: 'test-id',
                    llms: {
                        'test-id': sampleLlmModelConfig,
                        'another-id': {...sampleLlmModelConfig2, id: 'another-id'}
                    }
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(fullTestConfigs);
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader}); // AWAITED
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-id');

                // Successfully set another-id
                const setResult1 = await freshAdapter.setActiveLlm('another-id'); // AWAITED
                expect(setResult1).toBe(true);
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('another-id');

                // Attempt to set a non-existent ID
                const setResult2 = await freshAdapter.setActiveLlm('non-existent-llm-id'); // AWAITED
                expect(setResult2).toBe(false);
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('another-id'); // Should remain 'another-id'
            });

            it('getExecutionEnvironment_FOR_TESTING_ONLY() returns environment from context', () => {
                mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('client');
                const clientAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(clientAdapter.getExecutionEnvironment_FOR_TESTING_ONLY()).toBe('client');
            });

            it('getProjectRootPath_FOR_TESTING_ONLY() returns path from context', () => {
                mockEnvironmentContext.getProjectRootPath.mockReturnValue('/custom/path');
                const newAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(newAdapter.getProjectRootPath_FOR_TESTING_ONLY()).toBe('/custom/path');
            });

            it('getProxyServerUrl_FOR_TESTING_ONLY() returns URL from context', () => {
                mockEnvironmentContext.getProxyServerUrl.mockReturnValue('http://custom.proxy');
                const newAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                expect(newAdapter.getProxyServerUrl_FOR_TESTING_ONLY()).toBe('http://custom.proxy');
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
    // Add describe block for getAIDecision if not already present
    // describe('getAIDecision()', () => { /* ... tests ... */ });
});

// --- FILE END ---