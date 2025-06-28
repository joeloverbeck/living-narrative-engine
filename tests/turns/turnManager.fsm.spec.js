import { describe, it, expect, beforeEach } from '@jest/globals';
import TurnManager from '../../src/turns/turnManager.js';
import TurnEventSubscription from '../../src/turns/turnEventSubscription.js';
import { ImmediateScheduler } from '../../src/scheduling/index.js';
import { TURN_ENDED_ID } from '../../src/constants/eventIds.js';
import { createEventBus, createMockTurnHandler } from '../common/mockFactories/index.js';
import { createAiActor } from '../common/turns/testActors.js';
import { flushPromisesAndTimers } from '../common/jestHelpers.js';

class StubCycle {
  constructor(list) {
    this.list = list;
    this.index = 0;
  }
  async nextActor() {
    return this.list[this.index++] ?? null;
  }
  async clear() {
    this.index = 0;
  }
}

class StubRoundManager {
  constructor(cycle) {
    this.cycle = cycle;
    this.startRound = jest.fn(async () => {
      this.cycle.index = 0;
    });
    this.endTurn = jest.fn();
  }
}

describe('TurnManager FSM', () => {
  let bus;
  let scheduler;
  let cycle;
  let roundMgr;
  let resolver;
  let tm;
  let a1;
  let a2;

  beforeEach(() => {
    scheduler = new ImmediateScheduler();
    bus = createEventBus();
    a1 = createAiActor('a1');
    a2 = createAiActor('a2');
    cycle = new StubCycle([a1, a2]);
    roundMgr = new StubRoundManager(cycle);
    resolver = { resolveHandler: jest.fn(async () => createMockTurnHandler()) };
    const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    tm = new TurnManager({
      turnOrderService: { clearCurrentRound: jest.fn() },
      entityManager: { getEntityInstance: jest.fn() },
      logger,
      dispatcher: bus,
      turnHandlerResolver: resolver,
      roundManager: roundMgr,
      turnCycle: cycle,
      eventSub: new TurnEventSubscription(bus, logger, scheduler),
      scheduler,
    });
  });

  it('cycles through actors and starts new round when list exhausted', async () => {
    await tm.start();
    expect(tm.getCurrentActorId()).toBe('a1');
    await bus.dispatch(TURN_ENDED_ID, { entityId: 'a1', success: true });
    expect(tm.getCurrentActorId()).toBe('a2');
    await bus.dispatch(TURN_ENDED_ID, { entityId: 'a2', success: true });
    await flushPromisesAndTimers();
    expect(roundMgr.startRound).toHaveBeenCalled();
    expect(tm.getCurrentActorId()).toBe('a1');
  });
});
