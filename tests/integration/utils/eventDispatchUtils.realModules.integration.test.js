import { describe, it, expect } from '@jest/globals';
import { dispatchWithLogging } from '../../../src/utils/eventDispatchUtils.js';
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

  validate(schemaId) {
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
    schemaValidator,
    eventBus,
    safeEventDispatcher,
  };
};

describe('dispatchWithLogging integration with SafeEventDispatcher', () => {
  it('logs success and dispatches events through the validated pipeline', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'integration:dispatch-success');

    const receivedEvents = [];
    env.safeEventDispatcher.subscribe(
      'integration:dispatch-success',
      (event) => {
        receivedEvents.push(event);
      }
    );

    await dispatchWithLogging(
      env.safeEventDispatcher,
      'integration:dispatch-success',
      { marker: 1 },
      env.logger
    );

    expect(receivedEvents).toEqual([
      { type: 'integration:dispatch-success', payload: { marker: 1 } },
    ]);
    expect(
      env.logger.calls.debug.some(([message]) =>
        message.includes("Dispatched 'integration:dispatch-success'")
      )
    ).toBe(true);
    expect(
      env.logger.calls.error.some(([message]) =>
        message.includes("Failed dispatching 'integration:dispatch-success'")
      )
    ).toBe(false);
  });

  it('captures dispatcher rejections and logs errors with context', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'integration:dispatch-reject');

    const originalDispatch = env.safeEventDispatcher.dispatch.bind(
      env.safeEventDispatcher
    );
    env.safeEventDispatcher.dispatch = (...args) => {
      if (args[0] === 'integration:dispatch-reject') {
        return Promise.reject(new Error('forced failure for coverage'));
      }
      return originalDispatch(...args);
    };

    await dispatchWithLogging(
      env.safeEventDispatcher,
      'integration:dispatch-reject',
      { marker: 2 },
      env.logger,
      'failure-context'
    );

    expect(
      env.logger.calls.error.some(
        ([message, error]) =>
          message.includes(
            "Failed dispatching 'integration:dispatch-reject' event for failure-context"
          ) &&
          error instanceof Error &&
          error.message === 'forced failure for coverage'
      )
    ).toBe(true);
  });
});
