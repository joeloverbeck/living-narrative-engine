import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import { Throttler } from '../../../src/alerting/throttler.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

describe('Throttler expired window branch', () => {
  const key = 'event';
  const payload = { message: 'msg' };
  let dispatcher;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    dispatcher = { dispatch: jest.fn() };
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears stale entry when timer has not fired but window expired', () => {
    const throttler = new Throttler(dispatcher, 'warning');

    // initial event creates an entry and timer
    expect(throttler.allow(key, payload)).toBe(true);

    // advance system time beyond window without processing timers
    jest.setSystemTime(11001);

    // second event should treat as new and clear old timer
    expect(throttler.allow(key, payload)).toBe(true);

    // no dispatch yet
    expectNoDispatch(dispatcher.dispatch);

    // run all timers to ensure cleared timer did not dispatch
    jest.advanceTimersByTime(10000);
    expectNoDispatch(dispatcher.dispatch);
  });
});
