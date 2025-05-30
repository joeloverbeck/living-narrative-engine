// tests/services/promptBuilder.test.js
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

    describe('Dynamic Configuration Selection (_findConfiguration)', () => {
        const exactMatchConfig = {
            configId: "exact_cfg", modelIdentifier: "vendor/model-exact-match",
            promptElements: [{key: "test", prefix: "Exact:"}], promptAssemblyOrder: ["test"]
        };
        const shortWildcardConfig = {
            configId: "short_wild_cfg", modelIdentifier: "vendor/*",
            promptElements: [{key: "test", prefix: "ShortWild:"}], promptAssemblyOrder: ["test"]
        };
        const mediumWildcardConfig = {
            configId: "medium_wild_cfg", modelIdentifier: "vendor/model-*",
            promptElements: [{key: "test", prefix: "MediumWild:"}], promptAssemblyOrder: ["test"]
        };
        const longWildcardConfig = {
            configId: "long_wild_cfg", modelIdentifier: "vendor/model-exact*",
            promptElements: [{key: "test", prefix: "LongWild:"}], promptAssemblyOrder: ["test"]
        };
        const anotherLongWildcardConfig = {
            configId: "another_long_wild_cfg", modelIdentifier: "vendor/model-extra*",
            promptElements: [{key: "test", prefix: "AnotherLongWild:"}], promptAssemblyOrder: ["test"]
        };
        const unrelatedConfig = {
            configId: "unrelated_cfg", modelIdentifier: "other-vendor/other-model",
            promptElements: [{key: "test", prefix: "Unrelated:"}], promptAssemblyOrder: ["test"]
        };

        // Order can matter for tie-breaking same-length wildcards if their patterns were identical
        // but here patterns are different, so longest prefix rule is dominant.
        const allConfigs = [exactMatchConfig, shortWildcardConfig, mediumWildcardConfig, longWildcardConfig, anotherLongWildcardConfig, unrelatedConfig];

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: allConfigs});
        });

        test('should select configuration by exact modelIdentifier match', async () => {
            const result = await promptBuilder.build("vendor/model-exact-match", {testContent: "data"});
            expect(result).toBe("Exact:data");
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected exact match configId "${exactMatchConfig.configId}"`));
        });

        test('should select configuration by wildcard match if no exact match', async () => {
            const result = await promptBuilder.build("vendor/model-wildcard-test", {testContent: "data"});
            expect(result).toBe("MediumWild:data"); // "vendor/model-*" is more specific than "vendor/*"
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match configId "${mediumWildcardConfig.configId}"`));
        });

        test('exact match should take precedence over wildcard match', async () => {
            const result = await promptBuilder.build("vendor/model-exact-match", {testContent: "data"});
            expect(result).toBe("Exact:data");
        });

        test('longer wildcard prefix should take precedence over shorter wildcard prefix', async () => {
            const result = await promptBuilder.build("vendor/model-exact-specific", {testContent: "data"});
            expect(result).toBe("LongWild:data"); // "vendor/model-exact*" > "vendor/model-*" > "vendor/*"
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match configId "${longWildcardConfig.configId}"`));
        });

        test('should correctly pick between multiple matching wildcards based on longest prefix', async () => {
            const result = await promptBuilder.build("vendor/model-extracool", {testContent: "data"});
            // "vendor/model-extra*" (prefix "vendor/model-extra") vs "vendor/model-*" (prefix "vendor/model-")
            expect(result).toBe("AnotherLongWild:data");
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match configId "${anotherLongWildcardConfig.configId}"`));
        });

        test('should return empty string and log error if no configuration matches', async () => {
            const result = await promptBuilder.build("non-existent-vendor/non-existent-model", {testContent: "data"});
            expect(result).toBe("");
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No configuration found for llmId "non-existent-vendor/non-existent-model"'));
        });

        test('should correctly handle llmId shorter than some wildcard prefixes but matching a general one', async () => {
            const result = await promptBuilder.build("vendor/mode", {testContent: "data"});
            expect(result).toBe("ShortWild:data"); // Matches "vendor/*"
        });

        test('wildcard should not match if llmId does not start with prefix', async () => {
            const result = await promptBuilder.build("different-vendor/model-exact-plus", {testContent: "data"});
            expect(result).toBe("");
        });
    });
});

// --- FILE END ---