import { jest } from '@jest/globals';

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import { createEventBus } from '../../../common/mockFactories/eventBus.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class TestTurnHandler {
  constructor({ logger, dispatcher }) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetStateAndResources = jest.fn();
    this.requestIdleStateTransition = jest.fn();
    this.requestAwaitingExternalTurnEndStateTransition = jest.fn();
  }

  setTurnContext(ctx) {
    this._context = ctx;
  }

  getTurnContext() {
    return this._context;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

describe('AwaitingExternalTurnEndState integration', () => {
  let logger;
  let eventBus;
  let safeDispatcher;
  let handler;
  let actor;
  let onEndTurn;
  let context;
  let state;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createMockLogger();
    eventBus = createEventBus({ captureEvents: true });
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });

    handler = new TestTurnHandler({ logger, dispatcher: safeDispatcher });
    actor = { id: 'actor-1' };
    onEndTurn = jest.fn();

    context = new TurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: safeDispatcher,
        turnEndPort: { signalTurnEnd: jest.fn() },
        entityManager: {
          getComponentData: jest.fn(),
          getEntityInstance: jest.fn(),
        },
      },
      strategy: {
        decideAction: jest.fn(),
        getMetadata: jest.fn(() => ({})),
        dispose: jest.fn(),
      },
      onEndTurnCallback: onEndTurn,
      handlerInstance: handler,
      onSetAwaitingExternalEventCallback: jest.fn(),
    });

    handler.setTurnContext(context);
    state = new AwaitingExternalTurnEndState(handler);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dispatchTurnEnded = async (payload) => {
    await eventBus.dispatch(TURN_ENDED_ID, payload);
  };

  test('subscribes to turn-ended events and completes turn for matching actor', async () => {
    await state.enterState(handler, null);

    expect(context.isAwaitingExternalEvent()).toBe(true);
    expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(1);

    await dispatchTurnEnded({ entityId: 'other-actor', error: null });
    expect(onEndTurn).not.toHaveBeenCalled();

    await dispatchTurnEnded({ entityId: actor.id, error: null });

    expect(onEndTurn).toHaveBeenCalledTimes(1);
    expect(onEndTurn).toHaveBeenCalledWith(null);
    expect(context.isAwaitingExternalEvent()).toBe(false);
    expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(0);

    const internalState = state.getInternalStateForTest();
    expect(internalState.timeoutId).toBeNull();
    expect(internalState.unsubscribeFn).toBeUndefined();
    expect(internalState.awaitingActionId).toBe('unknown-action');

    onEndTurn.mockClear();
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  test('passes turn-end errors through to the context', async () => {
    await state.enterState(handler, null);
    const failure = new Error('rule failed');

    await dispatchTurnEnded({ entityId: actor.id, error: failure });

    expect(onEndTurn).toHaveBeenCalledWith(failure);
    expect(context.isAwaitingExternalEvent()).toBe(false);
  });

  test('emits timeout errors and dispatches system notifications when no event arrives', async () => {
    const timeoutMs = 50;
    state = new AwaitingExternalTurnEndState(handler, { timeoutMs });

    await state.enterState(handler, null);
    expect(context.isAwaitingExternalEvent()).toBe(true);

    await jest.runOnlyPendingTimersAsync();

    expect(onEndTurn).toHaveBeenCalledTimes(1);
    const timeoutError = onEndTurn.mock.calls[0][0];
    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError.code).toBe('TURN_END_TIMEOUT');
    expect(timeoutError.message).toContain(`${timeoutMs}`);

    const systemEvents = eventBus.events.filter(
      (event) => event.eventType === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(systemEvents).toHaveLength(1);
    expect(systemEvents[0].payload.details.actionId).toBe('unknown-action');

    await state.exitState(handler, { getStateName: () => 'TimeoutCleanup' });
    expect(context.isAwaitingExternalEvent()).toBe(false);
  });

  test('clears guards on exit even when awaiting flag callbacks throw', async () => {
    await state.enterState(handler, null);
    const originalSetAwaiting = context.setAwaitingExternalEvent.bind(context);
    const erroringLogger = logger;

    context.setAwaitingExternalEvent = jest.fn(() => {
      originalSetAwaiting(false, actor.id);
      throw new Error('listener failed');
    });

    await state.exitState(handler, { getStateName: () => 'NextState' });

    expect(context.setAwaitingExternalEvent).toHaveBeenCalledWith(false, actor.id);
    expect(erroringLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to clear awaitingExternalEvent flag'),
      expect.any(Error)
    );

    const internalState = state.getInternalStateForTest();
    expect(internalState.timeoutId).toBeNull();
    expect(internalState.unsubscribeFn).toBeUndefined();
    expect(context.isAwaitingExternalEvent()).toBe(false);
  });

  test('destroy resets internal tracking and stops listening for events', async () => {
    await state.enterState(handler, null);

    await state.destroy(handler);

    const internalState = state.getInternalStateForTest();
    expect(internalState.timeoutId).toBeNull();
    expect(internalState.unsubscribeFn).toBeUndefined();

    onEndTurn.mockClear();
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  test('enterState resets handler when no turn context is available', async () => {
    handler.setTurnContext(null);

    const idleSpy = handler.requestIdleStateTransition;
    await state.enterState(handler, null);

    expect(handler.resetStateAndResources).toHaveBeenCalledWith('enter-no-context');
    expect(idleSpy).toHaveBeenCalledTimes(1);

    const internalState = state.getInternalStateForTest();
    expect(internalState.timeoutId).toBeNull();
    expect(internalState.unsubscribeFn).toBeUndefined();
  });

  test('handleTurnEndedEvent exits gracefully when no context exists', async () => {
    handler.setTurnContext(null);

    await state.handleTurnEndedEvent(handler, { payload: { entityId: actor.id } });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  test('handleSubmittedCommand is ignored while awaiting external completion', async () => {
    await state.enterState(handler, null);

    await expect(state.handleSubmittedCommand()).resolves.toBeUndefined();

    await state.exitState(handler, { getStateName: () => 'PostCommand' });
  });

  test('timeout callback returns early when no longer awaiting', async () => {
    await state.enterState(handler, null);
    context.setAwaitingExternalEvent(false, actor.id);

    await jest.runOnlyPendingTimersAsync();

    expect(onEndTurn).not.toHaveBeenCalled();
    expect(eventBus.events).toHaveLength(0);

    await state.exitState(handler, { getStateName: () => 'EarlyTimeoutCleanup' });
  });

  test('timeout processing tolerates missing safe dispatcher', async () => {
    const noDispatcherHandler = new TestTurnHandler({ logger, dispatcher: null });
    const noDispatcherContext = new TurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: null,
        turnEndPort: { signalTurnEnd: jest.fn() },
        entityManager: {
          getComponentData: jest.fn(),
          getEntityInstance: jest.fn(),
        },
      },
      strategy: {
        decideAction: jest.fn(),
        getMetadata: jest.fn(() => ({})),
        dispose: jest.fn(),
      },
      onEndTurnCallback: onEndTurn,
      handlerInstance: noDispatcherHandler,
    });

    noDispatcherHandler.setTurnContext(noDispatcherContext);
    const stateWithoutDispatcher = new AwaitingExternalTurnEndState(
      noDispatcherHandler
    );

    await stateWithoutDispatcher.enterState(noDispatcherHandler, null);
    noDispatcherHandler.getSafeEventDispatcher = () => null;
    noDispatcherContext.getSafeEventDispatcher = () => null;

    await jest.runOnlyPendingTimersAsync();

    expect(onEndTurn).toHaveBeenCalledTimes(1);
    expect(eventBus.events).toHaveLength(0);

    await stateWithoutDispatcher.exitState(noDispatcherHandler, {
      getStateName: () => 'MissingDispatcherCleanup',
    });
  });

  test('exitState handles repeated invocations without residual guards', async () => {
    await state.enterState(handler, null);
    await state.exitState(handler, { getStateName: () => 'FirstExit' });

    const internalAfterFirst = state.getInternalStateForTest();
    expect(internalAfterFirst.timeoutId).toBeNull();
    expect(internalAfterFirst.unsubscribeFn).toBeUndefined();

    await state.exitState(handler, { getStateName: () => 'SecondExit' });
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('failed to clear awaitingExternalEvent flag'),
      expect.any(Error)
    );
  });
});
