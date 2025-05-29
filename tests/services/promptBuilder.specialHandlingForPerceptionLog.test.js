// tests/services/promptBuilder.specialHandlingForPerceptionLog.test.js
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

    describe('Special Handling for Perception Log', () => {
        const perceptionLogTestConfig = {
            config_id: "p_log_test", model_identifier: "log/test",
            prompt_elements: [
                {key: "header", prefix: "Conversation Start (ID: {session_id})\n"},
                {key: "perception_log_entry", prefix: "[{timestamp}][{role} ({source_system})]: ", suffix: "\n"},
                {key: "perception_log_wrapper", prefix: "--- Log ---\n", suffix: "--- End Log ---\n"},
                {key: "footer", prefix: "End."}
            ],
            prompt_assembly_order: ["header", "perception_log_wrapper", "footer"]
        };
        const noEntryConfig = {
            config_id: "no_entry_cfg", model_identifier: "log/no_entry",
            prompt_elements: [{key: "perception_log_wrapper", prefix: "<WRAP>", suffix: "</WRAP>"}],
            prompt_assembly_order: ["perception_log_wrapper"]
        };

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [perceptionLogTestConfig, noEntryConfig]});
        });

        test('should correctly assemble perception log with multiple entries, substituting placeholders', async () => {
            const promptData = {
                // headerContent: "H", // Removed - content is defined by prefix
                // footerContent: "F", // Removed - content is defined by prefix
                session_id: "S123", source_system: "CoreAI",
                perceptionLogArray: [
                    {role: "user", timestamp: "T1", content: "Msg1.", source_system: "UserInput"},
                    {role: "assistant", timestamp: "T2", content: "Msg2."}, // source_system from promptData
                ]
            };
            const result = await promptBuilder.build("log/test", promptData);
            const expected = "Conversation Start (ID: S123)\n" +
                "--- Log ---\n" +
                "[T1][user (UserInput)]: Msg1.\n" +
                "[T2][assistant (CoreAI)]: Msg2.\n" +
                "--- End Log ---\n" +
                "End.";
            expect(result).toBe(expected);
        });

        test('should gracefully omit perception log if array is empty, null, or undefined', async () => {
            // Removed headerContent and footerContent from baseData as their content is defined by prefixes
            const baseData = {session_id: "S0"};
            const expected = "Conversation Start (ID: S0)\nEnd.";
            expect(await promptBuilder.build("log/test", {...baseData, perceptionLogArray: []})).toBe(expected);
            expect(await promptBuilder.build("log/test", {...baseData, perceptionLogArray: null})).toBe(expected);
            expect(await promptBuilder.build("log/test", {...baseData})).toBe(expected); // Undefined
            // Corrected expected string to match actual log output
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Perception log array for 'perception_log_wrapper' missing or empty. Skipping."));
        });

        test('should skip wrapper if perception_log_entry config is missing', async () => {
            const promptData = {perceptionLogArray: [{role: "user", content: "Message 1"}]};
            const result = await promptBuilder.build("log/no_entry", promptData);
            expect(result).toBe("");
            // Updated expectation to match the actual log message format
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Missing 'perception_log_entry' for config_id \"no_entry_cfg\""));
            // Corrected expected string to match actual log output
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Perception log 'perception_log_wrapper' resulted in no entries. Skipping wrapper."));
        });

        test('should skip invalid entries (null, non-object) in perceptionLogArray and log warning', async () => {
            const promptData = {
                perceptionLogArray: [{role: "user", content: "Valid"}, null, "not an object"],
                source_system: "S", session_id: "id", // headerContent and footerContent omitted
            };
            await promptBuilder.build("log/test", promptData);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid perception log entry"), {entry: null});
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid perception log entry"), {entry: "not an object"});
        });

        test('should handle entries with missing content (null/undefined) as empty string content', async () => {
            const promptData = {
                perceptionLogArray: [{role: "user", timestamp: "T", content: null}],
                source_system: "S", session_id: "id", // headerContent and footerContent omitted
            };
            const result = await promptBuilder.build("log/test", promptData);
            expect(result).toContain("[T][user (S)]: \n"); // Empty content
        });
    });
});

// --- FILE END ---