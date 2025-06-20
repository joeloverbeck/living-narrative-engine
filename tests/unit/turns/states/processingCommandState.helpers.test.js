import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { ProcessingWorkflow } from '../../../../src/turns/states/workflows/processingWorkflow.js';

const mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
  beforeEach(() => {
    jest.clearAllMocks();
    state = new ProcessingCommandState(mockHandler, null, null);
    workflow = new ProcessingWorkflow(state, null, null, () => {});
  });

  test('_validateContextAndActor returns actor when valid', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor);
    await expect(workflow._validateContextAndActor(ctx)).resolves.toBe(actor);
  });

  test('_validateContextAndActor returns null when actor missing', async () => {
    const ctx = makeCtx(null);
    await expect(workflow._validateContextAndActor(ctx)).resolves.toBeNull();
  });

  test('_resolveTurnAction uses constructor action', async () => {
    const actor = { id: 'a1' };
    const action = { actionDefinitionId: 'act' };
    state = new ProcessingCommandState(mockHandler, null, action);
    workflow = new ProcessingWorkflow(state, null, action, (a) => {});
    const ctx = makeCtx(actor);
    await expect(workflow._resolveTurnAction(ctx, actor)).resolves.toBe(action);
  });

  test('_dispatchSpeech dispatches when speech present', async () => {
    const actor = { id: 'a1' };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeCtx(actor, { getSafeEventDispatcher: () => dispatcher });
    await state._dispatchSpeech(ctx, actor, { speech: 'hi' });
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });

  test('_executeActionWorkflow calls _processCommandInternal', async () => {
    const actor = { id: 'a1' };
    const ctx = makeCtx(actor);
    const action = { actionDefinitionId: 'act' };
    const spy = jest
      .spyOn(state, '_processCommandInternal')
      .mockResolvedValue(undefined);
    await workflow._executeActionWorkflow(ctx, actor, action);
    expect(spy).toHaveBeenCalledWith(ctx, actor, action);
  });
});
