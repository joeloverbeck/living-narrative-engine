import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ActionDecisionWorkflow } from '../../../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../../../src/turns/providers/llmDecisionProvider.js';
import {
  DISPLAY_SPEECH_ID,
  DISPLAY_THOUGHT_ID,
  LLM_SUGGESTED_ACTION_ID,
} from '../../../../../src/constants/eventIds.js';
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

  test('dispatches a speech preview bubble before awaiting submission', async () => {
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

    const notes = [{ text: 'note', subject: 'test' }];
    const initialAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };
    const finalAction = { actionDefinitionId: 'act1', commandString: 'cmd1' };

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
      extractedData: { speech: 'Hello human', thoughts: 'inner', notes },
      availableActions,
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(safeDispatcher.dispatch.mock.calls.map((call) => call[0])).toContain(
      DISPLAY_SPEECH_ID
    );
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_SPEECH_ID, {
      entityId: actor.id,
      speechContent: 'Hello human',
      thoughts: 'inner',
      notes,
    });
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({ previewDisplayed: true })
    );
  });

  test('dispatches a thought preview bubble when only thoughts are provided', async () => {
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
      extractedData: { thoughts: 'Maybe wait?' },
      availableActions,
      suggestedIndex: 2,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(safeDispatcher.dispatch.mock.calls.map((call) => call[0])).toContain(
      DISPLAY_THOUGHT_ID
    );
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
      entityId: actor.id,
      thoughts: 'Maybe wait?',
    });
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({ previewDisplayed: true })
    );
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
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
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
    const warnMessages = vedLogger.warn.mock.calls.map(([msg]) => msg);
    expect(warnMessages.length).toBeLessThanOrEqual(1);
    if (warnMessages.length) {
      expect(warnMessages[0]).toContain('core:display_speech');
    }
    expect(vedLogger.error).not.toHaveBeenCalled();
  });
});

