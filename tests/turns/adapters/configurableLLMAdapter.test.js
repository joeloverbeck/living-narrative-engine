// tests/turns/adapters/configurableLLMAdapter.test.js
// --- FILE START ---

import {jest, beforeEach, describe, expect, it} from '@jest/globals';
import {ConfigurableLLMAdapter} from '../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust path as needed
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

// Updated sampleLlmModelConfig to align with LLMModelConfig type and use configId
/** @type {import('../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
const sampleLlmModelConfig = {
    configId: 'test-llm-1', // Changed from id
    displayName: 'Test LLM 1',
    apiType: 'openai',
    modelIdentifier: 'gpt-3.5-turbo',
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    jsonOutputStrategy: {method: 'native_json'},
    promptElements: [{key: 'sys', prefix: '', suffix: ''}], // Added required
    promptAssemblyOrder: ['sys'], // Added required
    defaultParameters: {temperature: 0.7},
};

/** @type {import('../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
const sampleLlmModelConfig2 = {
    configId: 'test-llm-2', // Changed from id
    displayName: 'Test LLM 2 (Cloud)',
    apiType: CLOUD_API_TYPES[0] || 'anthropic',
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    jsonOutputStrategy: {method: 'native_json'}, // Added required
    promptElements: [{key: 'sys', prefix: '', suffix: ''}], // Added required
    promptAssemblyOrder: ['sys'], // Added required
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultParameters: {temperature: 0.5},
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
        mockLlmConfigLoader.loadConfigs.mockReset();
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
            });
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
                    logger: {info: jest.fn()}, // missing other methods
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
        // Updated mockSuccessConfigPayload to new structure
        const mockSuccessConfigPayload = {
            defaultConfigId: 'test-llm-1', // Changed
            configs: { // Changed
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
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockSuccessConfigPayload)));
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(true); // Should pass with correct payload
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(mockSuccessConfigPayload);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Actual asynchronous initialization started with LlmConfigLoader.'));
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configurations loaded successfully.',
                expect.objectContaining({numberOfConfigs: 2, defaultConfigId: 'test-llm-1'}) // Changed
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'test-llm-1' (Test LLM 1) set as active by defaultConfigId from file." // Changed
            );
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.');
        });

        it('should successfully initialize and set no default LLM if defaultConfigId is not in configs', async () => {
            const configsNoMatchingDefault = {
                ...mockSuccessConfigPayload,
                defaultConfigId: 'non-existent-llm' // Changed
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNoMatchingDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isOperational()).toBe(true); // Adapter is operational as configs loaded
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(await adapter.getCurrentActiveLlmConfig()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultConfigId' (\"non-existent-llm\") is specified in configurations, but no LLM configuration with this ID exists") // Changed
            );
        });

        it('should successfully initialize and set no default LLM if defaultConfigId is null or empty string', async () => {
            const configsNullDefault = {
                ...mockSuccessConfigPayload,
                defaultConfigId: null // Changed
            };
            // With strict init, defaultConfigId: null makes it non-operational
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsNullDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.isOperational()).toBe(false); // Non-operational
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            await expect(adapter.getCurrentActiveLlmConfig()).rejects.toThrow(); // Accessing config when non-op throws
            expect(mockLogger.error).toHaveBeenCalledWith( // Expect error for unexpected structure
                'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                expect.any(Object)
            );

            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            const configsEmptyDefault = {
                ...mockSuccessConfigPayload,
                defaultConfigId: "   " // Changed
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(configsEmptyDefault);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.isOperational()).toBe(true); // Operational with empty string defaultConfigId
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(await adapter.getCurrentActiveLlmConfig()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("'defaultConfigId' found in configurations but it is not a valid non-empty string") // Changed
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
            await expect(adapter.getCurrentActiveLlmConfig())
                .rejects
                .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Critical error loading LLM configurations.',
                expect.objectContaining({message: mockErrorConfigPayload.message})
            );
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs returns an unexpected structure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({someUnexpectedProperty: true}); // Missing configs and defaultConfigId
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                {configResult: {someUnexpectedProperty: true}}
            );
        });

        it('should handle initialization failure if LlmConfigLoader.loadConfigs throws an exception', async () => {
            const loadException = new Error('Unexpected load exception');
            mockLlmConfigLoader.loadConfigs.mockRejectedValue(loadException);
            await expect(adapter.init({llmConfigLoader: mockLlmConfigLoader})).rejects.toThrow(loadException);

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: Unexpected exception during LLM configuration loading.',
                expect.objectContaining({errorMessage: loadException.message})
            );
        });

        it('should throw an error synchronously and set states if llmConfigLoader is invalid or missing', () => {
            expect(() => adapter.init({llmConfigLoader: null}))
                .toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);

            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            }); // re-init for next part of test
            const invalidLoader = {loadConfigs: 'not-a-function'};
            expect(() => adapter.init({llmConfigLoader: invalidLoader}))
                .toThrow('ConfigurableLLMAdapter: Initialization requires a valid LlmConfigLoader instance.');
            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);
        });

        it('should skip re-initialization logic if already initialized and operational', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockSuccessConfigPayload)));
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isOperational()).toBe(true); // Ensure first init was operational
            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            mockLogger.info.mockClear();

            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Already initialized and operational from a previous successful call. Skipping re-initialization logic.');
        });

        it('should throw an error if attempting to re-initialize after a critical configuration loading failure', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(mockErrorConfigPayload);
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.isInitialized()).toBe(true);
            expect(adapter.isOperational()).toBe(false);

            await expect(adapter.init({llmConfigLoader: mockLlmConfigLoader}))
                .rejects.toThrow('ConfigurableLLMAdapter: Cannot re-initialize after a critical configuration loading failure from a previous attempt.');
        });
    });

    describe('Configuration Management (setActiveLlm, getCurrentActiveLlmConfig, #setDefaultActiveLlm)', () => {
        // Updated mockFullConfigPayload
        const mockFullConfigPayload = {
            defaultConfigId: 'test-llm-1', // Changed
            configs: { // Changed
                'test-llm-1': sampleLlmModelConfig,
                'test-llm-2': sampleLlmModelConfig2,
                'llm-no-display': { // sample for no display name
                    configId: 'llm-no-display', apiType: 'openai', // Changed
                    modelIdentifier: 'gpt-text', endpointUrl: 'url3',
                    jsonOutputStrategy: {method: 'text'}, promptElements: [], promptAssemblyOrder: [] // Added required
                }
            },
        };

        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            // Ensure a successful init for these tests
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockFullConfigPayload)));
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.isOperational()).toBe(true); // Verify operational before each sub-test
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
        });

        describe('setActiveLlm()', () => {
            it('should successfully set an active LLM with a valid ID and update config', async () => {
                const result = await adapter.setActiveLlm('test-llm-2');
                expect(result).toBe(true);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-2');
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'test-llm-2' (Test LLM 2 (Cloud))."
                );
            });

            it('should log display name as N/A if not present when setting active LLM', async () => {
                await adapter.setActiveLlm('llm-no-display');
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'llm-no-display' (N/A)."
                );
            });

            it('should return false and log error if LLM ID is invalid (null, empty, non-string)', async () => {
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = await adapter.getCurrentActiveLlmConfig();

                expect(await adapter.setActiveLlm(null)).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid llmId provided (must be a non-empty string). Received: 'null'"));
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
            });

            it('should return false and log error if LLM ID does not exist in configs', async () => {
                const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
                const initialConfig = await adapter.getCurrentActiveLlmConfig();

                const result = await adapter.setActiveLlm('non-existent-llm');
                expect(result).toBe(false);
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm' in the configs map. Active LLM remains unchanged ('test-llm-1')." // Changed
                );
            });

            it('should throw error if called when adapter is not operational', async () => {
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(nonOpAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(nonOpAdapter.setActiveLlm('test-llm-1'))
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            });

            it('should throw error if init resulted in non-operational state when calling setActiveLlm', async () => {
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({configs: null, defaultConfigId: null}); // Makes it non-operational
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(localAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(localAdapter.setActiveLlm('test-llm-1'))
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            });
        });

        describe('getCurrentActiveLlmConfig()', () => {
            it('should return the correct config object when an LLM is active', async () => {
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);
                await adapter.setActiveLlm('test-llm-2');
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
            });

            it('should return null if no LLM is currently active (e.g., after init with no default and no setActiveLlm call)', async () => {
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const noDefaultConfig = {
                    configs: mockFullConfigPayload.configs,
                    defaultConfigId: "non-existent-default"
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(noDefaultConfig);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(localAdapter.isOperational()).toBe(true);
                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();

                expect(await localAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.getCurrentActiveLlmConfig: No LLM configuration is currently active. Returning null.'
                );
            });

            it('should throw error if adapter is not operational when calling getCurrentActiveLlmConfig', async () => {
                const nonOpAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
                await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(nonOpAdapter.isOperational()).toBe(false);
                mockLogger.error.mockClear();

                await expect(nonOpAdapter.getCurrentActiveLlmConfig())
                    .rejects
                    .toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            });
        });

        describe('#setDefaultActiveLlm (tested via init outcomes)', () => {
            it('should set default LLM if defaultConfigId is present and valid in configs during init', async () => {
                // This test uses the 'adapter' instance that was set up in the parent describe's beforeEach.
                // That beforeEach already called adapter.init() with mockFullConfigPayload,
                // and mockLogger.info was cleared AFTER that init.
                // So, we are checking the state of 'adapter' after its init.
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);

                // To check the log specifically for this default selection, we'd need to look at the calls
                // made during the adapter.init() in the parent beforeEach.
                // However, mockLogger.info was cleared.
                // For this test to be robust about the LOG, it should re-init a local adapter.
                // Re-doing with a local adapter to isolate log checking:
                mockLogger.info.mockClear(); // Clear again just to be sure for localAdapter logs
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                // Use a deep copy for the local adapter's init to avoid any potential shared state issues with the mock object.
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockFullConfigPayload)));
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
                expect(await localAdapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig);
                expect(mockLogger.info).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: LLM configuration 'test-llm-1' (Test LLM 1) set as active by defaultConfigId from file."
                );
            });

            it('should set no default LLM if defaultConfigId is specified but not found in configs during init', async () => {
                mockLogger.warn.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configWithBadDefault = {
                    ...mockFullConfigPayload,
                    defaultConfigId: 'non-existent-default' // Changed
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithBadDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(await localAdapter.getCurrentActiveLlmConfig()).toBeNull();
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    "ConfigurableLLMAdapter: 'defaultConfigId' (\"non-existent-default\") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set." // Changed
                );
            });

            it('should set no default LLM if defaultConfigId is not specified in configs during init', async () => {
                mockLogger.info.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const {defaultConfigId, ...configNoDefaultBase} = mockFullConfigPayload;
                const configNoDefault = {...configNoDefaultBase}; // Ensure 'configs' map is present

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configNoDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(localAdapter.isOperational()).toBe(false);
                expect(localAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                    expect.any(Object)
                );
            });

            it('should NOT warn from #selectInitialActiveLlm about unloaded configs if init proceeds normally and configs are loaded', async () => {
                mockLogger.warn.mockClear();
                mockLogger.info.mockClear();
                const localAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                const configWithNullDefault = { // defaultConfigId is present but null
                    configs: {'some-llm': sampleLlmModelConfig},
                    defaultConfigId: null
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(configWithNullDefault);
                await localAdapter.init({llmConfigLoader: mockLlmConfigLoader});

                expect(localAdapter.isOperational()).toBe(false); // Non-operational because defaultConfigId is not a string
                expect(mockLogger.warn).not.toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter.#selectInitialActiveLlm: Cannot select active LLM because configurations map is not loaded or is invalid.'
                );
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'ConfigurableLLMAdapter: LLM configuration loading returned an unexpected structure.',
                    expect.objectContaining({configResult: configWithNullDefault})
                );
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
        });

        describe('isInitialized() and isOperational()', () => {
            it('isInitialized() should be false before init, true after init attempt', async () => {
                expect(freshAdapter.isInitialized()).toBe(false);
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                    defaultConfigId: "test",
                    configs: {'test': sampleLlmModelConfig}
                });
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isInitialized()).toBe(true);

                const anotherAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true});
                await anotherAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(anotherAdapter.isInitialized()).toBe(true);
            });

            it('isOperational() should be false before init', () => {
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be true after successful init', async () => {
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                    defaultConfigId: "test",
                    configs: {'test': sampleLlmModelConfig}
                });
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isOperational()).toBe(true);
            });

            it('isOperational() should be false after failed init (config load error)', async () => {
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.isOperational()).toBe(false);
            });

            it('isOperational() should be false after failed init (config loader invalid - sync throw)', () => {
                try {
                    freshAdapter.init({llmConfigLoader: null});
                } catch (e) { /* Expected */
                }
                expect(freshAdapter.isOperational()).toBe(false);
            });
        });

        describe('_FOR_TESTING_ONLY Methods', () => {
            const testConfigs = {
                defaultConfigId: 'test-id',
                configs: {'test-id': {...sampleLlmModelConfig, configId: 'test-id'}}
            };

            it('getLoadedConfigs_FOR_TESTING_ONLY() returns null before/failed init, configs after success', async () => {
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();

                mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(testConfigs)));
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(testConfigs);

                const failedInitAdapter = new ConfigurableLLMAdapter({
                    logger: mockLogger, environmentContext: mockEnvironmentContext,
                    apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory
                });
                mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "fail"});
                await failedInitAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(failedInitAdapter.getLoadedConfigs_FOR_TESTING_ONLY()).toBeNull();
            });

            it('getActiveLlmId_FOR_TESTING_ONLY() returns null initially, then active ID, and respects failed setActiveLlm', async () => {
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
                const fullTestConfigs = {
                    defaultConfigId: 'test-id',
                    configs: {
                        'test-id': {...sampleLlmModelConfig, configId: 'test-id'},
                        'another-id': {...sampleLlmModelConfig2, configId: 'another-id'}
                    }
                };
                mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(fullTestConfigs)));
                await freshAdapter.init({llmConfigLoader: mockLlmConfigLoader});
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-id');

                const setResult1 = await freshAdapter.setActiveLlm('another-id');
                expect(setResult1).toBe(true);
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('another-id');

                const setResult2 = await freshAdapter.setActiveLlm('non-existent-llm-id');
                expect(setResult2).toBe(false);
                expect(freshAdapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('another-id');
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
});

// --- FILE END ---