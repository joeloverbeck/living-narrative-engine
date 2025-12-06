import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  EventDispatchService,
  InvalidDispatcherError,
} from '../../../src/utils/eventDispatchService.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { EventDispatchTracer } from '../../../src/events/tracing/eventDispatchTracer.js';
import {
  ATTEMPT_ACTION_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

class TestLogger {
  constructor() {
    this.entries = [];
  }

  debug(message, meta) {
    this.entries.push({ level: 'debug', message, meta });
  }

  info(message, meta) {
    this.entries.push({ level: 'info', message, meta });
  }

  warn(message, meta) {
    this.entries.push({ level: 'warn', message, meta });
  }

  error(message, meta) {
    this.entries.push({ level: 'error', message, meta });
  }

  byLevel(level) {
    return this.entries.filter((entry) => entry.level === level);
  }
}

class FakeSafeEventDispatcher {
  constructor() {
    this.calls = [];
    this.behaviors = new Map();
  }

  setBehavior(eventName, behavior) {
    this.behaviors.set(eventName, behavior);
  }

  dispatch(eventName, payload, options = {}) {
    this.calls.push({ eventName, payload, options });
    const behavior = this.behaviors.get(eventName);
    if (!behavior) {
      return Promise.resolve(true);
    }
    return behavior(payload, options);
  }
}

class FakeOutputService {
  constructor({ reject = false } = {}) {
    this.reject = reject;
    this.traces = [];
  }

  async writeTrace(trace) {
    this.traces.push(trace);
    if (this.reject) {
      throw new Error('Trace write failure');
    }
  }
}

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('EventDispatchService integration', () => {
  let logger;
  let dispatcher;
  let outputService;
  let tracer;
  let traceFilter;

  const createService = ({
    safeDispatcher = dispatcher,
    filter = traceFilter,
    traceWriter = tracer,
    log = logger,
  } = {}) =>
    new EventDispatchService({
      safeEventDispatcher: safeDispatcher,
      logger: log,
      actionTraceFilter: filter,
      eventDispatchTracer: traceWriter,
    });

  beforeEach(() => {
    logger = new TestLogger();
    dispatcher = new FakeSafeEventDispatcher();
    outputService = new FakeOutputService();
    tracer = new EventDispatchTracer({ logger, outputService });
    traceFilter = new ActionTraceFilter({ logger });
  });

  it('dispatchWithLogging logs success and propagates dispatcher failures', async () => {
    const service = createService();

    await service.dispatchWithLogging(
      'test:event',
      { sample: true },
      'success-context'
    );

    dispatcher.setBehavior('failing:event', () =>
      Promise.reject(new Error('simulated failure'))
    );

    await service.dispatchWithLogging(
      'failing:event',
      { id: 42 },
      'failure-context'
    );

    const debugMessages = logger.byLevel('debug').map((entry) => entry.message);
    expect(
      debugMessages.some((msg) =>
        msg.includes("Dispatched 'test:event' for success-context")
      )
    ).toBe(true);

    const errorMessages = logger.byLevel('error').map((entry) => entry.message);
    expect(
      errorMessages.some((msg) =>
        msg.includes(
          "Failed dispatching 'failing:event' event for failure-context"
        )
      )
    ).toBe(true);
  });

  it('dispatchWithErrorHandling traces successful dispatches with sanitized payloads', async () => {
    dispatcher.setBehavior(ATTEMPT_ACTION_ID, () => Promise.resolve(true));
    dispatcher.setBehavior(SYSTEM_ERROR_OCCURRED_ID, () =>
      Promise.resolve(true)
    );

    const service = createService();

    const payload = {
      action: { definitionId: 'story:embrace' },
      token: 'super-secret',
      apiKey: 'abc123',
    };

    const result = await service.dispatchWithErrorHandling(
      ATTEMPT_ACTION_ID,
      payload,
      'romantic-context'
    );

    expect(result).toBe(true);
    await flushAsync();

    expect(outputService.traces).toHaveLength(1);
    const traceJson = outputService.traces[0].toJSON();
    expect(traceJson.payload.token).toBe('[REDACTED]');
    expect(traceJson.payload.apiKey).toBe('[REDACTED]');
    expect(traceJson.payload.action.definitionId).toBe('story:embrace');

    const debugMessages = logger.byLevel('debug').map((entry) => entry.message);
    expect(
      debugMessages.some((msg) =>
        msg.includes(
          'dispatchWithErrorHandling: Dispatch successful for romantic-context'
        )
      )
    ).toBe(true);
  });

  it('dispatchWithErrorHandling reports dispatcher failures without triggering system errors', async () => {
    const failureDispatcher = new FakeSafeEventDispatcher();
    failureDispatcher.setBehavior(ATTEMPT_ACTION_ID, () =>
      Promise.resolve(false)
    );

    const filterDisabled = new ActionTraceFilter({ enabled: false, logger });
    const service = createService({
      safeDispatcher: failureDispatcher,
      filter: filterDisabled,
    });

    const result = await service.dispatchWithErrorHandling(
      ATTEMPT_ACTION_ID,
      { action: { definitionId: 'story:hesitate' } },
      'low-confidence'
    );

    expect(result).toBe(false);
    const warnings = logger.byLevel('warn').map((entry) => entry.message);
    expect(
      warnings.some((msg) =>
        msg.includes('SafeEventDispatcher reported failure for low-confidence')
      )
    ).toBe(true);
    expect(
      failureDispatcher.calls.filter(
        (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID
      )
    ).toHaveLength(0);
  });

  it('dispatchWithErrorHandling dispatches system errors and tolerates trace writer failures', async () => {
    dispatcher.setBehavior('broken:event', () => {
      throw new Error('catastrophic failure');
    });
    dispatcher.setBehavior(SYSTEM_ERROR_OCCURRED_ID, () => {
      throw new Error('secondary failure');
    });

    const rejectingOutput = new FakeOutputService({ reject: true });
    const rejectingTracer = new EventDispatchTracer({
      logger,
      outputService: rejectingOutput,
    });
    const service = createService({ traceWriter: rejectingTracer });

    const result = await service.dispatchWithErrorHandling(
      'broken:event',
      { action: { definitionId: 'story:fail' } },
      'catastrophic-context'
    );

    expect(result).toBe(false);
    await flushAsync();

    expect(
      dispatcher.calls.filter(
        (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID
      ).length
    ).toBeGreaterThan(0);

    const warnMessages = logger.byLevel('warn').map((entry) => entry.message);
    expect(
      warnMessages.some((msg) =>
        msg.includes('Failed to write event dispatch trace')
      )
    ).toBe(true);
  });

  it('dispatchSystemError handles asynchronous dispatcher failures gracefully', async () => {
    dispatcher.setBehavior(SYSTEM_ERROR_OCCURRED_ID, () =>
      Promise.reject(new Error('async system error'))
    );

    const service = createService();

    await service.dispatchSystemError(
      'Async failure occurred',
      { code: 'ASYNC' },
      { async: true }
    );

    await flushAsync();

    const errorMessages = logger.byLevel('error').map((entry) => entry.message);
    expect(
      errorMessages.some((msg) =>
        msg.includes(
          'Failed to dispatch system error event: Async failure occurred'
        )
      )
    ).toBe(true);
  });

  it('dispatchValidationError produces standardized result and emits system error event', () => {
    dispatcher.setBehavior(SYSTEM_ERROR_OCCURRED_ID, () =>
      Promise.resolve(true)
    );

    const service = createService();

    const result = service.dispatchValidationError('Validation issue', {
      field: 'name',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Validation issue',
      details: { field: 'name' },
    });

    expect(
      dispatcher.calls.filter(
        (call) =>
          call.eventName === SYSTEM_ERROR_OCCURRED_ID &&
          call.payload.message === 'Validation issue'
      )
    ).toHaveLength(1);
  });

  it('safeDispatchEvent logs both success and failure outcomes', async () => {
    dispatcher.setBehavior('SAFE_OK', () => Promise.resolve(true));
    dispatcher.setBehavior('SAFE_THROW', () => {
      throw new Error('safe dispatch failure');
    });

    const service = createService();

    await service.safeDispatchEvent('SAFE_OK', { value: 1 });
    await service.safeDispatchEvent('SAFE_THROW', { value: 2 });

    const debugMessages = logger.byLevel('debug').map((entry) => entry.message);
    expect(
      debugMessages.some((msg) => msg.includes('Dispatched SAFE_OK'))
    ).toBe(true);

    const errorMessages = logger.byLevel('error').map((entry) => entry.message);
    expect(
      errorMessages.some((msg) => msg.includes('Failed to dispatch SAFE_THROW'))
    ).toBe(true);
  });

  it('dispatchSystemError throws InvalidDispatcherError when dispatcher is invalid', () => {
    const invalidDispatcher = {};
    const invalidService = createService({ safeDispatcher: invalidDispatcher });

    expect(() =>
      invalidService.dispatchSystemError(
        'No dispatcher',
        {},
        {
          throwOnInvalidDispatcher: true,
        }
      )
    ).toThrow(InvalidDispatcherError);
  });
});
