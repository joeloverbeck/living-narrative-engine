/**
 * @file Test suite for the TurnManager test bed helper.
 * @see tests/unit/common/turns/turnManagerTestBed.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnManagerTestBed } from '../../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../../src/turns/turnManager.js';

jest.mock('../../../../src/turns/turnManager.js');

describe('TurnManager Test Helpers: TurnManagerTestBed', () => {
  let testBed;

  class FakeManager {
    constructor() {
      this.start = jest.fn(async () => {
        await this.advanceTurn();
      });
      this.stop = jest.fn();
      this.advanceTurn = jest.fn();
    }
  }

  class RealManager {
    async start() {
      await this.advanceTurn();
    }
    stop() {}
    advanceTurn() {}
  }

  beforeEach(() => {
    jest.clearAllMocks();
    testBed = new TurnManagerTestBed();
  });

  it('instantiates TurnManager with mocks', () => {
    expect(TurnManager).toHaveBeenCalledTimes(1);
    expect(TurnManager).toHaveBeenCalledWith({
      turnOrderService: testBed.turnOrderService,
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      dispatcher: testBed.dispatcher,
      turnHandlerResolver: testBed.turnHandlerResolver,
    });
  });

  it('setActiveEntities stores entities in the mock', () => {
    const entity = { id: 'e1' };
    testBed.setActiveEntities(entity);
    expect(testBed.mocks.entityManager.activeEntities.get('e1')).toBe(entity);
    expect(Array.from(testBed.mocks.entityManager.entities)).toContain(entity);
  });

  it('trigger dispatches to subscribed handlers', () => {
    const handler = jest.fn();
    testBed.dispatcher.subscribe('core:test', handler);
    const payload = { ok: true };

    testBed.trigger('core:test', payload);

    expect(handler).toHaveBeenCalledWith({ type: 'core:test', payload });
  });

  it('cleanup stops the manager and resets mocks', async () => {
    const stopSpy = testBed.turnManager.stop;
    testBed.logger.debug('hi');
    expect(testBed.logger.debug).toHaveBeenCalledTimes(1);

    await testBed.cleanup();

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(testBed.logger.debug).toHaveBeenCalledTimes(0);
  });

  it('startWithEntities starts manager and clears logs', async () => {
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    const e1 = { id: 'a' };
    bed.logger.info('pre');
    const withResetSpy = jest.spyOn(bed, 'withReset');
    await bed.startWithEntities(e1);
    expect(bed.turnManager.start).toHaveBeenCalledTimes(1);
    expect(bed.entityManager.activeEntities.get('a')).toBe(e1);
    expect(bed.logger.info).toHaveBeenCalledTimes(0);
    expect(withResetSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(withResetSpy).toHaveBeenCalledTimes(1);
    withResetSpy.mockRestore();
    await bed.cleanup();
  });

  it('startRunning sets running without advancing', async () => {
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    const withResetSpy = jest.spyOn(bed, 'withReset');
    await bed.startRunning();
    expect(bed.turnManager.start).toHaveBeenCalledTimes(1);
    expect(bed.turnManager.advanceTurn).not.toHaveBeenCalled();
    expect(withResetSpy).toHaveBeenCalledWith(expect.any(Function));
    expect(withResetSpy).toHaveBeenCalledTimes(1);
    withResetSpy.mockRestore();
    await bed.cleanup();
  });

  it('captureHandler retrieves subscribed callback', () => {
    const cb = jest.fn();
    testBed.dispatcher.subscribe('evt', cb);
    expect(testBed.captureHandler('evt')).toBe(cb);
  });

  it('captureSubscription captures handler and returns unsubscribe', () => {
    const capture = testBed.captureSubscription('evt');
    const cb = jest.fn();
    const result = testBed.dispatcher.subscribe('evt', cb);
    expect(capture.handler).toBe(cb);
    expect(result).toBe(capture.unsubscribe);
  });

  it('advanceAndFlush runs timers after advancing', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    bed.turnManager.advanceTurn.mockResolvedValue();
    const fn = jest.fn();
    setTimeout(fn, 50);
    await bed.advanceAndFlush();
    expect(bed.turnManager.advanceTurn).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
    jest.useRealTimers();
    await bed.cleanup();
  });

  it('startAndFlush starts manager then flushes timers', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    const fn = jest.fn();
    setTimeout(fn, 50);
    await bed.startAndFlush();
    expect(bed.turnManager.start).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
    jest.useRealTimers();
    await bed.cleanup();
  });

  it('startWithEntitiesAndFlush adds entities and flushes timers', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    const entity = { id: 'x' };
    const fn = jest.fn();
    setTimeout(fn, 50);
    await bed.startWithEntitiesAndFlush(entity);
    expect(bed.turnManager.start).toHaveBeenCalled();
    expect(bed.entityManager.activeEntities.get('x')).toBe(entity);
    expect(fn).toHaveBeenCalled();
    jest.useRealTimers();
    await bed.cleanup();
  });

  it('spy helpers restore spies during cleanup', async () => {
    const bed = new TurnManagerTestBed({ TurnManagerClass: RealManager });
    const stopSpy = bed.spyOnStop();
    const advanceSpy = bed.spyOnAdvanceTurn();
    await bed.turnManager.stop();
    await bed.turnManager.advanceTurn();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(advanceSpy).toHaveBeenCalledTimes(1);
    await bed.cleanup();
    expect(jest.isMockFunction(bed.turnManager.stop)).toBe(false);
    expect(jest.isMockFunction(bed.turnManager.advanceTurn)).toBe(false);
  });

  it('mockActorSequence returns actors in order then null', async () => {
    const actor1 = { id: 'a1' };
    const actor2 = { id: 'a2' };
    testBed.mockActorSequence(actor1, actor2);

    await expect(testBed.mocks.turnOrderService.getNextEntity()).resolves.toBe(
      actor1
    );
    await expect(testBed.mocks.turnOrderService.getNextEntity()).resolves.toBe(
      actor2
    );
    await expect(
      testBed.mocks.turnOrderService.getNextEntity()
    ).resolves.toBeNull();
  });
});
