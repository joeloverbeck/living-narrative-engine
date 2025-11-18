import { describe, it, expect, jest, afterEach } from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

/**
 * Helper to create a minimal dispatcher compatible with AlertRouter.
 *
 * @param {Partial<import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher>} overrides
 */
function createDispatcher(overrides = {}) {
  const handlers = new Map();
  const dispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      handlers.set(eventId, handler);
    }),
    dispatch: jest.fn(),
  };

  Object.assign(dispatcher, overrides);
  return { dispatcher, handlers };
}

describe('AlertRouter catch block coverage', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs an error when handleEvent fails while queuing', () => {
    const { dispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Force queue mutation to throw so the catch block logs the failure.
    router.queue = null;
    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, { message: 'ignored' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  it('flushes queued events to the console when UI never becomes ready', () => {
    jest.useFakeTimers();

    const { dispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'Warn players' } },
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'Critical failure' } },
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: {} },
    ];

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(warnSpy).toHaveBeenCalledWith('Warn players');
    expect(
      errorSpy.mock.calls.some((call) => call[0] === 'Critical failure')
    ).toBe(true);
    expect(
      errorSpy.mock.calls.some(
        (call) => call[0] === 'AlertRouter flush error:' && call[1] instanceof Error
      )
    ).toBe(true);
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs a flush error when the queue cannot be processed at all', () => {
    jest.useFakeTimers();

    const { dispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = null; // Causes startFlushTimer to throw before iterating entries.

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(
      errorSpy.mock.calls.some(
        (call) => call[0] === 'AlertRouter flush error:' && call[1] instanceof Error
      )
    ).toBe(true);
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs forwarding failures while draining the queue in notifyUIReady', () => {
    const { dispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'keep me' } },
    ];

    const forwardError = new Error('forward failure');
    router.forwardToUI = jest.fn(() => {
      throw forwardError;
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.notifyUIReady();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      forwardError
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  it('logs dispatch failures when the dispatcher throws', () => {
    const dispatchError = new Error('dispatch failure');
    const { dispatcher } = createDispatcher({
      dispatch: jest.fn(() => {
        throw dispatchError;
      }),
    });

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'payload' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      dispatchError
    );
  });
});
