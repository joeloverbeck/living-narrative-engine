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
    bus.subscribe('test', handler);
    await bus.dispatch('test', { foo: 'bar' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'test',
      payload: { foo: 'bar' },
    });
  });

  it('handles wildcard subscriptions', async () => {
    const handler = jest.fn();
    bus.subscribe('*', handler);
    await bus.dispatch('any', { a: 1 });
    expect(handler).toHaveBeenCalledWith({ type: 'any', payload: { a: 1 } });
  });

  it('unsubscribes listeners correctly', async () => {
    const handler = jest.fn();
    bus.subscribe('once', handler);
    bus.unsubscribe('once', handler);
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
});
