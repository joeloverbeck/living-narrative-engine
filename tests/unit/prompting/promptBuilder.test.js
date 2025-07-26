/**
 * @file Unit tests for PromptBuilder
 * @description Comprehensive unit tests to achieve 80%+ coverage for PromptBuilder.js
 */

/* eslint-env node */
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/* ------------------------------------------------------------------------- */
/* Mock Utilities                                                           */
/* ------------------------------------------------------------------------- */

const createMockLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
});

const createMockLLMConfigService = (configs = {}) => ({
  loadConfiguration: jest.fn(async (id) => configs[id] || null),
});

const createMockTemplateService = () => ({
  processCharacterPrompt: jest.fn().mockReturnValue('MOCK_TEMPLATE_OUTPUT'),
});

const createMockDataFormatter = () => ({
  formatPromptData: jest.fn().mockReturnValue({ formatted: 'data' }),
});

const BASIC_LLM_CONFIG = {
  configId: 'test-config',
  displayName: 'Test LLM',
  modelIdentifier: 'test-model',
  endpointUrl: 'https://test.api',
  apiType: 'test',
  jsonOutputStrategy: { method: 'test' },
};

const SAMPLE_PROMPT_DATA = {
  taskDefinitionContent: 'Test task',
  characterPersonaContent: 'Test persona',
  portrayalGuidelinesContent: 'Test guidelines',
  contentPolicyContent: 'Test policy',
  worldContextContent: 'Test world',
  availableActionsInfoContent: 'Test actions',
  userInputContent: 'Test input',
  finalInstructionsContent: 'Test instructions',
  assistantResponsePrefix: '\n',
  perceptionLogArray: [],
  thoughtsArray: [],
  notesArray: [],
  goalsArray: [],
};

/* ------------------------------------------------------------------------- */
/* Test Suite                                                               */
/* ------------------------------------------------------------------------- */

