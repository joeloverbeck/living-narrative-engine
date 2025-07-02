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
});
