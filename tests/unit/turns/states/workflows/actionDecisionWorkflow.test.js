import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ActionDecisionWorkflow } from '../../../../../src/turns/states/workflows/actionDecisionWorkflow.js';

describe('ActionDecisionWorkflow.run', () => {
  let logger;
  let ctx;
  let state;
  let actor;
  let strategy;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    actor = { id: 'a1' };
    ctx = {
      getLogger: () => logger,
      endTurn: jest.fn().mockResolvedValue(undefined),
      requestProcessingCommandStateTransition: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    strategy = { decideAction: jest.fn() };
    state = {
      getStateName: () => 'AwaitingActorDecisionState',
      _decideAction: jest.fn(),
      _recordDecision: jest.fn(),
      _emitActionDecided: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('handles valid action decision', async () => {
    const action = { actionDefinitionId: 'act', commandString: 'cmd' };
    state._decideAction.mockResolvedValue({ action, extractedData: { n: 1 } });
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();
    expect(state._decideAction).toHaveBeenCalledWith(strategy, ctx, actor);
    expect(state._recordDecision).toHaveBeenCalledWith(ctx, action, { n: 1 });
    expect(state._emitActionDecided).toHaveBeenCalledWith(ctx, actor, { n: 1 });
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd',
      action
    );
  });

  test('ends turn when action invalid', async () => {
    state._decideAction.mockResolvedValue({
      action: null,
      extractedData: null,
    });
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();
    expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(logger.warn).toHaveBeenCalled();
  });

  test('handles AbortError gracefully', async () => {
    const abortErr = new Error('abort');
    abortErr.name = 'AbortError';
    state._decideAction.mockRejectedValue(abortErr);
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();
    expect(ctx.endTurn).toHaveBeenCalledWith(null);
  });

  test('handles generic errors', async () => {
    const err = new Error('boom');
    state._decideAction.mockRejectedValue(err);
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();
    expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
    const endErr = ctx.endTurn.mock.calls[0][0];
    expect(endErr.message).toContain('boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
