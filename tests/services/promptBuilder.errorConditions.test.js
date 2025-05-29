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

    describe('Error Conditions and Edge Cases', () => {
        test('build should return empty string and log error if llmId is null or not a string', async () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [MOCK_CONFIG_1]});
            expect(await promptBuilder.build(null, {sContent: "t"})).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: llmId is required and must be a string.');
            logger.error.mockClear();
            // @ts-ignore
            expect(await promptBuilder.build({id: 1}, {sContent: "t"})).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: llmId is required and must be a string.');
        });

        test('build should return empty string and log error if promptData is null or not an object', async () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [MOCK_CONFIG_1]});
            // @ts-ignore
            expect(await promptBuilder.build(MOCK_CONFIG_1.model_identifier, null)).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: promptData is required and must be a non-null object.');
            logger.error.mockClear();
            // @ts-ignore
            expect(await promptBuilder.build(MOCK_CONFIG_1.model_identifier, "string")).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: promptData is required and must be a non-null object.');
        });

        test('should warn and skip key if key in assembly_order not in prompt_elements', async () => {
            const cfg = {
                config_id: "err_key",
                model_identifier: "e/k",
                prompt_elements: [{key: "a"}],
                prompt_assembly_order: ["a", "b"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            await promptBuilder.build("e/k", {aContent: "D"});
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Key "b" from prompt_assembly_order not found'));
        });

        test('should produce empty string if prompt_assembly_order is empty', async () => {
            const cfg = {
                config_id: "empty_o",
                model_identifier: "e/o",
                prompt_elements: [{key: "a"}],
                prompt_assembly_order: []
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            expect(await promptBuilder.build("e/o", {aContent: "D"})).toBe("");
        });

        test('should produce empty string and warnings if prompt_elements is empty but order is not', async () => {
            const cfg = {
                config_id: "empty_e",
                model_identifier: "e/e",
                prompt_elements: [],
                prompt_assembly_order: ["a"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            expect(await promptBuilder.build("e/e", {})).toBe("");
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Key "a" from prompt_assembly_order not found'));
        });

        test('placeholders for deeply nested structures in promptData are not resolved', async () => {
            const cfg = {
                config_id: "deep",
                model_identifier: "e/d",
                prompt_elements: [{key: "user", prefix: "{user.name}"}],
                prompt_assembly_order: ["user"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            const result = await promptBuilder.build("e/d", {user: {name: "Alice"}, userContent: "Info"});
            expect(result).toBe("Info"); // Placeholder "{user.name}" becomes empty string
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Placeholder "{user.name}" not found'));
        });

        test('should log and return empty string if no configurations are loaded', async () => {
            promptBuilder = new PromptBuilder({logger}); // No configs, no path
            expect(await promptBuilder.build("any/model", {})).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: No configurations available. Cannot build prompt.');
        });
    });
});

// --- FILE END ---