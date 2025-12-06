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

/**
 * Utility helper that creates a dispatcher mock capturing subscription handlers.
 *
 * @returns {{ dispatcher: { subscribe: jest.Mock, dispatch: jest.Mock }, emit: (eventId: string, payload: object) => void }}
 */
function createDispatcherHarness() {
  /** @type {Map<string, (event: { payload: any }) => void>} */
  const subscriptions = new Map();
  const dispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      subscriptions.set(eventId, handler);
      return () => subscriptions.delete(eventId);
    }),
    dispatch: jest.fn(),
  };

  return {
    dispatcher,
    emit(eventId, payload) {
      const handler = subscriptions.get(eventId);
      if (!handler) {
        throw new Error(`No handler registered for ${eventId}`);
      }
      handler({ payload });
    },
  };
}

describe('AlertRouter additional coverage', () => {
  let harness;
  /** @type {ReturnType<typeof createDispatcherHarness>['dispatcher']} */
  let dispatcher;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    harness = createDispatcherHarness();
    dispatcher = harness.dispatcher;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs queue push failures without crashing when handling events', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const failure = new Error('queue failed');
    router.queue = {
      length: 0,
      push: () => {
        throw failure;
      },
    };

    expect(() =>
      harness.emit(SYSTEM_WARNING_OCCURRED_ID, { message: 'ignored' })
    ).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith('AlertRouter error:', failure);
  });

  it('logs subscription failures when dispatcher.subscribe throws synchronously', () => {
    const subscribeFailure = new Error('subscribe failed');
    dispatcher.subscribe.mockImplementation(() => {
      throw subscribeFailure;
    });

    expect(
      () => new AlertRouter({ safeEventDispatcher: dispatcher })
    ).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      subscribeFailure
    );
  });

  it('routes queued error events to console.error when the timer flushes', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    harness.emit(SYSTEM_ERROR_OCCURRED_ID, { message: 'fatal issue' });

    jest.runOnlyPendingTimers();

    expect(consoleErrorSpy).toHaveBeenCalledWith('fatal issue');
    expect(consoleWarnSpy).not.toHaveBeenCalledWith('fatal issue');
    expect(router.queue).toEqual([]);
  });

  it('does not restart the flush timer when additional events arrive in the queue', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const timerSpy = jest.spyOn(router, 'startFlushTimer');

    harness.emit(SYSTEM_WARNING_OCCURRED_ID, { message: 'first' });
    harness.emit(SYSTEM_WARNING_OCCURRED_ID, { message: 'second' });

    expect(timerSpy).toHaveBeenCalledTimes(1);
  });

  it('logs outer flush failures and resets internal queue state', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const flushFailure = new Error('iteration failed');

    router.queue = {
      forEach: () => {
        throw flushFailure;
      },
    };

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      flushFailure
    );
    expect(Array.isArray(router.queue)).toBe(true);
    expect(router.flushTimer).toBeNull();
  });

  it('logs failures when forwarding queued events during notifyUIReady', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const forwardFailure = new Error('forward failed');

    router.queue.push({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'queued' },
    });
    router.flushTimer = setTimeout(() => {}, 0);
    jest.spyOn(router, 'forwardToUI').mockImplementation(() => {
      throw forwardFailure;
    });

    router.notifyUIReady();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      forwardFailure
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('reports dispatcher errors when forwarding directly to the UI', () => {
    const dispatchFailure = new Error('dispatch failed');
    dispatcher.dispatch.mockImplementation(() => {
      throw dispatchFailure;
    });

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, { message: 'boom' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      dispatchFailure
    );
  });

  it('maps event types to the appropriate UI event identifiers', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, { message: 'warn' });
    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'err' });

    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(1, DISPLAY_WARNING_ID, {
      message: 'warn',
    });
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(2, DISPLAY_ERROR_ID, {
      message: 'err',
    });
  });

  it('defaults to display_error when forwarding unrecognised event types', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    dispatcher.dispatch.mockClear();
    router.forwardToUI('unexpected:event', { message: 'noop' });

    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message: 'noop',
    });
  });

  it('ignores queued events that use unrecognised identifiers during flush', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();

    router.queue.push({
      name: 'unexpected:event',
      payload: { message: 'noop' },
    });
    router.startFlushTimer();

    jest.runOnlyPendingTimers();

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('invokes forwardToUI immediately when the UI is already ready', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.uiReady = true;
    const forwardSpy = jest.spyOn(router, 'forwardToUI');

    harness.emit(SYSTEM_WARNING_OCCURRED_ID, { message: 'direct forward' });

    expect(forwardSpy).toHaveBeenCalledWith(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'direct forward',
    });
  });

  it('warns when queued warning events flush successfully', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    harness.emit(SYSTEM_WARNING_OCCURRED_ID, { message: 'be cautious' });

    jest.runOnlyPendingTimers();

    expect(consoleWarnSpy).toHaveBeenCalledWith('be cautious');
  });

  it('logs flush errors for entries that lack a usable message field', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    harness.emit(SYSTEM_WARNING_OCCURRED_ID, {});

    jest.runOnlyPendingTimers();

    const flushErrorCall = consoleErrorSpy.mock.calls.find(
      ([label, err]) =>
        label === 'AlertRouter flush error:' &&
        err instanceof Error &&
        err.message.includes('Missing or invalid `message`')
    );

    expect(flushErrorCall).toBeDefined();
  });

  it('handles notifyUIReady gracefully when no flush timer is active', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    expect(() => router.notifyUIReady()).not.toThrow();
    expect(router.flushTimer).toBeNull();
    expect(router.uiReady).toBe(true);
  });
});
