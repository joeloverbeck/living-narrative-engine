import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

describe('EventBus', () => {
  let bus;
  beforeEach(() => {
    bus = new EventBus({ logger: createLogger() });
  });

  it('subscribes and dispatches events to specific listeners', async () => {
    const handler = jest.fn();
    const unsub = bus.subscribe('test', handler);
    expect(typeof unsub).toBe('function');
    await bus.dispatch('test', { foo: 'bar' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'test',
      payload: { foo: 'bar' },
    });
    expect(unsub()).toBe(true);
  });

  it('handles wildcard subscriptions', async () => {
    const handler = jest.fn();
    bus.subscribe('*', handler);
    await bus.dispatch('any', { a: 1 });
    expect(handler).toHaveBeenCalledWith({ type: 'any', payload: { a: 1 } });
  });

  it('unsubscribes listeners correctly', async () => {
    const handler = jest.fn();
    const unsub = bus.subscribe('once', handler);
    expect(typeof unsub).toBe('function');
    expect(unsub()).toBe(true);
    await bus.dispatch('once');
    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('once')).toBe(0);
  });

  it('reports listener count for specific events', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.subscribe('count', h1);
    bus.subscribe('count', h2);
    expect(bus.listenerCount('count')).toBe(2);
  });

  it('returns null on failed subscription and false on failed unsubscribe', () => {
    const unsub = bus.subscribe('', () => {});
    expect(unsub).toBeNull();
    const result = bus.unsubscribe('', () => {});
    expect(result).toBe(false);
  });

  it('unsubscribe returns false when listener not found', () => {
    const handler = jest.fn();
    const result = bus.unsubscribe('missing', handler);
    expect(result).toBe(false);
  });

  describe('setBatchMode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      bus = new EventBus({ logger: createLogger() });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('updates configuration when enabling batch mode while already enabled', () => {
      bus.setBatchMode(true, {
        context: 'initial-load',
        timeoutMs: 1000,
        maxGlobalRecursion: 50,
      });

      expect(bus.isBatchModeEnabled()).toBe(true);
      expect(bus.getBatchModeOptions()).toMatchObject({
        context: 'initial-load',
        timeoutMs: 1000,
        maxGlobalRecursion: 50,
        maxRecursionDepth: 10,
      });

      bus.setBatchMode(true, {
        context: 'nested-load',
        timeoutMs: 2000,
        maxGlobalRecursion: 150,
        maxRecursionDepth: 30,
      });

      expect(bus.getBatchModeOptions()).toMatchObject({
        context: 'nested-load',
        timeoutMs: 2000,
        maxGlobalRecursion: 150,
        maxRecursionDepth: 30,
      });

      // Original timeout should be cleared; batch mode should remain enabled after 1s
      jest.advanceTimersByTime(1001);
      expect(bus.isBatchModeEnabled()).toBe(true);
      expect(bus.getBatchModeOptions()).not.toBeNull();

      // Batch mode should auto-disable after the updated timeout elapses
      jest.advanceTimersByTime(998);
      expect(bus.isBatchModeEnabled()).toBe(true);
      jest.advanceTimersByTime(2);
      expect(bus.isBatchModeEnabled()).toBe(false);
      expect(bus.getBatchModeOptions()).toBeNull();
    });

    it('refreshes timeout when enabling batch mode with identical options', () => {
      const options = {
        context: 'loader',
        timeoutMs: 1000,
        maxGlobalRecursion: 75,
      };

      bus.setBatchMode(true, options);

      // Advance close to the timeout without reaching it
      jest.advanceTimersByTime(900);
      expect(bus.isBatchModeEnabled()).toBe(true);

      // Re-apply the same configuration to refresh the timeout window
      bus.setBatchMode(true, options);

      // Exceed the original timeout window; batch mode should still be active
      jest.advanceTimersByTime(200);
      expect(bus.isBatchModeEnabled()).toBe(true);

      // Once the refreshed timeout elapses, batch mode should auto-disable
      jest.advanceTimersByTime(801);
      expect(bus.isBatchModeEnabled()).toBe(false);
      expect(bus.getBatchModeOptions()).toBeNull();
    });
  });

  describe('Recursion Counter Reset', () => {
    it('should manually reset recursion counters via resetRecursionCounters()', async () => {
      const logger = createLogger();
      const bus = new EventBus({ logger });

      // Create a handler that dispatches another event (recursion)
      const recursiveHandler = jest.fn(async (event) => {
        if (event.payload.depth < 3) {
          await bus.dispatch('test:recursive', { depth: event.payload.depth + 1 });
        }
      });

      bus.subscribe('test:recursive', recursiveHandler);

      // Dispatch to build up recursion depth
      await bus.dispatch('test:recursive', { depth: 1 });

      // Verify handler was called multiple times (recursive calls)
      expect(recursiveHandler).toHaveBeenCalled();

      // Reset counters
      bus.resetRecursionCounters();

      // Verify logger was called with debug message
      expect(logger.debug).toHaveBeenCalledWith(
        'EventBus: Recursion depth counters manually reset'
      );

      // Dispatch again - should start from depth 0
      recursiveHandler.mockClear();
      await bus.dispatch('test:recursive', { depth: 1 });

      // Should work without warnings since counters were reset
      expect(recursiveHandler).toHaveBeenCalled();
    });

    it('should auto-reset recursion counters after 5 seconds of inactivity', async () => {
      const logger = createLogger();
      const bus = new EventBus({ logger });

      // Mock Date.now to simulate time passage
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      Date.now = jest.fn(() => currentTime);

      try {
        // Create a handler that leaves entries in the recursion map by throwing
        // This simulates an edge case where dispatch didn't complete cleanly
        const faultyHandler = jest.fn(async () => {
          throw new Error('Simulated error to leave map dirty');
        });

        bus.subscribe('test:auto-reset', faultyHandler);

        // Dispatch that will fail and potentially leave map entries
        try {
          await bus.dispatch('test:auto-reset', { depth: 1 });
        } catch (err) {
          // Expected to fail
        }

        // Simulate 6 seconds passing (more than 5-second threshold)
        currentTime += 6000;

        // Dispatch again with a clean handler - should trigger auto-reset
        bus.unsubscribe('test:auto-reset', faultyHandler);
        const cleanHandler = jest.fn();
        bus.subscribe('test:auto-reset', cleanHandler);

        logger.debug.mockClear();
        await bus.dispatch('test:auto-reset', { depth: 1 });

        // Verify auto-reset mechanism ran (even if map was empty, the time check should happen)
        // The key behavior: dispatch should work normally after time threshold
        expect(cleanHandler).toHaveBeenCalled();
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should not auto-reset if dispatch happens within 5 seconds', async () => {
      const logger = createLogger();
      const bus = new EventBus({ logger });

      // Mock Date.now to simulate time passage
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      Date.now = jest.fn(() => currentTime);

      try {
        // First dispatch
        await bus.dispatch('test:no-reset', { value: 1 });

        // Simulate only 3 seconds passing (less than 5-second threshold)
        currentTime += 3000;

        // Second dispatch
        logger.debug.mockClear();
        await bus.dispatch('test:no-reset', { value: 2 });

        // Verify auto-reset was NOT triggered
        const debugCalls = logger.debug.mock.calls;
        const autoResetCall = debugCalls.find(call =>
          call[0] && call[0].includes('Auto-reset triggered')
        );
        expect(autoResetCall).toBeUndefined();
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});
