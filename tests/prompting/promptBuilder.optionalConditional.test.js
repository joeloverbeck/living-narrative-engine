// tests/prompting/promptBuilder.optionalConditional.test.js
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
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler.js';
import { ThoughtsSectionAssembler } from '../../src/prompting/assembling/thoughtsSectionAssembler.js';
import { GoalsSectionAssembler } from '../../src/prompting/assembling/goalsSectionAssembler.js';
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
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
  assemble: jest.fn(), // Specific implementation set in beforeEach
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''), // Default for unused assembler
});

describe('PromptBuilder', () => {
  let logger;
  let mockLlmConfigService;
  let mockPlaceholderResolver;
  let mockStandardAssembler;
  let mockPerceptionLogAssembler;
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

      // Inject all required assemblers
      promptBuilder = new PromptBuilder({
        logger,
        llmConfigService: mockLlmConfigService,
        placeholderResolver: mockPlaceholderResolver,
        standardElementAssembler: mockStandardAssembler,
        perceptionLogAssembler: mockPerceptionLogAssembler,
        notesSectionAssembler: new NotesSectionAssembler({ logger }),
        thoughtsSectionAssembler: new ThoughtsSectionAssembler({ logger }),
        goalsSectionAssembler: new GoalsSectionAssembler({ logger }),
        indexedChoicesAssembler: new IndexedChoicesAssembler({ logger }),
      });

      mockStandardAssembler.assemble.mockImplementation(
        (elementConfig, promptData, placeholderResolverInstance) => {
          const prefix = placeholderResolverInstance.resolve(
            elementConfig.prefix || '',
            promptData
          );
          const suffix = placeholderResolverInstance.resolve(
            elementConfig.suffix || '',
            promptData
          );
          const camelCaseKey = elementConfig.key.replace(/_([a-z])/g, (_, c) =>
            c.toUpperCase()
          );
          const contentKey = `${camelCaseKey}Content`;
          const raw = promptData[contentKey];
          const central =
            raw === null || raw === undefined
              ? ''
              : typeof raw === 'string'
                ? raw
                : '';
          return central || prefix || suffix
            ? `${prefix}${central}${suffix}`
            : '';
        }
      );
    });

    test('should include optional part if content exists, omit if not', async () => {
      const withOpt = await promptBuilder.build('cond/test', {
        optPartContent: 'Opt',
      });
      expect(withOpt).toContain('Opt');

      const withoutOpt = await promptBuilder.build('cond/test', {
        optPartContent: '',
      });
      expect(withoutOpt).toBe('');

      const nullOpt = await promptBuilder.build('cond/test', {
        optPartContent: null,
      });
      expect(nullOpt).toBe('');

      const undefOpt = await promptBuilder.build('cond/test', {});
      expect(undefOpt).toBe('');
    });

    test('should include/omit conditional part based on truthiness of flag', async () => {
      const on = await promptBuilder.build('cond/test', {
        enableIt: true,
        truthyCondContent: 'Yes',
      });
      expect(on).toContain('Truthy: Yes');

      const off = await promptBuilder.build('cond/test', {
        enableIt: false,
        truthyCondContent: 'No',
      });
      expect(off).not.toContain('Truthy:');
    });

    test('should include/omit conditional part based on flag matching expectedValue', async () => {
      const match = await promptBuilder.build('cond/test', {
        mode: 'active',
        valCondContent: 'Active',
      });
      expect(match).toContain('ValMode: Active');

      const noMatch = await promptBuilder.build('cond/test', {
        mode: 'inactive',
        valCondContent: 'Inactive',
      });
      expect(noMatch).not.toContain('ValMode:');

      const missing = await promptBuilder.build('cond/test', {
        valCondContent: 'Empty',
      });
      expect(missing).not.toContain('ValMode:');
    });

    test('should omit conditional part and warn if condition.promptDataFlag is invalid type', async () => {
      const result = await promptBuilder.build('cond/test', {
        badCondFlagContent: 'X',
        optPartContent: 'Y',
      });
      expect(result).toContain('Y'); // optional part still included
      expect(result).not.toContain('Bad:'); // bad_cond_flag omitted

      expect(logger.warn).toHaveBeenCalledWith(
        `PromptBuilder.#isElementConditionMet: Conditional element has invalid or empty 'promptDataFlag'. Assuming condition not met.`,
        expect.objectContaining({
          condition: conditionalTestConfig.promptElements[3].condition,
        })
      );
    });
  });
});
// --- FILE END ---
