import { describe, it, afterEach, expect, jest } from '@jest/globals';
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

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class InMemoryGameDataRepository {
  constructor(definitions) {
    this.definitions = new Map(definitions);
  }

  getEventDefinition(eventName) {
    return this.definitions.get(eventName) || null;
  }
}

class PermissiveSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

/**
 *
 * @param root0
 * @param root0.dispatcherFactory
 * @param root0.RouterClass
 */
function createEnvironment({
  dispatcherFactory = (deps) => new SafeEventDispatcher(deps),
  RouterClass = AlertRouter,
} = {}) {
  const logger = new RecordingLogger();
  const eventBus = new EventBus({ logger });
  const schemaValidator = new PermissiveSchemaValidator();

  const definitions = [
    [SYSTEM_WARNING_OCCURRED_ID, { id: SYSTEM_WARNING_OCCURRED_ID, payloadSchema: null }],
    [SYSTEM_ERROR_OCCURRED_ID, { id: SYSTEM_ERROR_OCCURRED_ID, payloadSchema: null }],
    [DISPLAY_WARNING_ID, { id: DISPLAY_WARNING_ID, payloadSchema: null }],
    [DISPLAY_ERROR_ID, { id: DISPLAY_ERROR_ID, payloadSchema: null }],
  ];
  const gameDataRepository = new InMemoryGameDataRepository(definitions);

  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });

  const safeEventDispatcher = dispatcherFactory({
    validatedEventDispatcher,
    logger,
  });

  const router = new RouterClass({ safeEventDispatcher });

  return {
    router,
    safeEventDispatcher,
    eventBus,
    logger,
    validatedEventDispatcher,
  };
}

class ThrowingSafeEventDispatcher extends SafeEventDispatcher {
  constructor(deps, eventsToThrowFor) {
    super(deps);
    this.eventsToThrowFor = new Set(eventsToThrowFor);
  }

  dispatch(eventName, payload, options = {}) {
    const resultPromise = super.dispatch(eventName, payload, options);
    if (this.eventsToThrowFor.has(eventName)) {
      throw new Error(`forced failure for ${eventName}`);
    }
    return resultPromise;
  }
}

class ForwardFailingAlertRouter extends AlertRouter {
  forwardToUI(name, payload) {
    throw new Error(`UI forwarding failure for ${name}`);
  }
}

describe('AlertRouter real event flow coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('flushes queued events using real dispatch infrastructure and logs malformed payloads', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { router, safeEventDispatcher } = createEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'warning: disk nearly full',
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'error: shard offline',
    });
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      // Missing message field to exercise the malformed branch inside startFlushTimer
      other: 'missing message',
    });

    expect(router.queue).toHaveLength(3);

    await jest.runOnlyPendingTimersAsync();

    expect(warnSpy).toHaveBeenCalledWith('warning: disk nearly full');
    expect(errorSpy).toHaveBeenCalledWith('error: shard offline');
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({ message: 'Missing or invalid `message` in payload' })
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('delivers queued events to UI subscribers even when dispatcher throws during forwarding', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const eventsToThrowFor = [DISPLAY_WARNING_ID, DISPLAY_ERROR_ID];
    const { router, safeEventDispatcher } = createEnvironment({
      dispatcherFactory: (deps) =>
        new ThrowingSafeEventDispatcher(deps, eventsToThrowFor),
    });

    const deliveredPayloads = [];
    const unsubscribeWarning = safeEventDispatcher.subscribe(
      DISPLAY_WARNING_ID,
      (event) => {
        deliveredPayloads.push(event.payload);
      }
    );

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning needs UI',
    });

    expect(router.queue).toHaveLength(1);

    router.notifyUIReady();

    expect(deliveredPayloads).toEqual([{ message: 'queued warning needs UI' }]);
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.objectContaining({ message: `forced failure for ${DISPLAY_WARNING_ID}` })
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);

    if (typeof unsubscribeWarning === 'function') {
      unsubscribeWarning();
    }
  });

  it('guards queued forwarding when forwardToUI fails before dispatch', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { router, safeEventDispatcher } = createEnvironment({
      RouterClass: ForwardFailingAlertRouter,
    });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'will trigger forward failure',
    });

    expect(router.queue).toHaveLength(1);

    router.notifyUIReady();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.objectContaining({ message: 'UI forwarding failure for core:system_warning_occurred' })
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
  });
});
