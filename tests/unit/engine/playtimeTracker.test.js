import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';

/** @type {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/** @type {{dispatch: jest.Mock}} */
let mockDispatcher;

// Helper to fast-forward time in tests
let nowSpy;
let currentTime;

beforeEach(() => {
  jest.clearAllMocks();
  currentTime = 1000000;
  nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
  mockDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => {
  nowSpy.mockRestore();
});

describe('PlaytimeTracker', () => {
  test('startSession sets start time and logs debug', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    expect(tracker._getSessionStartTime()).toBe(currentTime);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `PlaytimeTracker: Session started at ${currentTime}`
    );
  });

  test('startSession warns when called twice', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    currentTime += 1000;
    tracker.startSession();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `PlaytimeTracker: startSession called while a session was already active (started at ${currentTime - 1000}). Restarting session timer.`
    );
    expect(tracker._getSessionStartTime()).toBe(currentTime);
  });

  test('endSessionAndAccumulate adds playtime when session active', () => {
    const tracker = new PlaytimeTracker({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
    tracker.startSession();
    currentTime += 5000;
    tracker.endSessionAndAccumulate();
    expect(tracker._getAccumulatedPlaytimeSeconds()).toBe(5);
    expect(tracker._getSessionStartTime()).toBe(0);
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
    tracker._setAccumulatedPlaytimeSeconds(10);
    tracker.startSession();
    currentTime += 3000;
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
    tracker._setAccumulatedPlaytimeSeconds(20);
    tracker.startSession();
    tracker.reset();
    expect(tracker._getAccumulatedPlaytimeSeconds()).toBe(0);
    expect(tracker._getSessionStartTime()).toBe(0);
    expect(mockLogger.debug).toHaveBeenLastCalledWith(
      'PlaytimeTracker: Playtime reset.'
    );
  });
});
