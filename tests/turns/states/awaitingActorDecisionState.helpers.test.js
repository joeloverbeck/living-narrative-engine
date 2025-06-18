import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../src/turns/states/awaitingActorDecisionState.js';

const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
const makeCtx = (opts = {}) => ({
  getLogger: () => logger,
  getActor: jest.fn(() => opts.actor),
  getStrategy: jest.fn(() => opts.strategy),
  setDecisionMeta: jest.fn(),
  setChosenAction: jest.fn(),
  getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
  requestProcessingCommandStateTransition: jest.fn(),
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

  test('_emitActionDecided dispatches event', async () => {
    const actor = { id: 'a1', type: 'ai' };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeCtx({ actor });
    ctx.getSafeEventDispatcher = () => dispatcher;
    await state._emitActionDecided(ctx, actor, null);
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });
});
