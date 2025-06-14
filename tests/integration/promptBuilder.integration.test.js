/* eslint-env jest */

import { describe, beforeEach, test, expect } from '@jest/globals';
import { PromptBuilder } from '../../src/prompting/promptBuilder.js';
import { AssemblerRegistry } from '../../src/prompting/assemblerRegistry.js';
import { StandardElementAssembler } from '../../src/prompting/assembling/standardElementAssembler.js';
import { IndexedChoicesAssembler } from '../../src/prompting/assembling/indexedChoicesAssembler.js';
import { PlaceholderResolver } from '../../src/utils/placeholderResolver.js';

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
    expect(result).toContain('<task>You are a helpful assistant.</task>');
    // Check for specialized element output
    expect(result).toContain('<choices>');
    expect(result).toContain('index: 1 --> go north (Move to the next area.)');
    expect(result).toContain('index: 2 --> wait (Do nothing.)');
    expect(result).toContain('</choices>');
    // Ensure no errors were thrown during resolution
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('should throw an error if a required assembler is not registered', async () => {
    // Arrange: Create a new registry without the 'task_definition' registration
    const incompleteRegistry = new AssemblerRegistry();
    incompleteRegistry.register(
      'indexed_choices',
      new IndexedChoicesAssembler({ logger: mockLogger })
    );

    const builderWithBadRegistry = new PromptBuilder({
      logger: mockLogger,
      llmConfigService: mockLlmConfigService,
      placeholderResolver,
      assemblerRegistry: incompleteRegistry, // Use the incomplete registry
      conditionEvaluator: mockConditionEvaluator,
    });

    const promptData = { taskDefinitionContent: 'This will fail.' };

    // Act & Assert
    await expect(
      builderWithBadRegistry.build(TEST_LLM_ID, promptData)
    ).rejects.toThrow(
      "AssemblerRegistry.resolve: No assembler registered for 'task_definition'"
    );

    // We expect the logger to have been called with the error message before it was thrown
    expect(mockLogger.error).toHaveBeenCalledWith(
      "AssemblerRegistry.resolve: No assembler registered for 'task_definition'"
    );
  });
});
