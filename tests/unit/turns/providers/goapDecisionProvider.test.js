import { jest, describe, it, expect } from '@jest/globals';
import { GoapDecisionProvider } from '../../../../src/turns/providers/goapDecisionProvider.js';

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const mockDispatcher = { dispatch: jest.fn() };

const ERROR_MESSAGE =
  'GoapDecisionProvider: Cannot choose an action because no indexed actions were provided.';

describe('GoapDecisionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the first action index for a non-empty actions array', async () => {
    const provider = new GoapDecisionProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const decision = await provider.decide(
      { id: 'a1' },
      {},
      [
        { index: 2, actionId: 'core:test', commandString: 'do x', params: {}, description: 'test', visual: null },
        { index: 1, actionId: 'core:other', commandString: 'do y', params: {}, description: 'other', visual: null },
      ]
    );

    expect(decision).toEqual({
      chosenIndex: 2,
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
      ERROR_MESSAGE
    );
    expect(mockLogger.error).toHaveBeenCalledWith(ERROR_MESSAGE, {
      receivedType: 'array',
      actionsLength: 0,
    });
  });

  it('throws an error when actions is not an array', async () => {
    const provider = new GoapDecisionProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    await expect(
      // @ts-expect-error intentionally passing null to simulate runtime failure
      provider.decide({ id: 'a1' }, {}, null)
    ).rejects.toThrow(ERROR_MESSAGE);
    expect(mockLogger.error).toHaveBeenCalledWith(ERROR_MESSAGE, {
      receivedType: 'null',
      actionsLength: undefined,
    });
  });
});
