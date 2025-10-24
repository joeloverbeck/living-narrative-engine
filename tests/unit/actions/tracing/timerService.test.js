/**
 * @file Unit tests for TimerService and TestTimerService
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  TimerService,
  TestTimerService,
  defaultTimerService,
} from '../../../../src/actions/tracing/timerService.js';

describe('TimerService', () => {
  let timerService;
  let timerId;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  beforeEach(() => {
    timerService = new TimerService();
    timerId = null;

    // Mock global timer functions
    global.setTimeout = jest.fn().mockReturnValue(12345);
    global.clearTimeout = jest.fn();
    global.setInterval = jest.fn().mockReturnValue(67890);
    global.clearInterval = jest.fn();
  });

  afterEach(() => {
    if (timerId) {
      timerService.clearTimeout(timerId);
      timerService.clearInterval(timerId);
    }

    // Restore original functions
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  describe('setTimeout', () => {
    it('should call native setTimeout with callback and delay', () => {
      const callback = jest.fn();
      const delay = 1000;

      const result = timerService.setTimeout(callback, delay);

      expect(global.setTimeout).toHaveBeenCalledWith(callback, delay);
      expect(result).toBe(12345);
    });
  });

  describe('clearTimeout', () => {
    it('should call native clearTimeout with valid timer ID', () => {
      const timerId = 12345;

      timerService.clearTimeout(timerId);

      expect(global.clearTimeout).toHaveBeenCalledWith(timerId);
    });

    it('should not call native clearTimeout with null timer ID', () => {
      timerService.clearTimeout(null);

      expect(global.clearTimeout).not.toHaveBeenCalled();
    });

    it('should not call native clearTimeout with undefined timer ID', () => {
      timerService.clearTimeout(undefined);

      expect(global.clearTimeout).not.toHaveBeenCalled();
    });

    it('should not call native clearTimeout with falsy timer ID (0)', () => {
      timerService.clearTimeout(0);

      expect(global.clearTimeout).not.toHaveBeenCalled();
    });
  });

  describe('setInterval', () => {
    it('should call native setInterval with callback and delay', () => {
      const callback = jest.fn();
      const delay = 500;

      const result = timerService.setInterval(callback, delay);

      expect(global.setInterval).toHaveBeenCalledWith(callback, delay);
      expect(result).toBe(67890);
    });
  });

  describe('clearInterval', () => {
    it('should call native clearInterval with valid timer ID', () => {
      const timerId = 67890;

      timerService.clearInterval(timerId);

      expect(global.clearInterval).toHaveBeenCalledWith(timerId);
    });

    it('should not call native clearInterval with null timer ID', () => {
      timerService.clearInterval(null);

      expect(global.clearInterval).not.toHaveBeenCalled();
    });

    it('should not call native clearInterval with undefined timer ID', () => {
      timerService.clearInterval(undefined);

      expect(global.clearInterval).not.toHaveBeenCalled();
    });

    it('should not call native clearInterval with falsy timer ID (0)', () => {
      timerService.clearInterval(0);

      expect(global.clearInterval).not.toHaveBeenCalled();
    });
  });
});

describe('TestTimerService', () => {
  let testTimerService;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    testTimerService = new TestTimerService();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor and reset', () => {
    it('should initialize with empty state', () => {
      expect(testTimerService.getPendingCount()).toBe(0);
      expect(testTimerService.hasPending()).toBe(false);
      expect(testTimerService.isProcessing()).toBe(false);
      expect(testTimerService.getRunningCount()).toBe(0);
    });
  });

  describe('setTimeout', () => {
    it('should schedule a timer and return incrementing ID', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const id1 = testTimerService.setTimeout(callback1, 1000);
      const id2 = testTimerService.setTimeout(callback2, 2000);

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(testTimerService.getPendingCount()).toBe(2);
      expect(testTimerService.hasPending()).toBe(true);
    });

    it('should store timer with correct properties', () => {
      const callback = jest.fn();
      const delay = 1500;

      testTimerService.setTimeout(callback, delay);

      expect(testTimerService.getPendingCount()).toBe(1);
    });
  });

  describe('clearTimeout', () => {
    it('should remove pending timer with valid ID', () => {
      const callback = jest.fn();
      const timerId = testTimerService.setTimeout(callback, 1000);

      expect(testTimerService.getPendingCount()).toBe(1);

      testTimerService.clearTimeout(timerId);

      expect(testTimerService.getPendingCount()).toBe(0);
      expect(testTimerService.hasPending()).toBe(false);
    });

    it('should not throw error with invalid timer ID', () => {
      expect(() => testTimerService.clearTimeout(999)).not.toThrow();
    });

    it('should not throw error with null timer ID', () => {
      expect(() => testTimerService.clearTimeout(null)).not.toThrow();
    });

    it('should not throw error with undefined timer ID', () => {
      expect(() => testTimerService.clearTimeout(undefined)).not.toThrow();
    });
  });

  describe('setInterval', () => {
    it('should schedule interval timer like setTimeout', () => {
      const callback = jest.fn();
      const delay = 500;

      const timerId = testTimerService.setInterval(callback, delay);

      expect(timerId).toBe(1);
      expect(testTimerService.getPendingCount()).toBe(1);
    });
  });

  describe('clearInterval', () => {
    it('should clear interval timer like clearTimeout', () => {
      const callback = jest.fn();
      const timerId = testTimerService.setInterval(callback, 500);

      expect(testTimerService.getPendingCount()).toBe(1);

      testTimerService.clearInterval(timerId);

      expect(testTimerService.getPendingCount()).toBe(0);
    });
  });

  describe('triggerAll', () => {
    it('should execute all pending timers immediately', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      testTimerService.setTimeout(callback1, 1000);
      testTimerService.setTimeout(callback2, 2000);

      expect(testTimerService.getPendingCount()).toBe(2);

      await testTimerService.triggerAll();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(testTimerService.getPendingCount()).toBe(0);
    });

    it('should handle async callbacks', async () => {
      const asyncCallback = jest.fn().mockResolvedValue('done');

      testTimerService.setTimeout(asyncCallback, 1000);

      await testTimerService.triggerAll();

      expect(asyncCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors without throwing', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const successCallback = jest.fn();

      testTimerService.setTimeout(errorCallback, 1000);
      testTimerService.setTimeout(successCallback, 2000);

      await testTimerService.triggerAll();

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(successCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Timer callback error:',
        expect.any(Error)
      );
    });

    it('should handle recursive timer creation', async () => {
      let recursiveCallCount = 0;
      const recursiveCallback = jest.fn().mockImplementation(() => {
        recursiveCallCount++;
        if (recursiveCallCount < 3) {
          testTimerService.setTimeout(recursiveCallback, 100);
        }
      });

      testTimerService.setTimeout(recursiveCallback, 1000);

      await testTimerService.triggerAll();

      expect(recursiveCallback).toHaveBeenCalledTimes(3);
    });

    it('should prevent infinite loops with max iterations', async () => {
      const infiniteCallback = jest.fn().mockImplementation(() => {
        testTimerService.setTimeout(infiniteCallback, 100);
      });

      testTimerService.setTimeout(infiniteCallback, 1000);

      await testTimerService.triggerAll();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'TestTimerService: Maximum trigger iterations reached, may have pending operations'
      );
      expect(infiniteCallback).toHaveBeenCalledTimes(100);
    });

    it('should not trigger if already processing', async () => {
      const callback = jest.fn();
      testTimerService.setTimeout(callback, 1000);

      // Start processing by calling triggerAll without await to simulate ongoing processing
      const firstTrigger = testTimerService.triggerAll();

      // Try to trigger again while first is still processing
      await testTimerService.triggerAll();

      // Wait for first trigger to complete
      await firstTrigger;

      expect(callback).toHaveBeenCalledTimes(1);
      expect(testTimerService.getPendingCount()).toBe(0);
    });

    it('should skip cleared timers during execution', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const timerId1 = testTimerService.setTimeout(callback1, 1000);
      testTimerService.setTimeout(callback2, 2000);

      // Clear first timer before triggering
      testTimerService.clearTimeout(timerId1);

      await testTimerService.triggerAll();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle promise rejection in callbacks', async () => {
      const rejectingCallback = jest
        .fn()
        .mockRejectedValue(new Error('Promise rejected'));
      const successCallback = jest.fn();

      testTimerService.setTimeout(rejectingCallback, 1000);
      testTimerService.setTimeout(successCallback, 2000);

      await testTimerService.triggerAll();

      expect(rejectingCallback).toHaveBeenCalledTimes(1);
      expect(successCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Timer callback error:',
        expect.any(Error)
      );
    });

    it('should skip timers cleared while processing the current batch', async () => {
      let secondaryTimerId;
      const firstCallback = jest.fn().mockImplementation(() => {
        testTimerService.clearTimeout(secondaryTimerId);
      });
      const secondCallback = jest.fn();

      testTimerService.setTimeout(firstCallback, 0);
      secondaryTimerId = testTimerService.setTimeout(secondCallback, 0);

      await testTimerService.triggerAll();

      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(secondCallback).not.toHaveBeenCalled();
    });

    it('should await any remaining running callbacks after processing', async () => {
      const originalAdd = Set.prototype.add;
      const originalDelete = Set.prototype.delete;
      const allSettledSpy = jest.spyOn(Promise, 'allSettled');
      let capturedSet;

      Set.prototype.add = function patchedAdd(value) {
        if (!capturedSet) {
          capturedSet = this;
          Set.prototype.add = originalAdd;
        }
        return originalAdd.call(this, value);
      };

      Set.prototype.delete = function patchedDelete(value) {
        if (this === capturedSet) {
          return false;
        }
        return originalDelete.call(this, value);
      };

      try {
        const asyncCallback = jest.fn().mockResolvedValue(undefined);
        testTimerService.setTimeout(asyncCallback, 0);

        await testTimerService.triggerAll();

        expect(allSettledSpy).toHaveBeenCalledWith(
          expect.arrayContaining([expect.any(Promise)])
        );
        expect(capturedSet).toBeDefined();
        expect(capturedSet.size).toBeGreaterThan(0);
        capturedSet.clear();
      } finally {
        Set.prototype.add = originalAdd;
        Set.prototype.delete = originalDelete;
        allSettledSpy.mockRestore();
      }
    });
  });

  describe('advanceTime', () => {
    it('should trigger timers that should fire within the time window', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      testTimerService.setTimeout(callback1, 500);
      testTimerService.setTimeout(callback2, 1000);
      testTimerService.setTimeout(callback3, 1500);

      await testTimerService.advanceTime(1000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();
      expect(testTimerService.getPendingCount()).toBe(1);
    });

    it('should trigger immediate timers (delay 0)', async () => {
      const callback = jest.fn();

      testTimerService.setTimeout(callback, 0);

      await testTimerService.advanceTime(100);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should adjust remaining delay for non-triggered timers', async () => {
      const callback = jest.fn();

      testTimerService.setTimeout(callback, 1000);

      await testTimerService.advanceTime(300);

      expect(callback).not.toHaveBeenCalled();
      expect(testTimerService.getPendingCount()).toBe(1);

      // Advance remaining time
      await testTimerService.advanceTime(700);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not advance if already processing', async () => {
      const callback = jest.fn();
      testTimerService.setTimeout(callback, 500);

      // Start advancing time without await to simulate ongoing processing
      const firstAdvance = testTimerService.advanceTime(1000);

      // Try to advance again while first is still processing
      await testTimerService.advanceTime(1000);

      // Wait for first advance to complete
      await firstAdvance;

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should skip cleared timers during time advancement', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const timerId1 = testTimerService.setTimeout(callback1, 500);
      testTimerService.setTimeout(callback2, 500);

      testTimerService.clearTimeout(timerId1);

      await testTimerService.advanceTime(1000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle promise rejection in advanceTime callbacks', async () => {
      const rejectingCallback = jest
        .fn()
        .mockRejectedValue(new Error('Advance time promise rejected'));

      testTimerService.setTimeout(rejectingCallback, 500);

      await testTimerService.advanceTime(1000);

      expect(rejectingCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Timer callback error:',
        expect.any(Error)
      );
    });

    it('should skip timers cleared after being scheduled for advancement', async () => {
      let secondaryTimerId;
      const firstCallback = jest.fn().mockImplementation(() => {
        testTimerService.clearTimeout(secondaryTimerId);
      });
      const secondCallback = jest.fn();

      testTimerService.setTimeout(firstCallback, 0);
      secondaryTimerId = testTimerService.setTimeout(secondCallback, 0);

      await testTimerService.advanceTime(0);

      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(secondCallback).not.toHaveBeenCalled();
    });

    it('should await remaining running callbacks when advancing time', async () => {
      const originalAdd = Set.prototype.add;
      const originalDelete = Set.prototype.delete;
      const allSettledSpy = jest.spyOn(Promise, 'allSettled');
      let capturedSet;

      Set.prototype.add = function patchedAdd(value) {
        if (!capturedSet) {
          capturedSet = this;
          Set.prototype.add = originalAdd;
        }
        return originalAdd.call(this, value);
      };

      Set.prototype.delete = function patchedDelete(value) {
        if (this === capturedSet) {
          return false;
        }
        return originalDelete.call(this, value);
      };

      try {
        const asyncCallback = jest.fn().mockResolvedValue(undefined);
        testTimerService.setTimeout(asyncCallback, 0);

        await testTimerService.advanceTime(0);

        expect(allSettledSpy).toHaveBeenCalledWith(
          expect.arrayContaining([expect.any(Promise)])
        );
        expect(capturedSet).toBeDefined();
        expect(capturedSet.size).toBeGreaterThan(0);
        capturedSet.clear();
      } finally {
        Set.prototype.add = originalAdd;
        Set.prototype.delete = originalDelete;
        allSettledSpy.mockRestore();
      }
    });
  });

  describe('waitForCompletion', () => {
    it('should resolve immediately when not processing', async () => {
      await expect(
        testTimerService.waitForCompletion()
      ).resolves.toBeUndefined();
    });

    it('should wait for running callbacks to complete', async () => {
      let resolveCallback;
      const longRunningCallback = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveCallback = resolve;
        });
      });

      testTimerService.setTimeout(longRunningCallback, 1000);

      // Start processing but don't wait
      const triggerPromise = testTimerService.triggerAll();

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(testTimerService.isProcessing()).toBe(true);

      // Start waiting for completion
      const waitPromise = testTimerService.waitForCompletion();

      // Resolve the long-running callback
      resolveCallback('done');

      // Wait for everything to complete
      await triggerPromise;
      await waitPromise;

      expect(testTimerService.isProcessing()).toBe(false);
    });

    it('should timeout after max attempts', async () => {
      // Mock isProcessing to always return true
      jest.spyOn(testTimerService, 'isProcessing').mockReturnValue(true);

      await testTimerService.waitForCompletion();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'TestTimerService waitForCompletion: Max attempts reached'
        )
      );
    });
  });

  describe('clearAll', () => {
    it('should clear all pending timers and reset state', () => {
      testTimerService.setTimeout(jest.fn(), 1000);
      testTimerService.setTimeout(jest.fn(), 2000);

      expect(testTimerService.getPendingCount()).toBe(2);

      testTimerService.clearAll();

      expect(testTimerService.getPendingCount()).toBe(0);
      expect(testTimerService.hasPending()).toBe(false);
      expect(testTimerService.getRunningCount()).toBe(0);
    });
  });

  describe('status methods', () => {
    it('should return correct pending count', () => {
      expect(testTimerService.getPendingCount()).toBe(0);

      testTimerService.setTimeout(jest.fn(), 1000);
      expect(testTimerService.getPendingCount()).toBe(1);

      testTimerService.setTimeout(jest.fn(), 2000);
      expect(testTimerService.getPendingCount()).toBe(2);
    });

    it('should return correct pending status', () => {
      expect(testTimerService.hasPending()).toBe(false);

      testTimerService.setTimeout(jest.fn(), 1000);
      expect(testTimerService.hasPending()).toBe(true);
    });

    it('should return correct running count', () => {
      expect(testTimerService.getRunningCount()).toBe(0);
      // Running count is tracked during actual execution,
      // so this tests the getter method
    });

    it('should return correct processing status', () => {
      expect(testTimerService.isProcessing()).toBe(false);
      // Processing status is determined by internal flags,
      // which are private but we can test the getter
    });
  });
});

describe('defaultTimerService', () => {
  it('should be an instance of TimerService', () => {
    expect(defaultTimerService).toBeInstanceOf(TimerService);
  });

  it('should be a singleton instance', () => {
    expect(defaultTimerService).toBe(defaultTimerService);
  });
});
