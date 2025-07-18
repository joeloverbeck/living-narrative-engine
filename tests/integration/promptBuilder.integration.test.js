/* eslint-env jest */

import { describe, beforeEach, test, expect } from '@jest/globals';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { AssemblerRegistry } from '../../src/prompting/assemblerRegistry.js';
import { StandardElementAssembler } from '../../src/prompting/assembling/standardElementAssembler.js';
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolverUtils.js';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockLlmConfigService = {
  getConfig: jest.fn(),
};

const mockConditionEvaluator = {
  isElementConditionMet: jest.fn(() => true),
};

describe('PromptBuilder Integration Test', () => {
  let promptBuilder;
  let assemblerRegistry;
  let placeholderResolver;

  const TEST_LLM_ID = 'test-llm-config';
  const MOCK_LLM_CONFIG = {
    promptElements: [
      { key: 'task_definition', prefix: '<task>', suffix: '</task>' },
      { key: 'indexed_choices', prefix: '<choices>', suffix: '</choices>' },
    ],
    promptAssemblyOrder: ['task_definition', 'indexed_choices'],
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // 1. Instantiate Core Services
    assemblerRegistry = new AssemblerRegistry();
    placeholderResolver = new PlaceholderResolver(mockLogger);
    const standardAssembler = new StandardElementAssembler({
      logger: mockLogger,
      safeEventDispatcher: { dispatch: jest.fn() },
    });
    const indexedChoicesAssembler = new IndexedChoicesAssembler({
      logger: mockLogger,
    });

    // 2. ***** Register Assemblers (This mirrors the fix in registerAI.js) *****
    // Register the generic assembler for standard keys
    assemblerRegistry.register('task_definition', standardAssembler);
    // Register the specialized assembler
    assemblerRegistry.register('indexed_choices', indexedChoicesAssembler);

    // 3. Configure mock services
    mockLlmConfigService.getConfig.mockResolvedValue(MOCK_LLM_CONFIG);

    // 4. Instantiate the System Under Test
    promptBuilder = new PromptBuilder({
      logger: mockLogger,
      llmConfigService: mockLlmConfigService,
      placeholderResolver,
      assemblerRegistry,
      conditionEvaluator: mockConditionEvaluator,
    });
  });

  test('should build a complete prompt with standard and specialized assemblers', async () => {
    // Arrange
    const promptData = {
      taskDefinitionContent: 'You are a helpful assistant.',
      indexedChoicesArray: [
        {
          index: 1,
          commandString: 'go north',
          description: 'Move to the next area.',
        },
        { index: 2, commandString: 'wait', description: 'Do nothing.' },
      ],
    };

    // Act
    const result = await promptBuilder.build(TEST_LLM_ID, promptData);

    // Assert
    expect(result).not.toBe('');
    // Check for standard element output
    expect(result).toContain('<task_definition>');
    expect(result).toContain('You are a helpful assistant.');
    expect(result).toContain('</task_definition>');
    // Check for specialized element output
    expect(result).toContain('<indexed_choices>');
    expect(result).toContain('[1] go north: Move to the next area.');
    expect(result).toContain('[2] wait: Do nothing.');
    expect(result).toContain('</indexed_choices>');
    // Ensure no errors were thrown during resolution
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('should handle minimal prompt data correctly', async () => {
    // Arrange: Create a new builder with minimal dependencies
    const builderWithMinimalData = new PromptBuilder({
      logger: mockLogger,
      llmConfigService: mockLlmConfigService,
    });

    const promptData = { taskDefinitionContent: 'This will work.' };

    // Act
    const result = await builderWithMinimalData.build(TEST_LLM_ID, promptData);

    // Assert
    expect(result).not.toBe('');
    expect(result).toContain('<task_definition>');
    expect(result).toContain('This will work.');
    expect(result).toContain('</task_definition>');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
