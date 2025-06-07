// tests/prompting/promptBuilder.errorConditions.test.js
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
  addOrUpdateConfigs: jest.fn(),
  resetCache: jest.fn(),
  getLlmConfigsCacheForTest: jest.fn(),
  getConfigsLoadedOrAttemptedFlagForTest: jest.fn(),
});

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
  resolve: jest.fn((str) => str), // Default mock returns string as is
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(), // Default mock, will be implemented in beforeEach
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''),
});

/** @type {LLMConfig} */
const MOCK_CONFIG_1 = {
  configId: 'test_config_v1',
  modelIdentifier: 'test-vendor/test-model-exact',
  promptElements: [
    { key: 'system_prompt', prefix: 'System: {data_val}', suffix: '\n' },
    { key: 'user_query', prefix: 'User: ', suffix: '\n' },
  ],
  promptAssemblyOrder: ['system_prompt', 'user_query'],
};

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
    });

    // General mock for standard assembler for this suite
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
        let centralContentString =
          typeof rawContent === 'string' ? rawContent : '';

        if (resolvedPrefix || centralContentString || resolvedSuffix) {
          return `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
        }
        return '';
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Conditions and Edge Cases', () => {
    test('build should return empty string and log error if llmId is null or not a string', async () => {
      // @ts-ignore
      expect(await promptBuilder.build(null, { sContent: 't' })).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'PromptBuilder.build: llmId is required and must be a string.'
      );
      logger.error.mockClear();
      // @ts-ignore
      expect(await promptBuilder.build({ id: 1 }, { sContent: 't' })).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'PromptBuilder.build: llmId is required and must be a string.'
      );
    });

    test('build should return empty string and log error if promptData is null or not an object', async () => {
      // @ts-ignore
      expect(
        await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, null)
      ).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'PromptBuilder.build: promptData is required and must be a non-null object.'
      );
      logger.error.mockClear();
      // @ts-ignore
      expect(
        await promptBuilder.build(MOCK_CONFIG_1.modelIdentifier, 'string')
      ).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'PromptBuilder.build: promptData is required and must be a non-null object.'
      );
    });

    test('should warn and skip key if key in assembly_order not in promptElements', async () => {
      const cfg = {
        configId: 'err_key_test',
        modelIdentifier: 'vendor/err_key_model',
        promptElements: [{ key: 'a', prefix: 'ContentA:' }],
        promptAssemblyOrder: ['a', 'b_missing'],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(cfg);
      // mockPlaceholderResolver.resolve is a pass-through by default from outer beforeEach.
      // The mockStandardAssembler will be called for "a".

      const result = await promptBuilder.build('vendor/err_key_model', {
        aContent: 'Data for A',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        `PromptBuilder.build: Key "b_missing" from promptAssemblyOrder not found in promptElements for configId "${cfg.configId}". Skipping.`
      );
      expect(result).toBe('ContentA:Data for A'); // Only 'a' should be assembled
    });

    test('should produce empty string if promptAssemblyOrder is empty', async () => {
      const cfg = {
        configId: 'empty_order_test',
        modelIdentifier: 'vendor/empty_order_model',
        promptElements: [{ key: 'a', prefix: 'ContentA:' }],
        promptAssemblyOrder: [],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(cfg);

      expect(
        await promptBuilder.build('vendor/empty_order_model', {
          aContent: 'Data for A',
        })
      ).toBe('');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully assembled prompt for llmId: vendor/empty_order_model using config ${cfg.configId}. Length: 0`
        )
      );
    });

    test('should produce empty string and warnings if promptElements is empty but order is not', async () => {
      const cfg = {
        configId: 'empty_elements_test',
        modelIdentifier: 'vendor/empty_elements_model',
        promptElements: [],
        promptAssemblyOrder: ['a_ordered_but_missing'],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(cfg);

      expect(await promptBuilder.build('vendor/empty_elements_model', {})).toBe(
        ''
      );
      expect(logger.warn).toHaveBeenCalledWith(
        `PromptBuilder.build: Key "a_ordered_but_missing" from promptAssemblyOrder not found in promptElements for configId "${cfg.configId}". Skipping.`
      );
    });

    test('placeholders for deeply nested structures in promptData are not resolved by default by PlaceholderResolver', async () => {
      const cfg = {
        configId: 'deep_placeholder_test',
        modelIdentifier: 'vendor/deep_placeholder_model',
        promptElements: [
          { key: 'user', prefix: 'Name: {user.name} {flat_val}' },
        ], // Suffix removed, content assumed empty for simplicity
        promptAssemblyOrder: ['user'],
      };
      mockLlmConfigService.getConfig.mockResolvedValue(cfg);

      // This test relies on PlaceholderResolver's specific behavior (and its logging).
      // We mock how PlaceholderResolver.resolve would behave given the input.
      mockPlaceholderResolver.resolve.mockImplementation((str, data) => {
        if (str === 'Name: {user.name} {flat_val}') {
          // Actual PlaceholderResolver looks for 'user.name' and 'flat_val' as top-level keys.
          // 'user.name' as a single key won't be found.
          // Simulate PlaceholderResolver logging for the unfound key.
          if (!Object.prototype.hasOwnProperty.call(data, 'user.name')) {
            logger.warn(
              `PlaceholderResolver: Placeholder "{user.name}" not found in provided data sources. Replacing with empty string.`
            );
          }
          const flatValResolved = Object.prototype.hasOwnProperty.call(
            data,
            'flat_val'
          )
            ? data.flat_val
            : '';
          return `Name: ${flatValResolved}`; // '{user.name}' becomes empty
        }
        return str;
      });

      const promptData = {
        userContent: '', // content for the 'user' element
        user: { name: 'Alice' },
        flat_val: 'FlatValue',
      };
      const result = await promptBuilder.build(
        'vendor/deep_placeholder_model',
        promptData
      );

      expect(mockPlaceholderResolver.resolve).toHaveBeenCalledWith(
        'Name: {user.name} {flat_val}',
        promptData
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'PlaceholderResolver: Placeholder "{user.name}" not found'
        )
      );
      expect(result).toBe('Name: FlatValue'); // Based on the mock resolve behavior
    });

    test('should log and return empty string if no configurations are loaded', async () => {
      mockLlmConfigService.getConfig.mockResolvedValue(undefined);

      expect(await promptBuilder.build('any/model', {})).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "any/model". Cannot build prompt.'
      );
    });
  });
});

// --- FILE END ---
