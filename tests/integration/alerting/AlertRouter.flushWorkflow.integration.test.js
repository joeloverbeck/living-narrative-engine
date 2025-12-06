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
    description: 'alert-router-flush-workflow',
  });
};

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createAlertRouterEnvironment = () => {
  const logger = createLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = {
    isSchemaLoaded: () => true,
    validate: () => ({ isValid: true }),
  };
  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
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
    validatedEventDispatcher,
    eventBus,
  };
};

describe('AlertRouter flush workflow integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('flushes queued warning and error events when UI stays inactive', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'delayed warning',
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'delayed error',
    });

    expect(alertRouter.queue).toHaveLength(2);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(warnSpy.mock.calls.map((call) => call[0])).toContain(
      'delayed warning'
    );
    expect(errorSpy.mock.calls.map((call) => call[0])).toContain(
      'delayed error'
    );
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();

    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'solo error dispatch',
    });

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(errorSpy.mock.calls.map((call) => call[0])).toContain(
      'solo error dispatch'
    );
  });

  it('forwards queued events to UI channels once notifyUIReady is invoked', async () => {
    const { alertRouter, safeEventDispatcher, validatedEventDispatcher } =
      createAlertRouterEnvironment();

    const forwardedWarnings = [];
    const forwardedErrors = [];

    safeEventDispatcher.subscribe(DISPLAY_WARNING_ID, ({ payload }) => {
      forwardedWarnings.push(payload);
    });

    safeEventDispatcher.subscribe(DISPLAY_ERROR_ID, ({ payload }) => {
      forwardedErrors.push(payload);
    });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning',
    });
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'queued error',
    });

    expect(alertRouter.queue).toHaveLength(2);

    alertRouter.notifyUIReady();

    expect(forwardedWarnings).toEqual([{ message: 'queued warning' }]);
    expect(forwardedErrors).toEqual([{ message: 'queued error' }]);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.uiReady).toBe(true);

    await validatedEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'immediate warning',
    });

    expect(forwardedWarnings).toContainEqual({ message: 'immediate warning' });

    alertRouter.notifyUIReady();
  });

  it('logs flush errors when queued payloads are malformed', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      // Missing message property to trigger the error branch
      note: 'missing message field',
    });

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(
      errorSpy.mock.calls.some(
        ([msg, err]) =>
          msg === 'AlertRouter flush error:' &&
          err instanceof Error &&
          err.message.includes('Missing or invalid')
      )
    ).toBe(true);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();

    alertRouter.queue.push({
      name: 'core:display_warning',
      payload: { message: 'ui echo' },
      timestamp: new Date().toISOString(),
    });
    alertRouter.startFlushTimer();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(errorSpy.mock.calls.map((call) => call[0])).not.toContain('ui echo');
  });

  it('captures subscription failures from the dispatcher', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const failingDispatcher = {
      subscribe: () => {
        throw new Error('subscribe failure');
      },
      dispatch: jest.fn(),
      unsubscribe: jest.fn(),
    };

    expect(
      () => new AlertRouter({ safeEventDispatcher: failingDispatcher })
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter subscription error:',
      expect.objectContaining({ message: 'subscribe failure' })
    );
  });
});
