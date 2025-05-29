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
    
    describe('Handling of Optional and Conditional Parts', () => {
        const conditionalTestConfig = {
            config_id: "cond_test", model_identifier: "cond/test",
            prompt_elements: [
                {key: "opt_part"},
                {key: "truthy_cond", prefix: "Truthy: ", condition: {promptDataFlag: "enableIt"}},
                {key: "val_cond", prefix: "ValMode: ", condition: {promptDataFlag: "mode", expectedValue: "active"}},
                {key: "bad_cond_flag", prefix: "Bad:", condition: {promptDataFlag: 123}}
            ],
            prompt_assembly_order: ["opt_part", "truthy_cond", "val_cond", "bad_cond_flag"]
        };

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [conditionalTestConfig]});
        });

        test('should include optional part if content exists, omit if not', async () => {
            expect(await promptBuilder.build("cond/test", {optPartContent: "Opt"})).toContain("Opt");
            expect(await promptBuilder.build("cond/test", {optPartContent: ""})).not.toContain("Opt");
        });

        test('should include/omit conditional part based on truthiness of flag', async () => {
            const resTrue = await promptBuilder.build("cond/test", {enableIt: true, truthyCondContent: "Enabled"});
            expect(resTrue).toContain("Truthy: Enabled");
            const resFalse = await promptBuilder.build("cond/test", {enableIt: false, truthyCondContent: "Enabled"});
            expect(resFalse).not.toContain("Truthy:");
        });

        test('should include/omit conditional part based on flag matching expectedValue', async () => {
            const resMatch = await promptBuilder.build("cond/test", {mode: "active", valCondContent: "IsActive"});
            expect(resMatch).toContain("ValMode: IsActive");
            const resNoMatch = await promptBuilder.build("cond/test", {mode: "inactive", valCondContent: "IsActive"});
            expect(resNoMatch).not.toContain("ValMode:");
        });

        test('should omit conditional part and warn if condition.promptDataFlag is invalid type', async () => {
            const result = await promptBuilder.build("cond/test", {badCondFlagContent: "Content"});
            expect(result).not.toContain("Bad:");
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("invalid 'promptDataFlag' in its condition"), expect.anything());
        });
    });
});

// --- FILE END ---