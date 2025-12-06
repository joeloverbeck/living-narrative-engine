import { describe, it, beforeEach, expect } from '@jest/globals';
import { assertValidActionIndex } from '../../../src/utils/actionIndexUtils.js';
import { InvalidDispatcherError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

/**
 * Simple dispatcher implementation that records all dispatched events.
 */
class RecordingDispatcher {
  constructor() {
    /** @type {{ eventId: string, payload: any }[]} */
    this.events = [];
  }

  /**
   * Records the dispatched event and mimics the async signature of the real dispatcher.
   *
   * @param {string} eventId
   * @param {any} payload
   * @returns {Promise<boolean>}
   */
  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

/**
 * Lightweight logger implementation capturing log calls for inspection.
 */
class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

/**
 * These tests exercise assertValidActionIndex together with the production
 * safeDispatchError helper to ensure real dispatcher and logger instances are
 * used when an invalid index is supplied.
 */
describe('assertValidActionIndex integration with safeDispatchError', () => {
  /** @type {RecordingDispatcher} */
  let dispatcher;
  /** @type {RecordingLogger} */
  let logger;

  beforeEach(() => {
    dispatcher = new RecordingDispatcher();
    logger = new RecordingLogger();
  });

  it('allows valid indices without dispatching errors', async () => {
    await expect(
      assertValidActionIndex(
        2,
        5,
        'TestProvider',
        'actor:1',
        dispatcher,
        logger
      )
    ).resolves.not.toThrow();

    expect(dispatcher.events).toHaveLength(0);
    expect(logger.errorLogs).toHaveLength(0);
  });

  it('dispatches system error events when the index is not an integer', async () => {
    const debugData = { context: 'non-integer-selection' };

    await expect(
      assertValidActionIndex(
        1.5,
        4,
        'ProviderA',
        'actor:alpha',
        dispatcher,
        logger,
        debugData
      )
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(dispatcher.events).toHaveLength(1);
    const event = dispatcher.events[0];
    expect(event.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload.message).toBe(
      "ProviderA: Did not receive a valid integer 'chosenIndex' for actor actor:alpha."
    );
    expect(event.payload.details).toEqual(debugData);
  });

  it('rejects indices below 1 and augments the dispatched details', async () => {
    const debugData = { currentLocation: 'central-plaza' };

    await expect(
      assertValidActionIndex(
        0,
        3,
        'ProviderB',
        'actor:beta',
        dispatcher,
        logger,
        debugData
      )
    ).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );

    expect(dispatcher.events).toHaveLength(1);
    const event = dispatcher.events[0];
    expect(event.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload.message).toBe(
      'ProviderB: invalid chosenIndex (0) for actor actor:beta.'
    );
    expect(event.payload.details).toEqual({
      ...debugData,
      actionsCount: 3,
    });
    // Ensure the original debugData was not mutated by the helper.
    expect(debugData).toEqual({ currentLocation: 'central-plaza' });
  });

  it('rejects indices above the available range', async () => {
    await expect(
      assertValidActionIndex(
        10,
        2,
        'ProviderC',
        'actor:gamma',
        dispatcher,
        logger
      )
    ).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );

    expect(dispatcher.events).toHaveLength(1);
    const event = dispatcher.events[0];
    expect(event.eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload.details.actionsCount).toBe(2);
  });

  it('throws InvalidDispatcherError when dispatcher lacks a dispatch method', async () => {
    const badDispatcher = {};

    await expect(
      assertValidActionIndex(
        0,
        1,
        'ProviderD',
        'actor:delta',
        badDispatcher,
        logger
      )
    ).rejects.toThrow(InvalidDispatcherError);
  });
});
