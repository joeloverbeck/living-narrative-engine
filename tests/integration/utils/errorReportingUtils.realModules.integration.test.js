import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { reportMissingActorId } from '../../../src/utils/errorReportingUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

class RecordingLogger {
  constructor() {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
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

class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  register(schemaId, result) {
    this.schemas.set(schemaId, result);
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  validate(schemaId, payload) {
    const result = this.schemas.get(schemaId);
    if (!result) {
      return { isValid: true, errors: [] };
    }

    if (typeof result === 'function') {
      return result(payload);
    }

    return {
      isValid: result.isValid !== false,
      errors: result.errors || [],
    };
  }
}

const registerEventDefinition = (registry, eventId, overrides = {}) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
    ...overrides,
  });
};

const createDispatcherEnvironment = () => {
  const logger = new RecordingLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
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

  return {
    logger,
    registry,
    gameDataRepository,
    schemaValidator,
    eventBus,
    safeEventDispatcher,
  };
};

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('reportMissingActorId integration with real dispatchers', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('dispatches a system error and logs when falling back to a handler actor id', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, SYSTEM_ERROR_OCCURRED_ID);

    const receivedEvents = [];
    env.safeEventDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      (event) => {
        receivedEvents.push(event);
      }
    );

    reportMissingActorId(
      env.safeEventDispatcher,
      env.logger,
      undefined,
      'handler-actor'
    );

    await flushAsync();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toEqual({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: 'Actor ID must be provided but was missing.',
        details: {
          providedActorId: null,
          fallbackActorId: 'handler-actor',
        },
      },
    });
    expect(
      env.logger.calls.warn.some(([message]) =>
        message.includes("Actor ID was missing; fell back to 'handler-actor'.")
      )
    ).toBe(true);
  });

  it('logs warning when no dispatcher is provided and does not attempt dispatch', () => {
    const logger = new RecordingLogger();
    reportMissingActorId(null, logger, 'original', 'fallback');

    expect(logger.calls.warn).toEqual([
      ["Actor ID was missing; fell back to 'fallback'."],
    ]);
  });

  it('records dispatch failures while preserving the warning log', () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, SYSTEM_ERROR_OCCURRED_ID);

    const dispatchError = new Error('dispatch failed');
    const originalDispatch = env.safeEventDispatcher.dispatch.bind(
      env.safeEventDispatcher
    );
    env.safeEventDispatcher.dispatch = (eventName, payload) => {
      if (eventName === SYSTEM_ERROR_OCCURRED_ID) {
        throw dispatchError;
      }
      return originalDispatch(eventName, payload);
    };

    expect(() =>
      reportMissingActorId(
        env.safeEventDispatcher,
        env.logger,
        undefined,
        'fallback-actor'
      )
    ).not.toThrow();

    expect(
      env.logger.calls.error.some(([message, details]) =>
        message.includes('Failed to dispatch system error event') &&
        details?.dispatchError === dispatchError
      )
    ).toBe(true);

    expect(
      env.logger.calls.warn.some(([message]) =>
        message.includes("Actor ID was missing; fell back to 'fallback-actor'.")
      )
    ).toBe(true);
  });
});
