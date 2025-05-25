// tests/turns/adapters/configurableLLMAdapter.management.test.js
// --- FILE START ---

import {jest, beforeEach, describe, expect, it} from '@jest/globals';
import {ConfigurableLLMAdapter, ConfigurationError} from '../../../src/turns/adapters/configurableLLMAdapter.js';
import {CLOUD_API_TYPES} from '../../../src/llms/constants/llmConstants.js';

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

/** @type {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} */
const sampleLlmModelConfig1 = {
    id: 'test-llm-1',
    displayName: 'Test LLM 1',
    apiType: 'openai',
    modelIdentifier: 'gpt-3.5-turbo',
    endpointUrl: 'https://api.openai.com/v1/chat/completions',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.7},
    jsonOutputStrategy: {method: 'native_json'}, // Added for completeness
};

/** @type {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} */
const sampleLlmModelConfig2 = {
    id: 'test-llm-2',
    displayName: 'Test LLM 2 (Cloud)',
    apiType: CLOUD_API_TYPES[0] || 'anthropic',
    modelIdentifier: 'claude-2',
    endpointUrl: 'https://api.anthropic.com/v1/messages',
    promptFrame: {system: "System prompt", user: "User prompt {{gameSummary}}"},
    defaultParameters: {temperature: 0.5},
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    jsonOutputStrategy: {method: 'native_json'}, // Added for completeness
};

/** @type {import('../../../src/services/llmConfigLoader.js').LLMModelConfig} */
const llmConfigNoDisplayName = {
    id: 'llm-no-display',
    apiType: 'openai',
    modelIdentifier: 'gpt-text',
    endpointUrl: 'url3',
    jsonOutputStrategy: {method: 'native_json'}, // Added for completeness
};

