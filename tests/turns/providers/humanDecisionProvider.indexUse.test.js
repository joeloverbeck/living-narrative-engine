// test/turns/providers/humanDecisionProvider.indexUse.test.js

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { HumanDecisionProvider } from '../../../src/turns/providers/humanDecisionProvider.js';

// Mock dependencies
const mockPromptCoordinator = {
  prompt: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Test setup
describe('HumanDecisionProvider', () => {
  let humanDecisionProvider;
  let mockActor;
  let mockContext;
  let availableActions;

  // Reset mocks and state before each test
  beforeEach(() => {
    jest.clearAllMocks();

    humanDecisionProvider = new HumanDecisionProvider({
      promptCoordinator: mockPromptCoordinator,
      actionIndexingService: {}, // Not used in the corrected implementation
      logger: mockLogger,
    });

    mockActor = { id: 'player-1' };
    mockContext = {}; // Keep it simple, not needed for this logic

    // A sample list of indexed actions that `decide` will receive
    availableActions = [
      { index: 1, id: 'core:wait', command: 'wait' },
      {
        index: 2,
        id: 'core:go',
        command: 'go north',
        params: { direction: 'north' },
      },
      { index: 3, id: 'core:look', command: 'look' },
    ];
  });

  // Test Case 1: The prompt returns a direct numerical index. This is the ideal, simple case.
  test('should return the correct index when prompt provides `chosenIndex` directly', async () => {
    const promptResult = {
      chosenIndex: 2,
      speech: 'I am going north.',
    };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    const decision = await humanDecisionProvider.decide(
      mockActor,
      mockContext,
      availableActions
    );

    expect(mockPromptCoordinator.prompt).toHaveBeenCalledWith(
      mockActor,
      expect.any(Object)
    );
    expect(decision.chosenIndex).toBe(2);
    expect(decision.speech).toBe('I am going north.');
    expect(decision.thoughts).toBeNull();
  });
});
