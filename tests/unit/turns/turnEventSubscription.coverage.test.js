import { describe, it, expect, jest } from '@jest/globals';
import TurnEventSubscription from '../../../src/turns/turnEventSubscription.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';
import { createEventBus } from '../../common/mockFactories/index.js';

/**
 * Builds a scheduler mock that tracks invocations.
 * Note: Since Phase 10 fix, setTimeout is no longer called by TurnEventSubscription,
 * but the scheduler is still required by the constructor contract for backward compatibility.
 *
 * @returns {{ setTimeout: jest.Mock, clearTimeout: jest.Mock }} Scheduler mock
 */
function createSchedulerMock() {
  return {
    setTimeout: jest.fn((fn, delay) => {
      fn();
      return delay ?? 0;
    }),
    clearTimeout: jest.fn(),
  };
}

/**
 * Creates a basic logger stub with a debuggable interface.
 *
 * @returns {{ debug: jest.Mock, error: jest.Mock }}
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
  };
}

describe('TurnEventSubscription - coverage', () => {
  describe('constructor validation', () => {
    it('requires bus with subscribe function', () => {
      const scheduler = createSchedulerMock();
      const logger = createLoggerMock();

      expect(() => new TurnEventSubscription(null, logger, scheduler)).toThrow(
        'TurnEventSubscription: bus must support subscribe'
      );
      expect(() => new TurnEventSubscription({}, logger, scheduler)).toThrow(
        'TurnEventSubscription: bus must support subscribe'
      );
    });

    it('requires logger with debug method', () => {
      const bus = { subscribe: jest.fn() };
      const scheduler = createSchedulerMock();

      expect(() => new TurnEventSubscription(bus, null, scheduler)).toThrow(
        'TurnEventSubscription: logger is required'
      );
      expect(() => new TurnEventSubscription(bus, {}, scheduler)).toThrow(
        'TurnEventSubscription: logger is required'
      );
    });

    it('requires scheduler with timeout APIs', () => {
      const bus = { subscribe: jest.fn() };
      const logger = createLoggerMock();

      expect(() => new TurnEventSubscription(bus, logger, null)).toThrow(
        'TurnEventSubscription: invalid scheduler'
      );
      expect(
        () => new TurnEventSubscription(bus, logger, { setTimeout: jest.fn() })
      ).toThrow('TurnEventSubscription: invalid scheduler');
      expect(
        () =>
          new TurnEventSubscription(bus, logger, { clearTimeout: jest.fn() })
      ).toThrow('TurnEventSubscription: invalid scheduler');
    });
  });

  it('subscribes to turn end events and invokes callback immediately', async () => {
    const bus = createEventBus();
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock();
    const cb = jest.fn();
    const subscription = new TurnEventSubscription(bus, logger, scheduler);

    subscription.subscribe(cb);

    expect(bus.subscribe).toHaveBeenCalledTimes(1);
    const [, wrappedHandler] = bus.subscribe.mock.calls[0];
    expect(bus.subscribe).toHaveBeenCalledWith(
      TURN_ENDED_ID,
      expect.any(Function)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'TurnEventSubscription: subscribed'
    );

    await bus.dispatch(TURN_ENDED_ID, { entityId: 'abc', success: true });

    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEventSubscription: received ${TURN_ENDED_ID} event`
    );
    // Phase 10 fix: callback is invoked immediately, not via setTimeout
    // scheduler.setTimeout is no longer called
    expect(cb).toHaveBeenCalledWith({
      type: TURN_ENDED_ID,
      payload: { entityId: 'abc', success: true },
    });
    expect(wrappedHandler).toBe(bus.subscribe.mock.calls[0][1]);
  });

  it('ignores subsequent subscribe calls when already subscribed', () => {
    const bus = createEventBus();
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock();
    const subscription = new TurnEventSubscription(bus, logger, scheduler);
    const cb = jest.fn();

    subscription.subscribe(cb);
    subscription.subscribe(cb);

    expect(bus.subscribe).toHaveBeenCalledTimes(1);
  });

  it('throws if subscribe does not return an unsubscribe function and recovers after error', () => {
    const unsubSpy = jest.fn();
    const bus = {
      subscribe: jest
        .fn()
        .mockReturnValueOnce('not-a-function')
        .mockReturnValue(unsubSpy),
    };
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock();
    const subscription = new TurnEventSubscription(bus, logger, scheduler);

    expect(() => subscription.subscribe(jest.fn())).toThrow(
      'Subscription function did not return an unsubscribe callback.'
    );
    expect(logger.debug).not.toHaveBeenCalledWith(
      'TurnEventSubscription: subscribed'
    );

    const cb = jest.fn();
    subscription.subscribe(cb);

    expect(bus.subscribe).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenLastCalledWith(
      'TurnEventSubscription: subscribed'
    );
  });

  it('unsubscribes when active and logs, but is silent when inactive', () => {
    const unsubSpy = jest.fn();
    const bus = { subscribe: jest.fn(() => unsubSpy) };
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock();
    const subscription = new TurnEventSubscription(bus, logger, scheduler);
    const cb = jest.fn();

    subscription.subscribe(cb);
    logger.debug.mockClear();
    subscription.unsubscribe();

    expect(unsubSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'TurnEventSubscription: unsubscribed'
    );

    logger.debug.mockClear();
    subscription.unsubscribe();

    expect(unsubSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  // Phase 10 fix: This test was removed because callbacks are now invoked immediately
  // (no setTimeout deferral) to fix the race condition with state machine transitions.
  // The original test verified that pending timeouts are cleared on unsubscribe,
  // but this is no longer applicable since callbacks execute synchronously.
  it('invokes callback immediately without deferral (Phase 10 race condition fix)', async () => {
    const bus = createEventBus();
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock();
    const subscription = new TurnEventSubscription(bus, logger, scheduler);
    const cb = jest.fn();

    subscription.subscribe(cb);

    // Before Phase 10, this would be deferred via setTimeout.
    // Now it executes immediately when the event fires.
    await bus.dispatch(TURN_ENDED_ID, { reason: 'test' });

    // Callback should have been invoked immediately, not deferred
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      type: TURN_ENDED_ID,
      payload: { reason: 'test' },
    });
    // setTimeout is no longer used for callback deferral
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
  });

  it('logs and suppresses errors thrown by callbacks', async () => {
    const bus = createEventBus();
    const logger = createLoggerMock();
    const scheduler = createSchedulerMock(); // Use simple mock since setTimeout isn't called
    const subscription = new TurnEventSubscription(bus, logger, scheduler);

    const error = new Error('callback failed');
    const failingCallback = jest.fn(() => {
      throw error;
    });

    subscription.subscribe(failingCallback);
    await bus.dispatch(TURN_ENDED_ID, { reason: 'boom' });

    // Allow the async invokeCallback to complete and catch the error
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(failingCallback).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `TurnEventSubscription: callback threw while handling ${TURN_ENDED_ID}.`,
      error
    );
  });
});
