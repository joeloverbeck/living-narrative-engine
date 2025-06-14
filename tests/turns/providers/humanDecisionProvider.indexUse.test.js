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

  // Test Case 2: The prompt returns an action object/ID, simulating the output from PromptSession.
  // This verifies the primary bug fix.
  test('should resolve the correct index when prompt provides an action object/ID', async () => {
    const promptResult = {
      action: { id: 'core:wait' }, // No numerical index
      speech: 'I will wait.',
    };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    const decision = await humanDecisionProvider.decide(
      mockActor,
      mockContext,
      availableActions
    );

    expect(decision.chosenIndex).toBe(1); // Should correctly find index 1 for 'core:wait'
    expect(decision.speech).toBe('I will wait.');
  });

  // Test Case 3: The prompt returns an action ID that is not in the list of available actions.
  // This tests the error handling for an invalid choice.
  test('should throw an error if the prompt returns an invalid action ID', async () => {
    const promptResult = {
      action: { id: 'core:fly' }, // This action is not in our `availableActions`
    };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    // We expect the promise to be rejected with an error.
    await expect(
      humanDecisionProvider.decide(mockActor, mockContext, availableActions)
    ).rejects.toThrow('Action "core:fly" is not a valid choice.');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not find action with ID "core:fly"'),
      expect.any(Object)
    );
  });

  // Test Case 4: The prompt returns a result that cannot be resolved to an index (e.g., malformed).
  // This tests the final validation step.
  test('should throw an error if a valid index cannot be determined', async () => {
    const promptResult = {
      // Empty object, no index and no action
      speech: 'Uhhh...',
    };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    await expect(
      humanDecisionProvider.decide(mockActor, mockContext, availableActions)
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to determine a valid integer index'),
      expect.any(Object)
    );
  });
});
