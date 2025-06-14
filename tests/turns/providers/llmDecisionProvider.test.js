import { jest, describe, expect } from '@jest/globals';
import { LLMDecisionProvider } from '../../../src/turns/providers/llmDecisionProvider.js';

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe('LLMDecisionProvider', () => {
  it('should delegate to llmChooser.choose and map result correctly', async () => {
    // Arrange
    const mockResult = { index: 2, speech: 'hi', thoughts: null, notes: null };
    const mockChooser = { choose: jest.fn().mockResolvedValue(mockResult) };

    const provider = new LLMDecisionProvider({
      llmChooser: mockChooser,
      logger: mockLogger,
    });

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

  it('should throw if chooser returns non-integer index', async () => {
    const mockChooser = { choose: jest.fn().mockResolvedValue({ index: '1' }) };
    const provider = new LLMDecisionProvider({
      llmChooser: mockChooser,
      logger: mockLogger,
    });

    await expect(
      provider.decide('actor', 'context', ['a'], null)
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should throw if index is out of range', async () => {
    const mockChooser = { choose: jest.fn().mockResolvedValue({ index: 3 }) };
    const provider = new LLMDecisionProvider({
      llmChooser: mockChooser,
      logger: mockLogger,
    });

    await expect(
      provider.decide('actor', 'context', ['a', 'b'], null)
    ).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );
  });
});
