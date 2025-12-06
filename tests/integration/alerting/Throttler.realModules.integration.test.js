import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { Throttler } from '../../../src/alerting/throttler.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.entries.debug.push(args);
  }

  info(...args) {
    this.entries.info.push(args);
  }

  warn(...args) {
    this.entries.warn.push(args);
  }

  error(...args) {
    this.entries.error.push(args);
  }
}

class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  register(schemaId, validationResult) {
    this.schemas.set(schemaId, validationResult);
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  validate(schemaId) {
    const entry = this.schemas.get(schemaId);
    if (!entry) {
      return { isValid: true, errors: [] };
    }
    if (typeof entry === 'function') {
      return entry();
    }
    return {
      isValid: entry.isValid !== false,
      errors: entry.errors || [],
    };
  }
}

const registerEventDefinition = (registry, eventId) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
  });
};

const createAlertingEnvironment = () => {
  const logger = new RecordingLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
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

  return {
    logger,
    registry,
    schemaValidator,
    eventBus,
    validatedEventDispatcher,
    safeEventDispatcher,
  };
};

const flushAsyncWork = async () => {
  // Allow pending microtasks created by dispatcher promises to settle
  await Promise.resolve();
  await Promise.resolve();
};

describe('Throttler integration with real dispatch infrastructure', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('suppresses duplicate warning events and emits a summary through SafeEventDispatcher', async () => {
    const env = createAlertingEnvironment();
    registerEventDefinition(env.registry, 'core:display_warning');

    const receivedWarnings = [];
    env.safeEventDispatcher.subscribe('core:display_warning', (event) => {
      receivedWarnings.push(event.payload);
    });

    const throttler = new Throttler(env.safeEventDispatcher, 'warning');

    const firstPayload = {
      message: 'Memory usage high',
      details: { usage: 91 },
    };

    expect(throttler.allow('alert:memory', firstPayload)).toBe(true);
    expect(
      throttler.allow('alert:memory', {
        message: 'Memory usage high',
        details: { usage: 92 },
      })
    ).toBe(false);

    jest.advanceTimersByTime(10000);
    await flushAsyncWork();

    expect(receivedWarnings).toEqual([
      {
        message:
          "Warning: 'Memory usage high' occurred 1 more times in the last 10 seconds.",
        details: { usage: 91 },
      },
    ]);
  });

  it('resets tracking when the throttle window elapses before summary dispatch and uses the new base payload', async () => {
    const env = createAlertingEnvironment();
    registerEventDefinition(env.registry, 'core:display_error');

    const receivedErrors = [];
    env.safeEventDispatcher.subscribe('core:display_error', (event) => {
      receivedErrors.push(event.payload);
    });

    const throttler = new Throttler(env.safeEventDispatcher, 'error');

    expect(
      throttler.allow('alert:db', {
        message: 'Database connection lost',
        details: { server: 'db-01' },
      })
    ).toBe(true);

    // Advance system time beyond the throttle window without executing timers
    jest.setSystemTime(Date.now() + 11000);

    const resumedPayload = {
      message: 'Database connection lost',
      details: { server: 'db-01' },
    };

    expect(throttler.allow('alert:db', resumedPayload)).toBe(true);
    expect(throttler.allow('alert:db', resumedPayload)).toBe(false);

    jest.advanceTimersByTime(10000);
    await flushAsyncWork();

    expect(receivedErrors).toEqual([
      {
        message:
          "Error: 'Database connection lost' occurred 1 more times in the last 10 seconds.",
        details: { server: 'db-01' },
      },
    ]);
  });

  it('falls back to a generic summary when the original payload omits the message field', async () => {
    const env = createAlertingEnvironment();
    registerEventDefinition(env.registry, 'core:display_warning');

    const summaries = [];
    env.safeEventDispatcher.subscribe('core:display_warning', (event) => {
      summaries.push(event.payload);
    });

    const throttler = new Throttler(env.safeEventDispatcher, 'warning');

    const basePayload = { details: { code: 42 } };
    expect(throttler.allow('alert:fallback', basePayload)).toBe(true);
    expect(throttler.allow('alert:fallback', basePayload)).toBe(false);

    jest.advanceTimersByTime(10000);
    await flushAsyncWork();

    expect(summaries).toEqual([
      {
        message:
          "Warning: 'An event' occurred 1 more times in the last 10 seconds.",
        details: { code: 42 },
      },
    ]);
  });

  it('does not emit a summary when no duplicate events were suppressed', async () => {
    const env = createAlertingEnvironment();
    registerEventDefinition(env.registry, 'core:display_warning');

    const summaries = [];
    env.safeEventDispatcher.subscribe('core:display_warning', (event) => {
      summaries.push(event.payload);
    });

    const throttler = new Throttler(env.safeEventDispatcher, 'warning');
    expect(
      throttler.allow('alert:single', {
        message: 'Single occurrence',
        details: { code: 7 },
      })
    ).toBe(true);

    jest.advanceTimersByTime(10000);
    await flushAsyncWork();

    expect(summaries).toEqual([]);
  });

  it('throws when constructed with an invalid dispatcher implementation', () => {
    expect(() => new Throttler({}, 'warning')).toThrow(
      'Throttler: A valid ISafeEventDispatcher instance is required.'
    );
  });
});
