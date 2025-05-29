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

    describe('Constructor', () => {
        test('should initialize with a default console logger if no logger is provided', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {
            });
            const pb = new PromptBuilder();
            expect(pb).toBeInstanceOf(PromptBuilder);
            // The constructor logs an initialization message.
            expect(consoleSpy).toHaveBeenCalledWith('PromptBuilder initialized. Configurations will be loaded from file on demand if configFilePath is set.');
            consoleSpy.mockRestore();
        });

        test('should initialize with a provided logger', () => {
            promptBuilder = new PromptBuilder({logger});
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            // The constructor logs an initialization message using the provided logger.
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized. Configurations will be loaded from file on demand if configFilePath is set.');
        });

        test('should initialize with initialConfigs and mark configs as loaded', () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: [MOCK_CONFIG_1]});
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PromptBuilder initialized with 1 preloaded configurations.'));
            // Check if the config is findable, implying it's in the cache
            expect(promptBuilder._findConfiguration(MOCK_CONFIG_1.model_identifier)).toEqual(MOCK_CONFIG_1);
            // The log message "PromptBuilder initialized with 1 preloaded configurations."
            // implies that configsLoadedOrAttempted was set to true internally.
        });

        test('should log info if initialized with empty initialConfigs array', () => {
            promptBuilder = new PromptBuilder({logger, initialConfigs: []});
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PromptBuilder initialized. Configurations will be loaded from file on demand if configFilePath is set.'));
            // The log message implies that configsLoadedOrAttempted remained false (or was not set to true by empty initialConfigs).
        });

        test('should initialize with configFilePath', () => {
            promptBuilder = new PromptBuilder({logger, configFilePath: MOCK_CONFIG_FILE_PATH});
            // The constructor logs an initialization message. The presence of configFilePath
            // alone doesn't mark configs as "loaded" at construction, hence the "on demand" message.
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized. Configurations will be loaded from file on demand if configFilePath is set.');
            // To truly test configFilePath, one would typically test the behavior of a method
            // like build() or ensureConfigsLoaded() that uses this path to fetch configurations.
        });

        test('should log appropriate message if both initialConfigs and configFilePath are provided', () => {
            promptBuilder = new PromptBuilder({
                logger,
                initialConfigs: [MOCK_CONFIG_1],
                configFilePath: MOCK_CONFIG_FILE_PATH
            });
            // If initialConfigs are provided, they take precedence for the initial "loaded" status message.
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PromptBuilder initialized with 1 preloaded configurations.'));
        });
    });
});

// --- FILE END ---