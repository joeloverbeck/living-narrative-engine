import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

/**
 * @file Tests specifically for the setTimeout/clearTimeout binding fix
 * @description These tests verify that the "Illegal invocation" TypeError
 * is resolved when using default setTimeout/clearTimeout functions.
 */

describe('AwaitingExternalTurnEndState - setTimeout binding fix', () => {
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
      getChosenAction: jest.fn(() => ({ actionDefinitionId: 'test_action' })),
      getActor: jest.fn(() => ({ id: 'test_actor' })),
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

  it('should not throw "Illegal invocation" error when using default setTimeout', async () => {
    // This test reproduces the exact scenario that was causing the error
    const state = new AwaitingExternalTurnEndState(mockHandler);

    // The previous implementation would throw "TypeError: Illegal invocation" here
    await expect(state.enterState(mockHandler, null)).resolves.not.toThrow();
  });

  it('should correctly setup timeout with proper context binding', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 100,
    });

    await state.enterState(mockHandler, null);

    // Verify that a timeout was actually set
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(100);

    // Verify timeout callback was executed without error
    expect(mockCtx.endTurn).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });

  it('should preserve custom setTimeout/clearTimeout injection capability', async () => {
    const customSetTimeout = jest.fn(() => {
      // Simulate custom timer behavior
      return 'custom-timer-id';
    });
    const customClearTimeout = jest.fn();

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 50,
      setTimeoutFn: customSetTimeout,
      clearTimeoutFn: customClearTimeout,
    });

    await state.enterState(mockHandler, null);

    // Verify custom functions were used
    expect(customSetTimeout).toHaveBeenCalledWith(expect.any(Function), 50);

    await state.exitState(mockHandler, null);

    // Verify custom clear function was called
    expect(customClearTimeout).toHaveBeenCalledWith('custom-timer-id');
  });

  it('should handle timeout callback execution without context binding issues', async () => {
    jest.useFakeTimers();

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 200,
    });

    await state.enterState(mockHandler, null);

    // Advance time to trigger timeout
    jest.advanceTimersByTime(200);

    // Verify the timeout callback executed successfully
    expect(mockCtx.endTurn).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should properly clear timeout on state exit', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 1000,
    });

    await state.enterState(mockHandler, null);

    // Verify timeout was set
    expect(setTimeoutSpy).toHaveBeenCalled();

    // Exit state before timeout
    await state.exitState(mockHandler, null);

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advance time past original timeout
    jest.advanceTimersByTime(1000);

    // Verify endTurn was NOT called (timeout was cleared)
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should maintain internal state correctly after binding fix', async () => {
    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 300,
    });

    await state.enterState(mockHandler, null);

    const internalState = state.getInternalStateForTest();

    // Verify internal state is properly maintained
    expect(internalState.timeoutId).toBeDefined();
    expect(internalState.timeoutId).not.toBeNull();
    expect(internalState.unsubscribeFn).toBeDefined();
    expect(internalState.awaitingActionId).toBe('test_action');
  });
});
