// tests/services/promptBuilder.coreAssemblyLogic.test.js
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

    describe('Core Assembly Logic & Placeholder Substitution', () => {
        const coreLogicConfig = {
            config_id: "core_test_config", model_identifier: "core/test",
            prompt_elements: [
                {key: "header", prefix: "== HEADER {global_id} ==\n", suffix: "\n== END HEADER =="},
                {key: "introduction", prefix: "Intro: {character_name} says: \"", suffix: "\"\n"},
                {key: "main_content", prefix: "Content: ", suffix: ""},
                {key: "footer", prefix: "\n-- Footer {world_name} --", suffix: "\nEnd of Prompt."}
            ],
            prompt_assembly_order: ["header", "introduction", "main_content", "footer"]
        };

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [coreLogicConfig]});
        });

        test('should assemble prompt according to prompt_assembly_order with prefixes, suffixes, and placeholders', async () => {
            const promptData = {
                headerContent: "Title",
                introductionContent: "Hello",
                mainContentContent: "This is the main part.",
                footerContent: "Signature",
                global_id: "G1",
                character_name: "Alice",
                world_name: "Wonderland"
            };
            const expected = "== HEADER G1 ==\nTitle\n== END HEADER ==" +
                "Intro: Alice says: \"Hello\"\n" +
                "Content: This is the main part." +
                "\n-- Footer Wonderland --Signature\nEnd of Prompt.";
            const result = await promptBuilder.build("core/test", promptData);
            expect(result).toBe(expected);
        });

        test('should handle missing placeholders by replacing with empty string and logging warning', async () => {
            const promptData = {introductionContent: "Hi", world_name: "Mars"}; // character_name missing
            await promptBuilder.build("core/test", {
                ...promptData,
                headerContent: "",
                mainContentContent: "",
                footerContent: "End"
            });
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Placeholder "{character_name}" not found'));
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Placeholder "{global_id}" not found')); // From header
        });

        test('should handle placeholders with accidental spaces like { placeholder_name }', async () => {
            const cfg = {
                config_id: "s",
                model_identifier: "s/s",
                prompt_elements: [{key: "el", prefix: "V: {  val  }"}],
                prompt_assembly_order: ["el"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            const result = await promptBuilder.build("s/s", {val: "test", elContent: ""});
            expect(result).toBe("V: test");
        });

        test('should skip element and log warning if content is not a string (and not special)', async () => {
            const promptData = {headerContent: {text: "obj"}, introductionContent: "Valid", character_name: "C"};
            const result = await promptBuilder.build("core/test", promptData);
            expect(result).not.toContain("HEADER");
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Content for 'header' (from 'headerContent') is not a string."));
        });

        test('should convert snake_case element key to camelCaseContent for promptData lookup', async () => {
            const cfg = {
                config_id: "snake",
                model_identifier: "s/t",
                prompt_elements: [{key: "my_key"}],
                prompt_assembly_order: ["my_key"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            const result = await promptBuilder.build("s/t", {myKeyContent: "Data"});
            expect(result).toBe("Data");
        });
    });
});

// --- FILE END ---