// tests/services/promptBuilder.dynamicConfigSelection.test.js
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

/** @returns {jest.Mocked<PlaceholderResolver>} */
const mockPlaceholderResolverInstance = () => ({
  resolve: jest.fn((text) => text), // Simple pass-through for these tests
});

/** @returns {jest.Mocked<StandardElementAssembler>} */
const mockStandardElementAssemblerInstance = () => ({
  assemble: jest.fn(), // Default mock, specific implementation will be set in test suite
});

/** @returns {jest.Mocked<PerceptionLogAssembler>} */
const mockPerceptionLogAssemblerInstance = () => ({
  assemble: jest.fn().mockReturnValue(''), // Default for unused assembler
});

describe('PromptBuilder', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {LLMConfigService} */
  let llmConfigService; // Will be a real instance in the nested describe
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
    // LLMConfigService and PromptBuilder will be set up in the nested describe block
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
      modelIdentifier: 'vendor/model-exact-match', // Same modelID as exactMatchConfig
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
        llmConfigService: llmConfigService,
        placeholderResolver: mockPlaceholderResolver,
        standardElementAssembler: mockStandardAssembler, // Pass the mock
        perceptionLogAssembler: mockPerceptionLogAssembler, // Pass the mock
        notesSectionAssembler: new NotesSectionAssembler({ logger }),
      });

      // Configure the mock StandardElementAssembler for this suite
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

          return `${resolvedPrefix}${centralContentString}${resolvedSuffix}`;
        }
      );

      logger.info.mockClear();
      logger.debug.mockClear();
      logger.warn.mockClear();
      logger.error.mockClear();
    });

    test('should select configuration by exact modelIdentifier match', async () => {
      const llmIdToTest = 'vendor/model-exact-match';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      // exactMatchConfig is chosen because LLMConfigService finds it first for this modelIdentifier.
      expect(result).toBe('Exact:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by exact modelIdentifier match for "${llmIdToTest}". ConfigId: "${exactMatchConfig.configId}".`
      );
    });

    test('should select configuration by configId match if llmId is a configId', async () => {
      const llmIdToTest = 'priority_cfg_id';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('PriorityByID:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Found configuration by direct configId match for "${llmIdToTest}". ConfigId: "${configIdPriorityConfig.configId}".`
      );
    });

    test('should select configuration by wildcard match if no exact match (by configId or modelIdentifier)', async () => {
      const llmIdToTest = 'vendor/model-wildcard-test';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('MediumWild:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmIdToTest}". Pattern: "${mediumWildcardConfig.modelIdentifier}", ConfigId: "${mediumWildcardConfig.configId}".`
      );
    });

    test('exact match (by modelIdentifier) should take precedence over wildcard match if llmId is not a configId', async () => {
      const llmIdToTest = 'vendor/model-exact-match'; // Not a configId
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('Exact:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by exact modelIdentifier match for "${llmIdToTest}". ConfigId: "${exactMatchConfig.configId}".`
      );
    });

    test('longer wildcard prefix should take precedence over shorter wildcard prefix', async () => {
      const llmIdToTest = 'vendor/model-exact-specific';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('LongWild:data'); // "vendor/model-exact*" vs "vendor/model-*" vs "vendor/*"
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmIdToTest}". Pattern: "${longWildcardConfig.modelIdentifier}", ConfigId: "${longWildcardConfig.configId}".`
      );
    });

    test('should correctly pick between multiple matching wildcards based on longest prefix', async () => {
      // llmIdToTest will match "vendor/model-extra*" and "vendor/model-*" and "vendor/*"
      // "vendor/model-extra*" is the longest.
      const llmIdToTest = 'vendor/model-extracool';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('AnotherLongWild:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmIdToTest}". Pattern: "${anotherLongWildcardConfig.modelIdentifier}", ConfigId: "${anotherLongWildcardConfig.configId}".`
      );
    });

    test('should return empty string and log error if no configuration matches', async () => {
      const llmIdToTest = 'non-existent-vendor/non-existent-model';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('');
      expect(logger.warn).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: No configuration found for identifier "${llmIdToTest}" after checking configId, exact modelIdentifier, and wildcard modelIdentifier.`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "${llmIdToTest}". Cannot build prompt.`
      );
    });

    test('should correctly handle llmId shorter than some wildcard prefixes but matching a general one', async () => {
      // "vendor/mode" matches "vendor/*" but not "vendor/model-*" or "vendor/model-exact*"
      const llmIdToTest = 'vendor/mode';
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('ShortWild:data');
      expect(logger.info).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: Selected configuration by wildcard modelIdentifier match for "${llmIdToTest}". Pattern: "${shortWildcardConfig.modelIdentifier}", ConfigId: "${shortWildcardConfig.configId}".`
      );
    });

    test('wildcard should not match if llmId does not start with prefix', async () => {
      const llmIdToTest = 'different-vendor/model-exact-plus'; // Does not match "vendor/*" etc.
      const result = await promptBuilder.build(llmIdToTest, {
        testContent: 'data',
      });
      expect(result).toBe('');
      expect(logger.warn).toHaveBeenCalledWith(
        `LLMConfigService.getConfig: No configuration found for identifier "${llmIdToTest}" after checking configId, exact modelIdentifier, and wildcard modelIdentifier.`
      );
      expect(logger.error).toHaveBeenCalledWith(
        `PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "${llmIdToTest}". Cannot build prompt.`
      );
    });
  });
});

// --- FILE END ---
