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

  test('setAccumulatedPlaytime logs warning when dispatcher resolves false', async () => {
    mockDispatcher.dispatch.mockResolvedValue(false);

    expect(() => tracker.setAccumulatedPlaytime('bad')).toThrow(TypeError);

    await Promise.resolve();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'PlaytimeTracker: SafeEventDispatcher reported failure when reporting invalid playtime input.',
      expect.objectContaining({
        message: expect.stringContaining('expects a number'),
        details: expect.objectContaining({ receivedType: 'string' }),
      })
    );
  });

  test('setAccumulatedPlaytime logs warning when dispatcher returns false synchronously', async () => {
    mockDispatcher.dispatch.mockReturnValue(false);

    expect(() => tracker.setAccumulatedPlaytime(-5)).toThrow(RangeError);

    await Promise.resolve();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'PlaytimeTracker: SafeEventDispatcher reported failure when reporting invalid playtime input.',
      expect.objectContaining({
        message: expect.stringContaining('non-negative number'),
        details: expect.objectContaining({ seconds: -5 }),
      })
    );
  });

  test('setAccumulatedPlaytime still throws validation error when dispatcher throws', () => {
    const dispatchError = new Error('dispatch failure');
    mockDispatcher.dispatch.mockImplementation(() => {
      throw dispatchError;
    });

    expect(() => tracker.setAccumulatedPlaytime('bad')).toThrow(TypeError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'PlaytimeTracker: SafeEventDispatcher threw while reporting invalid playtime input.',
      dispatchError
    );
  });

  test('setAccumulatedPlaytime logs rejected dispatcher promises without preventing validation error', async () => {
    const dispatchError = new Error('async failure');
    mockDispatcher.dispatch.mockReturnValue(Promise.reject(dispatchError));

    expect(() => tracker.setAccumulatedPlaytime('bad')).toThrow(TypeError);

    await Promise.resolve();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'PlaytimeTracker: SafeEventDispatcher rejected while reporting invalid playtime input.',
      dispatchError
    );
  });
});
