import { describe, it, expect, jest } from '@jest/globals';
import TurnEventSubscription from '../../src/turns/turnEventSubscription.js';
import { ImmediateScheduler } from '../../src/scheduling/index.js';
import { TURN_ENDED_ID } from '../../src/constants/eventIds.js';
import { createEventBus } from '../common/mockFactories/index.js';

describe('TurnEventSubscription', () => {
  it('invokes callback via scheduler when event dispatched', async () => {
    const bus = createEventBus();
    const scheduler = new ImmediateScheduler();
    const spy = jest.spyOn(scheduler, 'setTimeout');
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const sub = new TurnEventSubscription(bus, logger, scheduler);
    const cb = jest.fn();

    sub.subscribe(cb);
    await bus.dispatch(TURN_ENDED_ID, { entityId: 'e1', success: true });

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(cb).toHaveBeenCalledWith({
      type: TURN_ENDED_ID,
      payload: { entityId: 'e1', success: true },
    });
  });

  it('unsubscribes correctly', async () => {
    const bus = createEventBus();
    const scheduler = new ImmediateScheduler();
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const sub = new TurnEventSubscription(bus, logger, scheduler);
    const cb = jest.fn();

    sub.subscribe(cb);
    sub.unsubscribe();
    await bus.dispatch(TURN_ENDED_ID, { entityId: 'e2', success: true });

    expect(cb).not.toHaveBeenCalled();
  });
});
