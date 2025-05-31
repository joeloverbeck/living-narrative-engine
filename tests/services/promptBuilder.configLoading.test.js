// tests/services/promptBuilder.configLoading.test.js
// --- FILE START ---
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {PromptBuilder} from '../../src/services/promptBuilder.js';
import {LLMConfigService} from '../../src/services/llmConfigService.js';
import {HttpConfigurationProvider} from '../../src/services/httpConfigurationProvider.js';
import {PlaceholderResolver} from '../../src/utils/placeholderResolver.js'; // For mocking
// Import assembler types for JSDoc
/** @typedef {import('../../src/services/promptElementAssemblers/StandardElementAssembler.js').StandardElementAssembler} StandardElementAssembler */
/** @typedef {import('../../src/services/promptElementAssemblers/PerceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler */


/**
 * @typedef {import('../../src/services/llmConfigService.js').LLMConfig} LLMConfig
 * @typedef {import('../../src/services/promptBuilder.js').PromptData} PromptData
 * @typedef {import('../../src/services/promptBuilder.js').PerceptionLogEntry} PerceptionLogEntry
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 */

/** @returns {jest.Mocked<ILogger>} */
const mockLoggerInstance = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
    resolve: jest.fn((str, ...dataSources) => { // Basic mock implementation
        let resolvedStr = str;
        if (str && dataSources.length > 0) {
            const regex = /{([^{}]+)}/g;
            resolvedStr = str.replace(regex, (match, placeholderKey) => {
                const trimmedKey = placeholderKey.trim();
                for (const dataSource of dataSources) {
                    if (dataSource && typeof dataSource === 'object' && Object.prototype.hasOwnProperty.call(dataSource, trimmedKey)) {
                        const value = dataSource[trimmedKey];
                        return value !== null && value !== undefined ? String(value) : '';
                    }
                }
                return '';
            });
        }
        return resolvedStr;
    }),
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(""),
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(""),
});


const MOCK_CONFIG_FILE_PATH = './test-llm-configs.json';

/** @type {LLMConfig} */
const MOCK_CONFIG_1 = {
    configId: "test_config_v1",
    modelIdentifier: "test-vendor/test-model-exact",
    promptElements: [
        {key: "system_prompt", prefix: "System: ", suffix: "\n"},
        {key: "user_query", prefix: "User: ", suffix: "\n"}
    ],
    promptAssemblyOrder: ["system_prompt", "user_query"]
};

/** @type {LLMConfig} */
const MOCK_CONFIG_2 = {
    configId: "test_config_v2_wildcard",
    modelIdentifier: "test-vendor/wildcard*",
    promptElements: [{key: "instruction", prefix: "Instruction Wildcard: "}],
    promptAssemblyOrder: ["instruction"]
};


