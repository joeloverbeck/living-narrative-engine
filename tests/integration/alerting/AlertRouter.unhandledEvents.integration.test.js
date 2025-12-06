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

describe('AlertRouter handling of unexpected event payloads', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('forwards queued events with unknown names as display errors once the UI is ready', async () => {
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();
    const displayErrorEvent = new Promise((resolve) => {
      let unsubscribe = null;
      unsubscribe = safeEventDispatcher.subscribe(DISPLAY_ERROR_ID, (event) => {
        unsubscribe?.();
        resolve(event);
      });
    });

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Router should treat this as an error once ready',
      diagnosticId: 'warn-1',
    });

    expect(alertRouter.queue).toHaveLength(1);
    alertRouter.queue[0].name = 'custom:system_notice';

    alertRouter.notifyUIReady();

    const forwarded = await displayErrorEvent;
    expect(forwarded.payload).toEqual({
      message: 'Router should treat this as an error once ready',
      diagnosticId: 'warn-1',
    });
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.uiReady).toBe(true);
    expect(alertRouter.flushTimer).toBeNull();
  });

  it('silently discards queued events that have unexpected names when the flush timer fires', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { alertRouter, safeEventDispatcher } = createAlertRouterEnvironment();

    await safeEventDispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message: 'Queued but renamed',
    });

    expect(alertRouter.queue).toHaveLength(1);
    alertRouter.queue[0].name = 'custom:system_notice';

    jest.advanceTimersByTime(5000);

    expect(warnSpy).not.toHaveBeenCalled();
    // Ensure the normal flush branch was not triggered with the original message
    expect(
      errorSpy.mock.calls.some((args) => args.includes('Queued but renamed'))
    ).toBe(false);
    expect(alertRouter.queue).toEqual([]);
    expect(alertRouter.flushTimer).toBeNull();
  });
});
