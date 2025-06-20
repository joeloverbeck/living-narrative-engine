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

  beforeEach(() => {
    jest.clearAllMocks();
    testBed = new TurnManagerTestBed();
  });

  it('instantiates TurnManager with mocks', () => {
    expect(TurnManager).toHaveBeenCalledTimes(1);
    expect(TurnManager).toHaveBeenCalledWith({
      turnOrderService: testBed.mocks.turnOrderService,
      entityManager: testBed.mocks.entityManager,
      logger: testBed.mocks.logger,
      dispatcher: testBed.mocks.dispatcher,
      turnHandlerResolver: testBed.mocks.turnHandlerResolver,
    });
  });

  it('setActiveEntities stores entities in the mock', () => {
    const entity = { id: 'e1' };
    testBed.setActiveEntities(entity);
    expect(testBed.mocks.entityManager.activeEntities.get('e1')).toBe(entity);
    expect(testBed.mocks.entityManager.getActiveEntities()).toContain(entity);
  });

  it('trigger dispatches to subscribed handlers', () => {
    const handler = jest.fn();
    testBed.mocks.dispatcher.subscribe('core:test', handler);
    const payload = { ok: true };

    testBed.trigger('core:test', payload);

    expect(handler).toHaveBeenCalledWith({ type: 'core:test', payload });
  });

  it('cleanup stops the manager and resets mocks', async () => {
    const stopSpy = testBed.turnManager.stop;
    testBed.mocks.logger.debug('hi');
    expect(testBed.mocks.logger.debug).toHaveBeenCalledTimes(1);

    await testBed.cleanup();

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(testBed.mocks.logger.debug).toHaveBeenCalledTimes(0);
  });
});
