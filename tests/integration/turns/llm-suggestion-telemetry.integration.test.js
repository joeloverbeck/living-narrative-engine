import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ActionDecisionWorkflow } from '../../../src/turns/states/workflows/actionDecisionWorkflow.js';
import { LLMDecisionProvider } from '../../../src/turns/providers/llmDecisionProvider.js';
import * as llmTimeoutConfig from '../../../src/config/llmTimeout.config.js';

describe('LLM suggestion telemetry integration', () => {
  let logger;
  let timeoutSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    timeoutSpy = jest
      .spyOn(llmTimeoutConfig, 'getLLMTimeoutConfig')
      .mockReturnValue({
        enabled: true,
        timeoutMs: 5,
        policy: 'autoAccept',
        waitActionHints: [],
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    timeoutSpy?.mockRestore();
  });

  it('logs telemetry once per cycle with pending traces on timeout resolution', async () => {
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
    ];

    const ctx = {
      getLogger: () => logger,
      endTurn: jest.fn().mockResolvedValue(undefined),
      requestProcessingCommandStateTransition: jest
        .fn()
        .mockResolvedValue(undefined),
      setAwaitingExternalEvent: jest.fn(),
      cancelActivePrompt: jest.fn(),
      getPlayerPromptService: () => ({
        prompt: jest.fn(() => new Promise(() => {})),
      }),
      getPromptSignal: () => new AbortController().signal,
      getSafeEventDispatcher: () => safeDispatcher,
    };

    const strategy = {
      decisionProvider: llmProvider,
      turnActionFactory: {
        create: jest.fn().mockImplementation((composite) => ({
          actionDefinitionId: composite.actionId,
          commandString: composite.commandString,
        })),
      },
    };

    const state = {
      getStateName: () => 'AwaitingActorDecisionState',
      _decideAction: jest.fn().mockResolvedValue({
        action: { actionDefinitionId: 'act1', commandString: 'cmd1' },
        extractedData: null,
        availableActions,
        suggestedIndex: 1,
      }),
      _recordDecision: jest.fn(),
      _emitActionDecided: jest.fn().mockResolvedValue(undefined),
      _handler: {},
    };

    const workflow = new ActionDecisionWorkflow(state, ctx, actor, strategy);
    const runPromise = workflow.run();

    await jest.runAllTimersAsync();
    await runPromise;

    const telemetryCalls = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('LLM suggestion telemetry')
    );
    expect(telemetryCalls).toHaveLength(1);
    expect(telemetryCalls[0][1]).toEqual(
      expect.objectContaining({
        actorId: 'actor-1',
        suggestedIndex: 1,
        finalIndex: 1,
        override: false,
        resolvedByTimeout: true,
        timeoutPolicy: 'autoAccept',
      })
    );

    const pendingTraces = logger.debug.mock.calls.filter(([msg]) =>
      msg.includes('Pending approval')
    );
    expect(pendingTraces).toHaveLength(2);
  });
});

