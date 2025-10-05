import { describe, it, beforeEach, expect, jest } from '@jest/globals';
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
    validatedEventDispatcher,
    safeEventDispatcher,
  };
};

describe('SafeEventDispatcher integration with validated event infrastructure', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches events through the validated dispatcher and manages subscriptions', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'integration:event-ready');

    const receivedPayloads = [];
    const unsubscribe = env.safeEventDispatcher.subscribe(
      'integration:event-ready',
      (event) => {
        receivedPayloads.push({ type: event.type, payload: event.payload });
      }
    );

    expect(typeof unsubscribe).toBe('function');

    const dispatchResult = await env.safeEventDispatcher.dispatch(
      'integration:event-ready',
      { marker: 1 }
    );

    expect(dispatchResult).toBe(true);
    expect(receivedPayloads).toEqual([
      { type: 'integration:event-ready', payload: { marker: 1 } },
    ]);
    expect(
      env.logger.calls.debug.some(([message]) =>
        message.includes(
          "Successfully dispatched event 'integration:event-ready'"
        )
      )
    ).toBe(true);

    expect(unsubscribe()).toBe(true);

    await env.safeEventDispatcher.dispatch('integration:event-ready', {
      marker: 2,
    });
    expect(receivedPayloads).toHaveLength(1);

    const handler = () => {};
    env.safeEventDispatcher.subscribe('integration:event-ready', handler);
    env.safeEventDispatcher.unsubscribe('integration:event-ready', handler);

    expect(
      env.logger.calls.debug.some(([message]) =>
        message.includes('Successfully unsubscribed from event')
      )
    ).toBe(true);

    env.safeEventDispatcher.unsubscribe('integration:event-ready', () => {});
    expect(
      env.logger.calls.debug.filter(([message]) =>
        message.includes('Successfully unsubscribed from event')
      ).length
    ).toBe(1);
  });

  it('logs warnings when the validated dispatcher reports a failed dispatch', async () => {
    const env = createDispatcherEnvironment();
    const schemaId = 'integration:validation-failure#payload';
    env.schemaValidator.register(schemaId, {
      isValid: false,
      errors: [{ instancePath: '/value', message: 'expected string' }],
    });
    registerEventDefinition(env.registry, 'integration:validation-failure', {
      payloadSchema: schemaId,
    });

    const result = await env.safeEventDispatcher.dispatch(
      'integration:validation-failure',
      { value: 42 }
    );

    expect(result).toBe(false);
    expect(
      env.logger.calls.warn.some(([message]) =>
        message.includes(
          "Underlying VED failed to dispatch event 'integration:validation-failure'"
        )
      )
    ).toBe(true);
  });

  it('captures asynchronous failures from the validated dispatcher without throwing', async () => {
    class RejectingDispatcher {
      constructor() {
        this.subscribe = () => () => true;
        this.unsubscribe = () => true;
        this.setBatchMode = () => {};
      }

      async dispatch() {
        throw new Error('async failure');
      }
    }

    const logger = new RecordingLogger();
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new RejectingDispatcher(),
      logger,
    });

    const outcome = await safeEventDispatcher.dispatch(
      'integration:async-break',
      {}
    );

    expect(outcome).toBe(false);
    expect(logger.calls.error).toHaveLength(1);
    expect(logger.calls.error[0][0]).toContain('async-break');
  });

  it('falls back to console.error when handling system error events that reject', async () => {
    class RejectingDispatcher {
      constructor() {
        this.subscribe = () => () => true;
        this.unsubscribe = () => true;
        this.setBatchMode = () => {};
      }

      async dispatch() {
        throw new Error('boom');
      }
    }

    const logger = new RecordingLogger();
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new RejectingDispatcher(),
      logger,
    });

    const outcome = await safeEventDispatcher.dispatch(
      'core:system_error_occurred',
      {}
    );

    expect(outcome).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'SafeEventDispatcher: Exception caught while dispatching event'
      ),
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it('falls back to console logging when the logger throws during error handling', () => {
    class FaultyLogger extends RecordingLogger {
      error(...args) {
        this.calls.error.push(args);
        throw new Error('logger failure');
      }
    }

    class ThrowingDispatcher {
      dispatch() {
        return true;
      }

      subscribe() {
        throw new Error('subscribe failure');
      }

      unsubscribe() {
        return true;
      }

      setBatchMode() {}
    }

    const logger = new FaultyLogger();
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new ThrowingDispatcher(),
      logger,
    });

    const result = safeEventDispatcher.subscribe(
      'integration:logger-branch',
      () => {}
    );

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'SafeEventDispatcher: Logger failed while handling error in subscribing to event'
      ),
      expect.any(Error),
      'Logger error:',
      expect.any(Error)
    );
  });

  it('reports invalid unsubscribe functions returned by the validated dispatcher', () => {
    class NonCompliantDispatcher {
      dispatch() {
        return true;
      }

      subscribe() {
        return 'not-a-function';
      }

      unsubscribe() {
        return true;
      }

      setBatchMode() {}
    }

    const logger = new RecordingLogger();
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new NonCompliantDispatcher(),
      logger,
    });

    const unsubscribe = safeEventDispatcher.subscribe(
      'integration:bad-unsubscribe',
      () => {}
    );

    expect(unsubscribe).toBeNull();
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('did not return a valid unsubscribe function')
      )
    ).toBe(true);
  });

  it('delegates batch mode controls to the validated dispatcher and event bus', () => {
    const env = createDispatcherEnvironment();

    env.safeEventDispatcher.setBatchMode(true, {
      context: 'integration-test',
      maxRecursionDepth: 5,
      maxGlobalRecursion: 10,
    });

    expect(env.eventBus.isBatchModeEnabled()).toBe(true);
    expect(env.eventBus.getBatchModeOptions()).toMatchObject({
      context: 'integration-test',
      maxRecursionDepth: 5,
      maxGlobalRecursion: 10,
    });

    env.safeEventDispatcher.setBatchMode(false);
    expect(env.eventBus.isBatchModeEnabled()).toBe(false);
  });

  it('validates constructor dependencies for logger and validated dispatcher', () => {
    class MinimalDispatcher {
      dispatch() {
        return true;
      }

      subscribe() {
        return () => true;
      }

      unsubscribe() {
        return true;
      }

      setBatchMode() {}
    }

    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: new MinimalDispatcher(),
          logger: {},
        })
    ).toThrow('SafeEventDispatcher: Invalid or missing logger dependency');

    const logger = new RecordingLogger();

    expect(
      () =>
        new SafeEventDispatcher({
          validatedEventDispatcher: {},
          logger,
        })
    ).toThrow(
      'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
    );

    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
        )
      )
    ).toBe(true);
  });
});
