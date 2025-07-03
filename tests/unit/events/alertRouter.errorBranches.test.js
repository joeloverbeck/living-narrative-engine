import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import {
  describe,
  beforeEach,
  afterEach,
  jest,
  test,
  expect,
} from '@jest/globals';

/**
 * Helper to create a router with a mocked dispatcher.
 *
 * @returns {{router: AlertRouter, dispatcher: object}}
 */
function createRouter() {
  const dispatcher = {
    listeners: {},
    subscribe: jest.fn((name, listener) => {
      dispatcher.listeners[name] = listener;
    }),
    dispatch: jest.fn(),
  };
  const router = new AlertRouter({ safeEventDispatcher: dispatcher });
  return { router, dispatcher };
}

describe('AlertRouter uncovered branches', () => {
  let router;
  let dispatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ router, dispatcher } = createRouter());
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('handleEvent logs errors when enqueueing fails', () => {
    // Force queue.push to throw
    router.queue.push = () => {
      throw new Error('push fail');
    };
    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'hi' });
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  test('error events flushed after timeout go to console.error', () => {
    dispatcher.listeners[SYSTEM_ERROR_OCCURRED_ID]({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload: { message: 'boom' },
    });
    jest.advanceTimersByTime(5000);
    expect(console.error).toHaveBeenCalledWith('boom');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('startFlushTimer handles unexpected errors', () => {
    router.queue = {
      forEach: () => {
        throw new Error('outer');
      },
    };
    router.startFlushTimer();
    jest.advanceTimersByTime(5000);
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(router.flushTimer).toBeNull();
    expect(router.queue).toEqual([]);
  });

  test('notifyUIReady logs when forwarding queued events fails', () => {
    router.queue.push({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'x' },
    });
    router.forwardToUI = () => {
      throw new Error('forward fail');
    };
    router.notifyUIReady();
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
  });

  test('forwardToUI logs dispatch errors', () => {
    dispatcher.dispatch.mockImplementation(() => {
      throw new Error('dispatch fail');
    });
    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, { message: 'oops' });
    expect(console.error).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.any(Error)
    );
  });
});
