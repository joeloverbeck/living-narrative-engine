import { describe, it, expect, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

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

  validate(schemaId, _payload) {
    const result = this.schemas.get(schemaId);
    if (!result) {
      return { isValid: true, errors: [] };
    }
    if (typeof result === 'function') {
      return result();
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

const createDispatcherEnvironment = ({
  LoggerClass = RecordingLogger,
  EventBusClass = EventBus,
  ValidatedDispatcherClass = ValidatedEventDispatcher,
} = {}) => {
  const logger = new LoggerClass();
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
  const eventBus = new EventBusClass({ logger });
  const validatedEventDispatcher = new ValidatedDispatcherClass({
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
    schemaValidator,
    eventBus,
    validatedEventDispatcher,
    safeEventDispatcher,
  };
};

describe('SafeEventDispatcher console fallback integration coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to console when async dispatch rejects and the logger throws', async () => {
    class ThrowingLogger extends RecordingLogger {
      error(...args) {
        super.error(...args);
        throw new Error('logger failure for async path');
      }
    }

    class RejectingValidatedDispatcher extends ValidatedEventDispatcher {
      async dispatch(eventName, payload, options = {}) {
        await super.dispatch(eventName, payload, options);
        throw new Error('async dispatch failure');
      }
    }

    const env = createDispatcherEnvironment({
      LoggerClass: ThrowingLogger,
      ValidatedDispatcherClass: RejectingValidatedDispatcher,
    });
    registerEventDefinition(env.registry, 'integration:async-signal');

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await env.safeEventDispatcher.dispatch(
      'integration:async-signal',
      { marker: 42 }
    );

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'SafeEventDispatcher: Logger failed while handling error in dispatching event'
      ),
      expect.any(Error),
      'Logger error:',
      expect.any(Error)
    );
  });

  it('uses console logging immediately for synchronous error-event failures', () => {
    const env = createDispatcherEnvironment();
    const originalUnsubscribe = env.validatedEventDispatcher.unsubscribe;
    env.validatedEventDispatcher.unsubscribe = () => {
      throw new Error('synchronous unsubscribe failure');
    };

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const outcome = env.safeEventDispatcher.unsubscribe(
      'core:system_error_occurred',
      () => {}
    );

    expect(outcome).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'SafeEventDispatcher: Exception caught while unsubscribing (direct call) from event'
      ),
      expect.objectContaining({ error: expect.any(Error) })
    );

    env.validatedEventDispatcher.unsubscribe = originalUnsubscribe;
  });

  it('returns early without logging when unsubscribe returns undefined', () => {
    const env = createDispatcherEnvironment();
    const originalUnsubscribe = env.validatedEventDispatcher.unsubscribe;
    env.validatedEventDispatcher.unsubscribe = () => undefined;

    env.logger.calls.debug = [];

    const outcome = env.safeEventDispatcher.unsubscribe(
      'integration:undefined-result',
      () => {}
    );

    expect(outcome).toBeUndefined();
    expect(
      env.logger.calls.debug.some(([message]) =>
        message.includes('Successfully unsubscribed')
      )
    ).toBe(false);

    env.validatedEventDispatcher.unsubscribe = originalUnsubscribe;
  });
});
