import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

const createLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
});

describe('AwaitingExternalTurnEndState – guard coverage', () => {
  let mockHandler;
  let mockCtx;
  let mockDispatcher;
  let mockLogger;

  beforeEach(() => {
    jest.useFakeTimers();

    mockLogger = createLogger();
    mockDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockImplementation((_, cb) => {
        mockDispatcher._callback = cb;
        return jest.fn();
      }),
    };

    mockCtx = {
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({ actionDefinitionId: 'sweep' }),
      getActor: () => ({ id: 'actor-1' }),
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
      getSafeEventDispatcher: () => mockDispatcher,
      getLogger: () => mockLogger,
    };

    mockHandler = {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('invokes the subscribed turn-ended handler for the current actor', async () => {
    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 50,
      setTimeoutFn: (...args) => setTimeout(...args),
      clearTimeoutFn: (...args) => clearTimeout(...args),
    });
    const handlerSpy = jest.spyOn(state, 'handleTurnEndedEvent');

    await state.enterState(mockHandler, null);

    expect(mockDispatcher.subscribe).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function)
    );
    const callback = mockDispatcher._callback;
    await callback({ payload: { entityId: 'actor-1' } });

    expect(handlerSpy).toHaveBeenCalledWith(mockHandler, {
      payload: { entityId: 'actor-1' },
    });
    expect(mockCtx.endTurn).toHaveBeenCalledWith(null);
  });

  it('logs a warning when clearing awaitingExternalEvent fails during exit', async () => {
    mockCtx.setAwaitingExternalEvent
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('flag update failed');
      });

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 50,
      setTimeoutFn: (...args) => setTimeout(...args),
      clearTimeoutFn: (...args) => clearTimeout(...args),
    });

    await state.enterState(mockHandler, null);
    await state.exitState(mockHandler, null);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to clear awaitingExternalEvent flag'),
      expect.any(Error)
    );
  });
});
