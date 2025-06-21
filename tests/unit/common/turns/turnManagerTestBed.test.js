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
    expect(testBed.entityManager.activeEntities.get('e1')).toBe(entity);
    expect(testBed.entityManager.getActiveEntities()).toContain(entity);
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
    await bed.startWithEntities(e1);
    expect(bed.turnManager.start).toHaveBeenCalledTimes(1);
    expect(bed.entityManager.activeEntities.get('a')).toBe(e1);
    expect(bed.logger.info).toHaveBeenCalledTimes(0);
    await bed.cleanup();
  });

  it('startRunning sets running without advancing', async () => {
    const bed = new TurnManagerTestBed({ TurnManagerClass: FakeManager });
    await bed.startRunning();
    expect(bed.turnManager.start).toHaveBeenCalledTimes(1);
    expect(bed.turnManager.advanceTurn).not.toHaveBeenCalled();
    await bed.cleanup();
  });

  it('captureHandler retrieves subscribed callback', () => {
    const cb = jest.fn();
    testBed.dispatcher.subscribe('evt', cb);
    expect(testBed.captureHandler('evt')).toBe(cb);
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
});
