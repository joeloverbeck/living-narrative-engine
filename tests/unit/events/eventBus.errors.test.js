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
    bus.subscribe('', () => {});
    bus.subscribe('test', null);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs for invalid unsubscribe arguments', () => {
    bus.unsubscribe('', () => {});
    bus.unsubscribe('a', null);
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
