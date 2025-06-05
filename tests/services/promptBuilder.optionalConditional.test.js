// tests/services/promptBuilder.optionalConditional.test.js
// --- FILE START ---
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { LLMConfigService } from '../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolver.js';
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler';
// Import assembler types for JSDoc
/** @typedef {import('../../src/prompting/assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler */
/** @typedef {import('../../src/prompting/assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler */

/**
 * @typedef {import('../../src/llms/llmConfigService.js').LLMConfig} LLMConfig
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
});

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
  resolve: jest.fn((text) => text), // Default: pass through text
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(), // Specific implementation will be set in the test suite's beforeEach
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''), // Default for unused assembler
});

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
  let promptBuilder;

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

  describe('Handling of Optional and Conditional Parts', () => {
    const conditionalTestConfig = {
      configId: 'cond_test',
      modelIdentifier: 'cond/test',
      promptElements: [
        { key: 'opt_part' }, // No prefix/suffix, content only
        {
          key: 'truthy_cond',
          prefix: 'Truthy: ',
          condition: { promptDataFlag: 'enableIt' },
        },
        {
          key: 'val_cond',
          prefix: 'ValMode: ',
          condition: { promptDataFlag: 'mode', expectedValue: 'active' },
        },
        {
          key: 'bad_cond_flag',
          prefix: 'Bad:',
          condition: { promptDataFlag: 123 },
        }, // Invalid promptDataFlag type
      ],
      promptAssemblyOrder: [
        'opt_part',
        'truthy_cond',
        'val_cond',
        'bad_cond_flag',
      ],
    };

    beforeEach(() => {
      mockLlmConfigService.getConfig.mockResolvedValue(conditionalTestConfig);

      // Instantiate PromptBuilder with all dependencies including the new assemblers
      promptBuilder = new PromptBuilder({
        logger,
        llmConfigService: mockLlmConfigService,
        placeholderResolver: mockPlaceholderResolver,
        standardElementAssembler: mockStandardAssembler,
        perceptionLogAssembler: mockPerceptionLogAssembler,
        notesSectionAssembler: new NotesSectionAssembler({ logger }),
      });

      // Configure the mock StandardElementAssembler for this suite.
      // It needs to replicate how an element with optional content and prefix/suffix is assembled.
      mockStandardAssembler.assemble.mockImplementation(
        (elementConfig, promptData, placeholderResolverInstance) => {
          const resolvedPrefix = placeholderResolverInstance.resolve(
            elementConfig.prefix || '',
            promptData
          );
          const resolvedSuffix = placeholderResolverInstance.resolve(
            elementConfig.suffix || '',
            promptData
          );

          const camelCaseKey = elementConfig.key.replace(/_([a-z])/g, (g) =>
            g[1].toUpperCase()
          );
          const contentKeyInPromptData = `${camelCaseKey}Content`;
          const rawContent = promptData[contentKeyInPromptData];
          let centralContentString = '';

          if (rawContent === null || rawContent === undefined) {
            centralContentString = '';
          } else if (typeof rawContent === 'string') {
            centralContentString = rawContent;
          } else {
            // This case should ideally be handled by StandardElementAssembler's own tests.
            // For these PromptBuilder tests, if non-string content occurs for a standard element,
            // we assume the assembler might log and return empty or handle it internally.
            // The original tests here didn't focus on non-string content for conditional elements,
            // so returning empty is a safe bet for the mock.
            centralContentString = '';
          }

          if (resolvedPrefix || centralContentString || resolvedSuffix) {
            return `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
          }
          return '';
        }
      );
    });

    test('should include optional part if content exists, omit if not', async () => {
      mockPlaceholderResolver.resolve.mockImplementation((text) => text); // Ensure pass-through for this test

      const resultWithContent = await promptBuilder.build('cond/test', {
        optPartContent: 'Opt',
      });
      expect(resultWithContent).toContain('Opt');
      // Check that assemble was called for opt_part. The mock will handle prefix/suffix internally.
      expect(mockStandardAssembler.assemble).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'opt_part' }),
        expect.objectContaining({ optPartContent: 'Opt' }),
        mockPlaceholderResolver,
        expect.any(Map)
      );

      const resultWithoutContent = await promptBuilder.build('cond/test', {
        optPartContent: '',
      });
      expect(resultWithoutContent).toBe(''); // Since other parts are conditional and not triggered by this promptData

      const resultWithNullContent = await promptBuilder.build('cond/test', {
        optPartContent: null,
      });
      expect(resultWithNullContent).toBe('');

      const resultWithUndefinedContent = await promptBuilder.build(
        'cond/test',
        {}
      ); // optPartContent is undefined
      expect(resultWithUndefinedContent).toBe('');
    });

    test('should include/omit conditional part based on truthiness of flag', async () => {
      const resTrue = await promptBuilder.build('cond/test', {
        enableIt: true,
        truthyCondContent: 'Enabled',
      });
      expect(resTrue).toContain('Truthy: Enabled');
      expect(mockStandardAssembler.assemble).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'truthy_cond' }),
        expect.objectContaining({
          enableIt: true,
          truthyCondContent: 'Enabled',
        }),
        mockPlaceholderResolver,
        expect.any(Map)
      );

      // Clear mock calls for the next assertion in the same test
      mockStandardAssembler.assemble.mockClear();

      const resFalse = await promptBuilder.build('cond/test', {
        enableIt: false,
        truthyCondContent: 'ShouldNotAppear',
      });
      expect(resFalse).not.toContain('Truthy:');
      expect(resFalse).not.toContain('ShouldNotAppear');
      // Verify assemble was NOT called for 'truthy_cond' when condition is false
      expect(mockStandardAssembler.assemble).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'truthy_cond' }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test('should include/omit conditional part based on flag matching expectedValue', async () => {
      const resMatch = await promptBuilder.build('cond/test', {
        mode: 'active',
        valCondContent: 'IsActive',
      });
      expect(resMatch).toContain('ValMode: IsActive');
      expect(mockStandardAssembler.assemble).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'val_cond' }),
        expect.objectContaining({ mode: 'active', valCondContent: 'IsActive' }),
        mockPlaceholderResolver,
        expect.any(Map)
      );
      mockStandardAssembler.assemble.mockClear();

      const resNoMatch = await promptBuilder.build('cond/test', {
        mode: 'inactive',
        valCondContent: 'ShouldNotAppear',
      });
      expect(resNoMatch).not.toContain('ValMode:');
      expect(resNoMatch).not.toContain('ShouldNotAppear');
      expect(mockStandardAssembler.assemble).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'val_cond' }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      mockStandardAssembler.assemble.mockClear();

      const resValueMissing = await promptBuilder.build('cond/test', {
        valCondContent: 'ShouldNotAppear',
      }); // mode flag is missing
      expect(resValueMissing).not.toContain('ValMode:');
      expect(mockStandardAssembler.assemble).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'val_cond' }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    test('should omit conditional part and warn if condition.promptDataFlag is invalid type', async () => {
      const result = await promptBuilder.build('cond/test', {
        badCondFlagContent: 'Content',
        optPartContent: 'Optional', // Provide this to ensure prompt isn't empty
      });
      expect(result).not.toContain('Bad:'); // The element "bad_cond_flag" should be skipped
      expect(result).toContain('Optional'); // "opt_part" should be assembled
      expect(logger.warn).toHaveBeenCalledWith(
        `PromptBuilder.#isElementConditionMet: Conditional element has invalid or empty 'promptDataFlag'. Assuming condition not met.`,
        expect.objectContaining({
          condition: conditionalTestConfig.promptElements[3].condition,
        })
      );
      // Verify assemble was NOT called for 'bad_cond_flag'
      expect(mockStandardAssembler.assemble).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'bad_cond_flag' }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      // Verify assemble WAS called for 'opt_part'
      expect(mockStandardAssembler.assemble).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'opt_part' }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });
});

// --- FILE END ---
