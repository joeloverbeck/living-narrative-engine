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

/**
 *
 */
function createDispatcher() {
  const handlers = new Map();
  const dispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      handlers.set(eventId, handler);
    }),
    dispatch: jest.fn(),
  };

  return { dispatcher, handlers };
}

describe('AlertRouter hard-to-reach error branches', () => {
  let dispatcher;
  let handlers;
  let errorSpy;
  let warnSpy;

  beforeEach(() => {
    ({ dispatcher, handlers } = createDispatcher());
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('swallows forwarding failures when UI is marked ready', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.uiReady = true;
    router.forwardToUI = jest.fn(() => {
      throw new Error('forward failure');
    });

    handlers.get(SYSTEM_WARNING_OCCURRED_ID)({
      payload: { message: 'ignored' },
    });

    expect(router.forwardToUI).toHaveBeenCalledWith(
      SYSTEM_WARNING_OCCURRED_ID,
      { message: 'ignored' }
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  it('flushes queued events, logging malformed payloads and continuing', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'warn me' } },
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'fail loudly' } },
      {
        name: SYSTEM_WARNING_OCCURRED_ID,
        payload: { details: 'missing message' },
      },
    ];

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(warnSpy).toHaveBeenCalledWith('warn me');
    expect(errorSpy).toHaveBeenCalledWith('fail loudly');
    expect(
      errorSpy.mock.calls.some(
        ([label, err]) =>
          label === 'AlertRouter flush error:' && err instanceof Error
      )
    ).toBe(true);
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('handles catastrophic flush errors by clearing state', () => {
    jest.useFakeTimers();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const catastrophic = new Error('flush loop');

    router.queue = {
      forEach: jest.fn(() => {
        throw catastrophic;
      }),
    };

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      catastrophic
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs forwarding failures while draining the queue during notifyUIReady', () => {
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.flushTimer = setTimeout(() => undefined, 1000);
    router.queue = [
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'queued-error' } },
    ];
    router.forwardToUI = jest.fn(() => {
      throw new Error('queued forward failure');
    });

    router.notifyUIReady();

    expect(router.flushTimer).toBeNull();
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
  });

  it('reports dispatch failures when forwarding directly to the UI', () => {
    const dispatchFailure = new Error('dispatch failed');
    dispatcher.dispatch.mockImplementation(() => {
      throw dispatchFailure;
    });

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'live error' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      dispatchFailure
    );
  });
});
