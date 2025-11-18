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
