import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';

const makeActor = (id = 'a1') => ({ id });

const buildHandler = () => {
  const handler = {
    _resetTurnStateAndResources: jest.fn(),
    resetStateAndResources: jest.fn((reason) => {
      handler._resetTurnStateAndResources(reason);
    }),
    requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    _transitionToState: jest.fn(),
    _turnStateFactory: { createIdleState: jest.fn(() => ({})) },
  };
  return handler;
};

const buildCtx = (actor) => ({
  getActor: () => actor,
  requestAwaitingInputStateTransition: jest.fn().mockResolvedValue(undefined),
});

describe('TurnIdleState helper methods', () => {
  let idle;
  let handler;
  beforeEach(() => {
    handler = buildHandler();
    idle = new TurnIdleState(handler);
  });

  test('_validateActorEntity throws on invalid actor', () => {
    expect(() => idle._validateActorEntity(handler, null, console)).toThrow();
    expect(handler._resetTurnStateAndResources).toHaveBeenCalled();
  });

  test('_validateTurnContext throws when context missing', () => {
    expect(() =>
      idle._validateTurnContext(handler, null, 'a1', console)
    ).toThrow();
    expect(handler._resetTurnStateAndResources).toHaveBeenCalled();
  });

  test('_validateActorMatch throws when mismatch', () => {
    const actor = makeActor('a1');
    const ctx = buildCtx(makeActor('a2'));
    expect(() =>
      idle._validateActorMatch(handler, ctx, actor, console)
    ).toThrow();
  });

  test('_requestAwaitingInput delegates to context', async () => {
    const actor = makeActor('a1');
    const ctx = buildCtx(actor);
    await idle._requestAwaitingInput(ctx, actor, handler, console);
    expect(ctx.requestAwaitingInputStateTransition).toHaveBeenCalled();
  });
});