describe('PromptBuilder - Unit Tests', () => {
  let logger;
  let llmConfigService;

  beforeEach(() => {
    logger = createMockLogger();
    llmConfigService = createMockLLMConfigService({
      'test-llm': BASIC_LLM_CONFIG,
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Constructor Tests                                                        */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('Constructor', () => {
    test('should construct with required dependencies', () => {
      const builder = new PromptBuilder({
        logger,
        llmConfigService,
      });

      expect(builder).toBeInstanceOf(PromptBuilder);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PromptBuilder (template-based) initialised')
      );
    });

    test('should use console logger when no logger provided', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      const builder = new PromptBuilder({
        llmConfigService,
      });

      expect(builder).toBeInstanceOf(PromptBuilder);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PromptBuilder (template-based) initialised')
      );

      consoleSpy.mockRestore();
    });

    test('should create default PromptTemplateService when not provided', () => {
      const builder = new PromptBuilder({
        logger,
        llmConfigService,
      });

      expect(builder).toBeInstanceOf(PromptBuilder);
      // Verify default service creation by checking the debug log
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PromptBuilder (template-based) initialised')
      );
    });

    test('should create default PromptDataFormatter when not provided', () => {
      const builder = new PromptBuilder({
        logger,
        llmConfigService,
      });

      expect(builder).toBeInstanceOf(PromptBuilder);
      // Verify constructor completes successfully
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PromptBuilder (template-based) initialised')
      );
    });

    test('should use provided templateService and dataFormatter', () => {
      const mockTemplateService = createMockTemplateService();
      const mockDataFormatter = createMockDataFormatter();

      const builder = new PromptBuilder({
        logger,
        llmConfigService,
        templateService: mockTemplateService,
        dataFormatter: mockDataFormatter,
      });

      expect(builder).toBeInstanceOf(PromptBuilder);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PromptBuilder (template-based) initialised')
      );
    });

    test('should throw InvalidArgumentError when llmConfigService is null', () => {
      expect(() => {
        new PromptBuilder({
          logger,
          llmConfigService: null,
        });
      }).toThrow(InvalidArgumentError);
    });

    test('should throw InvalidArgumentError when llmConfigService is undefined', () => {
      expect(() => {
        new PromptBuilder({
          logger,
        });
      }).toThrow(InvalidArgumentError);
    });

    test('should throw InvalidArgumentError when llmConfigService lacks required method', () => {
      const invalidService = {};

      expect(() => {
        new PromptBuilder({
          logger,
          llmConfigService: invalidService,
        });
      }).toThrow(InvalidArgumentError);
    });

    test('should validate llmConfigService has loadConfiguration method', () => {
      const serviceWithMethod = {
        loadConfiguration: jest.fn(),
      };

      expect(() => {
        new PromptBuilder({
          logger,
          llmConfigService: serviceWithMethod,
        });
      }).not.toThrow();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Build Method - Input Validation Tests                                   */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('build() - Input Validation', () => {
    let builder;

    beforeEach(() => {
      builder = new PromptBuilder({
        logger,
        llmConfigService,
      });
    });

    test('should return empty string when llmId is null', async () => {
      const result = await builder.build(null, SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('llmId is required and must be a string')
      );
    });

    test('should return empty string when llmId is undefined', async () => {
      const result = await builder.build(undefined, SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('llmId is required and must be a string')
      );
    });

    test('should return empty string when llmId is empty string', async () => {
      const result = await builder.build('', SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('llmId is required and must be a string')
      );
    });

    test('should return empty string when llmId is not a string', async () => {
      const result = await builder.build(123, SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('llmId is required and must be a string')
      );
    });

    test('should return empty string when promptData is null', async () => {
      const result = await builder.build('test-llm', null);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('promptData is required and must be an object')
      );
    });

    test('should return empty string when promptData is undefined', async () => {
      const result = await builder.build('test-llm', undefined);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('promptData is required and must be an object')
      );
    });

    test('should return empty string when promptData is not an object', async () => {
      const result = await builder.build('test-llm', 'not-an-object');

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('promptData is required and must be an object')
      );
    });

    test('should log debug message when build() is called', async () => {
      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "PromptBuilder.build called for llmId='test-llm'"
        )
      );
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Build Method - Configuration Loading Tests                              */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('build() - Configuration Loading', () => {
    let builder;

    beforeEach(() => {
      builder = new PromptBuilder({
        logger,
        llmConfigService,
      });
    });

    test('should return empty string when LLM configuration not found', async () => {
      const result = await builder.build('nonexistent-llm', SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "No configuration found for llmId 'nonexistent-llm'"
        )
      );
    });

    test('should call loadConfiguration with correct llmId', async () => {
      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(llmConfigService.loadConfiguration).toHaveBeenCalledWith(
        'test-llm'
      );
    });

    test('should handle loadConfiguration throwing error', async () => {
      llmConfigService.loadConfiguration.mockRejectedValueOnce(
        new Error('Configuration load failed')
      );

      await expect(
        builder.build('test-llm', SAMPLE_PROMPT_DATA)
      ).rejects.toThrow('Configuration load failed');
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Build Method - Service Integration Tests                                */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('build() - Service Integration', () => {
    let mockTemplateService;
    let mockDataFormatter;
    let builder;

    beforeEach(() => {
      mockTemplateService = createMockTemplateService();
      mockDataFormatter = createMockDataFormatter();

      builder = new PromptBuilder({
        logger,
        llmConfigService,
        templateService: mockTemplateService,
        dataFormatter: mockDataFormatter,
      });
    });

    test('should call dataFormatter.formatPromptData with correct data', async () => {
      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(mockDataFormatter.formatPromptData).toHaveBeenCalledWith(
        SAMPLE_PROMPT_DATA
      );
    });

    test('should call templateService.processCharacterPrompt with formatted data', async () => {
      const formattedData = { formatted: 'test-data' };
      mockDataFormatter.formatPromptData.mockReturnValue(formattedData);

      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(mockTemplateService.processCharacterPrompt).toHaveBeenCalledWith(
        formattedData
      );
    });

    test('should return template service output', async () => {
      const expectedPrompt = 'PROCESSED_TEMPLATE_RESULT';
      mockTemplateService.processCharacterPrompt.mockReturnValue(
        expectedPrompt
      );

      const result = await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(result).toBe(expectedPrompt);
    });

    test('should log completion with prompt length', async () => {
      const promptResult = 'Test prompt result';
      mockTemplateService.processCharacterPrompt.mockReturnValue(promptResult);

      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Final prompt length = ${promptResult.length}`)
      );
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Build Method - Happy Path Tests                                         */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('build() - Happy Path', () => {
    let builder;

    beforeEach(() => {
      builder = new PromptBuilder({
        logger,
        llmConfigService,
      });
    });

    test('should complete full build process successfully', async () => {
      const result = await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle empty promptData object', async () => {
      const result = await builder.build('test-llm', {});

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    test('should handle promptData with minimal fields', async () => {
      const minimalData = {
        taskDefinitionContent: 'Test task',
        perceptionLogArray: [],
        thoughtsArray: [],
        notesArray: [],
        goalsArray: [],
      };

      const result = await builder.build('test-llm', minimalData);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Build Method - Error Handling                                           */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('build() - Error Handling', () => {
    let builder;
    let mockTemplateService;
    let mockDataFormatter;

    beforeEach(() => {
      mockTemplateService = createMockTemplateService();
      mockDataFormatter = createMockDataFormatter();

      builder = new PromptBuilder({
        logger,
        llmConfigService,
        templateService: mockTemplateService,
        dataFormatter: mockDataFormatter,
      });
    });

    test('should handle dataFormatter throwing error', async () => {
      mockDataFormatter.formatPromptData.mockImplementation(() => {
        throw new Error('Data formatting failed');
      });

      await expect(
        builder.build('test-llm', SAMPLE_PROMPT_DATA)
      ).rejects.toThrow('Data formatting failed');
    });

    test('should handle templateService throwing error', async () => {
      mockTemplateService.processCharacterPrompt.mockImplementation(() => {
        throw new Error('Template processing failed');
      });

      await expect(
        builder.build('test-llm', SAMPLE_PROMPT_DATA)
      ).rejects.toThrow('Template processing failed');
    });

    test('should handle dataFormatter returning null', async () => {
      mockDataFormatter.formatPromptData.mockReturnValue(null);

      const result = await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(mockTemplateService.processCharacterPrompt).toHaveBeenCalledWith(
        null
      );
      expect(result).toBeTruthy(); // Should still return template service result
    });

    test('should handle templateService returning empty string', async () => {
      mockTemplateService.processCharacterPrompt.mockReturnValue('');

      const result = await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(result).toBe('');
    });
  });

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Edge Cases and Integration Scenarios                                    */
  /* ──────────────────────────────────────────────────────────────────────── */

  describe('Edge Cases and Integration', () => {
    test('should work with real PromptTemplateService and PromptDataFormatter', async () => {
      const realTemplateService = new PromptTemplateService({ logger });
      const realDataFormatter = new PromptDataFormatter({ logger });

      const builder = new PromptBuilder({
        logger,
        llmConfigService,
        templateService: realTemplateService,
        dataFormatter: realDataFormatter,
      });

      const result = await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle complex promptData with all fields populated', async () => {
      const complexPromptData = {
        taskDefinitionContent: 'Complex task definition',
        characterPersonaContent: 'Detailed character persona',
        portrayalGuidelinesContent: 'Comprehensive portrayal guidelines',
        contentPolicyContent: 'Detailed content policy',
        worldContextContent: 'Rich world context',
        availableActionsInfoContent: 'Extensive available actions',
        userInputContent: 'User input content',
        finalInstructionsContent: 'Final instructions',
        assistantResponsePrefix: 'Assistant: ',
        perceptionLogArray: [
          { type: 'visual', content: 'Bright light ahead' },
          { type: 'audio', content: 'Footsteps approaching' },
          { type: 'tactile', content: 'Cold wind' },
        ],
        thoughtsArray: [
          { text: 'What should I do next?', timestamp: '2024-01-01T10:00:00Z' },
          { text: 'This seems dangerous', timestamp: '2024-01-01T10:01:00Z' },
        ],
        notesArray: [
          {
            text: 'Important detail to remember',
            timestamp: '2024-01-01T09:30:00Z',
          },
          { text: 'Another crucial note', timestamp: '2024-01-01T09:45:00Z' },
        ],
        goalsArray: [
          { text: 'Complete the quest', timestamp: '2024-01-01T09:00:00Z' },
          { text: 'Help the villagers', timestamp: '2024-01-01T09:15:00Z' },
        ],
      };

      const builder = new PromptBuilder({
        logger,
        llmConfigService,
      });

      const result = await builder.build('test-llm', complexPromptData);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(100); // Should be substantial content
    });

    test('should log appropriate debug messages throughout build process', async () => {
      const builder = new PromptBuilder({
        logger,
        llmConfigService,
      });

      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      // Verify all expected debug calls
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "PromptBuilder.build called for llmId='test-llm'"
        )
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'PromptBuilder.build: Completed. Final prompt length ='
        )
      );
    });

    test('should maintain correct call order: loadConfig -> formatData -> processTemplate', async () => {
      const mockTemplateService = createMockTemplateService();
      const mockDataFormatter = createMockDataFormatter();
      const callOrder = [];

      llmConfigService.loadConfiguration.mockImplementation(async (id) => {
        callOrder.push('loadConfiguration');
        return id === 'test-llm' ? BASIC_LLM_CONFIG : null;
      });

      mockDataFormatter.formatPromptData.mockImplementation((data) => {
        callOrder.push('formatPromptData');
        return { formatted: 'data' };
      });

      mockTemplateService.processCharacterPrompt.mockImplementation((data) => {
        callOrder.push('processCharacterPrompt');
        return 'final result';
      });

      const builder = new PromptBuilder({
        logger,
        llmConfigService,
        templateService: mockTemplateService,
        dataFormatter: mockDataFormatter,
      });

      await builder.build('test-llm', SAMPLE_PROMPT_DATA);

      expect(callOrder).toEqual([
        'loadConfiguration',
        'formatPromptData',
        'processCharacterPrompt',
      ]);
    });
  });
});
