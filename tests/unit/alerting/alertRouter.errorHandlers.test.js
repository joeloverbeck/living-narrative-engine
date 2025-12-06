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
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

const createDispatcher = () => ({
  subscribe: jest.fn(),
  dispatch: jest.fn(),
});

describe('AlertRouter error handling edge cases', () => {
  let dispatcher;

  beforeEach(() => {
    dispatcher = createDispatcher();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('logs an error when forwarding fails while the UI is ready', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.uiReady = true;

    const failure = new Error('forward failure');
    jest.spyOn(router, 'forwardToUI').mockImplementation(() => {
      throw failure;
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    router.handleEvent(SYSTEM_ERROR_OCCURRED_ID, { message: 'ignored' });

    expect(consoleSpy.mock.calls).toContainEqual([
      'AlertRouter error:',
      failure,
    ]);
  });

  it('logs flush errors for malformed queued payloads', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    router.queue.push({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: {},
    });

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    const flushErrorCall = consoleSpy.mock.calls.find(
      ([message, err]) =>
        message === 'AlertRouter flush error:' &&
        err instanceof Error &&
        err.message.includes('Missing or invalid `message`')
    );

    expect(flushErrorCall).toBeTruthy();
  });

  it('logs outer flush errors when queue iteration throws', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const flushFailure = new Error('outer flush failure');

    router.queue = {
      forEach: () => {
        throw flushFailure;
      },
    };

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(consoleSpy.mock.calls).toContainEqual([
      'AlertRouter flush error:',
      flushFailure,
    ]);
  });

  it('logs when forwarding queued events fails during notifyUIReady', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const forwardFailure = new Error('queued forward failure');

    jest.spyOn(router, 'forwardToUI').mockImplementation(() => {
      throw forwardFailure;
    });
    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'hello' } },
    ];
    router.flushTimer = setTimeout(() => {}, 0);

    router.notifyUIReady();

    expect(consoleSpy.mock.calls).toContainEqual([
      'AlertRouter error forwarding queued event:',
      forwardFailure,
    ]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs dispatch errors from the underlying dispatcher', () => {
    const dispatchFailure = new Error('dispatch failure');
    dispatcher.dispatch.mockImplementation(() => {
      throw dispatchFailure;
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, { message: 'boom' });

    expect(consoleSpy.mock.calls).toContainEqual([
      'AlertRouter dispatch error:',
      dispatchFailure,
    ]);
  });

  it('flushes queued warnings and errors to the console when timeout expires', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.queue.push(
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'warned' } },
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'failed' } }
    );

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(warnSpy.mock.calls).toContainEqual(['warned']);
    expect(errorSpy.mock.calls).toContainEqual(['failed']);
  });

  it('flushes queued error events individually', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.queue.push({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload: { message: 'single failure' },
    });

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(errorSpy.mock.calls).toContainEqual(['single failure']);
  });

  it('ignores queued events with unexpected names during flush', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.queue.push({ name: 'unknown:event', payload: { message: 'noop' } });

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('delegates subscription callbacks with unwrapped payloads', () => {
    const subscriptions = [];
    dispatcher.subscribe = jest.fn((eventId, handler) => {
      subscriptions.push({ eventId, handler });
    });

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const handleSpy = jest
      .spyOn(router, 'handleEvent')
      .mockImplementation(() => {});

    const warningPayload = { message: 'ready' };
    const errorPayload = { message: 'not good' };
    subscriptions[0].handler({ payload: warningPayload });
    subscriptions[1].handler({ payload: errorPayload });

    expect(handleSpy).toHaveBeenNthCalledWith(
      1,
      SYSTEM_WARNING_OCCURRED_ID,
      warningPayload
    );
    expect(handleSpy).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      errorPayload
    );
  });

  it('reports subscription errors without throwing', () => {
    const subscribeError = new Error('subscribe failure');
    dispatcher.subscribe = jest.fn(() => {
      throw subscribeError;
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(
      () => new AlertRouter({ safeEventDispatcher: dispatcher })
    ).not.toThrow();
    expect(consoleSpy.mock.calls).toContainEqual([
      'AlertRouter subscription error:',
      subscribeError,
    ]);
  });

  it('queues events and starts the flush timer when UI is not ready', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const startSpy = jest.spyOn(router, 'startFlushTimer');

    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued' });

    expect(router.queue).toHaveLength(1);
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('does not restart the flush timer when additional events are queued', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.queue.push({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'first' },
    });
    const startSpy = jest.spyOn(router, 'startFlushTimer');

    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'second' });

    expect(startSpy).not.toHaveBeenCalled();
    expect(router.queue).toHaveLength(2);
  });

  it('forwards error events to the UI dispatcher without errors', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'critical' });

    expect(dispatcher.dispatch).toHaveBeenCalledWith('core:display_error', {
      message: 'critical',
    });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('handles notifyUIReady when no flush timer is active', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    router.notifyUIReady();

    expect(router.flushTimer).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
