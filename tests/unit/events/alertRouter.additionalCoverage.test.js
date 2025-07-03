import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  DISPLAY_WARNING_ID,
  DISPLAY_ERROR_ID,
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
 *
 */
function createRouter() {
  const dispatcher = {
    listeners: {},
    subscribe: jest.fn((name, cb) => {
      dispatcher.listeners[name] = cb;
    }),
    dispatch: jest.fn(),
  };
  const router = new AlertRouter({ safeEventDispatcher: dispatcher });
  return { router, dispatcher };
}

describe('AlertRouter additional coverage', () => {
  let router;
  let dispatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ router, dispatcher } = createRouter());
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('queueing multiple events only starts timer once and flushes both types', () => {
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'warn1' });
    const firstTimer = router.flushTimer;
    router.handleEvent(SYSTEM_ERROR_OCCURRED_ID, { message: 'err1' });
    expect(router.queue).toHaveLength(2);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(router.flushTimer).toBe(firstTimer);

    jest.advanceTimersByTime(5000);

    expect(console.warn).toHaveBeenCalledWith('warn1');
    expect(console.error).toHaveBeenCalledWith('err1');
    expect(router.flushTimer).toBeNull();
    expect(router.queue).toEqual([]);
  });

  test('notifyUIReady forwards queued events and clears timer', () => {
    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued' });
    router.notifyUIReady();

    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_WARNING_ID, {
      message: 'queued',
    });
    expect(router.flushTimer).toBeNull();
    expect(router.queue).toEqual([]);

    // new events forward immediately
    dispatcher.dispatch.mockClear();
    dispatcher.listeners[SYSTEM_ERROR_OCCURRED_ID]({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload: { message: 'later' },
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_ERROR_ID, {
      message: 'later',
    });
  });
});
