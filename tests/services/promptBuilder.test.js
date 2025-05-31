// tests/services/promptBuilder.test.js
// --- FILE START ---
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {PromptBuilder} from '../../src/services/promptBuilder.js';
import {LLMConfigService} from '../../src/services/llmConfigService.js'; // Added
import {PlaceholderResolver} from '../../src/utils/placeholderResolver.js'; // Added
// Import assembler types for JSDoc
/** @typedef {import('../../src/services/promptElementAssemblers/StandardElementAssembler.js').StandardElementAssembler} StandardElementAssembler */
/** @typedef {import('../../src/services/promptElementAssemblers/PerceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler */

/**
 * @typedef {import('../../src/services/llmConfigService.js').LLMConfig} LLMConfig
 // PromptData, PerceptionLogEntry not used here
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 */

/** @returns {jest.Mocked<ILogger>} */
const mockLoggerInstance = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

/** @returns {jest.Mocked<LLMConfigService>} */
const mockLlmConfigServiceInstance = () => ({
    getConfig: jest.fn(),
    // Add other methods if needed for other tests in this file
});

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
    resolve: jest.fn(text => text), // Simple pass-through
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(""),
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(""),
});


// MOCK_CONFIG_FILE_PATH is not directly used by PromptBuilder's constructor anymore
// const MOCK_CONFIG_FILE_PATH = './test-llm-configs.json';

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

// MOCK_CONFIG_2 is not used in this file.

describe('PromptBuilder', () => {
    /** @type {jest.Mocked<ILogger>} */
    let logger;
    /** @type {jest.Mocked<LLMConfigService>} */
    let mockLlmConfigService;
    /** @type {jest.Mocked<PlaceholderResolver>} */
    let mockPlaceholderResolver;
    /** @type {jest.Mocked<StandardElementAssembler>} */
    let mockStandardAssembler;
    /** @type {jest.Mocked<PerceptionLogAssembler>} */
    let mockPerceptionLogAssembler;
    /** @type {PromptBuilder} */
    let promptBuilder; // Used in some tests

    beforeEach(() => {
        logger = mockLoggerInstance();
        mockLlmConfigService = mockLlmConfigServiceInstance();
        mockPlaceholderResolver = mockPlaceholderResolverInstance();
        mockStandardAssembler = mockStandardElementAssemblerInstance();
        mockPerceptionLogAssembler = mockPerceptionLogAssemblerInstance();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with a default console logger if no logger is provided', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {
            });
            // Provide required dependencies, logger will use its default (console)
            const pb = new PromptBuilder({
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(pb).toBeInstanceOf(PromptBuilder);
            expect(consoleSpy).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
            consoleSpy.mockRestore();
        });

        test('should initialize with a provided logger', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
        });

        test('should initialize correctly when LLMConfigService might have initialConfigs', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
        });

        test('should initialize correctly when LLMConfigService might have empty initialConfigs', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
        });

        test('should initialize correctly when LLMConfigService might have a configSourceIdentifier (formerly configFilePath)', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
        });

        test('should initialize correctly regardless of how LLMConfigService is configured', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler
            });
            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith('PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers.');
        });

        test('should throw error if LLMConfigService is not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    // llmConfigService missing
                    placeholderResolver: mockPlaceholderResolver,
                    standardElementAssembler: mockStandardAssembler,
                    perceptionLogAssembler: mockPerceptionLogAssembler
                });
            }).toThrow('PromptBuilder: LLMConfigService is a required dependency.');
        });

        test('should throw error if PlaceholderResolver is not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    // placeholderResolver missing
                    standardElementAssembler: mockStandardAssembler,
                    perceptionLogAssembler: mockPerceptionLogAssembler
                });
            }).toThrow('PromptBuilder: PlaceholderResolver is a required dependency.');
        });

        // Add tests for missing assembler dependencies
        test('should throw error if StandardElementAssembler is not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    placeholderResolver: mockPlaceholderResolver,
                    // standardElementAssembler missing
                    perceptionLogAssembler: mockPerceptionLogAssembler
                });
            }).toThrow('PromptBuilder: StandardElementAssembler is a required dependency.');
        });

        test('should throw error if PerceptionLogAssembler is not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    placeholderResolver: mockPlaceholderResolver,
                    standardElementAssembler: mockStandardAssembler
                    // perceptionLogAssembler missing
                });
            }).toThrow('PromptBuilder: PerceptionLogAssembler is a required dependency.');
        });
    });

    // TODO: Add describe block for 'build' method tests, focusing on orchestration logic.
    // These tests would mock assemblers and verify:
    // - Correct assembler is chosen based on element key.
    // - 'assemble' method is called with correct parameters.
    // - Output from assemblers is correctly concatenated.
    // - Conditional logic (#isElementConditionMet) correctly skips assembler calls.
    // - Error handling if an assembler throws an error.
});

// --- FILE END ---