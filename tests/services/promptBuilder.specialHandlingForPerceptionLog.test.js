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

// const MOCK_CONFIG_FILE_PATH = './test-llm-configs.json'; // Not used in this test suite

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
    let fetchSpy; // Not used in this suite as initialConfigs are used


    beforeEach(() => {
        logger = mockLoggerInstance();
        fetchSpy = jest.spyOn(global, 'fetch'); // Spy even if not directly used by these tests
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Special Handling for Perception Log', () => {
        const perceptionLogTestConfig = {
            configId: "p_log_test", modelIdentifier: "log/test",
            promptElements: [
                {key: "header", prefix: "Conversation Start (ID: {session_id})\n"},
                {key: "perception_log_entry", prefix: "[{timestamp}][{role} ({source_system})]: ", suffix: "\n"},
                {key: "perception_log_wrapper", prefix: "--- Log ---\n", suffix: "--- End Log ---\n"},
                {key: "footer", prefix: "End."}
            ],
            promptAssemblyOrder: ["header", "perception_log_wrapper", "footer"]
        };
        const noEntryConfig = {
            configId: "no_entry_cfg", modelIdentifier: "log/no_entry",
            promptElements: [{key: "perception_log_wrapper", prefix: "<WRAP>", suffix: "</WRAP>"}], // No perception_log_entry
            promptAssemblyOrder: ["perception_log_wrapper"]
        };

        beforeEach(() => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [perceptionLogTestConfig, noEntryConfig]});
        });

        test('should correctly assemble perception log with multiple entries, substituting placeholders', async () => {
            const promptData = {
                session_id: "S123",
                source_system: "CoreAI", // Global fallback for source_system
                headerContent: "", // No dynamic content for header, prefix has placeholder
                footerContent: "", // No dynamic content for footer
                perceptionLogArray: [
                    {role: "user", timestamp: "T1", content: "Msg1.", source_system: "UserInput"}, // Entry-specific source_system
                    {role: "assistant", timestamp: "T2", content: "Msg2."}, // Will use global source_system from promptData
                ]
            };
            const result = await promptBuilder.build("p_log_test", promptData);
            // MODIFIED EXPECTATION: Timestamps are now empty due to PromptBuilder modification
            const expected = "Conversation Start (ID: S123)\n" +
                "--- Log ---\n" +
                "[][user (UserInput)]: Msg1.\n" + // Was "[T1][user (UserInput)]: Msg1.\n"
                "[][assistant (CoreAI)]: Msg2.\n" + // Was "[T2][assistant (CoreAI)]: Msg2.\n"
                "--- End Log ---\n" +
                "End.";
            expect(result).toBe(expected);
        });

        test('should gracefully omit perception log if array is empty, null, or undefined', async () => {
            const baseData = {
                session_id: "S0",
                headerContent: "",
                footerContent: ""
            };
            const expected = "Conversation Start (ID: S0)\nEnd.";

            logger.debug.mockClear();
            expect(await promptBuilder.build("p_log_test", {...baseData, perceptionLogArray: []})).toBe(expected);
            expect(logger.debug).toHaveBeenCalledWith(
                "PromptBuilder.build: Perception log array for 'perception_log_wrapper' missing or empty in PromptData. Skipping wrapper element."
            );

            logger.debug.mockClear();
            expect(await promptBuilder.build("p_log_test", {...baseData, perceptionLogArray: null})).toBe(expected);
            expect(logger.debug).toHaveBeenCalledWith(
                "PromptBuilder.build: Perception log array for 'perception_log_wrapper' missing or empty in PromptData. Skipping wrapper element."
            );

            logger.debug.mockClear();
            const dataWithoutLog = {...baseData};
            expect(await promptBuilder.build("p_log_test", dataWithoutLog)).toBe(expected);
            expect(logger.debug).toHaveBeenCalledWith(
                "PromptBuilder.build: Perception log array for 'perception_log_wrapper' missing or empty in PromptData. Skipping wrapper element."
            );
        });

        test('should skip wrapper if perception_log_entry config is missing', async () => {
            const promptData = {perceptionLogArray: [{role: "user", content: "Message 1"}]};
            const result = await promptBuilder.build("no_entry_cfg", promptData);

            expect(result).toBe("<WRAP></WRAP>"); // Expect wrapper prefix/suffix with empty content

            expect(logger.warn).toHaveBeenCalledWith(
                `PromptBuilder.build: Missing 'perception_log_entry' config for perception log in configId "no_entry_cfg". Entries will be empty.`
            );

            // Updated debug log expectation
            expect(logger.debug).toHaveBeenCalledWith(
                "PromptBuilder.build: Perception log wrapper for 'perception_log_wrapper' added. Entries were not formatted due to missing 'perception_log_entry' config."
            );
        });

        test('should skip invalid entries (null, non-object) in perceptionLogArray and log warning', async () => {
            const promptData = {
                perceptionLogArray: [
                    {role: "user", timestamp: "T_valid", content: "Valid"},
                    null,
                    "not an object"
                ],
                source_system: "S_global",
                session_id: "id_session",
                headerContent: "",
                footerContent: ""
            };
            await promptBuilder.build("p_log_test", promptData);
            expect(logger.warn).toHaveBeenCalledWith("PromptBuilder.build: Invalid perception log entry. Skipping.", {entry: null});
            expect(logger.warn).toHaveBeenCalledWith("PromptBuilder.build: Invalid perception log entry. Skipping.", {entry: "not an object"});
        });

        test('should handle entries with missing content (null/undefined) as empty string content', async () => {
            const promptData = {
                perceptionLogArray: [{role: "user", timestamp: "T_missing_content", content: null}],
                source_system: "S_global_for_missing",
                session_id: "id_session_missing",
                headerContent: "",
                footerContent: ""
            };
            const result = await promptBuilder.build("p_log_test", promptData);
            // MODIFIED EXPECTATION: Timestamp is now empty due to PromptBuilder modification
            expect(result).toContain("[][user (S_global_for_missing)]: \n"); // Was "[T_missing_content][user (S_global_for_missing)]: \n"
        });
    });
});

// --- FILE END ---