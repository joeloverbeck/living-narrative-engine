import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import { ActionDecisionWorkflow } from '../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../src/turns/providers/llmDecisionProvider.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../src/constants/eventIds.js';
import * as llmTimeoutConfig from '../../../src/config/llmTimeout.config.js';

describe('LLM timeout policies integration', () => {
  let timeoutConfigSpy;

  beforeEach(() => {
    jest.useRealTimers();
    timeoutConfigSpy = jest.spyOn(llmTimeoutConfig, 'getLLMTimeoutConfig');
  });

  afterEach(() => {
    timeoutConfigSpy?.mockRestore();
    jest.useRealTimers();
  });

  const buildCommonDeps = () => {
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const safeDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const llmProvider = new LLMDecisionProvider({
      llmChooser: { choose: jest.fn() },
      logger,
      safeEventDispatcher: safeDispatcher,
    });

    const actor = { id: 'actor-1' };

    const ctx = {
      getLogger: () => logger,
      endTurn: jest.fn().mockResolvedValue(undefined),
      requestProcessingCommandStateTransition: jest
        .fn()
        .mockResolvedValue(undefined),
      setAwaitingExternalEvent: jest.fn(),
      getPromptSignal: () => new AbortController().signal,
      cancelActivePrompt: jest.fn(),
      getSafeEventDispatcher: () => safeDispatcher,
    };

    const state = {
      getStateName: () => 'AwaitingActorDecisionState',
      _decideAction: jest.fn(),
      _recordDecision: jest.fn(),
      _emitActionDecided: jest.fn().mockResolvedValue(undefined),
      _handler: {},
    };

    return { logger, safeDispatcher, llmProvider, actor, ctx, state };
  };

  it('autoAccept resolves with suggested action after timeout', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 10,
      policy: 'autoAccept',
      waitActionHints: ['wait'],
    });

    const { safeDispatcher, llmProvider, actor, ctx, state } =
      buildCommonDeps();

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => new Promise(() => {})),
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

    const finalAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

    const strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(finalAction),
      },
    };

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
      extractedData: { speech: 'hello' },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(ctx.setAwaitingExternalEvent).toHaveBeenNthCalledWith(
      1,
      true,
      'actor-1'
    );
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(
      false,
      'actor-1'
    );
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'actor-1', suggestedIndex: 1 }),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledTimes(
      1
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({
        submittedIndex: 1,
        resolvedByTimeout: true,
        timeoutPolicy: 'autoAccept',
      })
    );
  });

  it('autoWait selects wait action when available', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 10,
      policy: 'autoWait',
      waitActionHints: ['wait'],
    });

    const { safeDispatcher, llmProvider, actor, ctx, state } =
      buildCommonDeps();

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => new Promise(() => {})),
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
        actionId: 'wait_action',
        description: 'Wait it out',
        commandString: 'wait',
      },
    ];

    const strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockImplementation((composite) => ({
          actionDefinitionId: composite.actionId,
          commandString: composite.commandString,
        })),
      },
    };

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
      extractedData: { speech: 'hello' },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'wait',
      expect.objectContaining({ actionDefinitionId: 'wait_action' })
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ actionDefinitionId: 'wait_action' }),
      expect.objectContaining({
        submittedIndex: 2,
        resolvedByTimeout: true,
        timeoutPolicy: 'autoWait',
      })
    );
  });

  it('noop policy keeps waiting after timeout', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 10,
      policy: 'noop',
      waitActionHints: ['wait'],
    });

    const { safeDispatcher, llmProvider, actor, ctx, state } =
      buildCommonDeps();

    let resolvePrompt;
    const promptPromise = new Promise((resolve) => {
      resolvePrompt = resolve;
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => promptPromise),
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

    const finalAction = { actionDefinitionId: 'act2', commandString: 'cmd2' };

    const strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(finalAction),
      },
    };

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
      extractedData: { speech: 'hello' },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();

    await jest.runAllTimersAsync();
    expect(ctx.requestProcessingCommandStateTransition).not.toHaveBeenCalled();
    expect(ctx.cancelActivePrompt).not.toHaveBeenCalled();

    resolvePrompt({ chosenIndex: 2 });
    await runPromise;

    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd2',
      finalAction
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({
        submittedIndex: 2,
        resolvedByTimeout: false,
        timeoutPolicy: 'noop',
      })
    );
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(
      false,
      'actor-1'
    );
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'actor-1' }),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
  });
});
