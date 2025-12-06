import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

class StubSafeEventDispatcher {
  constructor({ dispatchImpl } = {}) {
    this.handlers = new Map();
    this.dispatchImpl = dispatchImpl ?? (() => {});
  }

  subscribe(eventName, handler) {
    this.handlers.set(eventName, handler);
  }

  dispatch(eventName, payload) {
    return this.dispatchImpl(eventName, payload);
  }

  emit(eventName, payload) {
    const handler = this.handlers.get(eventName);
    if (handler) {
      handler({ name: eventName, payload });
    }
  }
}

describe('AlertRouter integration – catch branch coverage', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs an error when queue operations fail during handleEvent', () => {
    const dispatcher = new StubSafeEventDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue.push = () => {
      throw new Error('queue failed');
    };

    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'should log error',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  it('flushes queued warnings and errors to the console when UI stays unavailable', () => {
    jest.useFakeTimers();
    const dispatcher = new StubSafeEventDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.handleEvent(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'delayed warning',
    });
    router.handleEvent(SYSTEM_ERROR_OCCURRED_ID, { message: 'delayed error' });

    expect(router.flushTimer).not.toBeNull();

    jest.runOnlyPendingTimers();

    expect(consoleWarnSpy).toHaveBeenCalledWith('delayed warning');
    expect(consoleErrorSpy).toHaveBeenCalledWith('delayed error');
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('handles unexpected failures while iterating queued events during flush', () => {
    jest.useFakeTimers();
    const dispatcher = new StubSafeEventDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue = {
      forEach() {
        throw new Error('iteration failure');
      },
    };

    router.startFlushTimer();

    jest.runOnlyPendingTimers();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('continues processing when forwarding a queued event throws during notifyUIReady', () => {
    const dispatcher = new StubSafeEventDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.queue.push({
      name: SYSTEM_WARNING_OCCURRED_ID,
      payload: { message: 'queued warning' },
      timestamp: new Date().toISOString(),
    });

    router.forwardToUI = () => {
      throw new Error('forward failure');
    };

    router.notifyUIReady();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  it('logs dispatcher failures while forwarding events immediately', () => {
    const dispatcher = new StubSafeEventDispatcher({
      dispatchImpl() {
        throw new Error('dispatch failure');
      },
    });
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    router.uiReady = true;
    router.handleEvent(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'immediate error',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.any(Error)
    );
  });
});
