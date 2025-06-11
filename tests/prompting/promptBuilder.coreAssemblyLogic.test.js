// tests/prompting/promptBuilder.coreAssemblyLogic.test.js
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
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
import { LLMConfigService } from '../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolver.js';
import NotesSectionAssembler from '../../src/prompting/assembling/notesSectionAssembler.js';
// Import assembler types for JSDoc
/** @typedef {import('../../src/prompting/assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler */
/** @typedef {import('../../src/prompting/assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler */

/**
 * @typedef {import('../../src/llms/llmConfigService.js').LLMConfig} LLMConfig
 * @typedef {import('../../src/prompting/promptBuilder.js').PromptData} PromptData
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
  resolve: jest.fn(), // Will be configured per test
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(), // Implementation set in beforeEach
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''), // Default unused assembler
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

    promptBuilder = new PromptBuilder({
      logger,
      llmConfigService: mockLlmConfigService,
      placeholderResolver: mockPlaceholderResolver,
      standardElementAssembler: mockStandardAssembler,
      perceptionLogAssembler: mockPerceptionLogAssembler,
      notesSectionAssembler: new NotesSectionAssembler({ logger }),
      indexedChoicesAssembler: new IndexedChoicesAssembler({ logger }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Core Assembly Logic & Placeholder Substitution', () => {
    const coreLogicConfig = {
      configId: 'core_test_config',
      modelIdentifier: 'core/test',
      promptElements: [
        {
          key: 'header',
          prefix: '== HEADER {global_id} ==\n',
          suffix: '\n== END HEADER ==',
        },
        {
          key: 'introduction',
          prefix: 'Intro: {character_name} says: "',
          suffix: '"\n',
        },
        { key: 'main_content', prefix: 'Content: ', suffix: '' },
        {
          key: 'footer',
          prefix: '\n-- Footer {world_name} --',
          suffix: '\nEnd of Prompt.',
        },
      ],
      promptAssemblyOrder: ['header', 'introduction', 'main_content', 'footer'],
    };

    beforeEach(() => {
      // Return the core config for every getConfig call
      mockLlmConfigService.getConfig.mockResolvedValue(coreLogicConfig);

      // Mock standard assembler logic (prefix, content, suffix, snake_case->camelCase)
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
          // Convert key to camelCaseContent
          const camelCaseKey = elementConfig.key.replace(/_([a-z])/g, (_, c) =>
            c.toUpperCase()
          );
          const contentKey = `${camelCaseKey}Content`;
          const rawContent = promptData[contentKey];
          let central = '';

          if (rawContent == null) {
            central = '';
          } else if (typeof rawContent === 'string') {
            central = rawContent;
          } else {
            logger.warn(
              `PromptBuilder.build: Content for '${elementConfig.key}' (from '${contentKey}') is not a string, null, or undefined. It is of type '${typeof rawContent}'. Skipping this entire element.`
            );
            return '';
          }

          if (resolvedPrefix || central || resolvedSuffix) {
            return `${resolvedPrefix}${central}${resolvedSuffix}`;
          }
          return '';
        }
      );
    });

    test('should assemble prompt according to promptAssemblyOrder with prefixes, suffixes, and placeholders', async () => {
      const promptData = {
        headerContent: 'Title',
        introductionContent: 'Hello',
        mainContentContent: 'This is the main part.',
        footerContent: 'Signature',
        global_id: 'G1',
        character_name: 'Alice',
        world_name: 'Wonderland',
      };

      // Simple placeholder mock
      mockPlaceholderResolver.resolve.mockImplementation((text, pData) => {
        return text
          .replace('{global_id}', pData.global_id || '')
          .replace('{character_name}', pData.character_name || '')
          .replace('{world_name}', pData.world_name || '');
      });

      const expected =
        '== HEADER G1 ==\nTitle\n== END HEADER ==' +
        'Intro: Alice says: "Hello"\n' +
        'Content: This is the main part.' +
        '\n-- Footer Wonderland --Signature\nEnd of Prompt.';

      const result = await promptBuilder.build('core/test', promptData);
      expect(result).toBe(expected);
    });

    test('should handle missing placeholders by replacing with empty string and logging warning via PlaceholderResolver', async () => {
      const promptData = {
        introductionContent: 'Hi',
        world_name: 'Mars', // missing global_id and character_name
        headerContent: 'A',
        mainContentContent: 'B',
        footerContent: 'End',
      };

      mockPlaceholderResolver.resolve.mockImplementation((text, pData) => {
        let resolved = text;
        if (text.includes('{global_id}')) {
          resolved = resolved.replace('{global_id}', pData.global_id || '');
          if (!('global_id' in pData)) {
            logger.warn(
              `PlaceholderResolver: Placeholder "{global_id}" not found in provided data sources. Replacing with empty string.`
            );
          }
        }
        if (text.includes('{character_name}')) {
          resolved = resolved.replace(
            '{character_name}',
            pData.character_name || ''
          );
          if (!('character_name' in pData)) {
            logger.warn(
              `PlaceholderResolver: Placeholder "{character_name}" not found in provided data sources. Replacing with empty string.`
            );
          }
        }
        if (text.includes('{world_name}')) {
          resolved = resolved.replace('{world_name}', pData.world_name || '');
        }
        return resolved;
      });

      await promptBuilder.build('core/test', promptData);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'PlaceholderResolver: Placeholder "{global_id}" not found'
        )
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'PlaceholderResolver: Placeholder "{character_name}" not found'
        )
      );
    });

    test('should handle placeholders with accidental spaces like {  val  } via PlaceholderResolver', async () => {
      const spacingConfig = {
        configId: 'spacing_config',
        modelIdentifier: 'spacing/test',
        promptElements: [{ key: 'el', prefix: 'V: {  val  }' }],
        promptAssemblyOrder: ['el'],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(spacingConfig);

      mockPlaceholderResolver.resolve.mockImplementation((text, pData) => {
        // trim inside braces
        return text.replace(/\{\s*val\s*\}/, pData.val || '');
      });

      const result = await promptBuilder.build('spacing_config', {
        val: 'X',
        elContent: '',
      });
      expect(result).toBe('V: X');
      expect(mockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        'V: {  val  }',
        expect.objectContaining({ val: 'X', elContent: '' })
      );
      expect(mockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ val: 'X', elContent: '' })
      );
    });

    test('should skip element and log warning if content is not a string (and not special)', async () => {
      const promptData = {
        headerContent: { foo: 'bar' },
        introductionContent: 'OK',
        mainContentContent: 'Fine',
        footerContent: 'Bye',
        global_id: 'ID',
        character_name: 'Zed',
        world_name: '123',
      };

      mockPlaceholderResolver.resolve.mockImplementation((t, p) =>
        t.replace('{global_id}', p.global_id)
      );

      const result = await promptBuilder.build('core/test', promptData);

      expect(result).not.toContain('HEADER');
      expect(result).toContain('OK');
      expect(result).toContain('Fine');
      expect(result).toContain('Bye');
      expect(logger.warn).toHaveBeenCalledWith(
        "PromptBuilder.build: Content for 'header' (from 'headerContent') is not a string, null, or undefined. It is of type 'object'. Skipping this entire element."
      );
    });

    test('should convert snake_case element key to camelCaseContent for promptData lookup', async () => {
      const snakeConfig = {
        configId: 'snake_config',
        modelIdentifier: 'snake/test',
        promptElements: [
          { key: 'my_key_element', prefix: 'Pre:', suffix: ':Suf' },
        ],
        promptAssemblyOrder: ['my_key_element'],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(snakeConfig);
      mockPlaceholderResolver.resolve.mockImplementation((t) => t);

      const result = await promptBuilder.build('snake_config', {
        myKeyElementContent: 'VAL',
      });
      expect(result).toBe('Pre:VAL:Suf');
    });
  });
});

// --- FILE END ---
