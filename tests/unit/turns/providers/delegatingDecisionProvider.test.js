import { jest, describe, it, expect } from '@jest/globals';
import { DelegatingDecisionProvider } from '../../../../src/turns/providers/delegatingDecisionProvider.js';

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const mockDispatcher = { dispatch: jest.fn() };

describe('DelegatingDecisionProvider', () => {
  it('invokes the delegate with provided arguments and forwards the result', async () => {
    const delegate = jest.fn().mockResolvedValue({
      index: 1,
      speech: 'hello',
      thoughts: 'none',
      notes: ['note'],
    });
    const provider = new DelegatingDecisionProvider({
      delegate,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    const actor = { id: 'a1' };
    const context = {};
    const actions = ['x', 'y'];
    const abortSignal = new AbortController().signal;

    const decision = await provider.decide(
      actor,
      context,
      actions,
      abortSignal
    );

    expect(delegate).toHaveBeenCalledWith(actor, context, actions, abortSignal);
    expect(decision).toEqual({
      chosenIndex: 1,
      speech: 'hello',
      thoughts: 'none',
      notes: ['note'],
    });
  });

  it('constructor throws when delegate is not a function', () => {
    expect(
      () =>
        new DelegatingDecisionProvider({
          delegate: {},
          logger: mockLogger,
          safeEventDispatcher: mockDispatcher,
        })
    ).toThrow("Dependency 'delegate' must be a function, but got object.");
  });
});