describe('ConfigurableLLMAdapter Management Features', () => {
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

    describe('Constructor & Initial LLM Selection Logic', () => {
        it('should successfully instantiate and log environment and initialLlmId from constructor', () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: 'constructor-llm-id'
            });
            expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ConfigurableLLMAdapter: Instance created.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Execution environment: server.'));
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Initial LLM ID from constructor: 'constructor-llm-id'."));
        });

        it('should warn if initialLlmId is provided but invalid (not string, empty)', () => {
            new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: 123
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Constructor received an invalid type for initialLlmId (expected string or null). Received: number. Ignoring."));
            mockLogger.warn.mockClear();

            new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: "   "
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided."));
        });

        it('should use initialLlmId from constructor if valid and found in configs, and log it', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'default-id',
                llms: {
                    'constructor-llm-id': sampleLlmModelConfig1,
                    'default-id': sampleLlmModelConfig2,
                }
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: 'constructor-llm-id'
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('constructor-llm-id');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig1);
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'constructor-llm-id' (Test LLM 1) set as active by initialLlmId."
            );
        });

        it('should fallback to defaultLlmId if initialLlmId (from constructor) is not found, and log correctly', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'default-id',
                llms: {
                    'another-llm': sampleLlmModelConfig1,
                    'default-id': sampleLlmModelConfig2,
                }
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: 'non-existent-constructor-id'
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('default-id');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.#selectInitialActiveLlm: initialLlmId ('non-existent-constructor-id') was provided to constructor, but no LLM configuration with this ID exists. Falling back to defaultLlmId logic."
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'default-id' (Test LLM 2 (Cloud)) set as active by default."
            );
        });

        it('should use defaultLlmId from config if initialLlmId is not provided, and log it', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'default-id',
                llms: {
                    'default-id': sampleLlmModelConfig2,
                }
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                // No initialLlmId here
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('default-id');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'default-id' (Test LLM 2 (Cloud)) set as active by default."
            );
        });

        it('should handle cases where defaultLlmId from config is invalid or not found, and log correctly', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'non-existent-default-id',
                llms: {'some-llm': sampleLlmModelConfig1}
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: 'defaultLlmId' (\"non-existent-default-id\") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set."
            );
        });

        it('should handle cases where defaultLlmId from config is an empty string, and log correctly', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: '   ', // Empty string
                llms: {'some-llm': sampleLlmModelConfig1}
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.#selectInitialActiveLlm: 'defaultLlmId' found in configurations but it is not a valid non-empty string (\"   \")."
            );
            // Also check the more general warning
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.#selectInitialActiveLlm: No default LLM set. Neither initialLlmId nor defaultLlmId resulted in a valid active LLM selection."
            );
        });


        it('should handle cases where both initialLlmId (constructor) and defaultLlmId (config) are missing/invalid, and log correctly', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                // No defaultLlmId
                llms: {'some-llm': sampleLlmModelConfig1}
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: null // Or not provided
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: No "defaultLlmId" specified in configurations. No LLM is set as active by default.'
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.#selectInitialActiveLlm: No default LLM set. Neither initialLlmId nor defaultLlmId resulted in a valid active LLM selection."
            );
        });

        it('should handle no LLMs in config file, log warning, and have no active LLM', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'default-id', // This won't be found
                llms: {} // No LLMs
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger,
                environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider,
                llmStrategyFactory: mockLlmStrategyFactory
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});

            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: 'defaultLlmId' (\"default-id\") is specified in configurations, but no LLM configuration with this ID exists. No default LLM set."
            );
            expect(mockLogger.warn).toHaveBeenCalledWith( // This warning also comes from #selectInitialActiveLlm
                "ConfigurableLLMAdapter.#selectInitialActiveLlm: No LLM configurations found in llmConfigs.llms. No LLM can be set as active."
            );
        });

        it('should log N/A for displayName if not present during initial selection by constructor initialLlmId', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                llms: {'constructor-llm-no-display': llmConfigNoDisplayName}
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
                initialLlmId: 'constructor-llm-no-display'
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'constructor-llm-no-display' (N/A) set as active by initialLlmId."
            );
        });

        it('should log N/A for displayName if not present during initial selection by defaultLlmId', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({
                defaultLlmId: 'default-llm-no-display',
                llms: {'default-llm-no-display': llmConfigNoDisplayName}
            });
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter: LLM configuration 'default-llm-no-display' (N/A) set as active by default."
            );
        });
    });

    describe('setActiveLlm() Method', () => {
        const mockFullConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig1,
                'test-llm-2': sampleLlmModelConfig2,
                'llm-no-display': llmConfigNoDisplayName
            },
        };

        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockFullConfigPayload))); // Deep copy
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
        });

        it('should successfully set an active LLM with a valid ID, update internal state, and log change', async () => {
            const result = await adapter.setActiveLlm('test-llm-2');
            expect(result).toBe(true);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-2');
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(sampleLlmModelConfig2);
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'test-llm-2' (Test LLM 2 (Cloud))."
            );
        });

        it('should log N/A for displayName if not present when successfully setting active LLM', async () => {
            await adapter.setActiveLlm('llm-no-display');
            expect(mockLogger.info).toHaveBeenCalledWith(
                "ConfigurableLLMAdapter.setActiveLlm: Active LLM configuration changed from 'test-llm-1' to 'llm-no-display' (N/A)."
            );
        });

        it('should return false, log error, and not change state if LLM ID is invalid (null, empty string, non-string)', async () => {
            const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
            const initialConfig = await adapter.getCurrentActiveLlmConfig();

            for (const invalidId of [null, '', '   ', 123]) {
                mockLogger.error.mockClear();
                const result = await adapter.setActiveLlm(invalidId);
                expect(result).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `ConfigurableLLMAdapter.setActiveLlm: Invalid llmId provided (must be a non-empty string). Received: '${invalidId}'. Active LLM remains '${initialActiveId || 'none'}'.`
                );
                expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
                expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
            }
        });

        it('should return false, log error, and not change state if LLM ID does not exist', async () => {
            const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
            const initialConfig = await adapter.getCurrentActiveLlmConfig();

            const result = await adapter.setActiveLlm('non-existent-llm');
            expect(result).toBe(false);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
            expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm'. Active LLM remains unchanged ('${initialActiveId || 'none'}').`
            );
        });

        it('should throw error if called before init() (via #ensureInitialized)', async () => {
            const uninitializedAdapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLogger.error.mockClear();
            await expect(uninitializedAdapter.setActiveLlm('test-llm-1'))
                .rejects.toThrow('ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
            );
        });

        it('should throw error if called when adapter is not operational (via #ensureInitialized)', async () => {
            const nonOpAdapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({error: true, message: "config error"});
            await nonOpAdapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(nonOpAdapter.isOperational()).toBe(false);
            mockLogger.error.mockClear(); // Clear init logs

            await expect(nonOpAdapter.setActiveLlm('test-llm-1'))
                .rejects.toThrow('ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.');
            // #ensureInitialized logs its own error, setActiveLlm doesn't log an additional one before re-throwing
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
            );
        });
    });

    describe('getAvailableLlmOptions()', () => {
        const mockConfigsPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig1, // Has displayName
                'test-llm-2': sampleLlmModelConfig2, // Has displayName
                'llm-no-display': llmConfigNoDisplayName // No displayName, should use id
            },
        };

        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
        });

        it('should return correct array of {id, displayName} when operational and configs are loaded', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockConfigsPayload)));
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            mockLogger.warn.mockClear();

            const options = await adapter.getAvailableLlmOptions();
            expect(options).toEqual(expect.arrayContaining([
                {id: 'test-llm-1', displayName: 'Test LLM 1'},
                {id: 'test-llm-2', displayName: 'Test LLM 2 (Cloud)'},
                {id: 'llm-no-display', displayName: 'llm-no-display'} // Fallback to id
            ]));
            expect(options.length).toBe(3);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('should return an empty array if no LLM configurations are found in loaded configs', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({defaultLlmId: null, llms: {}});
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            mockLogger.warn.mockClear();

            const options = await adapter.getAvailableLlmOptions();
            expect(options).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter.getAvailableLlmOptions: No LLM configurations found in this.#llmConfigs.llms. Returning empty array.'
            );
        });

        it('should return empty array and log warning if adapter is not operational', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "config load failed"});
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.isOperational()).toBe(false);
            mockLogger.warn.mockClear(); // Clear init logs

            const options = await adapter.getAvailableLlmOptions();
            expect(options).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options.')
            );
        });

        it('should return empty array if called before init', async () => {
            // For uninitialized adapter, #ensureInitialized will throw, caught by getAvailableLlmOptions
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear(); // Also clear error for #ensureInitialized log

            const options = await adapter.getAvailableLlmOptions();
            expect(options).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options.')
            );
            // And #ensureInitialized would have logged an error
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
            );
        });
    });

    describe('getCurrentActiveLlmId()', () => {
        const mockConfigsPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {'test-llm-1': sampleLlmModelConfig1},
        };

        beforeEach(async () => {
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
        });

        it('should return the correct active LLM ID string when an LLM is active', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(JSON.parse(JSON.stringify(mockConfigsPayload)));
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(await adapter.getCurrentActiveLlmId()).toBe('test-llm-1');

            // Change active LLM
            const newConfigs = {
                defaultLlmId: 'test-llm-1',
                llms: {
                    'test-llm-1': sampleLlmModelConfig1,
                    'test-llm-new': sampleLlmModelConfig2,
                }
            };
            mockLlmConfigLoader.loadConfigs.mockResolvedValue(newConfigs); // For re-init logic if that was tested, but here we use setActiveLlm
            // Re-init adapter with new default for clarity of change
            adapter = new ConfigurableLLMAdapter({
                logger: mockLogger, environmentContext: mockEnvironmentContext,
                apiKeyProvider: mockApiKeyProvider, llmStrategyFactory: mockLlmStrategyFactory,
            });
            await adapter.init({llmConfigLoader: mockLlmConfigLoader}); // init with test-llm-1 active
            await adapter.setActiveLlm('test-llm-new');
            expect(await adapter.getCurrentActiveLlmId()).toBe('test-llm-new');
        });

        it('should return null if no LLM is active (e.g. no default, no setActiveLlm)', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({llms: {'some-llm': sampleLlmModelConfig1}}); // No defaultLlmId
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(await adapter.getCurrentActiveLlmId()).toBeNull();
        });

        it('should return null and log warning if adapter is not operational', async () => {
            mockLlmConfigLoader.loadConfigs.mockResolvedValue({error: true, message: "config load failed"});
            await adapter.init({llmConfigLoader: mockLlmConfigLoader});
            expect(adapter.isOperational()).toBe(false);
            mockLogger.warn.mockClear(); // Clear init logs

            const activeId = await adapter.getCurrentActiveLlmId();
            expect(activeId).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID.')
            );
        });

        it('should return null if called before init', async () => {
            // For uninitialized adapter, #ensureInitialized will throw, caught by getCurrentActiveLlmId
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear(); // Also clear error for #ensureInitialized log

            const activeId = await adapter.getCurrentActiveLlmId();
            expect(activeId).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID.')
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
            );
        });
    });

    // Tests for init, dependency validation in constructor etc. are mostly from the provided base
    // Ensure they align with ticket details, especially logging.
    describe('Constructor (Dependency Validation - inherited from original test structure)', () => {
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
        // Add other constructor dependency validation tests as originally present if they are not redundant with above.
    });

    describe('init() Method (Coverage for operational states - inherited)', () => {
        const mockSuccessConfigPayload = {
            defaultLlmId: 'test-llm-1',
            llms: {
                'test-llm-1': sampleLlmModelConfig1,
                'test-llm-2': sampleLlmModelConfig2,
            },
        };
        beforeEach(() => { // Local beforeEach for init tests needing fresh adapter
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
            expect(adapter.isOperational()).toBe(true);
            expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(mockSuccessConfigPayload);
            expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Actual asynchronous initialization started'));
            expect(mockLogger.info).toHaveBeenCalledWith(
                'ConfigurableLLMAdapter: LLM configurations loaded successfully.',
                expect.objectContaining({numberOfConfigs: 2, defaultLlmId: 'test-llm-1'})
            );
            // Specific check for default LLM selection log is in 'Constructor & Initial LLM Selection Logic'
            expect(mockLogger.info).toHaveBeenCalledWith('ConfigurableLLMAdapter: Initialization attempt complete and adapter is operational.');
        });
        // Add other relevant init tests ensuring all AC for init are covered.
    });
});

// --- FILE END ---