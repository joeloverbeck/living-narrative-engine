import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
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
    description: 'alert-router-integration-event',
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
    validatedEventDispatcher,
  };
};

describe('AlertRouter error resilience integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs queuing failures while the UI is not yet ready', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    alertRouter.queue.push = () => {
      throw new Error('queue push failure');
    };

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'will not enqueue',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.objectContaining({ message: 'queue push failure' })
    );
  });

  it('captures flush-level failures if queued event iteration throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning',
    });

    expect(alertRouter.queue).toHaveLength(1);

    alertRouter.queue.forEach = () => {
      throw new Error('iteration failure');
    };

    jest.advanceTimersByTime(5000);

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      expect.objectContaining({ message: 'iteration failure' })
    );
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });

  it('logs forwarding failures when notifyUIReady hits a bad stage', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'queued warning',
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

  it('captures dispatch failures when the UI is already ready', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, validatedEventDispatcher } =
      createAlertRouterEnvironment();

    alertRouter.uiReady = true;
    alertRouter.dispatcher.dispatch = () => {
      throw new Error('dispatch failure');
    };

    await validatedEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'immediate error',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.objectContaining({ message: 'dispatch failure' })
    );
  });
});
