// src/turns/services/humanDecisionProvider.test.js

import { jest, describe, beforeEach, expect } from '@jest/globals';
import { HumanDecisionProvider } from '../../../src/turns/providers/humanDecisionProvider.js';
import { ITurnDecisionProvider } from '../../../src/turns/interfaces/ITurnDecisionProvider.js';

// Mock dependencies
const mockPromptCoordinator = {
  prompt: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock data
const mockActor = { id: 'player1' };
const mockContext = {}; // Not used by the corrected implementation
const mockActions = [
  /* Not used directly, but represents the list the index refers to */
];
const mockAbortSignal = new AbortController().signal;

describe('HumanDecisionProvider', () => {
  let decisionProvider;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    decisionProvider = new HumanDecisionProvider({
      promptCoordinator: mockPromptCoordinator,
      logger: mockLogger,
    });
  });

  it('should be an instance of ITurnDecisionProvider', () => {
    expect(decisionProvider).toBeInstanceOf(ITurnDecisionProvider);
  });

  // --- SUCCESS PATHS ---

  it('should return a valid decision result when the prompt resolves with an index and speech', async () => {
    // Arrange: Mock the prompt coordinator to return a successful result
    const promptResult = {
      chosenIndex: 2,
      speech: 'I choose the second option.',
      thoughts: 'This seems wise.',
      notes: ['A note'],
    };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    // Act: Call the decide method
    const result = await decisionProvider.decide(
      mockActor,
      mockContext,
      mockActions,
      mockAbortSignal
    );

    // Assert: Check that the prompt coordinator was called correctly
    expect(mockPromptCoordinator.prompt).toHaveBeenCalledWith(mockActor, {
      cancellationSignal: mockAbortSignal,
    });
    expect(mockPromptCoordinator.prompt).toHaveBeenCalledTimes(1);

    // Assert: Check that the result is correctly structured
    expect(result).toEqual({
      chosenIndex: 2,
      speech: 'I choose the second option.',
      thoughts: 'This seems wise.',
      notes: ['A note'],
    });
  });

  it('should return a valid decision with null for missing optional fields', async () => {
    // Arrange: Mock a prompt result with only the required index
    const promptResult = { chosenIndex: 1 };
    mockPromptCoordinator.prompt.mockResolvedValue(promptResult);

    // Act
    const result = await decisionProvider.decide(
      mockActor,
      mockContext,
      mockActions
    );

    // Assert
    expect(result).toEqual({
      chosenIndex: 1,
      speech: null,
      thoughts: null,
      notes: null,
    });
  });

  // --- FAILURE PATHS & EDGE CASES ---

  it('should throw an error if the prompt result does not include an integer index', async () => {
    // Arrange: Mock various invalid prompt results
    const invalidResults = [
      { chosenIndex: null },
      { chosenIndex: '2' }, // Must be a number
      {}, // Missing property
      { chosenIndex: 1.5 }, // Must be an integer
    ];

    for (const invalidResult of invalidResults) {
      mockPromptCoordinator.prompt.mockResolvedValue(invalidResult);

      // Act & Assert
      await expect(
        decisionProvider.decide(mockActor, mockContext, mockActions)
      ).rejects.toThrow(
        'Could not resolve the chosen action to a valid index.'
      );

      // Assert that an error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Did not receive a valid integer 'chosenIndex'"
        ),
        { promptResult: invalidResult }
      );
    }
  });

  it('should propagate errors from the promptCoordinator', async () => {
    // Arrange: Mock the prompt coordinator to reject the promise
    const promptError = new Error('Prompt failed!');
    mockPromptCoordinator.prompt.mockRejectedValue(promptError);

    // Act & Assert
    await expect(
      decisionProvider.decide(mockActor, mockContext, mockActions)
    ).rejects.toThrow('Prompt failed!');
    expect(mockLogger.error).not.toHaveBeenCalled(); // The provider itself doesn't log this, it just lets the error bubble up.
  });
});
