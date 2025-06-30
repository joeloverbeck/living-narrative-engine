import { jest, describe, it, expect } from '@jest/globals';
import { GoapDecisionProvider } from '../../../../src/turns/providers/goapDecisionProvider.js';

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const mockDispatcher = { dispatch: jest.fn() };

describe('GoapDecisionProvider', () => {
  it('returns the first action index for a non-empty actions array', async () => {
    const provider = new GoapDecisionProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const decision = await provider.decide({ id: 'a1' }, {}, ['a', 'b']);

    expect(decision).toEqual({
      chosenIndex: 1,
      speech: null,
      thoughts: null,
      notes: null,
    });
  });

  it('throws an error when actions array is empty', async () => {
    const provider = new GoapDecisionProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    await expect(provider.decide({ id: 'a1' }, {}, [])).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );
  });
});