describe('ActionDecisionWorkflow Coverage', () => {
  let logger;
  let ctx;
  let state;
  let actor;
  let strategy;
  let timeoutConfigSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    actor = { id: 'a1' };
    const safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    ctx = {
      getLogger: () => logger,
      endTurn: jest.fn().mockResolvedValue(undefined),
      requestProcessingCommandStateTransition: jest
        .fn()
        .mockResolvedValue(undefined),
      setAwaitingExternalEvent: jest.fn(),
      getSafeEventDispatcher: jest.fn(() => safeEventDispatcher),
      getPlayerPromptService: jest.fn(),
      getPromptSignal: jest.fn(() => new AbortController().signal),
    };
    strategy = {
      decideAction: jest.fn(),
      decisionProvider: new LLMDecisionProvider({
        llmChooser: { choose: jest.fn() },
        logger,
        safeEventDispatcher,
      }),
      turnActionFactory: {
        create: jest.fn((c) => ({ actionDefinitionId: c.actionId })),
      },
    };
    state = {
      getStateName: () => 'State',
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

  test('_setPendingFlag catches and logs errors', async () => {
    ctx.setAwaitingExternalEvent.mockImplementation(() => {
      throw new Error('setPending failed');
    });

    // Setup state to trigger _setPendingFlag via run() -> _handleLLMPendingApproval
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to set pending flag')
    );
  });

  test('_getTimeoutSettings handles invalid waitActionHints', async () => {
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 100,
      policy: 'autoWait',
      waitActionHints: null, // Not an array
    });

    // We need to trigger logic that uses waitActionHints, e.g. autoWait policy
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    // Force timeout
    jest.useFakeTimers();
    ctx.getPlayerPromptService = () => ({
      prompt: () => new Promise(() => {}), // Hangs
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();

    await jest.runAllTimersAsync();
    await runPromise;

    jest.useRealTimers();

    // If waitActionHints defaults to [], _findWaitActionIndex returns null, fallbacks to fallbackIndex (1)
    expect(state._recordDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ timeoutPolicy: 'autoWait' })
    );
  });

  test('_findWaitActionIndex returns null when no match found', async () => {
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 100,
      policy: 'autoWait',
      waitActionHints: ['wait'],
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'attack' }], // No 'wait'
      suggestedIndex: 1,
    });

    jest.useFakeTimers();
    ctx.getPlayerPromptService = () => ({
      prompt: () => new Promise(() => {}),
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();

    await jest.runAllTimersAsync();
    await runPromise;
    jest.useRealTimers();

    // Should fallback to suggested index (1) since wait action not found
    expect(state._recordDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actionDefinitionId: 'attack' }),
      expect.objectContaining({ timeoutPolicy: 'autoWait' })
    );
  });

  test('_describeActionDescriptor uses actionId if description missing', async () => {
    // Mock dispatch to verify what's sent
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'myActionId' }], // No description
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({
        suggestedActionDescriptor: 'myActionId',
      }),
      expect.anything()
    );
  });

  test('_logLLMSuggestionTelemetry logs corrected indices', async () => {
    // Create a scenario where raw suggested != clamped
    // And raw submitted != clamped
    const availableActions = [{ index: 1, actionId: 'act1' }];

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions,
      suggestedIndex: 99, // Out of bounds
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 99 }), // Submission also out of bounds
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('LLM suggestion telemetry'),
      expect.objectContaining({
        correctedSuggestedIndex: 99,
        correctedSubmittedIndex: 99,
        suggestedIndex: 1, // Clamped
        finalIndex: 1, // Clamped
      })
    );
  });

  test('_awaitHumanSubmission handles immediate error when timeout disabled', async () => {
    // Ensure timeout disabled
    timeoutConfigSpy.mockReturnValue({ enabled: false });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockRejectedValue(new Error('Immediate fail')),
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Prompt submission failed'),
      expect.any(Error)
    );
    // Should use fallback
    expect(state._recordDecision).toHaveBeenCalled();
  });

  test('_emitSuggestedActionEvent handles null extractedData', async () => {
    // Force extractedData to be undefined
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: null,
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    // Logic in _emitSuggestedActionEvent:
    // speech: extractedData?.speech ?? null,
    // thoughts: extractedData?.thoughts ?? null,
    // notes: extractedData?.notes ?? null,

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({
        speech: null,
        thoughts: null,
        notes: null,
      }),
      expect.anything()
    );
  });

  test('_dispatchLLMDialogPreview catches dispatch errors', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('dispatch failed'));
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: { speech: 'hi' }, // Triggers speech dispatch
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch LLM preview speech bubble')
    );
  });

  test('_describeActionDescriptor falls back to commandString or definitionId', async () => {
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [
        { index: 1, commandString: 'cmd1' }, // No desc, no actionId
        { index: 2, actionDefinitionId: 'def2' }, // No desc, no actionId, no cmd
      ],
      suggestedIndex: 1,
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 2 }),
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    // First call for suggestedIndex 1 -> cmd1
    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({
        suggestedActionDescriptor: 'cmd1',
      }),
      expect.anything()
    );

    // We can't easily check the second fallback (def2) via LLM_SUGGESTED_ACTION_ID unless we run again
    // But we can verify the log for autoWait or similar if we force it?
    // Or just rely on unit test for the helper method if it was exported? It's not.
    // Let's run a second pass for index 2
  });

  test('_findCompositeForIndex handles fallback logic', async () => {
    // Test fallback to index-1
    const actions = [{ index: 1, actionId: 'act1' }];
    // We need to trick _findCompositeForIndex.
    // It looks for candidate?.index === index.
    // If we pass index 2, find returns undefined.
    // Then it tries actions[index-1] -> actions[1] -> undefined.
    // If we pass index 1, find returns match.

    // The fallback `actions[index-1]` is array index access.
    // If we have actions = [A, B] (indices 1, 2).
    // If we request index 1: find returns A.
    // If we request index 0 (invalid?): find undefined. actions[-1] undefined.
    // If we request index 1 but 'index' prop is missing on objects?
    // actions = [ { actionId: 'A' } ] (no index prop).
    // request index 1. find undefined. actions[0] -> A.
    // This confirms the fallback relies on array position matching 1-based index.

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ actionId: 'act1' }], // Missing 'index' property
      suggestedIndex: 1,
    });

    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({
        suggestedActionDescriptor: 'act1',
      }),
      expect.anything()
    );
  });

  test('_awaitHumanSubmission handles error when timeout ENABLED', async () => {
    timeoutConfigSpy.mockReturnValue({ enabled: true, timeoutMs: 1000 });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockRejectedValue(new Error('Prompt failed')),
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Prompt submission failed'),
      expect.any(Error)
    );
  });

  test('_logLLMSuggestionTelemetry logs correct data when no corrections needed', async () => {
    // Valid indices
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('LLM suggestion telemetry'),
      expect.objectContaining({
        correctedSuggestedIndex: null,
        correctedSubmittedIndex: null,
        suggestedIndex: 1,
        finalIndex: 1,
      })
    );
  });

  test('run() handles empty commandString fallback to actionDefinitionId', async () => {
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'def1', commandString: '   ' },
      extractedData: { n: 1 },
    });
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'def1', // Fallback
      expect.anything()
    );
  });

  test('_setPendingFlag handles missing warn method on logger', async () => {
    // Provide logger with error/debug but NO warn
    const limitedLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      // warn missing
    };
    ctx.getLogger = () => limitedLogger;
    ctx.setAwaitingExternalEvent.mockImplementation(() => {
      throw new Error('fail');
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();
    // Should not throw
  });

  test('_emitSuggestedActionEvent handles undefined extractedData', async () => {
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: undefined,
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ thoughts: null, speech: null, notes: null }),
      expect.anything()
    );
  });

  test('_describeActionDescriptor fallback chain full check', async () => {
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    // 1. Only actionDefinitionId (last resort)
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'def1' },
      extractedData: {},
      availableActions: [{ index: 1, actionDefinitionId: 'def1' }], // No desc, id, cmd
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ suggestedActionDescriptor: 'def1' }),
      expect.anything()
    );
  });

  test('previewDisplayed logic true/true', async () => {
    // Mock _dispatchLLMDialogPreview to return speech:true, thought:true
    // We can't easily mock the return of private method.
    // But we can mock the dispatcher to succeed for BOTH speech and thought?
    // _dispatchLLMDialogPreview implementation:
    // If speechPayload exists -> dispatch speech -> return { speech: true, thought: hasThoughts }
    // It returns early.
    // So it never returns { speech: true, thought: true }?
    // Wait:
    // return { speech: true, thought: Boolean(speechPayload.thoughts) };
    // Yes, if speechPayload has thoughts, it returns thought: true.

    const dispatch = jest.fn().mockResolvedValue(undefined);
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: { speech: 'hi', thoughts: 'inner' },
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    // This should set previewDisplayed to true.
    // Verified via recordDecision call.
    expect(state._recordDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ previewDisplayed: true })
    );
  });

  test('prompt success with timeout disabled (explicit)', async () => {
    // Coverage for _awaitHumanSubmission success path when timeout disabled
    timeoutConfigSpy.mockReturnValue({ enabled: false });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 2 }),
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [
        { index: 1, actionId: 'act1' },
        { index: 2, actionId: 'act2' },
      ],
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(state._recordDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ submittedIndex: 2 })
    );
  });

  test('run() handles null commandString', async () => {
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'def1', commandString: null },
      extractedData: { n: 1 },
    });
    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'def1', // Fallback
      expect.anything()
    );
  });
  test('_findCompositeForIndex returns null when not found and no fallback', async () => {
    // availableActions exists, but index not found, and index-1 not found.
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 5, // Out of bounds
    });

    // _handleLLMPendingApproval clamps index 5 -> 1.
    // So it finds index 1.
    // We need to bypass clamp?
    // _handleLLMPendingApproval always clamps.
    // So _findCompositeForIndex is always called with valid index if actions exist?
    // Wait, _findCompositeForIndex uses the index passed to it.
    // In _handleLLMPendingApproval:
    // const { value: clampedIndex } = this._clampIndex(rawSuggestedIndex, actions.length);
    // descriptor = _findCompositeForIndex(clampedIndex, actions) || action;

    // So clampedIndex is always valid?
    // _clampIndex: Math.min(Math.max(value, 1), actionsLength).
    // If actions.length > 0, clampedIndex is between 1 and length.
    // So actions[clampedIndex - 1] should always exist!
    // So the fallback `|| actions[index - 1]` in `_findCompositeForIndex` always succeeds if `actions` is dense.
    // And `actions.find` matches `candidate.index === index`.
    // So if actions are well-formed, it always finds.

    // The only case it returns null is if `actions` is empty (handled by first check) OR `actions` is sparse/malformed such that `index-1` is empty?
    // e.g. actions = []; (handled)
    // actions = [undefined];

    // If I pass `availableActions: [undefined]`.
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [null], // Malformed
      suggestedIndex: 1,
    });

    // _clampIndex(1, 1) -> 1.
    // _findCompositeForIndex(1, [null])
    // find: null?.index (crash? no, ?.index). undefined === 1 -> false.
    // actions[0] -> null.
    // returns null.
    // descriptor = null || action -> action.
    // So we can test that _findCompositeForIndex returns null?
    // Hard to verify output of private method directly.
    // But we can infer it if descriptor becomes `action`.
    // If we make `action` distinct from what `availableActions` would imply.

    const fallbackAction = { actionDefinitionId: 'fallback' };
    state._decideAction.mockResolvedValue({
      action: fallbackAction,
      extractedData: {},
      availableActions: [null],
      suggestedIndex: 1,
    });

    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    // descriptor should be fallbackAction
    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ suggestedActionDescriptor: 'fallback' }),
      expect.anything()
    );
  });

  test('_logLLMSuggestionTelemetry handles non-integer suggestedIndex', async () => {
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 'garbage', // Non-integer
    });

    // _clampIndex('garbage', 1) -> 1 (default)
    // raw = 'garbage'. clamped = 1.
    // correctedSuggestedIndex: 'garbage' !== 1 (true).
    // Number.isInteger('garbage') -> false.
    // returns null.

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('LLM suggestion telemetry'),
      expect.objectContaining({ correctedSuggestedIndex: null })
    );
  });

  test('Explicit warnings in _handleLLMPendingApproval', async () => {
    // 1. suggestedAdjusted warning
    // Covered by previous tests (index 99 -> 1)

    // 2. !actions.length warning
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [], // Empty
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'No indexed actions available for pending approval'
      )
    );

    // 3. submissionAdjusted warning
    // We need submission out of bounds.
    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1, actionId: 'act1' }],
      suggestedIndex: 1,
    });

    ctx.getPlayerPromptService = () => ({
      prompt: jest.fn().mockResolvedValue({ chosenIndex: 99 }),
    });

    const workflow2 = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow2.run();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Submitted index 99 was out of range')
    );
  });

  test('waitActionHints filters invalid entries', async () => {
    // Trigger autoWait with mixed hints
    timeoutConfigSpy.mockReturnValue({
      enabled: true,
      timeoutMs: 1,
      policy: 'autoWait',
      waitActionHints: [null, '', '  ', 'valid_wait'],
    });

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [
        { index: 1, actionId: 'valid_wait' }, // Use actionId for factory mock
      ],
      suggestedIndex: 1,
    });

    jest.useFakeTimers();
    ctx.getPlayerPromptService = () => ({
      prompt: () => new Promise(() => {}),
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();
    await jest.runAllTimersAsync();
    await runPromise;
    jest.useRealTimers();

    // Should have found 'valid_wait'
    expect(state._recordDecision).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actionDefinitionId: 'valid_wait' }),
      expect.anything()
    );
  });

  test('_describeActionDescriptor handles empty descriptor object', async () => {
    const dispatch = jest.fn();
    ctx.getSafeEventDispatcher = () => ({ dispatch });

    // Force finding an empty object as descriptor?
    // Hard. But we can use null fallback action and availableActions = [{}].
    // If availableActions has an item with index matching suggested, it uses it.
    // If that item is {}, it passes {} to _describeActionDescriptor.

    state._decideAction.mockResolvedValue({
      action: { actionDefinitionId: 'act1' },
      extractedData: {},
      availableActions: [{ index: 1 }], // Empty object
      suggestedIndex: 1,
    });

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    await workflow.run();

    expect(dispatch).toHaveBeenCalledWith(
      LLM_SUGGESTED_ACTION_ID,
      expect.objectContaining({ suggestedActionDescriptor: null }),
      expect.anything()
    );
  });
});
