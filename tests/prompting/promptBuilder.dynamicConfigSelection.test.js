// tests/prompting/promptBuilder.dynamicConfigSelection.test.js
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

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
  resolve: jest.fn((text) => text), // Simple pass-through for these tests
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(), // Will be implemented per test
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''), // Default for unused assembler
});

describe('PromptBuilder', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {LLMConfigService} */
  let llmConfigService;
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
    mockPlaceholderResolver = mockPlaceholderResolverInstance();
    mockStandardAssembler = mockStandardElementAssemblerInstance();
    mockPerceptionLogAssembler = mockPerceptionLogAssemblerInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dynamic Configuration Selection (via LLMConfigService)', () => {
    const exactMatchConfig = {
      configId: 'exact_cfg',
      modelIdentifier: 'vendor/model-exact-match',
      promptElements: [{ key: 'test', prefix: 'Exact:' }],
      promptAssemblyOrder: ['test'],
    };
    const shortWildcardConfig = {
      configId: 'short_wild_cfg',
      modelIdentifier: 'vendor/*',
      promptElements: [{ key: 'test', prefix: 'ShortWild:' }],
      promptAssemblyOrder: ['test'],
    };
    const mediumWildcardConfig = {
      configId: 'medium_wild_cfg',
      modelIdentifier: 'vendor/model-*',
      promptElements: [{ key: 'test', prefix: 'MediumWild:' }],
      promptAssemblyOrder: ['test'],
    };
    const longWildcardConfig = {
      configId: 'long_wild_cfg',
      modelIdentifier: 'vendor/model-exact*',
      promptElements: [{ key: 'test', prefix: 'LongWild:' }],
      promptAssemblyOrder: ['test'],
    };
    const anotherLongWildcardConfig = {
      configId: 'another_long_wild_cfg',
      modelIdentifier: 'vendor/model-extra*',
      promptElements: [{ key: 'test', prefix: 'AnotherLongWild:' }],
      promptAssemblyOrder: ['test'],
    };
    const unrelatedConfig = {
      configId: 'unrelated_cfg',
      modelIdentifier: 'other-vendor/other-model',
      promptElements: [{ key: 'test', prefix: 'Unrelated:' }],
      promptAssemblyOrder: ['test'],
    };
    const configIdPriorityConfig = {
      configId: 'priority_cfg_id',
      modelIdentifier: 'vendor/model-exact-match', // same as exactMatchConfig.modelIdentifier
      promptElements: [{ key: 'test', prefix: 'PriorityByID:' }],
      promptAssemblyOrder: ['test'],
    };

    const allConfigs = [
      exactMatchConfig,
      shortWildcardConfig,
      mediumWildcardConfig,
      longWildcardConfig,
      anotherLongWildcardConfig,
      unrelatedConfig,
      configIdPriorityConfig,
    ];

    beforeEach(() => {
      llmConfigService = new LLMConfigService({
        logger,
        configurationProvider: { fetchData: jest.fn() },
        initialConfigs: allConfigs,
      });

      promptBuilder = new PromptBuilder({
        logger,
        llmConfigService,
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
          const content = promptData[`${camelCaseKey}Content`] || '';
          return `${prefix}${content}${suffix}`;
        }
      );

      logger.info.mockClear();
      logger.debug.mockClear();
      logger.warn.mockClear();
      logger.error.mockClear();
    });

    test('should select configuration by exact modelIdentifier match', async () => {
      const llmId = 'vendor/model-exact-match';
      const result = await promptBuilder.build(llmId, { testContent: 'X' });
      expect(result).toBe('Exact:X');
      expect(logger.debug).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by exact modelIdentifier match for "${llmId}". ConfigId: "${exactMatchConfig.configId}".`
      );
    });

    test('should select configuration by configId match if llmId is a configId', async () => {
      const llmId = 'priority_cfg_id';
      const result = await promptBuilder.build(llmId, { testContent: 'Y' });
      expect(result).toBe('PriorityByID:Y');
      expect(logger.debug).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Found configuration by direct configId match for "${llmId}". ConfigId: "${configIdPriorityConfig.configId}".`
      );
    });

    test('should select configuration by wildcard match if no exact match', async () => {
      const llmId = 'vendor/model-wildcard-test';
      const result = await promptBuilder.build(llmId, { testContent: 'Z' });
      expect(result).toBe('MediumWild:Z');
      expect(logger.debug).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmId}". Pattern: "${mediumWildcardConfig.modelIdentifier}", ConfigId: "${mediumWildcardConfig.configId}".`
      );
    });

    test('exact match should take precedence over wildcard when llmId is not a configId', async () => {
      const llmId = 'vendor/model-exact-match';
      const result = await promptBuilder.build(llmId, { testContent: 'A' });
      expect(result).toBe('Exact:A');
    });

    test('longer wildcard prefix should take precedence over shorter ones', async () => {
      const llmId = 'vendor/model-exact-specific';
      const result = await promptBuilder.build(llmId, { testContent: 'B' });
      expect(result).toBe('LongWild:B');
    });

    test('should pick between wildcards based on longest prefix', async () => {
      const llmId = 'vendor/model-extracool';
      const result = await promptBuilder.build(llmId, { testContent: 'C' });
      expect(result).toBe('AnotherLongWild:C');
    });

    test('should return empty string and log error if no configuration matches', async () => {
      const llmId = 'no/match';
      const result = await promptBuilder.build(llmId, { testContent: 'D' });
      expect(result).toBe('');
      expect(logger.warn).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: No configuration found for identifier "${llmId}" after checking configId, exact modelIdentifier, and wildcard modelIdentifier.`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `PromptBuilder.build: No configuration found for llmId "${llmId}".`
      );
    });

    test('should handle llmId shorter than some wildcard prefixes but matching a general one', async () => {
      const llmId = 'vendor/mode';
      const result = await promptBuilder.build(llmId, { testContent: 'E' });
      expect(result).toBe('ShortWild:E');
    });

    test('wildcard should not match if llmId does not start with the prefix', async () => {
      const llmId = 'other-vendor/model-exact-plus';
      const result = await promptBuilder.build(llmId, { testContent: 'F' });
      expect(result).toBe('');
    });
  });
});
// --- FILE END ---
