// tests/services/promptBuilder.dynamicConfigSelection.test.js
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

// const MOCK_CONFIG_FILE_PATH = './test-llm-configs.json'; // Not used in this suite

// These MOCK_CONFIGs are not directly used by tests in this file but kept for potential context or future use
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
    let fetchSpy; // Not used by these tests as they use initialConfigs


    beforeEach(() => {
        logger = mockLoggerInstance();
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

        // This config has the same modelIdentifier as exactMatchConfig, but different configId.
        // Used to test that llmId passed to build should ideally be a configId for direct match.
        const configIdPriorityConfig = {
            configId: "priority_cfg_id", modelIdentifier: "vendor/model-exact-match", // Same modelIdentifier as exactMatchConfig
            promptElements: [{key: "test", prefix: "PriorityByID:"}], promptAssemblyOrder: ["test"]
        };


        // Order can matter for tie-breaking same-length wildcards if their patterns were identical
        // but here patterns are different, so longest prefix rule is dominant.
        const allConfigs = [exactMatchConfig, shortWildcardConfig, mediumWildcardConfig, longWildcardConfig, anotherLongWildcardConfig, unrelatedConfig, configIdPriorityConfig];

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: allConfigs});
        });

        test('should select configuration by exact modelIdentifier match', async () => {
            // This test implicitly relies on "vendor/model-exact-match" not being a configId in the cache.
            // If it were a configId, that would take precedence.
            const llmIdToTest = "vendor/model-exact-match";
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("Exact:data"); // or "PriorityByID:data" if llmId was "priority_cfg_id"
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by exact modelIdentifier match: configId "${exactMatchConfig.configId}" (model: "${exactMatchConfig.modelIdentifier}") for identifier "${llmIdToTest}"`)
            );
        });

        test('should select configuration by configId match if llmId is a configId', async () => {
            const llmIdToTest = "priority_cfg_id"; // This is a configId
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("PriorityByID:data");
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by direct configId match: "${configIdPriorityConfig.configId}" for identifier "${llmIdToTest}"`)
            );
        });


        test('should select configuration by wildcard match if no exact match (by configId or modelIdentifier)', async () => {
            const llmIdToTest = "vendor/model-wildcard-test"; // Not an exact modelIdentifier, not a configId
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("MediumWild:data"); // "vendor/model-*"
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by wildcard modelIdentifier match: configId "${mediumWildcardConfig.configId}" (pattern: "${mediumWildcardConfig.modelIdentifier}") for identifier "${llmIdToTest}"`)
            );
        });

        test('exact match (by modelIdentifier) should take precedence over wildcard match if llmId is not a configId', async () => {
            // llmId "vendor/model-exact-match" matches exactMatchConfig.modelIdentifier
            // and also matches shortWildcardConfig ("vendor/*") and mediumWildcardConfig ("vendor/model-*") and longWildcardConfig ("vendor/model-exact*")
            const llmIdToTest = "vendor/model-exact-match";
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("Exact:data"); // Expect exactMatchConfig
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by exact modelIdentifier match: configId "${exactMatchConfig.configId}"`)
            );
        });

        test('longer wildcard prefix should take precedence over shorter wildcard prefix', async () => {
            const llmIdToTest = "vendor/model-exact-specific"; // Matches "vendor/model-exact*", "vendor/model-*", "vendor/*"
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("LongWild:data"); // "vendor/model-exact*" is longest
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by wildcard modelIdentifier match: configId "${longWildcardConfig.configId}" (pattern: "${longWildcardConfig.modelIdentifier}") for identifier "${llmIdToTest}"`)
            );
        });

        test('should correctly pick between multiple matching wildcards based on longest prefix', async () => {
            const llmIdToTest = "vendor/model-extracool"; // Matches "vendor/model-extra*", "vendor/model-*", "vendor/*"
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("AnotherLongWild:data"); // "vendor/model-extra*" is longest
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by wildcard modelIdentifier match: configId "${anotherLongWildcardConfig.configId}" (pattern: "${anotherLongWildcardConfig.modelIdentifier}") for identifier "${llmIdToTest}"`)
            );
        });

        test('should return empty string and log error if no configuration matches', async () => {
            const llmIdToTest = "non-existent-vendor/non-existent-model";
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("");
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`No configuration found for llmId "${llmIdToTest}"`)
            );
        });

        test('should correctly handle llmId shorter than some wildcard prefixes but matching a general one', async () => {
            const llmIdToTest = "vendor/mode"; // Only matches "vendor/*"
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("ShortWild:data");
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining(`Selected by wildcard modelIdentifier match: configId "${shortWildcardConfig.configId}" (pattern: "${shortWildcardConfig.modelIdentifier}") for identifier "${llmIdToTest}"`)
            );
        });

        test('wildcard should not match if llmId does not start with prefix', async () => {
            const llmIdToTest = "different-vendor/model-exact-plus";
            const result = await promptBuilder.build(llmIdToTest, {testContent: "data"});
            expect(result).toBe("");
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`No configuration found for llmId "${llmIdToTest}"`)
            );
        });
    });
});

// --- FILE END ---