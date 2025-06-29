import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { ACTION_DECIDED_ID } from '../../../../src/constants/eventIds.js';
import * as safeDispatchEventModule from '../../../../src/utils/safeDispatchEvent.js';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const makeCtx = (opts = {}) => ({
  getLogger: () => logger,
  getActor: jest.fn(() => opts.actor),
  getStrategy: jest.fn(() => opts.strategy),
  setDecisionMeta: jest.fn(),
  setChosenAction: jest.fn(),
  getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
  requestProcessingCommandStateTransition: jest.fn(),
  endTurn: jest.fn(),
});

describe('AwaitingActorDecisionState helpers', () => {
  let state;
  beforeEach(() => {
    jest.clearAllMocks();
    state = new AwaitingActorDecisionState({ getLogger: () => logger });
  });

  test('validateActor returns actor', () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx({ actor });
    expect(state.validateActor(ctx)).toBe(actor);
  });

  test('retrieveStrategy returns strategy', () => {
    const actor = { id: 'a1' };
    const strategy = { decideAction: jest.fn() };
    const ctx = makeCtx({ actor, strategy });
    expect(state.retrieveStrategy(ctx, actor)).toBe(strategy);
  });

  test('_decideAction returns action info', async () => {
    const strategy = {
      decideAction: jest
        .fn()
        .mockResolvedValue({ action: { id: 1 }, extractedData: { t: 1 } }),
    };
    const ctx = makeCtx({ actor: { id: 'a1' }, strategy });
    const result = await state._decideAction(strategy, ctx, ctx.getActor());
    expect(result.action).toEqual({ id: 1 });
    expect(result.extractedData).toEqual({ t: 1 });
  });

  test('_recordDecision stores meta and action', () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx({ actor });
    state._recordDecision(ctx, { actionDefinitionId: 'act' }, { notes: [] });
    expect(ctx.setDecisionMeta).toHaveBeenCalled();
    expect(ctx.setChosenAction).toHaveBeenCalled();
  });

  test('_emitActionDecided dispatches immutable payload', async () => {
    const actor = { id: 'a1', isAi: true };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeCtx({ actor });
    ctx.getSafeEventDispatcher = () => dispatcher;

    const spy = jest.spyOn(safeDispatchEventModule, 'safeDispatchEvent');

    await state._emitActionDecided(ctx, actor, { foo: 'bar' });

    expect(spy).toHaveBeenCalledWith(
      dispatcher,
      ACTION_DECIDED_ID,
      {
        actorId: 'a1',
        actorType: 'ai',
        extractedData: { foo: 'bar', thoughts: '', notes: [] },
      },
      logger
    );

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test('_emitActionDecided logs error when dispatch fails', async () => {
    const actor = { id: 'a1', isAi: true };
    const dispatchErr = new Error('bad');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(dispatchErr) };
    const ctx = makeCtx({ actor });
    ctx.getSafeEventDispatcher = () => dispatcher;

    await state._emitActionDecided(ctx, actor, { speech: 'hi' });

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to dispatch ${ACTION_DECIDED_ID}`,
      dispatchErr
    );
  });

  test('constructor uses provided workflow factory in enterState', async () => {
    const actor = { id: 'a2' };
    const strategy = {
      decideAction: jest.fn().mockResolvedValue({
        action: {
          actionDefinitionId: 'id',
          commandString: 'cmd',
          actorId: 'a2',
        },
      }),
    };
    const ctx = makeCtx({ actor, strategy });
    const mockWorkflow = { run: jest.fn().mockResolvedValue(undefined) };
    const factory = jest.fn(() => mockWorkflow);
    const handler = { getLogger: () => logger, getTurnContext: () => ctx };
    const customState = new AwaitingActorDecisionState(handler, factory);

    await customState.enterState(handler, null);

    expect(factory).toHaveBeenCalledWith(customState, ctx, actor, strategy);
    expect(mockWorkflow.run).toHaveBeenCalled();
  });
});
