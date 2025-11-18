import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import {
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

/**
 *
 */
function createDispatcher() {
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
}

describe('AlertRouter resilience integration', () => {
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
    const subscriptionError = new Error('subscribe boom');
    const safeEventDispatcher = {
      subscribe: jest.fn(() => {
        throw subscriptionError;
      }),
      dispatch: jest.fn(),
    };

    expect(() => new AlertRouter({ safeEventDispatcher })).not.toThrow();
    expect(safeEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      subscriptionError
    );
  });

  it('traps errors thrown while queuing events', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });
    const queueFailure = new Error('queue failure');
    router.queue = {
      push: () => {
        throw queueFailure;
      },
    };

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'should never enqueue',
    });

    expect(errorSpy).toHaveBeenCalledWith('AlertRouter error:', queueFailure);
  });

  it('flushes queued events and logs malformed payload issues individually', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      notMessage: true,
    });
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'warning survives',
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'error survives',
    });
    router.handleEvent('custom:event', { message: 'ignored entirely' });

    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({ message: 'Missing or invalid `message` in payload' })
    );
    expect(warnSpy).toHaveBeenCalledWith('warning survives');
    expect(errorSpy).toHaveBeenCalledWith('error survives');
  });

  it('keeps processing when queue iteration throws during flush', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'hidden',
    });

    router.queue.forEach = () => {
      throw new Error('iteration fail');
    };

    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({ message: 'iteration fail' })
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('logs and clears queue when forwarding queued events fails on notifyUIReady', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning',
    });

    const forwardError = new Error('forward boom');
    const originalForwardToUI = router.forwardToUI.bind(router);
    router.forwardToUI = (...args) => {
      router.forwardToUI = originalForwardToUI;
      throw forwardError;
    };

    expect(() => router.notifyUIReady()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      forwardError
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });

  it('captures dispatcher failures when forwarding directly to the UI', () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });
    const immediateFailure = new Error('direct dispatch failure');
    safeEventDispatcher.dispatch = jest.fn(() => {
      throw immediateFailure;
    });

    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'ignored' });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      immediateFailure
    );
  });
});
