// tests/prompting/promptBuilder.specialHandlingForPerceptionLog.test.js
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
  resolve: jest.fn(),
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(),
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn(),
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

  describe('Special Handling for Perception Log', () => {
    const perceptionLogTestConfig = {
      configId: 'p_log_test',
      modelIdentifier: 'log/test',
      promptElements: [
        { key: 'header', prefix: 'Conversation Start (ID: {session_id})\n' },
        {
          key: 'perception_log_entry',
          prefix: '[{timestamp}][{role} ({source_system})]: ',
          suffix: '\n',
        },
        {
          key: 'perception_log_wrapper',
          prefix: '--- Log ---\n',
          suffix: '--- End Log ---\n',
        },
        { key: 'footer', prefix: 'End.' },
      ],
      promptAssemblyOrder: ['header', 'perception_log_wrapper', 'footer'],
    };
    const noEntryConfig = {
      configId: 'no_entry_cfg',
      modelIdentifier: 'log/no_entry',
      promptElements: [
        { key: 'perception_log_wrapper', prefix: '<WRAP>', suffix: '</WRAP>' },
      ],
      promptAssemblyOrder: ['perception_log_wrapper'],
    };

    beforeEach(() => {
      mockLlmConfigService.getConfig.mockResolvedValue(perceptionLogTestConfig);

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

      // 1) StandardElementAssembler: pass promptData twice to resolve()
      mockStandardAssembler.assemble.mockImplementation(
        (elementConfig, promptData, placeholderResolverInstance) => {
          const prefix = placeholderResolverInstance.resolve(
            elementConfig.prefix || '',
            promptData,
            promptData
          );
          const suffix = placeholderResolverInstance.resolve(
            elementConfig.suffix || '',
            promptData,
            promptData
          );
          const content = promptData[`${elementConfig.key}Content`] || '';
          return `${prefix}${content}${suffix}`;
        }
      );

      // 2) PerceptionLogAssembler: use noEntryConfig.configId for missing-entry warning
      mockPerceptionLogAssembler.assemble.mockImplementation(
        (
          wrapperConfig,
          promptData,
          placeholderResolverInstance,
          elementsMap
        ) => {
          const prefix = placeholderResolverInstance.resolve(
            wrapperConfig.prefix || '',
            promptData,
            promptData
          );
          const suffix = placeholderResolverInstance.resolve(
            wrapperConfig.suffix || '',
            promptData,
            promptData
          );
          const arr = promptData.perceptionLogArray;
          if (!Array.isArray(arr) || arr.length === 0) {
            logger.debug(
              "PromptBuilder.build: Perception log array for 'perception_log_wrapper' missing or empty in PromptData. Skipping wrapper element."
            );
            return '';
          }
          const entryConfig = elementsMap.get('perception_log_entry');
          if (!entryConfig) {
            // Correctly reference noEntryConfig.configId
            logger.warn(
              `PromptBuilder.build: Missing 'perception_log_entry' config for perception log in configId "${noEntryConfig.configId}". Entries will be empty.`
            );
            logger.debug(
              "PromptBuilder.build: Perception log wrapper for 'perception_log_wrapper' added. Entries were not formatted due to missing 'perception_log_entry' dependencyInjection."
            );
            return `${prefix}${suffix}`;
          }
          let out = '';
          for (const entry of arr) {
            if (!entry || typeof entry !== 'object') {
              logger.warn(
                'PromptBuilder.build: Invalid perception log entry. Skipping.',
                { entry }
              );
              continue;
            }
            const entryData = { ...entry };
            delete entryData.timestamp;
            const entryPrefix = placeholderResolverInstance.resolve(
              entryConfig.prefix || '',
              entryData,
              promptData
            );
            const entrySuffix = placeholderResolverInstance.resolve(
              entryConfig.suffix || '',
              entryData,
              promptData
            );
            const content = entry.content ?? '';
            out += `${entryPrefix}${content}${entrySuffix}`;
          }
          return `${prefix}${out}${suffix}`;
        }
      );
    });

    test('should correctly assemble perception log with multiple entries, substituting placeholders', async () => {
      const promptData = {
        session_id: 'S123',
        source_system: 'CoreAI',
        headerContent: '',
        footerContent: '',
        perceptionLogArray: [
          {
            role: 'user',
            timestamp: 'T1',
            content: 'Msg1.',
            source_system: 'UserInput',
          },
          { role: 'assistant', timestamp: 'T2', content: 'Msg2.' },
        ],
      };
      mockPlaceholderResolver.resolve.mockImplementation(
        (text, primary, secondary) => {
          let result = text;
          result = result.replace(
            '{session_id}',
            (secondary || {}).session_id || ''
          );
          result = result.replace('{role}', (primary || {}).role || '');
          const src =
            (primary && primary.source_system) ||
            (secondary && secondary.source_system) ||
            '';
          result = result.replace('{source_system}', src);
          return result.replace('{timestamp}', '');
        }
      );

      const result = await promptBuilder.build('p_log_test', promptData);
      const expected =
        'Conversation Start (ID: S123)\n' +
        '--- Log ---\n' +
        '[][user (UserInput)]: Msg1.\n' +
        '[][assistant (CoreAI)]: Msg2.\n' +
        '--- End Log ---\n' +
        'End.';
      expect(result).toBe(expected);
    });

    test('should gracefully omit perception log if array is empty, null, or undefined', async () => {
      mockPlaceholderResolver.resolve.mockImplementation((text, ds) =>
        text.replace('{session_id}', ds.session_id || '')
      );

      const base = { session_id: 'S0', headerContent: '', footerContent: '' };
      const emptyResult = await promptBuilder.build('p_log_test', {
        ...base,
        perceptionLogArray: [],
      });
      expect(emptyResult).toBe(`Conversation Start (ID: S0)\nEnd.`);
      expect(logger.debug).toHaveBeenCalledWith(
        "PromptBuilder.build: Perception log array for 'perception_log_wrapper' missing or empty in PromptData. Skipping wrapper element."
      );
    });

    test('should process wrapper even if perception_log_entry dependencyInjection is missing (entries will be empty)', async () => {
      mockLlmConfigService.getConfig.mockResolvedValue(noEntryConfig);
      mockPlaceholderResolver.resolve.mockImplementation((t) => t);

      const result = await promptBuilder.build('no_entry_cfg', {
        perceptionLogArray: [{ role: 'user', content: 'Message' }],
      });
      expect(result).toBe('<WRAP></WRAP>');
      expect(logger.warn).toHaveBeenCalledWith(
        `PromptBuilder.build: Missing 'perception_log_entry' config for perception log in configId "no_entry_cfg". Entries will be empty.`
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "PromptBuilder.build: Perception log wrapper for 'perception_log_wrapper' added. Entries were not formatted due to missing 'perception_log_entry' dependencyInjection."
      );
    });

    test('should skip invalid entries (null, non-object) in perceptionLogArray and log warning', async () => {
      mockPlaceholderResolver.resolve.mockImplementation((t, p, g) => {
        let r = t.replace('{session_id}', g.session_id || '');
        r = r.replace('{role}', p.role || '');
        r = r.replace(
          '{source_system}',
          p.source_system || g.source_system || ''
        );
        return r.replace('{timestamp}', '');
      });

      const promptData = {
        session_id: 'SID',
        source_system: 'SYS',
        headerContent: '',
        footerContent: '',
        perceptionLogArray: [
          {
            role: 'user',
            timestamp: 'T',
            content: 'Valid',
            source_system: 'SS',
          },
          null,
          'oops',
        ],
      };
      const result = await promptBuilder.build('p_log_test', promptData);
      expect(logger.warn).toHaveBeenCalledWith(
        'PromptBuilder.build: Invalid perception log entry. Skipping.',
        { entry: null }
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'PromptBuilder.build: Invalid perception log entry. Skipping.',
        { entry: 'oops' }
      );
      expect(result).toContain('[][user (SS)]: Valid\n');
    });

    test('should handle entries with missing content (null/undefined) as empty string content', async () => {
      mockPlaceholderResolver.resolve.mockImplementation((t, p, g) => {
        let r = t.replace('{session_id}', g.session_id || '');
        r = r.replace('{role}', p.role || '');
        r = r.replace('{source_system}', g.source_system || '');
        return r.replace('{timestamp}', '');
      });

      const promptData = {
        session_id: 'S',
        source_system: 'G',
        headerContent: '',
        footerContent: '',
        perceptionLogArray: [{ role: 'user', timestamp: 'T', content: null }],
      };
      const result = await promptBuilder.build('p_log_test', promptData);
      expect(result).toContain('[][user (G)]: \n');
    });
  });
});
// --- FILE END ---
