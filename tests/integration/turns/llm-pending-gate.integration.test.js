import { describe, it, expect, jest } from '@jest/globals';
import { ActionDecisionWorkflow } from '../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../src/turns/providers/llmDecisionProvider.js';
import {
  DISPLAY_SPEECH_ID,
  LLM_SUGGESTED_ACTION_ID,
} from '../../../src/constants/eventIds.js';

describe('LLM pending gate integration', () => {
  it('defers processing until submission resolves', async () => {
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const safeDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const llmProvider = new LLMDecisionProvider({
      llmChooser: { choose: jest.fn() },
      logger,
      safeEventDispatcher: safeDispatcher,
    });

    const actor = { id: 'actor-1' };
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
    const promptResult = new Promise((resolve) => {
      resolvePrompt = resolve;
    });

    const promptService = {
      prompt: jest.fn(() => promptResult),
    };

    const ctx = {
      getLogger: () => logger,
      endTurn: jest.fn().mockResolvedValue(undefined),
      requestProcessingCommandStateTransition: jest
        .fn()
        .mockResolvedValue(undefined),
      setAwaitingExternalEvent: jest.fn(),
      getPlayerPromptService: () => promptService,
      getPromptSignal: () => new AbortController().signal,
      getSafeEventDispatcher: () => safeDispatcher,
    };

    const finalAction = { actionDefinitionId: 'act2', commandString: 'cmd2' };

    const strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockReturnValue(finalAction),
      },
    };

    const state = {
      getStateName: () => 'AwaitingActorDecisionState',
      _decideAction: jest.fn().mockResolvedValue({
        action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
        extractedData: { speech: 'hello' },
        availableActions,
        suggestedIndex: 1,
      }),
      _recordDecision: jest.fn(),
      _emitActionDecided: jest.fn().mockResolvedValue(undefined),
      _handler: {},
    };

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();

    await Promise.resolve();
    expect(ctx.requestProcessingCommandStateTransition).not.toHaveBeenCalled();

    resolvePrompt({ chosenIndex: 2 });
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
    expect(safeDispatcher.dispatch.mock.calls.map((call) => call[0])).toContain(
      DISPLAY_SPEECH_ID
    );
    expect(safeDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_SPEECH_ID,
      expect.objectContaining({
        entityId: actor.id,
        speechContent: 'hello',
      })
    );
    expect(promptService.prompt).toHaveBeenCalledWith(actor, {
      indexedComposites: availableActions,
      cancellationSignal: expect.any(AbortSignal),
      suggestedAction: {
        index: 1,
        descriptor: 'One',
      },
    });
    expect(ctx.requestProcessingCommandStateTransition).toHaveBeenCalledWith(
      'cmd2',
      finalAction
    );
    expect(state._recordDecision).toHaveBeenCalledWith(
      ctx,
      finalAction,
      expect.objectContaining({ submittedIndex: 2 })
    );
  });
});
