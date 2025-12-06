import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  DISPLAY_WARNING_ID,
  DISPLAY_ERROR_ID,
} from '../../../src/constants/eventIds.js';

describe('AlertRouter', () => {
  let dispatcher;
  let subscriptions;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let setTimeoutSpy;
  let clearTimeoutSpy;
  let scheduledCallbacks;

  beforeEach(() => {
    subscriptions = {};
    dispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        subscriptions[eventId] = handler;
      }),
      dispatch: jest.fn(),
    };

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    scheduledCallbacks = [];
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((cb) => {
        scheduledCallbacks.push(cb);
        return Symbol('timer');
      });
    clearTimeoutSpy = jest
      .spyOn(global, 'clearTimeout')
      .mockImplementation(() => {
        scheduledCallbacks = [];
      });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  const triggerEvent = (eventId, payload) => {
    const handler = subscriptions[eventId];
    if (!handler) {
      throw new Error(`No handler registered for ${eventId}`);
    }
    handler({ payload });
  };

  const flushScheduledCallbacks = () => {
    scheduledCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        // Allow callbacks to throw without stopping other executions
        console.error(err);
      }
    });
    scheduledCallbacks = [];
  };

  it('queues warnings and errors until UI is ready and flushes them after timeout', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued warning' });
    triggerEvent(SYSTEM_ERROR_OCCURRED_ID, { message: 'queued error' });

    expect(router.queue).toHaveLength(2);
    expect(router.flushTimer).not.toBeNull();
    expect(setTimeoutSpy).toHaveBeenCalled();

    flushScheduledCallbacks();

    expect(consoleWarnSpy).toHaveBeenCalledWith('queued warning');
    expect(consoleErrorSpy).toHaveBeenCalledWith('queued error');
    expect(router.queue).toHaveLength(0);
    expect(router.flushTimer).toBeNull();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('flushes queue to UI when notifyUIReady is called and forwards subsequent events immediately', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'warn before ready' });
    triggerEvent(SYSTEM_ERROR_OCCURRED_ID, { message: 'error before ready' });

    router.notifyUIReady();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_WARNING_ID, {
      message: 'warn before ready',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message: 'error before ready',
    });
    expect(router.queue).toHaveLength(0);
    expect(router.uiReady).toBe(true);

    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'warn after ready' });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_WARNING_ID, {
      message: 'warn after ready',
    });
  });

  it('logs detailed errors for malformed payloads when flushing the queue', () => {
    new AlertRouter({ safeEventDispatcher: dispatcher });

    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, {});

    flushScheduledCallbacks();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(consoleErrorSpy.mock.calls.at(-1)[1].message).toMatch(
      'Missing or invalid `message`'
    );
  });

  it('logs subscription errors during construction', () => {
    const error = new Error('subscription failure');
    const failingDispatcher = {
      subscribe: jest.fn(() => {
        throw error;
      }),
      dispatch: jest.fn(),
    };

    new AlertRouter({ safeEventDispatcher: failingDispatcher });

    expect(failingDispatcher.subscribe).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      error
    );
  });

  it('logs and swallows unexpected queue errors when handling events', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const failure = new Error('queue failure');
    router.queue = {
      length: 0,
      push: () => {
        throw failure;
      },
    };

    expect(() =>
      triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'ignored' })
    ).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith('AlertRouter error:', failure);
  });

  it('logs outer flush errors when the queue cannot be iterated', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued warning' });
    // Simulate a mutation from outside the class that breaks iteration.
    router.queue = null;
    consoleErrorSpy.mockClear();

    flushScheduledCallbacks();

    const flushErrorCall = consoleErrorSpy.mock.calls.find(
      ([message]) => message === 'AlertRouter flush error:'
    );
    expect(flushErrorCall).toBeDefined();
    expect(flushErrorCall[1]).toBeInstanceOf(Error);
  });

  it('logs errors when forwarding queued events fails after the UI becomes ready', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    triggerEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued' });
    const failure = new Error('forward failure');
    router.forwardToUI = jest.fn(() => {
      throw failure;
    });
    consoleErrorSpy.mockClear();

    router.notifyUIReady();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      failure
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  it('logs dispatch errors when forwarding directly to the UI fails', () => {
    const dispatchError = new Error('dispatch failure');
    dispatcher.dispatch.mockImplementation(() => {
      throw dispatchError;
    });
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    consoleErrorSpy.mockClear();

    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'boom' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      dispatchError
    );
  });

  it('flushes timer entries with unrecognized event names without logging', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [{ name: 'custom:event', payload: { message: 'mystery' } }];

    router.startFlushTimer();

    expect(router.flushTimer).not.toBeNull();

    flushScheduledCallbacks();

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('skips timer cancellation when notifyUIReady is invoked without an active timer', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.flushTimer = null;
    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'queued warn' } },
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'queued error' } },
    ];

    const forwardSpy = jest.spyOn(router, 'forwardToUI');
    consoleErrorSpy.mockClear();
    clearTimeoutSpy.mockClear();

    router.notifyUIReady();

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(forwardSpy).toHaveBeenNthCalledWith(1, SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warn',
    });
    expect(forwardSpy).toHaveBeenNthCalledWith(2, SYSTEM_ERROR_OCCURRED_ID, {
      message: 'queued error',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);

    forwardSpy.mockRestore();
  });
});
