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
            expect(await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, null)).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: promptData is required and must be a non-null object.');
            logger.error.mockClear();
            // @ts-ignore
            expect(await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, "string")).toBe("");
            expect(logger.error).toHaveBeenCalledWith('PromptBuilder.build: promptData is required and must be a non-null object.');
        });

        test('should warn and skip key if key in assembly_order not in promptElements', async () => {
            const cfg = {
                configId: "err_key",
                modelIdentifier: "e/k",
                promptElements: [{key: "a"}],
                promptAssemblyOrder: ["a", "b"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            await promptBuilder.build("e/k", {aContent: "D"});
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Key "b" from promptAssemblyOrder not found'));
        });

        test('should produce empty string if promptAssemblyOrder is empty', async () => {
            const cfg = {
                configId: "empty_o",
                modelIdentifier: "e/o",
                promptElements: [{key: "a"}],
                promptAssemblyOrder: []
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            expect(await promptBuilder.build("e/o", {aContent: "D"})).toBe("");
        });

        test('should produce empty string and warnings if promptElements is empty but order is not', async () => {
            const cfg = {
                configId: "empty_e",
                modelIdentifier: "e/e",
                promptElements: [],
                promptAssemblyOrder: ["a"]
            };
            promptBuilder = new PromptBuilder({logger, initialConfigs: [cfg]});
            expect(await promptBuilder.build("e/e", {})).toBe("");
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Key "a" from promptAssemblyOrder not found'));
        });

        test('placeholders for deeply nested structures in promptData are not resolved', async () => {
            const cfg = {
                configId: "deep",
                modelIdentifier: "e/d",
                promptElements: [{key: "user", prefix: "{user.name}"}],
                promptAssemblyOrder: ["user"]
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