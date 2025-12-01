import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ActionDecisionWorkflow } from '../../../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../../../src/turns/providers/llmDecisionProvider.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../../../src/constants/eventIds.js';

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
      _handler: {},
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

  test('gates LLM decisions and waits for submission', async () => {
    const safeDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const llmProvider = new LLMDecisionProvider({
      llmChooser: { choose: jest.fn() },
      logger,
      safeEventDispatcher: safeDispatcher,
    });

    const availableActions = [
      {
        index: 1,
        actionId: 'act1',
        description: 'One',
        commandString: 'cmd1',
      },
      {
        index: 2,
        actionId: 'act2',
        description: 'Two',
        commandString: 'cmd2',
      },
    ];

    const prompt = {
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 2 }),
    };

    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };
    const finalAction = { actionDefinitionId: 'act2', commandString: 'cmd2' };

    ctx.getPlayerPromptService = () => prompt;
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(finalAction),
      },
    };

    state._decideAction.mockResolvedValue({
      action: initialAction,
      extractedData: { speech: 'hi' },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(ctx.setAwaitingExternalEvent).toHaveBeenNthCalledWith(1, true, 'a1');
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(false, 'a1');
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'a1', suggestedIndex: 1 })
    );
    expect(prompt.prompt).toHaveBeenCalledWith(actor, {
      indexedComposites: availableActions,
      cancellationSignal: expect.any(AbortSignal),
      suggestedAction: {
        index: 1,
        descriptor: 'One',
      },
    });
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({ suggestedIndex: 1, submittedIndex: 2 })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd2',
      finalAction
    );
  });
});