describe('PromptBuilder interaction with LLMConfigService for Configuration Loading', () => {
    /** @type {jest.Mocked<ILogger>} */
    let logger;
    /** @type {jest.Mocked<PlaceholderResolver>} */
    let mockPlaceholderResolver;
    /** @type {jest.Mocked<StandardElementAssembler>} */
    let mockStandardAssembler;
    /** @type {jest.Mocked<PerceptionLogAssembler>} */
    let mockPerceptionLogAssembler;
    /** @type {LLMConfigService} */
    let llmConfigService;
    /** @type {PromptBuilder} */
    let promptBuilder;
    /** @type {jest.SpiedFunction<typeof fetch>} */
    let fetchSpy;


    beforeEach(() => {
        logger = mockLoggerInstance();
        mockPlaceholderResolver = mockPlaceholderResolverInstance();
        mockStandardAssembler = mockStandardElementAssemblerInstance();
        mockPerceptionLogAssembler = mockPerceptionLogAssemblerInstance();
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Configuration Loading and Caching (via LLMConfigService)', () => {
        test('should load configurations from file successfully on first build call', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => ({
                    defaultConfigId: MOCK_CONFIG_1.configId,
                    configs: {
                        [MOCK_CONFIG_1.configId]: MOCK_CONFIG_1,
                        [MOCK_CONFIG_2.configId]: MOCK_CONFIG_2,
                    }
                }),
                status: 200,
                statusText: "OK"
            }));

            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            await promptBuilder.build(MOCK_CONFIG_1.configId, {systemPromptContent: "Hello"});

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(fetchSpy).toHaveBeenCalledWith(MOCK_CONFIG_FILE_PATH);
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`LLMConfigService.#loadAndCacheConfigurationsFromSource: Successfully loaded and cached 2 configurations from ${MOCK_CONFIG_FILE_PATH}. 0 invalid configs skipped.`)
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(2);
            expect(llmConfigService.getLlmConfigsCacheForTest().get(MOCK_CONFIG_1.configId)).toEqual(MOCK_CONFIG_1);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle fetch error when loading configurations', async () => {
            const errorMessage = `Failed to fetch configuration file from ${MOCK_CONFIG_FILE_PATH}: Not Found`;
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: false,
                status: 404,
                statusText: "Not Found"
            }));

            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);

            expect(logger.error).toHaveBeenCalledWith(
                `HttpConfigurationProvider: Failed to fetch configuration from ${MOCK_CONFIG_FILE_PATH}. Status: 404 Not Found`
            );
            expect(logger.error).toHaveBeenCalledWith(
                `LLMConfigService.#loadAndCacheConfigurationsFromSource: Error loading or parsing configurations from ${MOCK_CONFIG_FILE_PATH}. Detail: ${errorMessage}`,
                expect.objectContaining({
                    error: expect.objectContaining({message: errorMessage})
                })
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle network error (fetch throws) when loading configurations', async () => {
            const networkError = new Error("Network failure");
            fetchSpy.mockRejectedValueOnce(networkError);

            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            // This log can come from HttpConfigurationProvider or LLMConfigService depending on how error is wrapped/rethrown
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error loading or parsing configuration from ${MOCK_CONFIG_FILE_PATH}. Detail: ${networkError.message}`),
                expect.objectContaining({error: networkError})
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });


        test('should handle malformed JSON when loading configurations', async () => {
            const syntaxError = new SyntaxError("Unexpected token");
            // The HttpConfigurationProvider will make the detail message more specific
            const detailErrorMessage = `Failed to parse configuration data from ${MOCK_CONFIG_FILE_PATH} as JSON: ${syntaxError.message}`;

            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => {
                    throw syntaxError;
                },
                status: 200,
                statusText: "OK"
            }));
            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                `HttpConfigurationProvider: Failed to parse JSON response from ${MOCK_CONFIG_FILE_PATH}.`,
                expect.objectContaining({error: syntaxError.message}) // HttpConfig provider logs original error message part
            );
            expect(logger.error).toHaveBeenCalledWith(
                `LLMConfigService.#loadAndCacheConfigurationsFromSource: Error loading or parsing configurations from ${MOCK_CONFIG_FILE_PATH}. Detail: ${detailErrorMessage}`,
                expect.objectContaining({
                    error: expect.objectContaining({message: detailErrorMessage})
                })
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle non-object JSON or missing "configs" property in RootLLMConfigsFile', async () => {
            const badJsonData = {"not": "the right structure"};
            const detailErrorMessage = 'Invalid configuration data structure received from provider.';
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => (badJsonData),
                status: 200,
                statusText: "OK"
            }));
            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                'LLMConfigService.#loadAndCacheConfigurationsFromSource: Fetched data is not in the expected RootLLMConfigsFile format or "configs" map is missing/invalid.',
                expect.objectContaining({source: MOCK_CONFIG_FILE_PATH, receivedData: badJsonData})
            );
            expect(logger.error).toHaveBeenCalledWith(
                `LLMConfigService.#loadAndCacheConfigurationsFromSource: Error loading or parsing configurations from ${MOCK_CONFIG_FILE_PATH}. Detail: ${detailErrorMessage}`,
                expect.objectContaining({
                    error: expect.objectContaining({message: detailErrorMessage})
                })
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should skip invalid configuration objects during file load but load valid ones', async () => {
            const invalidConfig = {configId: "invalid_cfg"};
            const validConfig = MOCK_CONFIG_1;
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => ({
                    defaultConfigId: "any",
                    configs: {
                        [validConfig.configId]: validConfig,
                        "some_key_for_invalid": invalidConfig,
                        [MOCK_CONFIG_2.configId]: MOCK_CONFIG_2,
                    }
                }),
                status: 200,
                statusText: "OK"
            }));

            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            await promptBuilder.build(MOCK_CONFIG_1.configId, {systemPromptContent: "Test"});

            expect(logger.warn).toHaveBeenCalledWith(
                `LLMConfigService.#loadAndCacheConfigurationsFromSource: Skipping invalid or incomplete configuration object during source load.`,
                expect.objectContaining({configKey: "some_key_for_invalid", configData: invalidConfig})
            );
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(2);
            expect(llmConfigService.getLlmConfigsCacheForTest().has(validConfig.configId)).toBe(true);
            expect(llmConfigService.getLlmConfigsCacheForTest().has(MOCK_CONFIG_2.configId)).toBe(true);
            expect(llmConfigService.getLlmConfigsCacheForTest().has("invalid_cfg")).toBe(false);
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`LLMConfigService.#loadAndCacheConfigurationsFromSource: Successfully loaded and cached 2 configurations from ${MOCK_CONFIG_FILE_PATH}. 1 invalid configs skipped.`)
            );
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });


        test('should warn and not fetch if configSourceIdentifier is not set and no initial configs', async () => {
            const mockProvider = {fetchData: jest.fn()};
            llmConfigService = new LLMConfigService({logger, configurationProvider: mockProvider});
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            await promptBuilder.build("any-llm-id", {});

            expect(mockProvider.fetchData).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith('LLMConfigService.#ensureConfigsLoaded: No configSourceIdentifier set and no initial configurations were loaded. Cache is empty. Marking as loaded/attempted.');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "any-llm-id"'));
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should not attempt to load from file if initialConfigs were provided to LLMConfigService and no configSourceIdentifier', async () => {
            const mockProvider = {fetchData: jest.fn()};
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: mockProvider,
                initialConfigs: [MOCK_CONFIG_1]
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            // Check initial log from constructor
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LLMConfigService: Processing 1 initial configurations.'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LLMConfigService: Successfully loaded 1 initial configurations into cache.'));
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);


            // Clear mock calls from constructor before build
            logger.info.mockClear();
            logger.debug.mockClear();


            await promptBuilder.build(MOCK_CONFIG_1.configId, {systemPromptContent: "Test"});
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(mockProvider.fetchData).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith('LLMConfigService.#ensureConfigsLoaded: Configurations previously loaded and cache is populated. Skipping load.');
        });


        test('resetCache on LLMConfigService should clear its cache and reset its loaded flag', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({ // For first load
                ok: true,
                json: async () => ({
                    defaultConfigId: MOCK_CONFIG_1.configId,
                    configs: {[MOCK_CONFIG_1.configId]: MOCK_CONFIG_1}
                }),
                status: 200,
                statusText: "OK"
            }));
            const httpProvider = new HttpConfigurationProvider({logger});
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: httpProvider,
                configSourceIdentifier: MOCK_CONFIG_FILE_PATH
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            await promptBuilder.build(MOCK_CONFIG_1.configId, {systemPromptContent: "Test"});
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(1);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);

            // Clear info logs from the initial load before calling resetCache
            logger.info.mockClear();

            llmConfigService.resetCache();
            expect(logger.info).toHaveBeenCalledWith('LLMConfigService: Cache cleared and loaded state reset. Configurations will be reloaded from source on next request if source is configured.');
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);

            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => ({
                    defaultConfigId: MOCK_CONFIG_2.configId,
                    configs: {[MOCK_CONFIG_2.configId]: MOCK_CONFIG_2}
                }),
                status: 200,
                statusText: "OK"
            }));
            await promptBuilder.build(MOCK_CONFIG_2.configId, {instructionContent: "Test"});

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(1);
            expect(llmConfigService.getLlmConfigsCacheForTest().has(MOCK_CONFIG_2.configId)).toBe(true);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('addOrUpdateConfigs on LLMConfigService should add new and update existing configurations', () => {
            const mockProvider = {fetchData: jest.fn()};
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: mockProvider,
                initialConfigs: [MOCK_CONFIG_1]
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(1);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);

            // Clear info logs from initial load
            logger.info.mockClear();

            const updatedMockConfig1 = {...MOCK_CONFIG_1, modelIdentifier: "new-model-id"};
            const newConfig = MOCK_CONFIG_2;

            llmConfigService.addOrUpdateConfigs([updatedMockConfig1, newConfig]);
            expect(logger.info).toHaveBeenCalledWith('LLMConfigService.addOrUpdateConfigs: Processed 2 configs: 1 added, 1 updated, 0 skipped.');
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(2);
            expect(llmConfigService.getLlmConfigsCacheForTest().get(MOCK_CONFIG_1.configId)?.modelIdentifier).toBe("new-model-id");
            expect(llmConfigService.getLlmConfigsCacheForTest().get(MOCK_CONFIG_2.configId)).toEqual(newConfig);
        });

        test('addOrUpdateConfigs on LLMConfigService should handle empty array and skip invalid configs', () => {
            const mockProvider = {fetchData: jest.fn()};
            llmConfigService = new LLMConfigService({logger, configurationProvider: mockProvider});
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);
            logger.info.mockClear(); // Clear init logs

            llmConfigService.addOrUpdateConfigs([]);
            expect(logger.info).toHaveBeenCalledWith('LLMConfigService.addOrUpdateConfigs: No new or valid configurations to add/update from the provided array (length 0).');
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);

            logger.warn.mockClear(); // Clear before next call
            logger.info.mockClear();

            const invalidConfig = {configId: "no_model_id"};
            llmConfigService.addOrUpdateConfigs([invalidConfig, MOCK_CONFIG_1]);
            expect(logger.warn).toHaveBeenCalledWith('LLMConfigService.addOrUpdateConfigs: Skipping invalid configuration object.', {configAttempted: invalidConfig});
            expect(logger.info).toHaveBeenCalledWith('LLMConfigService.addOrUpdateConfigs: Processed 2 configs: 1 added, 0 updated, 1 skipped.');
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(1);
            expect(llmConfigService.getLlmConfigsCacheForTest().has(MOCK_CONFIG_1.configId)).toBe(true);
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('addOrUpdateConfigs on LLMConfigService should log if input is not an array', () => {
            const mockProvider = {fetchData: jest.fn()};
            llmConfigService = new LLMConfigService({logger, configurationProvider: mockProvider});
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            // @ts-ignore
            llmConfigService.addOrUpdateConfigs("not an array");
            expect(logger.error).toHaveBeenCalledWith('LLMConfigService.addOrUpdateConfigs: Input must be an array of LLMConfig objects.');
            expect(llmConfigService.getLlmConfigsCacheForTest().size).toBe(0);
        });

        test('build returns empty string if LLMConfigService provides no config after attempted load', async () => {
            const mockProvider = {fetchData: jest.fn().mockResolvedValue({configs: {}})};
            llmConfigService = new LLMConfigService({
                logger,
                configurationProvider: mockProvider,
                configSourceIdentifier: "dummy-path"
            });
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });

            const result = await promptBuilder.build('some-id', {someContent: 'data'});
            expect(result).toBe("");

            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('LLMConfigService.#loadAndCacheConfigurationsFromSource: No valid configurations found or loaded from the "configs" map in dummy-path. 0 invalid configs skipped. Cache is empty.'));
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "some-id". Cannot build prompt.');
            expect(llmConfigService.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });
    });
});

// --- FILE END ---