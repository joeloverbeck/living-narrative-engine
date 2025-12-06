import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  DISPLAY_ERROR_ID,
  DISPLAY_WARNING_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

const registerEventDefinition = (registry, eventId) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
  });
};

const createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
});

const createAlertRouterEnvironment = () => {
  const logger = createLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = {
    isSchemaLoaded: () => true,
    validate: () => ({ isValid: true }),
  };
  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  [
    SYSTEM_WARNING_OCCURRED_ID,
    SYSTEM_ERROR_OCCURRED_ID,
    DISPLAY_WARNING_ID,
    DISPLAY_ERROR_ID,
  ].forEach((eventId) => registerEventDefinition(registry, eventId));

  const alertRouter = new AlertRouter({ safeEventDispatcher });

  return {
    alertRouter,
    safeEventDispatcher,
  };
};

const waitForDisplayEvent = (dispatcher, eventId) =>
  new Promise((resolve) => {
    let unsubscribe = null;
    unsubscribe = dispatcher.subscribe(eventId, (event) => {
      unsubscribe?.();
      resolve(event);
    });
  });

describe('AlertRouter with real event infrastructure', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('queues events until the UI is ready and then forwards them through the SafeEventDispatcher', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Queued warning',
    });

    expect(alertRouter.queue).toHaveLength(1);
    expect(alertRouter.uiReady).toBe(false);
    expect(alertRouter.flushTimer).not.toBeNull();

    const warningEventPromise = waitForDisplayEvent(
      safeEventDispatcher,
      DISPLAY_WARNING_ID
    );

    alertRouter.notifyUIReady();

    const warningEvent = await warningEventPromise;

    expect(warningEvent.payload).toEqual({ message: 'Queued warning' });
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
    expect(alertRouter.uiReady).toBe(true);

    // Calling notifyUIReady again should be a no-op and exercises the branch
    // where no flush timer is active.
    alertRouter.notifyUIReady();
    expect(alertRouter.flushTimer).toBeNull();

    const errorEventPromise = waitForDisplayEvent(
      safeEventDispatcher,
      DISPLAY_ERROR_ID
    );

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Immediate error',
    });

    const errorEvent = await errorEventPromise;

    expect(errorEvent.payload).toEqual({ message: 'Immediate error' });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('flushes queued events to the console when the UI never becomes ready', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'System warning',
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'System error',
    });
    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      other: 'missing message',
    });

    expect(alertRouter.queue).toHaveLength(3);

    jest.advanceTimersByTime(5000);

    expect(warnSpy).toHaveBeenCalledWith('System warning');
    expect(errorSpy).toHaveBeenCalledWith('System error');
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({
        message: 'Missing or invalid `message` in payload',
      })
    );
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });

  it('logs subscription failures encountered during initialization', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { safeEventDispatcher } = createAlertRouterEnvironment();
    const failingDispatcher = Object.create(safeEventDispatcher);
    failingDispatcher.subscribe = () => {
      throw new Error('subscription failure');
    };

    expect(
      () => new AlertRouter({ safeEventDispatcher: failingDispatcher })
    ).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      expect.objectContaining({ message: 'subscription failure' })
    );
  });

  it('captures errors that occur while queuing events before the UI is ready', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    alertRouter.queue.push = () => {
      throw new Error('queue push failure');
    };

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'will fail to queue',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.objectContaining({ message: 'queue push failure' })
    );
  });

  it('handles unexpected failures when flushing the queued events', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'First warning',
    });

    // Corrupt the queue to trigger the outer catch block during the flush.
    alertRouter.queue = null;

    jest.advanceTimersByTime(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.any(Error)
    );
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });

  it('continues processing when forwarding queued events throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Queued warning',
    });

    alertRouter.forwardToUI = () => {
      throw new Error('forward failure');
    };

    alertRouter.notifyUIReady();

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.objectContaining({ message: 'forward failure' })
    );
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.uiReady).toBe(true);
  });

  it('logs dispatch errors when forwarding to the UI fails immediately', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    alertRouter.uiReady = true;
    safeEventDispatcher.dispatch = () => {
      throw new Error('dispatch failure');
    };

    alertRouter.forwardToUI(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Immediate dispatch failure',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.objectContaining({ message: 'dispatch failure' })
    );
  });
});
