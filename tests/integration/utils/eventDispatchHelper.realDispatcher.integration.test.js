import { describe, it, expect } from '@jest/globals';
import { dispatchWithErrorHandling } from '../../../src/utils/eventDispatchHelper.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

/**
 * Creates a logger that records every call without mocking any dependencies.
 *
 * @returns {{logger: import('../../../src/interfaces/coreServices.js').ILogger, entries: Record<string, any[][]>}}
 */
function createRecordingLogger() {
  const entries = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  const logger = {
    debug: (...args) => entries.debug.push(args),
    info: (...args) => entries.info.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
  };

  return { logger, entries };
}

class RecordingDispatcher {
  /**
   * @param {Record<string, { throw?: Error, return?: boolean } | ((payload: any) => boolean | Promise<boolean>)>} behaviors
   */
  constructor(behaviors = {}) {
    this.behaviors = behaviors;
    this.events = [];
  }

  /**
   * @param {string} eventName
   * @param {any} payload
   * @returns {Promise<boolean>}
   */
  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const behavior = this.behaviors[eventName];

    if (!behavior) {
      return true;
    }

    if (typeof behavior === 'function') {
      return await behavior(payload);
    }

    if (behavior.throw) {
      throw behavior.throw;
    }

    if (typeof behavior.return === 'boolean') {
      return behavior.return;
    }

    return true;
  }
}

describe('dispatchWithErrorHandling integration with real dispatcher', () => {
  it('logs a full success path when dispatch resolves to true', async () => {
    const dispatcher = new RecordingDispatcher();
    const { logger, entries } = createRecordingLogger();

    const payload = { id: 'success-case', value: 42 };
    const result = await dispatchWithErrorHandling(
      dispatcher,
      'integration:success',
      payload,
      logger,
      'integration test'
    );

    expect(result).toBe(true);
    expect(dispatcher.events).toEqual([
      { eventName: 'integration:success', payload },
    ]);

    expect(entries.debug[0][0]).toBe(
      "dispatchWithErrorHandling: Attempting dispatch: integration test ('integration:success')"
    );
    expect(entries.debug[1][0]).toBe(
      'dispatchWithErrorHandling: Dispatch successful for integration test.'
    );
    expect(entries.warn).toHaveLength(0);
    expect(entries.error).toHaveLength(0);
  });

  it('records a warning when the dispatcher reports failure', async () => {
    const dispatcher = new RecordingDispatcher({
      'integration:failure': { return: false },
    });
    const { logger, entries } = createRecordingLogger();

    const payload = { attempt: 1 };
    const result = await dispatchWithErrorHandling(
      dispatcher,
      'integration:failure',
      payload,
      logger,
      'integration failure'
    );

    expect(result).toBe(false);
    expect(dispatcher.events).toEqual([
      { eventName: 'integration:failure', payload },
    ]);

    expect(entries.warn[0][0]).toContain(
      'dispatchWithErrorHandling: SafeEventDispatcher reported failure for integration failure'
    );
    expect(entries.error).toHaveLength(0);
  });

  it('dispatches a system error event when the dispatcher throws', async () => {
    const thrownError = new Error('boom');
    const systemEvents = [];
    const dispatcher = new RecordingDispatcher({
      'integration:error': { throw: thrownError },
      [SYSTEM_ERROR_OCCURRED_ID]: (payload) => {
        systemEvents.push(payload);
        return true;
      },
    });
    const { logger, entries } = createRecordingLogger();

    const payload = { trigger: true };
    const result = await dispatchWithErrorHandling(
      dispatcher,
      'integration:error',
      payload,
      logger,
      'integration crash'
    );

    expect(result).toBe(false);
    expect(entries.error[0][0]).toBe(
      'dispatchWithErrorHandling: CRITICAL - Error during dispatch for integration crash. Error: boom'
    );
    expect(systemEvents).toHaveLength(1);

    const [systemPayload] = systemEvents;
    expect(systemPayload.message).toBe('System error during event dispatch.');
    expect(systemPayload.details.raw).toBe(
      'Exception in dispatch for integration:error'
    );
    expect(systemPayload.details.stack).toContain('Error: boom');

    const eventNames = dispatcher.events.map((event) => event.eventName);
    expect(eventNames).toEqual(['integration:error', SYSTEM_ERROR_OCCURRED_ID]);
  });
});
