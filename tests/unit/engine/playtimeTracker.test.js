import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';
import * as loggerUtils from '../../../src/utils/loggerUtils.js';

/** @type {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** @type {{dispatch: jest.Mock}} */
let mockDispatcher;

// Helper constant for deterministic system time in tests
const BASE_TIME = 1000000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(BASE_TIME);
  mockDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
  jest.spyOn(loggerUtils, 'ensureValidLogger');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PlaytimeTracker', () => {
  test('constructor validates logger with ensureValidLogger', () => {
    new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      mockLogger,
      'PlaytimeTracker'
    );
  });

  test('constructor falls back when logger invalid', () => {
    const invalid = {};
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const tracker = new PlaytimeTracker({
      // @ts-ignore intentionally invalid
      logger: invalid,
      safeEventDispatcher: mockDispatcher,
    });

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      invalid,
      'PlaytimeTracker'
    );
    tracker.startSession();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
  test('startSession sets start time and logs debug', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    jest.setSystemTime(BASE_TIME + 3000);
    expect(tracker.getTotalPlaytime()).toBe(3);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `PlaytimeTracker: Session started at ${BASE_TIME}`
    );
  });

  test('startSession warns when called twice', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    jest.setSystemTime(BASE_TIME + 1000);
    tracker.startSession();
    jest.setSystemTime(BASE_TIME + 2000);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `PlaytimeTracker: startSession called while a session was already active (started at ${BASE_TIME}). Restarting session timer.`
    );
    expect(tracker.getTotalPlaytime()).toBe(1);
  });

  test('endSessionAndAccumulate adds playtime when session active', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    jest.setSystemTime(BASE_TIME + 5000);
    tracker.endSessionAndAccumulate();
    expect(tracker.getTotalPlaytime()).toBe(5);
  });

  test('endSessionAndAccumulate with no session logs debug', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.endSessionAndAccumulate();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PlaytimeTracker: endSessionAndAccumulate called but no active session was found.'
    );
  });

  test('getTotalPlaytime returns accumulated plus current session duration', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.setAccumulatedPlaytime(10);
    tracker.startSession();
    jest.setSystemTime(BASE_TIME + 3000);
    expect(tracker.getTotalPlaytime()).toBe(13);
  });

  test('setAccumulatedPlaytime validates input', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    expect(() => tracker.setAccumulatedPlaytime('bad')).toThrow(TypeError);
    expect(() => tracker.setAccumulatedPlaytime(-1)).toThrow(RangeError);
  });

  test('reset clears accumulated playtime and session start time', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.setAccumulatedPlaytime(20);
    tracker.startSession();
    tracker.reset();
    expect(tracker.getTotalPlaytime()).toBe(0);
    expect(mockLogger.debug).toHaveBeenLastCalledWith(
      'PlaytimeTracker: Playtime reset.'
    );
  });
});
