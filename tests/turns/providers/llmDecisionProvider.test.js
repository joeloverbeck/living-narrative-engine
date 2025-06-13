import { jest, describe, expect } from '@jest/globals';
import { LLMDecisionProvider } from '../../../src/turns/providers/llmDecisionProvider.js';

describe('LLMDecisionProvider', () => {
  it('should delegate to llmChooser.choose and map result correctly', async () => {
    // Arrange
    const mockResult = { index: 2, speech: 'hi', thoughts: null, notes: null };
    const mockChooser = { choose: jest.fn().mockResolvedValue(mockResult) };

    const provider = new LLMDecisionProvider({ llmChooser: mockChooser });

    // Act
    const decision = await provider.decide(
      'actor',
      'context',
      ['a', 'b', 'c'],
      null
    );

    // Assert
    expect(mockChooser.choose).toHaveBeenCalledWith({
      actor: 'actor',
      context: 'context',
      actions: ['a', 'b', 'c'],
      abortSignal: null,
    });
    expect(decision).toEqual({
      chosenIndex: 2,
      speech: 'hi',
      thoughts: null,
      notes: null,
    });
  });
});
