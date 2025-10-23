import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import {
  DISPLAY_ERROR_ID,
  DISPLAY_WARNING_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

class TestLogger {
  constructor() {
    this.calls = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
  }
}

class NullGameDataRepository {
  getEventDefinition() {
    return null;
  }
}

class NoopSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

const createDispatcher = () => {
  const logger = new TestLogger();
  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: new NullGameDataRepository(),
    schemaValidator: new NoopSchemaValidator(),
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  return { logger, eventBus, validatedEventDispatcher, safeEventDispatcher };
};

describe('AlertRouter integration error handling', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  it('logs subscription errors without throwing during construction', () => {
    const { safeEventDispatcher } = createDispatcher();
    const failure = new Error('subscribe failure');
    const subscribeSpy = jest
      .spyOn(safeEventDispatcher, 'subscribe')
      .mockImplementation(() => {
        throw failure;
      });

    new AlertRouter({ safeEventDispatcher });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      failure
    );
    subscribeSpy.mockRestore();
  });

  it('flushes error events to the console when the UI never becomes ready', async () => {
    const { safeEventDispatcher } = createDispatcher();
    new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Severe failure',
    });

    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith('Severe failure');
  });

  it('routes queued error events through console.error when flushing manually', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    router.queue.push({
      name: SYSTEM_ERROR_OCCURRED_ID,
      payload: { message: 'Manual flush error' },
    });

    router.startFlushTimer();
    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith('Manual flush error');
  });

  it('ignores queued events with unknown names when flushing to the console', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    router.queue.push({
      name: 'unexpected:event',
      payload: { message: 'Ignored message' },
    });

    router.startFlushTimer();
    await jest.advanceTimersByTimeAsync(5000);

    expect(warnSpy).not.toHaveBeenCalledWith('Ignored message');
    expect(errorSpy).not.toHaveBeenCalledWith('Ignored message');
  });

  it('logs malformed payloads and continues flushing queued events', async () => {
    const { safeEventDispatcher } = createDispatcher();
    new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 42,
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Recovered error',
    });

    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({ message: 'Missing or invalid `message` in payload' })
    );
    expect(errorSpy).toHaveBeenCalledWith('Recovered error');
  });

  it('recovers if the queue is mutated before the flush timer fires', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Queued warning',
    });

    router.queue = null;
    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs dispatch errors encountered while forwarding queued events', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Queue me',
    });

    const failure = new Error('forward failure');
    const originalForward = router.forwardToUI.bind(router);
    router.forwardToUI = () => {
      throw failure;
    };

    router.notifyUIReady();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      failure
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
    router.forwardToUI = originalForward;
  });

  it('keeps running when queue push fails during handleEvent', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    router.queue = null;
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Ignored warning',
    });

    expect(errorSpy).toHaveBeenCalledWith('AlertRouter error:', expect.any(Error));
  });

  it('logs dispatch errors when forwarding live events after the UI is ready', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    router.notifyUIReady();

    const failure = new Error('UI offline');
    const originalDispatch = safeEventDispatcher.dispatch.bind(safeEventDispatcher);
    const dispatchSpy = jest
      .spyOn(safeEventDispatcher, 'dispatch')
      .mockImplementation((eventName, payload) => {
        if (
          eventName === SYSTEM_WARNING_OCCURRED_ID ||
          eventName === SYSTEM_ERROR_OCCURRED_ID
        ) {
          return originalDispatch(eventName, payload);
        }

        if (
          eventName === DISPLAY_WARNING_ID ||
          eventName === DISPLAY_ERROR_ID
        ) {
          throw failure;
        }

        return originalDispatch(eventName, payload);
      });

    await originalDispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Forward me',
    });

    expect(errorSpy).toHaveBeenCalledWith('AlertRouter dispatch error:', failure);
    dispatchSpy.mockRestore();
  });

  it('marks the router ready even when notifyUIReady is called without a timer', () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    router.notifyUIReady();

    expect(router.flushTimer).toBeNull();
    expect(router.uiReady).toBe(true);
  });
});
