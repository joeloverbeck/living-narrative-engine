import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

jest.setTimeout(30000);

/**
 * @description Simple logger that records all log invocations for assertions.
 * @typedef {{ debug: Function, info: Function, warn: Function, error: Function }} RecordingLoggerInterface
 */

/**
 * @description Recording logger implementation used for integration tests.
 * @implements {RecordingLoggerInterface}
 */
class RecordingLogger {
  /**
   * @param {{ throwOnError?: boolean }} [options]
   * @description Creates a logger that optionally throws when `.error` is invoked.
   */
  constructor({ throwOnError = false } = {}) {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
    this.throwOnError = throwOnError;
  }

  /**
   * @param {...*} args
   * @returns {void}
   * @description Records debug messages.
   */
  debug(...args) {
    this.calls.debug.push(args);
  }

  /**
   * @param {...*} args
   * @returns {void}
   * @description Records info messages.
   */
  info(...args) {
    this.calls.info.push(args);
  }

  /**
   * @param {...*} args
   * @returns {void}
   * @description Records warn messages.
   */
  warn(...args) {
    this.calls.warn.push(args);
  }

  /**
   * @param {...*} args
   * @returns {void}
   * @description Records error messages and optionally throws to simulate logger failures.
   */
  error(...args) {
    this.calls.error.push(args);
    if (this.throwOnError) {
      throw new Error('logger failure');
    }
  }
}

/**
 * @description Lightweight schema validator for integration tests.
 */
class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * @param {string} schemaId
   * @param {{ isValid?: boolean, errors?: Array }} result
   * @returns {void}
   * @description Registers a schema validation result.
   */
  register(schemaId, result) {
    this.schemas.set(schemaId, result);
  }

  /**
   * @param {string} schemaId
   * @returns {boolean}
   * @description Indicates whether a schema has been registered.
   */
  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  /**
   * @param {string} schemaId
   * @param {object} payload
   * @returns {{ isValid: boolean, errors: Array }}
   * @description Returns the registered validation outcome for the schema or defaults to success.
   */
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

/**
 * @description Registers an event definition within the provided registry.
 * @param {InMemoryDataRegistry} registry
 * @param {string} eventId
 * @param {object} [overrides]
 * @returns {void}
 */
const registerEventDefinition = (registry, eventId, overrides = {}) => {
  registry.store('events', eventId, {
    id: eventId,
    name: eventId,
    description: 'integration-test-event',
    ...overrides,
  });
};

/**
 * @description Creates an environment with real infrastructure modules wired together.
 * @param {{ throwOnError?: boolean }} [loggerOptions]
 * @returns {{
 *   logger: RecordingLogger,
 *   registry: InMemoryDataRegistry,
 *   schemaValidator: TestSchemaValidator,
 *   eventBus: EventBus,
 *   validatedEventDispatcher: ValidatedEventDispatcher,
 *   safeEventDispatcher: SafeEventDispatcher
 * }}
 */
