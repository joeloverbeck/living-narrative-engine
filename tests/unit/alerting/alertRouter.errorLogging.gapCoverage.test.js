import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

describe('AlertRouter error logging gap coverage', () => {
  let dispatcher;

  beforeEach(() => {
    dispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs an error when handleEvent fails to enqueue due to queue issues', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.queue = null;

    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'queued?' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  it('flushes queued warnings and errors to the console when timer elapses', () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [
      {
        name: SYSTEM_WARNING_OCCURRED_ID,
        payload: { message: 'delayed warning' },
      },
      {
        name: SYSTEM_ERROR_OCCURRED_ID,
        payload: { message: 'delayed error' },
      },
    ];

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(warnSpy).toHaveBeenCalledWith('delayed warning');
    expect(errorSpy).toHaveBeenCalledWith('delayed error');
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs a top-level flush error if the queue cannot be iterated', () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.queue = null;

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
  });

  it('logs forwarding errors encountered while replaying queued events', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [
      {
        name: SYSTEM_WARNING_OCCURRED_ID,
        payload: { message: 'queued warning' },
      },
    ];

    jest.spyOn(router, 'forwardToUI').mockImplementation(() => {
      throw new Error('forward failed');
    });

    router.notifyUIReady();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  it('logs dispatch errors when forwarding directly to the UI', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const throwingDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(() => {
        throw new Error('dispatch failed');
      }),
    };

    const router = new AlertRouter({ safeEventDispatcher: throwingDispatcher });

    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, { message: 'instant' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.any(Error)
    );
  });
});
