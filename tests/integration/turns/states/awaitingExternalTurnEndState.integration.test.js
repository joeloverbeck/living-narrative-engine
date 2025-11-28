/**
 * @file Integration tests for AwaitingExternalTurnEndState with the Promise.race architecture.
 *
 * Tests the real integration between:
 * - AwaitingExternalTurnEndState
 * - SafeEventDispatcher
 * - TurnContext
 * - AbortController-based cancellation
 * @see src/turns/states/awaitingExternalTurnEndState.js
 * @see src/turns/utils/cancellablePrimitives.js
 */

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

/**
 * Helper to flush promise queue for async coordination with fake timers.
 * Multiple calls needed to handle nested promise chains.
 */
const flushPromisesAndTimers = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

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
    state = new AwaitingExternalTurnEndState(handler, { timeoutMs: 100 });
  });

  afterEach(async () => {
    // Clean up any pending state before resetting timers
    if (state) {
      try {
        await state.destroy(handler);
      } catch {
        // Ignore cleanup errors
      }
    }
    jest.useRealTimers();
  });

  const dispatchTurnEnded = async (payload) => {
    await eventBus.dispatch(TURN_ENDED_ID, payload);
  };

  test('subscribes to turn-ended events and completes turn for matching actor', async () => {
    // Start enterState (which will await in Promise.race)
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    expect(context.isAwaitingExternalEvent()).toBe(true);
    expect(eventBus.listenerCount(TURN_ENDED_ID)).toBe(1);

    // Dispatch for wrong actor - should be ignored
    await dispatchTurnEnded({ entityId: 'other-actor', error: null });
    await flushPromisesAndTimers();
    expect(onEndTurn).not.toHaveBeenCalled();

    // Dispatch for correct actor - should complete turn
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    await flushPromisesAndTimers();

    // Wait for enterState to complete
    await enterPromise;

    expect(onEndTurn).toHaveBeenCalledTimes(1);
    expect(onEndTurn).toHaveBeenCalledWith(null);
    expect(context.isAwaitingExternalEvent()).toBe(false);

    // Verify internal state is cleaned up
    const internalState = state.getInternalStateForTest();
    expect(internalState.abortController).toBeNull();
    expect(internalState.awaitingActionId).toBe('unknown-action');
  });

  test('passes turn-end errors through to the context', async () => {
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    const failure = new Error('rule failed');
    await dispatchTurnEnded({ entityId: actor.id, error: failure });
    await flushPromisesAndTimers();
    await enterPromise;

    expect(onEndTurn).toHaveBeenCalledWith(failure);
    expect(context.isAwaitingExternalEvent()).toBe(false);
  });

  test('emits timeout errors and dispatches system notifications when no event arrives', async () => {
    const timeoutMs = 50;
    state = new AwaitingExternalTurnEndState(handler, { timeoutMs });

    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();
    expect(context.isAwaitingExternalEvent()).toBe(true);

    // Advance time to trigger timeout
    await jest.advanceTimersByTimeAsync(timeoutMs);
    await flushPromisesAndTimers();
    await enterPromise;

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
  });

  test('clears guards on exit even when awaiting flag callbacks throw', async () => {
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    // Make setAwaitingExternalEvent throw on cleanup
    const originalSetAwaiting = context.setAwaitingExternalEvent.bind(context);
    context.setAwaitingExternalEvent = jest.fn((value, actorId) => {
      originalSetAwaiting(value, actorId);
      if (!value) {
        throw new Error('listener failed');
      }
    });

    await state.exitState(handler, { getStateName: () => 'NextState' });
    await flushPromisesAndTimers();

    // enterPromise should resolve (AbortError is caught internally)
    await expect(enterPromise).resolves.toBeUndefined();

    expect(context.setAwaitingExternalEvent).toHaveBeenCalledWith(
      false,
      actor.id
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to clear awaitingExternalEvent flag'),
      expect.any(Error)
    );

    // Internal state should still be cleaned up
    const internalState = state.getInternalStateForTest();
    expect(internalState.abortController).toBeNull();
  });

  test('destroy resets internal tracking and stops listening for events', async () => {
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    await state.destroy(handler);
    await flushPromisesAndTimers();
    await enterPromise;

    const internalState = state.getInternalStateForTest();
    expect(internalState.abortController).toBeNull();
    expect(internalState.awaitingActionId).toBe('unknown-action');

    // Events after destroy should be ignored
    onEndTurn.mockClear();
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    await flushPromisesAndTimers();
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  test('enterState resets handler when no turn context is available', async () => {
    handler.setTurnContext(null);

    const idleSpy = handler.requestIdleStateTransition;
    await state.enterState(handler, null);

    expect(handler.resetStateAndResources).toHaveBeenCalledWith(
      'enter-no-context'
    );
    expect(idleSpy).toHaveBeenCalledTimes(1);

    const internalState = state.getInternalStateForTest();
    expect(internalState.abortController).toBeNull();
  });

  test('handleSubmittedCommand is ignored while awaiting external completion', async () => {
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    await expect(state.handleSubmittedCommand()).resolves.toBeUndefined();

    // Clean up by exiting
    await state.exitState(handler, { getStateName: () => 'PostCommand' });
    await flushPromisesAndTimers();
    await enterPromise;
  });

  test('exitState handles repeated invocations without residual guards', async () => {
    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    await state.exitState(handler, { getStateName: () => 'FirstExit' });
    await flushPromisesAndTimers();
    await enterPromise;

    const internalAfterFirst = state.getInternalStateForTest();
    expect(internalAfterFirst.abortController).toBeNull();

    // Second exit should be idempotent
    await state.exitState(handler, { getStateName: () => 'SecondExit' });

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('failed to clear awaitingExternalEvent flag'),
      expect.any(Error)
    );
  });

  test('event winning the race aborts the timeout', async () => {
    const timeoutMs = 100;
    state = new AwaitingExternalTurnEndState(handler, { timeoutMs });

    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    // Dispatch event before timeout
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    await flushPromisesAndTimers();
    await enterPromise;

    // Now advance timers - timeout should NOT fire since event already won
    onEndTurn.mockClear();
    await jest.advanceTimersByTimeAsync(timeoutMs);
    await flushPromisesAndTimers();

    // No additional calls to onEndTurn
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  test('abort controller prevents event processing after timeout', async () => {
    const timeoutMs = 50;
    state = new AwaitingExternalTurnEndState(handler, { timeoutMs });

    const enterPromise = state.enterState(handler, null);
    await flushPromisesAndTimers();

    // Let timeout win
    await jest.advanceTimersByTimeAsync(timeoutMs);
    await flushPromisesAndTimers();
    await enterPromise;

    const firstCallCount = onEndTurn.mock.calls.length;
    expect(firstCallCount).toBe(1);

    // Now dispatch event - should be ignored since state already exited
    await dispatchTurnEnded({ entityId: actor.id, error: null });
    await flushPromisesAndTimers();

    // No additional calls
    expect(onEndTurn.mock.calls.length).toBe(firstCallCount);
  });
});
