// tests/services/promptBuilder.configLoading.test.js
// --- FILE START ---
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {PromptBuilder} from '../../src/services/promptBuilder.js';

/**
 * @typedef {import('../../src/services/promptBuilder.js').LLMConfig} LLMConfig
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


describe('PromptBuilder', () => {
    /** @type {jest.Mocked<ILogger>} */
    let logger;
    /** @type {PromptBuilder} */
    let promptBuilder;
    /** @type {jest.SpiedFunction<typeof fetch>} */
    let fetchSpy;


    beforeEach(() => {
        logger = mockLoggerInstance();
        // Ensure `fetch` is spied on and can be restored.
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores all mocks, including fetchSpy
    });

    describe('Configuration Loading and Caching (#fetchAndCacheConfigurations, #ensureConfigsLoaded)', () => {
        test('should load configurations from file successfully on first build call', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => [MOCK_CONFIG_1, MOCK_CONFIG_2],
                status: 200,
                statusText: "OK"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            await promptBuilder.build("test-vendor/test-model-exact", {systemPromptContent: "Hello"});

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(fetchSpy).toHaveBeenCalledWith(MOCK_CONFIG_FILE_PATH);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`PromptBuilder: Successfully loaded and cached 2 configurations from ${MOCK_CONFIG_FILE_PATH}`));
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(2);
            expect(promptBuilder.getLlmConfigsCacheForTest().get(MOCK_CONFIG_1.configId)).toEqual(MOCK_CONFIG_1);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle fetch error when loading configurations', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: false,
                status: 404,
                statusText: "Not Found"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                `PromptBuilder: Failed to fetch llm-configs.json from ${MOCK_CONFIG_FILE_PATH}. Status: 404 Not Found`
            );
            expect(logger.error).toHaveBeenCalledWith(
                'PromptBuilder: Error loading or parsing llm-configs.json.',
                expect.objectContaining({path: MOCK_CONFIG_FILE_PATH})
            );
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle network error (fetch throws) when loading configurations', async () => {
            const networkError = new Error("Network failure");
            fetchSpy.mockRejectedValueOnce(networkError);
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                'PromptBuilder: Error loading or parsing llm-configs.json.',
                expect.objectContaining({path: MOCK_CONFIG_FILE_PATH, error: networkError})
            );
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });


        test('should handle malformed JSON when loading configurations', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => {
                    throw new SyntaxError("Unexpected token");
                },
                status: 200,
                statusText: "OK"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                'PromptBuilder: Error loading or parsing llm-configs.json.',
                expect.objectContaining({path: MOCK_CONFIG_FILE_PATH, error: expect.any(SyntaxError)})
            );
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should handle non-array JSON when loading configurations', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => ({"not": "an array"}),
                status: 200,
                statusText: "OK"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            const result = await promptBuilder.build("any-llm-id", {});
            expect(result).toBe("");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder: Loaded configuration data is not an array.', {data: {"not": "an array"}});
            expect(logger.error).toHaveBeenCalledWith(
                'PromptBuilder: Error loading or parsing llm-configs.json.',
                expect.objectContaining({path: MOCK_CONFIG_FILE_PATH, error: expect.any(Error)}) // Error is "Configuration data must be an array."
            );
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should skip invalid configuration objects during file load but load valid ones', async () => {
            const invalidConfig = {configId: "invalid_cfg"}; // Missing other required fields
            const validConfig = MOCK_CONFIG_1;
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => [validConfig, invalidConfig, MOCK_CONFIG_2],
                status: 200,
                statusText: "OK"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            await promptBuilder.build("test-vendor/test-model-exact", {systemPromptContent: "Test"});

            expect(logger.warn).toHaveBeenCalledWith(
                'PromptBuilder: Skipping invalid or incomplete configuration object during file load.',
                {config: invalidConfig}
            );
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(2);
            expect(promptBuilder.getLlmConfigsCacheForTest().has(validConfig.configId)).toBe(true);
            expect(promptBuilder.getLlmConfigsCacheForTest().has(MOCK_CONFIG_2.configId)).toBe(true);
            expect(promptBuilder.getLlmConfigsCacheForTest().has("invalid_cfg")).toBe(false);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`PromptBuilder: Successfully loaded and cached 2 configurations from ${MOCK_CONFIG_FILE_PATH}`));
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });


        test('should warn and not fetch if configFilePath is not set and no initial configs', async () => {
            promptBuilder = new PromptBuilder({logger}); // No configFilePath, no initialConfigs
            await promptBuilder.build("any-llm-id", {});
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith('PromptBuilder.#ensureConfigsLoaded: No configFilePath set and no initial configurations loaded. PromptBuilder may not function correctly.');
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: No configurations available. Cannot build prompt.');
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('should not attempt to load from file if initialConfigs were provided and no configFilePath', async () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [MOCK_CONFIG_1]});
            // #configsLoadedOrAttempted should be true due to initialConfigs
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PromptBuilder initialized with 1 preloaded configurations.'));

            await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, {systemPromptContent: "Test"});
            expect(fetchSpy).not.toHaveBeenCalled();
            // This debug log means it recognized configs were already there (from initialConfigs)
            expect(logger.debug).toHaveBeenCalledWith('PromptBuilder.#ensureConfigsLoaded: Configurations already loaded or load attempt was made and cache is not empty.');
        });


        test('resetConfigurationCache should clear cache and reset loaded flag', async () => {
            fetchSpy.mockResolvedValueOnce(Promise.resolve({ // For first load
                ok: true,
                json: async () => [MOCK_CONFIG_1],
                status: 200,
                statusText: "OK"
            }));
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});

            await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, {systemPromptContent: "Test"}); // Loads MOCK_CONFIG_1
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(1);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);

            promptBuilder.resetConfigurationCache();
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder: Configuration cache cleared and loaded state reset.');
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);

            // Setup fetch for the second load attempt
            fetchSpy.mockResolvedValueOnce(Promise.resolve({
                ok: true,
                json: async () => [MOCK_CONFIG_2], // Load a different config
                status: 200,
                statusText: "OK"
            }));
            await promptBuilder.build(MOCK_CONFIG_2.modelIdentifier, {instructionContent: "Test"}); // Should trigger fetch again

            expect(fetchSpy).toHaveBeenCalledTimes(2); // Called once for initial load, once after reset
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(1);
            expect(promptBuilder.getLlmConfigsCacheForTest().has(MOCK_CONFIG_2.configId)).toBe(true);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('addOrUpdateConfigs should add new and update existing configurations', () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [MOCK_CONFIG_1]});
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(1);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true); // Due to initialConfigs

            const updatedMockConfig1 = {
                ...MOCK_CONFIG_1,
                modelIdentifier: "new-model-id",
                promptElements: MOCK_CONFIG_1.promptElements, // Ensure these are copied if not deeply spread
                promptAssemblyOrder: MOCK_CONFIG_1.promptAssemblyOrder
            };
            const newConfig = MOCK_CONFIG_2;

            promptBuilder.addOrUpdateConfigs([updatedMockConfig1, newConfig]);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder.addOrUpdateConfigs: Loaded 1 new, updated 1 existing configurations.');
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(2);
            expect(promptBuilder.getLlmConfigsCacheForTest().get(MOCK_CONFIG_1.configId)?.modelIdentifier).toBe("new-model-id");
            expect(promptBuilder.getLlmConfigsCacheForTest().get(MOCK_CONFIG_2.configId)).toEqual(newConfig);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });

        test('addOrUpdateConfigs should handle empty array and skip invalid configs', () => {
            promptBuilder = new PromptBuilder({logger});
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false); // Initially false

            promptBuilder.addOrUpdateConfigs([]);
            // Original code does not log for (0 new, 0 updated)
            expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Loaded 0 new, updated 0 existing configurations.'));
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false); // Still false as no valid configs added

            const invalidConfig = {configId: "no_model_id"}; // Missing modelIdentifier and other required fields
            promptBuilder.addOrUpdateConfigs([invalidConfig, MOCK_CONFIG_1]);
            // FIX: Updated expected warning message
            expect(logger.warn).toHaveBeenCalledWith('PromptBuilder.addOrUpdateConfigs: Skipping invalid configuration object.', {config: invalidConfig});
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(1);
            expect(promptBuilder.getLlmConfigsCacheForTest().has(MOCK_CONFIG_1.configId)).toBe(true);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true); // Becomes true after MOCK_CONFIG_1 is added
        });

        test('addOrUpdateConfigs should log if input is not an array', () => {
            promptBuilder = new PromptBuilder({logger});
            // @ts-ignore
            promptBuilder.addOrUpdateConfigs("not an array");
            // FIX: Updated expected error message
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.addOrUpdateConfigs: Input must be an array.');
            expect(promptBuilder.getLlmConfigsCacheForTest().size).toBe(0);
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);
        });

        test('build returns empty string if no configs and no filepath after attempted load', async () => {
            promptBuilder = new PromptBuilder({logger}); // No path, no initial
            const result = await promptBuilder.build('some-id', {someContent: 'data'});
            expect(result).toBe("");
            expect(logger.warn).toHaveBeenCalledWith('PromptBuilder.#ensureConfigsLoaded: No configFilePath set and no initial configurations loaded. PromptBuilder may not function correctly.');
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: No configurations available. Cannot build prompt.');
            expect(promptBuilder.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
        });
    });
});

// --- FILE END ---