const createDispatcherEnvironment = (loggerOptions = {}) => {
  const logger = new RecordingLogger(loggerOptions);
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

describe('EventBus integration safety nets', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('guards invalid operations and batch mode toggling through validated dispatcher', async () => {
    const env = createDispatcherEnvironment();
    registerEventDefinition(env.registry, 'integration:valid');

    // Initial disable should exit early without toggling state.
    env.validatedEventDispatcher.setBatchMode(false);
    expect(env.eventBus.isBatchModeEnabled()).toBe(false);

    // Enable batch mode with a short timeout and ensure auto disable cleans up.
    jest.useFakeTimers();
    env.validatedEventDispatcher.setBatchMode(true, {
      context: 'integration-invalid',
      maxRecursionDepth: 8,
      maxGlobalRecursion: 12,
      timeoutMs: 5,
    });
    expect(env.eventBus.isBatchModeEnabled()).toBe(true);
    expect(env.eventBus.getBatchModeOptions()).toMatchObject({
      context: 'integration-invalid',
    });

    jest.advanceTimersByTime(10);
    expect(env.eventBus.isBatchModeEnabled()).toBe(false);
    expect(env.eventBus.getBatchModeOptions()).toBeNull();

    // Invalid subscribe attempts should be rejected and logged.
    const invalidNameResult = env.validatedEventDispatcher.subscribe(
      '',
      () => {}
    );
    expect(invalidNameResult).toBeNull();
    const invalidListenerResult = env.validatedEventDispatcher.subscribe(
      'integration:valid',
      /** @type {any} */ (null)
    );
    expect(invalidListenerResult).toBeNull();

    const unsubscribeInvalid = env.validatedEventDispatcher.unsubscribe(
      'integration:valid',
      /** @type {any} */ (null)
    );
    expect(unsubscribeInvalid).toBe(false);

    await env.safeEventDispatcher.dispatch('', { test: true });

    expect(env.eventBus.listenerCount(/** @type {any} */ (null))).toBe(0);
    expect(env.eventBus.listenerCount('integration:valid')).toBe(0);

    const errorMessages = env.logger.calls.error.map(([message]) =>
      String(message)
    );
    expect(
      errorMessages.some((message) =>
        message.includes('Invalid event name provided')
      )
    ).toBe(true);
    expect(
      errorMessages.some((message) =>
        message.includes('Invalid listener provided')
      )
    ).toBe(true);
  });

  it('raises global recursion warnings and stops at the configured limit', async () => {
    const env = createDispatcherEnvironment();
    const nonWorkflowEvents = Array.from(
      { length: 6 },
      (_, idx) => `integration:chain:${idx}`
    );
    nonWorkflowEvents.forEach((eventId) =>
      registerEventDefinition(env.registry, eventId)
    );

    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    env.validatedEventDispatcher.setBatchMode(true, {
      context: 'recursion-limit',
      maxRecursionDepth: 50,
      maxGlobalRecursion: 6,
      timeoutMs: 5000,
    });

    let step = 0;
    const maxSteps = 80;
    nonWorkflowEvents.forEach((eventId, idx) => {
      env.validatedEventDispatcher.subscribe(eventId, async () => {
        if (step >= maxSteps) {
          return;
        }
        step += 1;
        const nextEvent =
          nonWorkflowEvents[(idx + 1) % nonWorkflowEvents.length];
        await env.validatedEventDispatcher.dispatch(nextEvent, { step });
      });
    });

    await env.validatedEventDispatcher.dispatch(nonWorkflowEvents[0], { step });
    env.validatedEventDispatcher.setBatchMode(false);

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(
      consoleWarnSpy.mock.calls.some((call) =>
        String(call[0]).includes('Global recursion warning')
      )
    ).toBe(true);
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes('Global recursion limit')
      )
    ).toBe(true);
    expect(step).toBeLessThan(maxSteps);
  });

  it('halts extreme workflow recursion before per-event limits', async () => {
    const env = createDispatcherEnvironment();
    const workflowEvents = [
      'core:turn_started',
      'core:turn_processing_started',
      'core:turn_processing_ended',
      'core:turn_ended',
      'core:player_turn_prompt',
      'core:action_decided',
    ];
    workflowEvents.forEach((eventId) =>
      registerEventDefinition(env.registry, eventId)
    );

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    env.validatedEventDispatcher.setBatchMode(true, {
      context: 'workflow-batch',
      maxRecursionDepth: 60,
      maxGlobalRecursion: 200,
      timeoutMs: 5000,
    });

    let loops = 0;
    const maxLoops = 150;
    workflowEvents.forEach((eventId, idx) => {
      env.validatedEventDispatcher.subscribe(eventId, async () => {
        if (loops >= maxLoops) {
          return;
        }
        loops += 1;
        const nextEvent = workflowEvents[(idx + 1) % workflowEvents.length];
        await env.validatedEventDispatcher.dispatch(nextEvent, { loops });
      });
    });

    await env.validatedEventDispatcher.dispatch(workflowEvents[0], { loops });
    env.validatedEventDispatcher.setBatchMode(false);

    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes('Extreme workflow event recursion')
      )
    ).toBe(true);
    expect(loops).toBeLessThan(maxLoops);
  });

  it('halts extreme component recursion during initialization batch mode', async () => {
    const env = createDispatcherEnvironment();
    const componentEvents = [
      'core:component_added',
      'core:component_removed',
      'core:entity_created',
    ];
    componentEvents.forEach((eventId) =>
      registerEventDefinition(env.registry, eventId)
    );

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    env.validatedEventDispatcher.setBatchMode(true, {
      context: 'game-initialization',
      maxRecursionDepth: 400,
      maxGlobalRecursion: 400,
      timeoutMs: 5000,
    });

    let loops = 0;
    const maxLoops = 350;
    componentEvents.forEach((eventId, idx) => {
      env.validatedEventDispatcher.subscribe(eventId, async () => {
        if (loops >= maxLoops) {
          return;
        }
        loops += 1;
        const nextEvent = componentEvents[(idx + 1) % componentEvents.length];
        await env.validatedEventDispatcher.dispatch(nextEvent, { loops });
      });
    });

    await env.validatedEventDispatcher.dispatch(componentEvents[0], { loops });
    env.validatedEventDispatcher.setBatchMode(false);

    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes('Extreme component event recursion')
      )
    ).toBe(true);
    expect(loops).toBeLessThan(maxLoops);
  });

  it('uses console directly when recursion load exceeds safe thresholds during errors', async () => {
    const env = createDispatcherEnvironment();
    const chainLength = 12;
    const eventChain = Array.from(
      { length: chainLength },
      (_, idx) => `integration:recursion-error:${idx}`
    );
    eventChain.forEach((eventId) =>
      registerEventDefinition(env.registry, eventId)
    );

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    env.validatedEventDispatcher.setBatchMode(true, {
      context: 'error-recursion',
      maxRecursionDepth: 60,
      maxGlobalRecursion: 60,
      timeoutMs: 5000,
    });

    let dispatches = 0;
    eventChain.forEach((eventId, idx) => {
      env.validatedEventDispatcher.subscribe(eventId, async () => {
        dispatches += 1;
        if (idx === chainLength - 1) {
          throw new Error('forced recursion failure');
        }
        const nextEvent = eventChain[idx + 1];
        await env.validatedEventDispatcher.dispatch(nextEvent, { dispatches });
      });
    });

    await env.validatedEventDispatcher.dispatch(eventChain[0], { dispatches });
    env.validatedEventDispatcher.setBatchMode(false);

    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes('using console to prevent recursion')
      )
    ).toBe(true);
  });

  it('falls back to console logging when the provided logger throws inside listeners', async () => {
    const env = createDispatcherEnvironment({ throwOnError: true });
    registerEventDefinition(env.registry, 'integration:listener-error');

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    env.validatedEventDispatcher.subscribe('integration:listener-error', () => {
      throw new Error('listener failure');
    });

    await env.safeEventDispatcher.dispatch('integration:listener-error', {
      ok: true,
    });
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes(
          'Logger failed while handling error in "integration:listener-error" listener'
        )
      )
    ).toBe(true);
  });
});
