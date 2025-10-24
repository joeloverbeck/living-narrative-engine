import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/** @type {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>} */
let mockLogger;
let mockDispatcher;
let tracker;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  mockDispatcher = { dispatch: jest.fn() };
  tracker = new PlaytimeTracker({
    logger: mockLogger,
    safeEventDispatcher: mockDispatcher,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PlaytimeTracker additional branches', () => {
  test('setAccumulatedPlaytime stores value and resets session start', () => {
    tracker.startSession();
    expect(tracker._getSessionStartTime()).not.toBe(0);
    tracker.setAccumulatedPlaytime(42);
    expect(tracker._getAccumulatedPlaytimeSeconds()).toBe(42);
    expect(tracker._getSessionStartTime()).toBe(0);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PlaytimeTracker: Accumulated playtime set to 42s.'
    );
  });

  test('setAccumulatedPlaytime dispatches error events for invalid input', () => {
    expect(() => tracker.setAccumulatedPlaytime('bad')).toThrow(TypeError);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('number') })
    );

    mockDispatcher.dispatch.mockClear();
    expect(() => tracker.setAccumulatedPlaytime(-5)).toThrow(RangeError);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('-5') })
    );
  });

  test('setAccumulatedPlaytime rejects non-finite numbers', () => {
    expect(() => tracker.setAccumulatedPlaytime(Infinity)).toThrow(RangeError);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('Infinity') })
    );

    mockDispatcher.dispatch.mockClear();
    expect(() => tracker.setAccumulatedPlaytime(NaN)).toThrow(RangeError);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('NaN') })
    );
  });
});
