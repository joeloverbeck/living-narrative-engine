import { describe, it, expect, beforeEach } from '@jest/globals';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

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

class FailingValidatedEventDispatcher {
  constructor() {
    this.subscriptions = new Map();
    this.dispatchAttempts = [];
  }

  async dispatch(eventName, payload) {
    this.dispatchAttempts.push({ eventName, payload });
    throw new Error(`Intentional failure dispatching ${eventName}`);
  }

  subscribe(eventName, handler) {
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set());
    }
    this.subscriptions.get(eventName).add(handler);
    return () => this.unsubscribe(eventName, handler);
  }

  unsubscribe(eventName, handler) {
    this.subscriptions.get(eventName)?.delete(handler);
  }
}

describe('ShortTermMemoryService safe dispatcher failure integration', () => {
  let logger;
  let validatedDispatcher;
  let safeDispatcher;
  let service;

  beforeEach(() => {
    logger = new RecordingLogger();
    validatedDispatcher = new FailingValidatedEventDispatcher();
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    service = new ShortTermMemoryService({
      eventDispatcher: safeDispatcher,
      defaultMaxEntries: 1,
    });
  });

  const waitForAsync = () => new Promise((resolve) => setImmediate(resolve));

  it('does not surface errors when the safe dispatcher encounters failures', async () => {
    const mem = {
      thoughts: [],
      maxEntries: 5,
      entityId: 'npc-safe-1',
    };

    const fixedNow = new Date('2024-08-08T08:00:00.000Z');
    const result = service.addThought(mem, 'Integration memory', fixedNow);

    expect(result.wasAdded).toBe(true);
    expect(mem.thoughts).toHaveLength(1);
    expect(mem.thoughts[0]).toEqual({
      text: 'Integration memory',
      timestamp: fixedNow.toISOString(),
    });

    expect(() =>
      service.emitThoughtAdded(
        mem.entityId,
        result.entry.text,
        result.entry.timestamp
      )
    ).not.toThrow();

    await waitForAsync();

    expect(validatedDispatcher.dispatchAttempts).toHaveLength(1);
    expect(validatedDispatcher.dispatchAttempts[0]).toEqual({
      eventName: 'ThoughtAdded',
      payload: {
        entityId: 'npc-safe-1',
        text: 'Integration memory',
        timestamp: fixedNow.toISOString(),
      },
    });

    expect(logger.errorLogs.length).toBeGreaterThan(0);
    const combinedErrors = logger.errorLogs
      .flat()
      .map((entry) => String(entry));
    expect(
      combinedErrors.some((message) =>
        message.includes(
          "SafeEventDispatcher: Exception caught while dispatching event 'ThoughtAdded'"
        )
      )
    ).toBe(true);
  });
});
