import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { assertValidActionIndex } from '../../../../src/utils/actionIndexUtils.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

class RecordingValidatedDispatcher {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        await listener({ type: eventName, payload });
      }
    }
    return true;
  }

  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.unsubscribe(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  clear() {
    this.events = [];
  }
}

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

describe('actionIndexUtils assertValidActionIndex with real dispatcher', () => {
  let validatedDispatcher;
  let safeDispatcher;
  let logger;
  let recordedNotifications;
  let unsubscribe;

  const providerName = 'core:test-provider';
  const actorId = 'actor:alpha';

  beforeEach(() => {
    validatedDispatcher = new RecordingValidatedDispatcher();
    logger = new RecordingLogger();
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });

    recordedNotifications = [];
    unsubscribe = safeDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      (event) => {
        recordedNotifications.push(event);
      }
    );

    validatedDispatcher.clear();
  });

  afterEach(() => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });

  it('dispatches a system error event when chosenIndex is not an integer', async () => {
    const debugData = { rawSelection: 'two', available: 3 };

    await expect(
      assertValidActionIndex(
        'two',
        3,
        providerName,
        actorId,
        safeDispatcher,
        logger,
        debugData
      )
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(validatedDispatcher.events).toHaveLength(1);
    const event = validatedDispatcher.events[0];
    expect(event.eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload).toEqual({
      message: "core:test-provider: Did not receive a valid integer 'chosenIndex' for actor actor:alpha.",
      details: debugData,
    });

    expect(recordedNotifications).toHaveLength(1);
    expect(recordedNotifications[0]).toEqual({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: event.payload,
    });
  });

  it('uses an empty details object when debug data is omitted', async () => {
    await expect(
      assertValidActionIndex(
        'invalid',
        1,
        providerName,
        actorId,
        safeDispatcher,
        logger
      )
    ).rejects.toThrow('Could not resolve the chosen action to a valid index.');

    expect(validatedDispatcher.events).toHaveLength(1);
    const event = validatedDispatcher.events[0];
    expect(event.payload.details).toEqual({});
  });

  it('includes actionsCount detail when index is outside the available range', async () => {
    const debugData = { attempted: 5 };

    await expect(
      assertValidActionIndex(
        5,
        2,
        providerName,
        actorId,
        safeDispatcher,
        logger,
        debugData
      )
    ).rejects.toThrow('Player chose an index that does not exist for this turn.');

    expect(validatedDispatcher.events).toHaveLength(1);
    const event = validatedDispatcher.events[0];
    expect(event.eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(event.payload).toEqual({
      message: 'core:test-provider: invalid chosenIndex (5) for actor actor:alpha.',
      details: { attempted: 5, actionsCount: 2 },
    });

    expect(recordedNotifications).toHaveLength(1);

    // Verify the lower-bound branch of the range validation
    validatedDispatcher.clear();
    recordedNotifications.length = 0;

    await expect(
      assertValidActionIndex(
        0,
        2,
        providerName,
        actorId,
        safeDispatcher,
        logger,
        { attempted: 0 }
      )
    ).rejects.toThrow('Player chose an index that does not exist for this turn.');

    expect(validatedDispatcher.events).toHaveLength(1);
    const lowerEvent = validatedDispatcher.events[0];
    expect(lowerEvent.payload).toEqual({
      message: 'core:test-provider: invalid chosenIndex (0) for actor actor:alpha.',
      details: { attempted: 0, actionsCount: 2 },
    });
  });

  it('passes silently when the selected index is valid', async () => {
    await expect(
      assertValidActionIndex(
        1,
        3,
        providerName,
        actorId,
        safeDispatcher,
        logger,
        { context: 'sanity-check' }
      )
    ).resolves.not.toThrow();

    expect(validatedDispatcher.events).toHaveLength(0);
    expect(recordedNotifications).toHaveLength(0);
    expect(logger.errorLogs).toHaveLength(0);
    expect(logger.warnLogs).toHaveLength(0);
  });
});
