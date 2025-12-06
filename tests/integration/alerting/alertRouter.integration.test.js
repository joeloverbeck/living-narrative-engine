import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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

/**
 * Creates a mock safe event dispatcher that captures subscription handlers
 * and exposes a dispatch spy for assertions.
 *
 * @returns {{ dispatcher: any, getHandler: (eventName: string) => Function }}
 */
function createMockDispatcher() {
  const handlers = new Map();
  return {
    dispatcher: {
      subscribe: jest.fn((eventName, handler) => {
        handlers.set(eventName, handler);
        return () => handlers.delete(eventName);
      }),
      dispatch: jest.fn(),
    },
    getHandler(eventName) {
      return handlers.get(eventName);
    },
  };
}

describe('AlertRouter integration', () => {
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

  it('flushes queued events to the console when the UI never becomes ready', async () => {
    const { safeEventDispatcher } = createDispatcher();
    // Instantiate router (subscribes immediately)
    new AlertRouter({ safeEventDispatcher });

    const payload = { message: 'Integration warning' };
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, payload);

    expect(warnSpy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5000);

    expect(warnSpy).toHaveBeenCalledWith('Integration warning');
  });

  it('replays queued events to the UI once notifyUIReady is called', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    const forwardedWarnings = [];
    safeEventDispatcher.subscribe(DISPLAY_WARNING_ID, async (event) => {
      forwardedWarnings.push(event.payload);
    });

    const payload = { message: 'Buffered warning' };
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, payload);

    expect(forwardedWarnings).toHaveLength(0);

    router.notifyUIReady();

    expect(forwardedWarnings).toEqual([payload]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('forwards events directly once the UI is marked ready', async () => {
    const { safeEventDispatcher } = createDispatcher();
    const router = new AlertRouter({ safeEventDispatcher });

    const forwardedErrors = [];
    safeEventDispatcher.subscribe(DISPLAY_ERROR_ID, async (event) => {
      forwardedErrors.push(event.payload);
    });

    router.notifyUIReady();

    const payload = { message: 'Immediate error' };
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, payload);

    expect(forwardedErrors).toEqual([payload]);
    expect(errorSpy).not.toHaveBeenCalledWith('Immediate error');
  });
});

describe('AlertRouter error handling (mock-based)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('queues events until the UI is ready, then forwards them and cancels the flush timer', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { dispatcher, getHandler } = createMockDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    jest.spyOn(router, 'forwardToUI').mockImplementationOnce(() => {
      throw new Error('queued forward failure');
    });

    expect(dispatcher.subscribe).toHaveBeenCalledWith(
      SYSTEM_WARNING_OCCURRED_ID,
      expect.any(Function)
    );
    expect(dispatcher.subscribe).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.any(Function)
    );

    const warningHandler = getHandler(SYSTEM_WARNING_OCCURRED_ID);
    const errorHandler = getHandler(SYSTEM_ERROR_OCCURRED_ID);

    warningHandler({ payload: { message: 'Queued warning' } });

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    router.notifyUIReady();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.objectContaining({ message: 'queued forward failure' })
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    warningHandler({ payload: { message: 'Immediate warning' } });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_WARNING_ID, {
      message: 'Immediate warning',
    });

    errorHandler({ payload: { message: 'Immediate error' } });

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch).toHaveBeenLastCalledWith(DISPLAY_ERROR_ID, {
      message: 'Immediate error',
    });

    router.notifyUIReady();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes queued events to the console after five seconds and handles malformed payloads', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { dispatcher, getHandler } = createMockDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    const warningHandler = getHandler(SYSTEM_WARNING_OCCURRED_ID);
    const errorHandler = getHandler(SYSTEM_ERROR_OCCURRED_ID);

    warningHandler({ payload: { message: 'System warning' } });
    errorHandler({ payload: { message: 'System error' } });
    warningHandler({ payload: { other: 'missing message' } });
    router.queue.push({
      name: 'core:unhandled_event',
      payload: { message: 'Unhandled branch' },
      timestamp: new Date().toISOString(),
    });

    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(5000);

    expect(warnSpy).toHaveBeenCalledWith('System warning');
    expect(errorSpy).toHaveBeenCalledWith('System error');
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({
        message: 'Missing or invalid `message` in payload',
      })
    );
    expect(router.queue).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);

    warningHandler({ payload: { message: 'Another warning' } });
    router.queue = null;

    jest.advanceTimersByTime(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
  });

  it('logs an error if queuing fails while the UI is not ready', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { dispatcher, getHandler } = createMockDispatcher();
    const router = new AlertRouter({ safeEventDispatcher: dispatcher });

    const warningHandler = getHandler(SYSTEM_WARNING_OCCURRED_ID);
    router.queue.push = jest.fn(() => {
      throw new Error('queue push failure');
    });

    warningHandler({ payload: { message: 'Will fail to queue' } });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.objectContaining({ message: 'queue push failure' })
    );
  });

  it('logs a dispatch error when forwarding to the UI fails', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { dispatcher } = createMockDispatcher();
    dispatcher.dispatch.mockImplementation(() => {
      throw new Error('dispatch failure');
    });

    const router = new AlertRouter({ safeEventDispatcher: dispatcher });
    router.uiReady = true;

    router.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Broken dispatch',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.objectContaining({ message: 'dispatch failure' })
    );
  });

  it('logs subscription errors during construction without throwing', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dispatcher = {
      subscribe: jest.fn(() => {
        throw new Error('subscription failure');
      }),
      dispatch: jest.fn(),
    };

    expect(
      () => new AlertRouter({ safeEventDispatcher: dispatcher })
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      expect.objectContaining({ message: 'subscription failure' })
    );
  });
});
