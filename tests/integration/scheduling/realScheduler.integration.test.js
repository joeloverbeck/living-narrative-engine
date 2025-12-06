import { describe, it, beforeEach, expect } from '@jest/globals';
import RealScheduler from '../../../src/scheduling/RealScheduler.js';
import EventBus from '../../../src/events/eventBus.js';
import TurnEventSubscription from '../../../src/turns/turnEventSubscription.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(...args) {
    this.debugEntries.push(args);
  }

  info(...args) {
    this.infoEntries.push(args);
  }

  warn(...args) {
    this.warnEntries.push(args);
  }

  error(...args) {
    this.errorEntries.push(args);
  }
}

describe('RealScheduler integration with real modules', () => {
  let scheduler;
  let logger;
  let eventBus;

  beforeEach(() => {
    scheduler = new RealScheduler();
    logger = new RecordingLogger();
    eventBus = new EventBus({ logger });
  });

  it('invokes turn advancement callbacks synchronously through TurnEventSubscription', async () => {
    // Phase 10 fix: TurnEventSubscription now invokes callbacks synchronously
    // (immediately) rather than deferring via setTimeout. This prevents race
    // conditions where deferred callbacks could fire after state machine transitions.
    const subscription = new TurnEventSubscription(eventBus, logger, scheduler);
    const callOrder = [];

    const handlerPromise = new Promise((resolve) => {
      subscription.subscribe((event) => {
        callOrder.push('handler');
        resolve(event);
      });
    });

    callOrder.push('before-dispatch');
    await eventBus.dispatch(TURN_ENDED_ID, {
      actorId: 'npc-1',
      successStatus: 'complete',
    });
    callOrder.push('after-dispatch');

    // Handler is invoked synchronously during dispatch, so it appears
    // between 'before-dispatch' and 'after-dispatch'
    expect(callOrder).toEqual(['before-dispatch', 'handler', 'after-dispatch']);

    const event = await handlerPromise;
    // After awaiting, the order should still be the same
    expect(callOrder).toEqual(['before-dispatch', 'handler', 'after-dispatch']);
    expect(event.type).toBe(TURN_ENDED_ID);
    expect(event.payload).toEqual({
      actorId: 'npc-1',
      successStatus: 'complete',
    });

    subscription.unsubscribe();
  });

  it('supports cancelling scheduled work via clearTimeout before dispatch occurs', async () => {
    const events = [];
    const unsubscribe = eventBus.subscribe('integration:scheduled', (event) => {
      events.push(event);
    });

    const timerId = scheduler.setTimeout(() => {
      void eventBus.dispatch('integration:scheduled', {
        source: 'timer',
      });
    }, 30);

    scheduler.clearTimeout(timerId);

    await new Promise((resolve) => {
      setTimeout(resolve, 60);
    });

    expect(events).toHaveLength(0);

    await eventBus.dispatch('integration:scheduled', {
      source: 'direct',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'integration:scheduled',
      payload: { source: 'direct' },
    });

    unsubscribe();
  });
});
