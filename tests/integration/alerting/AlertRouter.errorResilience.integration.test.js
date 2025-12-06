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
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

class RecordingLogger {
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
function createAlertRouterEnvironment() {
  const logger = new RecordingLogger();
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

  const alertRouter = new AlertRouter({ safeEventDispatcher });

  return { alertRouter, safeEventDispatcher, logger };
}

describe('AlertRouter error resilience integration', () => {
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
    jest.restoreAllMocks();
  });

  it('logs queue handling errors when corrupted state prevents enqueueing', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();
    alertRouter.queue = null;

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'should be ignored due to corruption',
    });

    expect(
      errorSpy.mock.calls.some(
        ([message, err]) =>
          message === 'AlertRouter error:' &&
          err instanceof Error &&
          err.message.includes('push')
      )
    ).toBe(true);
  });

  it('captures flush iteration failures and resets its internal queue', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning',
    });

    expect(alertRouter.queue).toHaveLength(1);

    alertRouter.queue.forEach = () => {
      throw new Error('iteration failure');
    };

    await jest.advanceTimersByTimeAsync(5000);

    expect(
      errorSpy.mock.calls.some(
        ([message, err]) =>
          message === 'AlertRouter flush error:' &&
          err instanceof Error &&
          err.message === 'iteration failure'
      )
    ).toBe(true);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });

  it('logs and skips invalid queued entries when notifying UI readiness', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued before corruption',
    });

    alertRouter.queue[0] = null;

    alertRouter.notifyUIReady();

    expect(
      errorSpy.mock.calls.some(
        ([message, err]) =>
          message === 'AlertRouter error forwarding queued event:' &&
          err instanceof Error
      )
    ).toBe(true);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.uiReady).toBe(true);
  });

  it('logs dispatch failures while forwarding events after UI ready', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();
    alertRouter.notifyUIReady();

    const dispatchError = new Error('dispatch failure');
    const originalDispatch = alertRouter.dispatcher.dispatch;
    const boundOriginalDispatch = originalDispatch.bind(alertRouter.dispatcher);
    alertRouter.dispatcher.dispatch = (eventName, payload, options) => {
      if (eventName === DISPLAY_ERROR_ID) {
        throw dispatchError;
      }
      return boundOriginalDispatch(eventName, payload, options);
    };

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'should trigger dispatch error',
    });

    expect(
      errorSpy.mock.calls.some(
        ([message, err]) =>
          message === 'AlertRouter dispatch error:' && err === dispatchError
      )
    ).toBe(true);

    alertRouter.dispatcher.dispatch = originalDispatch;
  });

  it('still flushes queued error events to the console before failure', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'error before iteration failure',
    });

    expect(alertRouter.queue).toHaveLength(1);

    const originalForEach = alertRouter.queue.forEach.bind(alertRouter.queue);
    alertRouter.queue.forEach = (...args) => {
      originalForEach(...args);
      throw new Error('post-flush failure');
    };

    await jest.advanceTimersByTimeAsync(5000);

    expect(
      errorSpy.mock.calls.some(
        ([message, err]) =>
          message === 'AlertRouter flush error:' &&
          err instanceof Error &&
          err.message === 'post-flush failure'
      )
    ).toBe(true);
    expect(
      errorSpy.mock.calls.some(
        ([message]) => message === 'AlertRouter dispatch error:'
      )
    ).toBe(false);
    expect(
      errorSpy.mock.calls.some(
        ([msg]) => msg === 'error before iteration failure'
      )
    ).toBe(true);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });
});
