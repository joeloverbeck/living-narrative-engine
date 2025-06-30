import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

describe('EventBus error handling', () => {
  let bus;
  let logger;
  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    bus = new EventBus({ logger });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs for invalid subscribe arguments', () => {
    const r1 = bus.subscribe('', () => {});
    const r2 = bus.subscribe('test', null);
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs for invalid unsubscribe arguments', () => {
    const u1 = bus.unsubscribe('', () => {});
    const u2 = bus.unsubscribe('a', null);
    expect(u1).toBe(false);
    expect(u2).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs for invalid dispatch name', async () => {
    await bus.dispatch('');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('handles listener errors gracefully', async () => {
    bus.subscribe('x', () => {
      throw new Error('oops');
    });
    await bus.dispatch('x');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('EventBus: Error executing listener'),
      expect.any(Error)
    );
  });

  it('listenerCount logs and returns 0 for invalid name', () => {
    const count = bus.listenerCount('');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(count).toBe(0);
  });
});
