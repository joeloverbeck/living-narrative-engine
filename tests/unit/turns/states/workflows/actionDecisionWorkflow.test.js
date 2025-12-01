import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ActionDecisionWorkflow } from '../../../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../../../src/turns/providers/llmDecisionProvider.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import * as llmTimeoutConfig from '../../../../../src/config/llmTimeout.config.js';
import ValidatedEventDispatcher from '../../../../../src/events/validatedEventDispatcher.js';
import commonSchema from '../../../../../data/schemas/common.schema.json';
import suggestedActionEventDef from '../../../../../data/mods/core/events/suggested_action.event.json';

describe('ActionDecisionWorkflow.run', () => {
  let logger;
  let ctx;
  let state;
  let actor;
  let strategy;
  let timeoutConfigSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
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
    timeoutConfigSpy = jest
      .spyOn(llmTimeoutConfig, 'getLLMTimeoutConfig')
      .mockReturnValue({
        enabled: false,
        timeoutMs: 0,
        policy: 'autoAccept',
        waitActionHints: [],
      });
  });

  afterEach(() => {
    timeoutConfigSpy?.mockRestore();
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
      expect.objectContaining({ actorId: 'a1', suggestedIndex: 1 }),
      expect.objectContaining({ allowSchemaNotFound: true })
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
    const pendingTraces = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('Pending approval')
    );
    expect(pendingTraces).toHaveLength(2);
  });

  test('emits suggested_action with null index when no actions are available', async () => {
    const safeDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const llmProvider = new LLMDecisionProvider({
      llmChooser: { choose: jest.fn() },
      logger,
      safeEventDispatcher: safeDispatcher,
    });

    const prompt = { prompt: jest.fn() };
    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

    ctx.getPlayerPromptService = () => prompt;
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn(),
      },
    };

    state._decideAction.mockResolvedValue({
      action: initialAction,
      extractedData: { speech: 'hi' },
      availableActions: [],
      suggestedIndex: null,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(ctx.setAwaitingExternalEvent).toHaveBeenNthCalledWith(1, true, 'a1');
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(false, 'a1');
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'a1', suggestedIndex: null }),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
    expect(prompt.prompt).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No indexed actions available')
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      initialAction,
      expect.objectContaining({
        suggestedIndex: null,
        submittedIndex: null,
      })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd1',
      initialAction
    );
  });

  test('falls back gracefully when PlayerPromptService lookup fails', async () => {
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
    ];

    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };
    const finalAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

    ctx.getPlayerPromptService = () => {
      throw new Error('PlayerPromptService not available in services bag.');
    };
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

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('PlayerPromptService unavailable'),
      expect.any(Error)
    );
    expect(ctx.setAwaitingExternalEvent).toHaveBeenCalledWith(true, 'a1');
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'a1', suggestedIndex: 1 }),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd1',
      finalAction
    );
  });

  test('continues with LLM action when prompt submission rejects', async () => {
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
    ];

    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockRejectedValue(new Error('prompt failed')),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(initialAction),
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

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Prompt submission failed'),
      expect.any(Error)
    );
    expect(ctx.setAwaitingExternalEvent).toHaveBeenNthCalledWith(1, true, 'a1');
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(false, 'a1');
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'a1', suggestedIndex: 1 }),
      expect.objectContaining({ allowSchemaNotFound: true })
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ actionDefinitionId: 'act1' }),
      expect.objectContaining({
        suggestedIndex: 1,
        submittedIndex: 1,
        resolvedByTimeout: false,
        timeoutPolicy: null,
      })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd1',
      expect.objectContaining({ actionDefinitionId: 'act1' })
    );
  });

  test('logs and proceeds when suggested_action dispatch rejects', async () => {
    const dispatchError = new Error('bus down');
    const safeDispatcher = {
      dispatch: jest.fn().mockRejectedValue(dispatchError),
    };
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
    ];

    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(initialAction),
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

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch suggested action event'),
      dispatchError
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd1',
      expect.objectContaining({ actionDefinitionId: 'act1' })
    );
    expect(ctx.endTurn).not.toHaveBeenCalledWith(expect.any(Error));
  });

  test('clears pending flag and keeps telemetry when suggested_action validation fails', async () => {
    const safeDispatcher = {
      dispatch: jest.fn().mockResolvedValue(false),
    };
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
      action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
      extractedData: { speech: 'hi', thoughts: 'ok' },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ actorId: 'a1', suggestedIndex: 1 }),
      { allowSchemaNotFound: true }
    );
    expect(ctx.setAwaitingExternalEvent).toHaveBeenNthCalledWith(1, true, 'a1');
    expect(ctx.setAwaitingExternalEvent).toHaveBeenLastCalledWith(false, 'a1');
    const telemetryCalls = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('LLM suggestion telemetry')
    );
    expect(telemetryCalls).toHaveLength(1);
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({ submittedIndex: 2, suggestedIndex: 1 })
    );
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd2',
      finalAction
    );
  });

  test('logs telemetry once with invalid suggestion correction and override', async () => {
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
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    };

    ctx.getPlayerPromptService = () => prompt;
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockImplementation((composite) => ({
          actionDefinitionId: composite.actionId,
          commandString: composite.commandString,
        })),
      },
    };

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act2', commandString: 'cmd2' },
      extractedData: { speech: 'hi' },
      availableActions,
      suggestedIndex: 5,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    const telemetryCalls = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('LLM suggestion telemetry')
    );
    expect(telemetryCalls).toHaveLength(1);
    expect(telemetryCalls[0][1]).toEqual(
      expect.objectContaining({
        actorId: 'a1',
        suggestedIndex: 2,
        finalIndex: 1,
        override: true,
        resolvedByTimeout: false,
        correctedSuggestedIndex: 5,
        correctedSubmittedIndex: null,
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('LLM suggested index 5 was out of range')
    );
  });

  test('autoAccept timeout resolves with suggested index', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 5,
      policy: 'autoAccept',
      waitActionHints: [],
    });

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

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => new Promise(() => {})),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.cancelActivePrompt = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
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
      extractedData: {
        speech: 'hi',
        thoughts: 'note',
        notes: [
          {
            text: 'Containment vessel is ready',
            subject: 'chicken coop',
            subjectType: 'event',
            context: '12 Kiln Lane',
          },
        ],
      },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(ctx.cancelActivePrompt).toHaveBeenCalled();
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd1',
      expect.objectContaining({ actionDefinitionId: 'act1' })
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ actionDefinitionId: 'act1' }),
      expect.objectContaining({
        suggestedIndex: 1,
        submittedIndex: 1,
        resolvedByTimeout: true,
        timeoutPolicy: 'autoAccept',
      })
    );
    const telemetryCalls = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('LLM suggestion telemetry')
    );
    expect(telemetryCalls[0][1]).toEqual(
      expect.objectContaining({
        finalIndex: 1,
        resolvedByTimeout: true,
        timeoutPolicy: 'autoAccept',
      })
    );
  });

  test('autoWait timeout prefers wait action', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 5,
      policy: 'autoWait',
      waitActionHints: ['wait'],
    });

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
        actionId: 'wait_action',
        description: 'Wait it out',
        commandString: 'wait',
      },
    ];

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => new Promise(() => {})),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.cancelActivePrompt = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
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
      extractedData: {
        speech: 'hi',
        thoughts: 'consider safety',
        notes: [
          {
            text: 'Containment vessel is ready',
            subject: 'chicken coop',
            subjectType: 'event',
            context: '12 Kiln Lane',
          },
        ],
      },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(ctx.cancelActivePrompt).toHaveBeenCalled();
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'wait',
      expect.objectContaining({ actionDefinitionId: 'wait_action' })
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ actionDefinitionId: 'wait_action' }),
      expect.objectContaining({
        submittedIndex: 2,
        timeoutPolicy: 'autoWait',
        resolvedByTimeout: true,
      })
    );
  });

  test('noop policy waits past timeout', async () => {
    jest.useFakeTimers();
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 5,
      policy: 'noop',
      waitActionHints: ['wait'],
    });

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

    let resolvePrompt;
    const promptPromise = new Promise((resolve) => {
      resolvePrompt = resolve;
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn(() => promptPromise),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.cancelActivePrompt = jest.fn();
    ctx.getSafeEventDispatcher = () => safeDispatcher;

    strategy = {
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
      extractedData: {
        speech: 'hi',
        thoughts: 'consider safety',
        notes: [
          {
            text: 'Containment vessel is ready',
            subject: 'chicken coop',
            subjectType: 'event',
            context: '12 Kiln Lane',
          },
        ],
      },
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

    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ actionDefinitionId: 'act2' }),
      expect.objectContaining({
        submittedIndex: 2,
        resolvedByTimeout: false,
        timeoutPolicy: 'noop',
      })
    );
  });

  test('emitted payload validates through ValidatedEventDispatcher', async () => {
    const eventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    const schemaId = 'core:suggested_action#payload';
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    ajv.addSchema(commonSchema, 'schema://living-narrative-engine/common.schema.json');
    const schemaValidator = (() => {
      const payloadSchema = {
        $id: schemaId,
        ...JSON.parse(JSON.stringify(suggestedActionEventDef.payloadSchema)),
      };
      const validator = ajv.compile(payloadSchema);
      return {
        isSchemaLoaded: (id) => id === schemaId,
        validate: (id, payload) => ({
          isValid: validator(payload),
          errors: validator.errors ?? [],
        }),
      };
    })();
    const vedLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: {
        getEventDefinition: jest.fn(() => suggestedActionEventDef),
      },
      schemaValidator,
      logger: vedLogger,
    });

    const llmProvider = new LLMDecisionProvider({
      llmChooser: { choose: jest.fn() },
      logger,
      safeEventDispatcher: validatedDispatcher,
    });

    const availableActions = [
      {
        index: 1,
        actionId: 'act1',
        description: 'One',
        commandString: 'cmd1',
      },
    ];

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    });
    ctx.getPromptSignal = jest.fn(() => new AbortController().signal);
    ctx.setAwaitingExternalEvent = jest.fn();
    ctx.getSafeEventDispatcher = () => validatedDispatcher;

    strategy = {
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
      extractedData: {
        speech: 'hi',
        thoughts: 'consider safety',
        notes: [
          {
            text: 'Containment vessel is ready',
            subject: 'chicken coop',
            subjectType: 'event',
            context: '12 Kiln Lane',
          },
        ],
      },
      availableActions,
      suggestedIndex: 1,
    });

    const emitSpy = jest.spyOn(
      ActionDecisionWorkflow.prototype,
      '_emitSuggestedActionEvent'
    );
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(emitSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ description: 'One' }),
      expect.objectContaining({
        notes: [
          expect.objectContaining({
            text: 'Containment vessel is ready',
            subject: 'chicken coop',
            subjectType: 'event',
          }),
        ],
        thoughts: 'consider safety',
        speech: 'hi',
      })
    );
    emitSpy.mockRestore();

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({
        actorId: 'a1',
        suggestedIndex: 1,
        suggestedActionDescriptor: 'One',
        notes: [
          expect.objectContaining({
            subjectType: 'event',
            subject: 'chicken coop',
            text: 'Containment vessel is ready',
            context: '12 Kiln Lane',
          }),
        ],
      })
    );
    expect(vedLogger.warn).not.toHaveBeenCalled();
    expect(vedLogger.error).not.toHaveBeenCalled();
  });
});
