import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { Throttler } from '../../../src/alerting/throttler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import {
  DISPLAY_ERROR_ID,
  DISPLAY_WARNING_ID,
} from '../../../src/constants/eventIds.js';

const registerEventDefinition = (registry, eventId) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
  });
};

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createThrottlerEnvironment = () => {
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

  [DISPLAY_WARNING_ID, DISPLAY_ERROR_ID].forEach((eventId) =>
    registerEventDefinition(registry, eventId)
  );

  return { safeEventDispatcher };
};

describe('Throttler integration with real dispatchers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('suppresses duplicate warnings and emits a summary event after the throttle window', async () => {
    const { safeEventDispatcher } = createThrottlerEnvironment();
    const throttler = new Throttler(safeEventDispatcher, 'warning');

    const receivedEvents = [];
    const unsubscribe = safeEventDispatcher.subscribe(
      DISPLAY_WARNING_ID,
      (event) => {
        receivedEvents.push(event);
      }
    );

    const payload = {
      message: 'Latency spike detected',
      details: { code: 503 },
    };

    expect(throttler.allow('warning-key', payload)).toBe(true);

    jest.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));
    expect(throttler.allow('warning-key', payload)).toBe(false);

    jest.setSystemTime(new Date('2024-01-01T00:00:02.000Z'));
    expect(throttler.allow('warning-key', payload)).toBe(false);

    expect(receivedEvents).toHaveLength(0);

    jest.advanceTimersByTime(10000);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload).toEqual({
      message:
        "Warning: 'Latency spike detected' occurred 2 more times in the last 10 seconds.",
      details: payload.details,
    });

    jest.setSystemTime(new Date('2024-01-01T00:00:13.000Z'));
    expect(throttler.allow('warning-key', payload)).toBe(true);

    unsubscribe?.();
  });

  it('clears expired entries and avoids emitting summaries when no duplicates occur', async () => {
    const { safeEventDispatcher } = createThrottlerEnvironment();
    const throttler = new Throttler(safeEventDispatcher, 'error');

    const receivedErrorEvents = [];
    const unsubscribeError = safeEventDispatcher.subscribe(
      DISPLAY_ERROR_ID,
      (event) => {
        receivedErrorEvents.push(event);
      }
    );

    const firstPayload = {
      message: 'Initial failure',
      details: { code: 500 },
    };
    expect(throttler.allow('error-key', firstPayload)).toBe(true);

    jest.setSystemTime(new Date('2024-01-01T00:00:11.000Z'));
    const secondPayload = {
      message: 'Second failure',
      details: { code: 502 },
    };
    expect(throttler.allow('error-key', secondPayload)).toBe(true);

    jest.setSystemTime(new Date('2024-01-01T00:00:11.500Z'));
    expect(throttler.allow('error-key', secondPayload)).toBe(false);

    jest.advanceTimersByTime(10000);

    expect(receivedErrorEvents).toHaveLength(1);
    expect(receivedErrorEvents[0].payload).toEqual({
      message: "Error: 'Second failure' occurred 1 more times in the last 10 seconds.",
      details: secondPayload.details,
    });

    receivedErrorEvents.length = 0;

    jest.setSystemTime(new Date('2024-01-01T00:00:23.000Z'));
    expect(
      throttler.allow('solo-error', {
        message: 'Isolated failure',
        details: { code: 504 },
      })
    ).toBe(true);

    jest.advanceTimersByTime(10000);

    expect(receivedErrorEvents).toHaveLength(0);

    unsubscribeError?.();
  });
});
