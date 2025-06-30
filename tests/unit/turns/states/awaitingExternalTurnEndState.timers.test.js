import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

describe('AwaitingExternalTurnEndState custom timer functions', () => {
  const TIMEOUT_MS = 5;
  let mockCtx;
  let mockHandler;
  let mockDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => () => {}),
    };
    mockCtx = {
      getChosenActionId: jest.fn(),
      getChosenAction: jest.fn(() => ({ actionDefinitionId: 'act' })),
      getActor: jest.fn(() => ({ id: 'actor1' })),
      getSafeEventDispatcher: jest.fn(() => mockDispatcher),
      getLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn(() => true),
      endTurn: jest.fn(),
    };
    mockHandler = {
      getLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      getTurnContext: jest.fn(() => mockCtx),
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses injected setTimeout and clearTimeout for guards', async () => {
    const timerCb = { fn: null };
    const setTimeoutMock = jest.fn((fn, ms) => {
      timerCb.fn = fn;
      return 'tid';
    });
    const clearTimeoutMock = jest.fn();

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: TIMEOUT_MS,
      setTimeoutFn: setTimeoutMock,
      clearTimeoutFn: clearTimeoutMock,
    });

    await state.enterState(mockHandler, null);
    expect(setTimeoutMock).toHaveBeenCalledWith(
      expect.any(Function),
      TIMEOUT_MS
    );

    // simulate timeout firing
    await timerCb.fn();
    expect(safeDispatchError).toHaveBeenCalled();
    expect(mockCtx.endTurn).toHaveBeenCalled();

    await state.exitState(mockHandler, null);
    expect(clearTimeoutMock).toHaveBeenCalledWith('tid');
  });
});
