import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { ACTION_DECIDED_ID } from '../../../../src/constants/eventIds.js';

const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
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

    await state._emitActionDecided(ctx, actor, { foo: 'bar' });

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [evtId, payload] = dispatcher.dispatch.mock.calls[0];
    expect(evtId).toBe(ACTION_DECIDED_ID);
    const expectedPayload = {
      actorId: 'a1',
      actorType: 'ai',
      extractedData: { foo: 'bar', thoughts: '', notes: [] },
    };
    expect(payload).toEqual(expectedPayload);
    expect(Object.keys(payload)).toEqual(Object.keys(expectedPayload));
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
