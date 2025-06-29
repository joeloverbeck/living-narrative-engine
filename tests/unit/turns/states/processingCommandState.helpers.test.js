import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { ProcessingWorkflow } from '../../../../src/turns/states/workflows/processingWorkflow.js';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';
import * as safeDispatchEventModule from '../../../../src/utils/safeDispatchEvent.js';
import { ENTITY_SPOKE_ID } from '../../../../src/constants/eventIds.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockHandler = {
  getTurnContext: jest.fn(),
  _resetTurnStateAndResources: jest.fn(),
  resetStateAndResources: jest.fn(function (reason) {
    mockHandler._resetTurnStateAndResources(reason);
  }),
  _transitionToState: jest.fn(),
  getLogger: jest.fn(() => mockLogger),
  _turnStateFactory: { createIdleState: jest.fn(() => ({})) },
};

// Mock TurnDirectiveStrategyResolver for this test suite
jest.mock('../../../../src/turns/strategies/turnDirectiveStrategyResolver.js');

const makeCtx = (actor, extra = {}) => ({
  getLogger: () => mockLogger,
  getActor: () => actor,
  getChosenAction: jest.fn(),
  getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
  ...extra,
});

describe('ProcessingCommandState helpers', () => {
  let state;
  let workflow;
  let mockCommandProcessor;
  let mockCommandOutcomeInterpreter;
  let defaultTurnAction;
  const defaultCommandString = 'helper test command';

  beforeEach(() => {
    jest.clearAllMocks();

    mockCommandProcessor = {
      dispatchAction: jest.fn(),
    };
    mockCommandOutcomeInterpreter = {
      interpret: jest.fn(),
    };
    defaultTurnAction = {
      actionDefinitionId: 'helperTestAction',
      commandString: defaultCommandString,
    };

    const resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
    state = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: defaultCommandString,
      turnAction: defaultTurnAction,
      directiveResolver: resolver,
    });
    workflow = new ProcessingWorkflow(state, null, null, () => {});
  });

  test('_acquireContext returns context and starts processing', async () => {
    const ctx = makeCtx({ id: 'a1' });
    state._ensureContext = jest.fn(async () => ctx);
    const result = await workflow._acquireContext(mockHandler, null);
    expect(result).toBe(ctx);
    expect(state.isProcessing).toBe(true);
  });

  test('_acquireContext returns null when already processing', async () => {
    const ctx = makeCtx({ id: 'a1' });
    state._ensureContext = jest.fn(async () => ctx);
    state.startProcessing();
    const result = await workflow._acquireContext(mockHandler, null);
    expect(result).toBeNull();
  });

  test('_validateActor returns actor when valid', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor);
    await expect(workflow._validateActor(ctx)).resolves.toBe(actor);
  });

  test('_validateActor returns null when actor missing', async () => {
    const ctx = makeCtx(null);
    await expect(workflow._validateActor(ctx)).resolves.toBeNull();
  });

  test('_obtainTurnAction uses constructor action', async () => {
    const actor = { id: 'a1' };
    const specificAction = {
      actionDefinitionId: 'specificAct',
      commandString: 'specific command',
    };
    const resolver = new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
    state = new ProcessingCommandState({
      handler: mockHandler,
      commandProcessor: mockCommandProcessor,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      commandString: specificAction.commandString,
      turnAction: specificAction,
      directiveResolver: resolver,
    });
    workflow = new ProcessingWorkflow(state, null, specificAction, () => {});
    const ctx = makeCtx(actor);
    await expect(workflow._obtainTurnAction(ctx, actor)).resolves.toBe(
      specificAction
    );
  });

  test('_dispatchSpeech dispatches when speech present', async () => {
    const actor = { id: 'a1' };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeCtx(actor, { getSafeEventDispatcher: () => dispatcher });
    const helperSpy = jest.spyOn(safeDispatchEventModule, 'safeDispatchEvent');
    await state._dispatchSpeech(ctx, actor, { speech: 'hi' });
    expect(helperSpy).toHaveBeenCalledWith(
      dispatcher,
      ENTITY_SPOKE_ID,
      { entityId: 'a1', speechContent: 'hi' },
      mockLogger
    );
    expect(dispatcher.dispatch).toHaveBeenCalled();
    helperSpy.mockRestore();
  });

  test('_dispatchSpeech warns when dispatcher missing', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor, { getSafeEventDispatcher: () => null });
    await state._dispatchSpeech(ctx, actor, { speech: 'hi' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SafeEventDispatcher unavailable')
    );
  });

  test('_dispatchSpeech logs error when dispatch fails', async () => {
    const actor = { id: 'a1' };
    const dispatchErr = new Error('bad');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(dispatchErr) };
    const ctx = makeCtx(actor, { getSafeEventDispatcher: () => dispatcher });

    await state._dispatchSpeech(ctx, actor, { speech: 'hi' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      `Failed to dispatch ${ENTITY_SPOKE_ID}`,
      dispatchErr
    );
  });

  test('_dispatchSpeechIfNeeded forwards metadata', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor, { getDecisionMeta: () => ({ speech: 'hi' }) });
    const spy = jest
      .spyOn(state, '_dispatchSpeech')
      .mockResolvedValue(undefined);
    await workflow._dispatchSpeechIfNeeded(ctx, actor);
    expect(spy).toHaveBeenCalledWith(ctx, actor, { speech: 'hi' });
  });

  test('_executeAction calls _processCommandInternal', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor);
    const action = { actionDefinitionId: 'act' };
    const spy = jest
      .spyOn(state, '_processCommandInternal')
      .mockResolvedValue(undefined);
    await workflow._executeAction(ctx, actor, action);
    expect(spy).toHaveBeenCalledWith(
      ctx,
      actor,
      action,
      workflow._exceptionHandler
    );
  });

  test('_executeAction delegates errors to exception handler', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor);
    const action = { actionDefinitionId: 'act' };
    const err = new Error('boom');
    jest.spyOn(state, '_processCommandInternal').mockRejectedValue(err);
    const handlerSpy = jest.spyOn(workflow._exceptionHandler, 'handle');

    await workflow._executeAction(ctx, actor, action);

    expect(handlerSpy).toHaveBeenCalledWith(ctx, err, actor.id);
  });
});
