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
    config_id: "test_config_v1",
    model_identifier: "test-vendor/test-model-exact",
    prompt_elements: [
        {key: "system_prompt", prefix: "System: ", suffix: "\n"},
        {key: "user_query", prefix: "User: ", suffix: "\n"}
    ],
    prompt_assembly_order: ["system_prompt", "user_query"]
};

/** @type {LLMConfig} */
const MOCK_CONFIG_2 = {
    config_id: "test_config_v2_wildcard",
    model_identifier: "test-vendor/wildcard*",
    prompt_elements: [{key: "instruction", prefix: "Instruction Wildcard: "}],
    prompt_assembly_order: ["instruction"]
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
            config_id: "exact_cfg", model_identifier: "vendor/model-exact-match",
            prompt_elements: [{key: "test", prefix: "Exact:"}], prompt_assembly_order: ["test"]
        };
        const shortWildcardConfig = {
            config_id: "short_wild_cfg", model_identifier: "vendor/*",
            prompt_elements: [{key: "test", prefix: "ShortWild:"}], prompt_assembly_order: ["test"]
        };
        const mediumWildcardConfig = {
            config_id: "medium_wild_cfg", model_identifier: "vendor/model-*",
            prompt_elements: [{key: "test", prefix: "MediumWild:"}], prompt_assembly_order: ["test"]
        };
        const longWildcardConfig = {
            config_id: "long_wild_cfg", model_identifier: "vendor/model-exact*",
            prompt_elements: [{key: "test", prefix: "LongWild:"}], prompt_assembly_order: ["test"]
        };
        const anotherLongWildcardConfig = {
            config_id: "another_long_wild_cfg", model_identifier: "vendor/model-extra*",
            prompt_elements: [{key: "test", prefix: "AnotherLongWild:"}], prompt_assembly_order: ["test"]
        };
        const unrelatedConfig = {
            config_id: "unrelated_cfg", model_identifier: "other-vendor/other-model",
            prompt_elements: [{key: "test", prefix: "Unrelated:"}], prompt_assembly_order: ["test"]
        };

        // Order can matter for tie-breaking same-length wildcards if their patterns were identical
        // but here patterns are different, so longest prefix rule is dominant.
        const allConfigs = [exactMatchConfig, shortWildcardConfig, mediumWildcardConfig, longWildcardConfig, anotherLongWildcardConfig, unrelatedConfig];

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: allConfigs});
        });

        test('should select configuration by exact model_identifier match', async () => {
            const result = await promptBuilder.build("vendor/model-exact-match", {testContent: "data"});
            expect(result).toBe("Exact:data");
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected exact match config_id "${exactMatchConfig.config_id}"`));
        });

        test('should select configuration by wildcard match if no exact match', async () => {
            const result = await promptBuilder.build("vendor/model-wildcard-test", {testContent: "data"});
            expect(result).toBe("MediumWild:data"); // "vendor/model-*" is more specific than "vendor/*"
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match config_id "${mediumWildcardConfig.config_id}"`));
        });

        test('exact match should take precedence over wildcard match', async () => {
            const result = await promptBuilder.build("vendor/model-exact-match", {testContent: "data"});
            expect(result).toBe("Exact:data");
        });

        test('longer wildcard prefix should take precedence over shorter wildcard prefix', async () => {
            const result = await promptBuilder.build("vendor/model-exact-specific", {testContent: "data"});
            expect(result).toBe("LongWild:data"); // "vendor/model-exact*" > "vendor/model-*" > "vendor/*"
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match config_id "${longWildcardConfig.config_id}"`));
        });

        test('should correctly pick between multiple matching wildcards based on longest prefix', async () => {
            const result = await promptBuilder.build("vendor/model-extracool", {testContent: "data"});
            // "vendor/model-extra*" (prefix "vendor/model-extra") vs "vendor/model-*" (prefix "vendor/model-")
            expect(result).toBe("AnotherLongWild:data");
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Selected wildcard match config_id "${anotherLongWildcardConfig.config_id}"`));
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