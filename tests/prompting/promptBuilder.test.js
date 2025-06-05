// tests/services/promptBuilder.test.js
// --- FILE START ---
import {
    jest,
    describe,
    beforeEach,
    test,
    expect,
    afterEach,
} from '@jest/globals';
import {PromptBuilder} from '../../src/prompting/promptBuilder.js';
import {LLMConfigService} from '../../src/llms/llmConfigService.js'; // Added
import {PlaceholderResolver} from '../../src/utils/placeholderResolver.js';
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler.js'; // Added
// Import assembler types for JSDoc
/** @typedef {import('../../src/prompting/assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler */
/** @typedef {import('../../src/prompting/assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler */

/**
 * @typedef {import('../../src/llms/llmConfigService.js').LLMConfig} LLMConfig
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger}     ILogger
 */

/**
 * ------------------------------------------------------------------ *
 * Helpers                                                             *
 * -------------------------------------------------------------------
 */

const EXPECTED_INIT_MSG =
    'PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers (standard, perception‐log, thoughts, notes, goals).';

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
});

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
    resolve: jest.fn((text) => text), // Simple pass-through
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(''),
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
    assemble: jest.fn().mockReturnValue(''),
});

/**
 * ------------------------------------------------------------------ *
 * Mock data                                                           *
 * -------------------------------------------------------------------
 */

/** @type {LLMConfig} */
const MOCK_CONFIG_1 = {
    configId: 'test_config_v1',
    modelIdentifier: 'test-vendor/test-model-exact',
    promptElements: [
        {key: 'system_prompt', prefix: 'System: ', suffix: '\n'},
        {key: 'user_query', prefix: 'User: ', suffix: '\n'},
    ],
    promptAssemblyOrder: ['system_prompt', 'user_query'],
};

/**
 * ------------------------------------------------------------------ *
 * Tests                                                               *
 * -------------------------------------------------------------------
 */

describe('PromptBuilder', () => {
    /** @type {jest.Mocked<ILogger>}                  */ let logger;
    /** @type {jest.Mocked<LLMConfigService>}         */ let mockLlmConfigService;
    /** @type {jest.Mocked<PlaceholderResolver>}      */ let mockPlaceholderResolver;
    /** @type {jest.Mocked<StandardElementAssembler>} */ let mockStandardAssembler;
    /** @type {jest.Mocked<PerceptionLogAssembler>}   */ let mockPerceptionLogAssembler;
    /** @type {PromptBuilder}                         */ let promptBuilder; // Used in some tests

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
        test('initializes with default console logger when none provided', () => {
            const consoleSpy = jest
                .spyOn(console, 'info')
                .mockImplementation(() => {
                });
            const pb = new PromptBuilder({
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(pb).toBeInstanceOf(PromptBuilder);
            expect(consoleSpy).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
            consoleSpy.mockRestore();
        });

        test('initializes with provided logger', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
        });

        test('initializes correctly when LLMConfigService might have initialConfigs', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
        });

        test('initializes correctly when LLMConfigService might have empty initialConfigs', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
        });

        test('initializes correctly when LLMConfigService uses configSourceIdentifier', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
        });

        test('initializes correctly regardless of LLMConfigService details', () => {
            promptBuilder = new PromptBuilder({
                logger,
                llmConfigService: mockLlmConfigService,
                placeholderResolver: mockPlaceholderResolver,
                standardElementAssembler: mockStandardAssembler,
                perceptionLogAssembler: mockPerceptionLogAssembler,
                notesSectionAssembler: new NotesSectionAssembler({logger}),
            });

            expect(promptBuilder).toBeInstanceOf(PromptBuilder);
            expect(logger.info).toHaveBeenCalledWith(EXPECTED_INIT_MSG);
        });

        test('throws when LLMConfigService not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    placeholderResolver: mockPlaceholderResolver,
                    standardElementAssembler: mockStandardAssembler,
                    perceptionLogAssembler: mockPerceptionLogAssembler,
                });
            }).toThrow('PromptBuilder: LLMConfigService is a required dependency.');
        });

        test('throws when PlaceholderResolver not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    standardElementAssembler: mockStandardAssembler,
                    perceptionLogAssembler: mockPerceptionLogAssembler,
                });
            }).toThrow(
                'PromptBuilder: PlaceholderResolver is a required dependency.'
            );
        });

        test('throws when StandardElementAssembler not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    placeholderResolver: mockPlaceholderResolver,
                    perceptionLogAssembler: mockPerceptionLogAssembler,
                });
            }).toThrow(
                'PromptBuilder: StandardElementAssembler is a required dependency.'
            );
        });

        test('throws when PerceptionLogAssembler not provided', () => {
            expect(() => {
                new PromptBuilder({
                    logger,
                    llmConfigService: mockLlmConfigService,
                    placeholderResolver: mockPlaceholderResolver,
                    standardElementAssembler: mockStandardAssembler,
                });
            }).toThrow(
                'PromptBuilder: PerceptionLogAssembler is a required dependency.'
            );
        });
    });

    // TODO: Add tests for build() orchestration logic
});
// --- FILE END ---
