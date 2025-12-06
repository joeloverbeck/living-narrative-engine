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
} from '../../../../src/actions/tracing/timerService.js';

/**
 * Integration tests for the timer service implementations. These tests exercise the
 * production timer implementations with real timers and without mocking collaborators
 * to ensure behaviour under integration scenarios is covered.
 */
describe('Timer service integration behaviour', () => {
  describe('TimerService with real timers', () => {
    let timerService;

    beforeEach(() => {
      timerService = new TimerService();
    });

    afterEach(() => {
      timerService = null;
    });

    it('schedules and clears real timeouts and intervals', async () => {
      let timeoutTriggered = false;
      const timeoutId = timerService.setTimeout(() => {
        timeoutTriggered = true;
      }, 20);

      // Clearing the timeout should prevent it from firing, covering the guarded clear path
      timerService.clearTimeout(timeoutId);

      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(timeoutTriggered).toBe(false);

      let intervalCount = 0;
      const intervalId = timerService.setInterval(() => {
        intervalCount += 1;
      }, 10);

      await new Promise((resolve) => setTimeout(resolve, 35));
      timerService.clearInterval(intervalId);
      const callsAfterClear = intervalCount;

      await new Promise((resolve) => setTimeout(resolve, 35));
      expect(intervalCount).toBe(callsAfterClear);
    });
  });

  describe('TestTimerService cooperative behaviour', () => {
    let timerService;
    let errorSpy;

    beforeEach(() => {
      timerService = new TestTimerService();
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
      timerService.clearAll();
    });

    it('prevents reentrant triggerAll, skips cleared timers, and logs callback errors without failing the batch', async () => {
      const executionOrder = [];

      timerService.setTimeout(async () => {
        executionOrder.push('first');
        timerService.clearTimeout(clearableId);
        await timerService.advanceTime(0);
        await timerService.triggerAll();
      }, 0);

      const clearableId = timerService.setTimeout(() => {
        executionOrder.push('cleared');
      }, 0);

      timerService.setTimeout(() => {
        executionOrder.push('failing');
        throw new Error('boom');
      }, 0);

      timerService.setTimeout(() => {
        executionOrder.push('second');
      }, 0);

      await timerService.triggerAll();

      expect(executionOrder).toEqual(['first', 'failing', 'second']);
      expect(errorSpy).toHaveBeenCalledWith(
        'Timer callback error:',
        expect.any(Error)
      );
      expect(timerService.getPendingCount()).toBe(0);
      expect(timerService.hasPending()).toBe(false);
    });

    it('supports clearing pending timeouts and intervals before processing starts', async () => {
      const timeoutId = timerService.setTimeout(() => {
        throw new Error('timeout should have been cleared');
      }, 0);

      const intervalId = timerService.setInterval(() => {
        throw new Error('interval should have been cleared');
      }, 10);

      expect(timerService.getPendingCount()).toBe(2);

      timerService.clearTimeout(timeoutId);
      timerService.clearInterval(intervalId);

      expect(timerService.getPendingCount()).toBe(0);
      await timerService.triggerAll();
      expect(timerService.getPendingCount()).toBe(0);
      expect(timerService.hasPending()).toBe(false);
    });

    it('waits for active callbacks to settle when waitForCompletion runs alongside triggerAll', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        timerService.setTimeout(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve('async-complete');
              }, 30);
            }),
          0
        );

        const triggerPromise = timerService.triggerAll();
        await timerService.waitForCompletion();
        await triggerPromise;

        expect(timerService.isProcessing()).toBe(false);
        expect(timerService.getRunningCount()).toBe(0);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('logs a warning when triggerAll exceeds its maximum iteration safeguard', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        let iterations = 0;
        const scheduleLoop = () => {
          iterations += 1;
          if (iterations < 105) {
            timerService.setTimeout(scheduleLoop, 0);
          }
        };

        timerService.setTimeout(scheduleLoop, 0);
        await timerService.triggerAll();

        expect(iterations).toBeGreaterThanOrEqual(100);
        expect(warnSpy).toHaveBeenCalledWith(
          'TestTimerService: Maximum trigger iterations reached, may have pending operations'
        );
      } finally {
        warnSpy.mockRestore();
        timerService.clearAll();
      }
    });

    it('advances simulated time incrementally and keeps remaining timers pending', async () => {
      const stages = [];

      timerService.setTimeout(() => {
        stages.push('immediate');
      }, 0);

      timerService.setTimeout(() => {
        stages.push('async-start');
        return new Promise((resolve) => {
          setTimeout(() => {
            stages.push('async-finish');
            resolve();
          }, 15);
        });
      }, 50);

      const cancellableId = timerService.setTimeout(() => {
        stages.push('should-not-run');
      }, 50);

      timerService.setTimeout(() => {
        stages.push('delayed');
      }, 100);

      expect(timerService.getPendingCount()).toBe(4);
      expect(timerService.hasPending()).toBe(true);

      const advancePromise = timerService.advanceTime(60);
      expect(timerService.isProcessing()).toBe(true);
      timerService.clearTimeout(cancellableId);
      await advancePromise;

      expect(stages).toContain('immediate');
      expect(stages).toContain('async-start');
      expect(stages).toContain('async-finish');
      expect(stages).not.toContain('should-not-run');
      expect(stages).not.toContain('delayed');
      expect(timerService.getPendingCount()).toBe(1);

      await timerService.advanceTime(40);
      expect(stages).toContain('delayed');
      expect(timerService.hasPending()).toBe(false);
      expect(timerService.getRunningCount()).toBe(0);
      timerService.clearAll();
      expect(timerService.getPendingCount()).toBe(0);
    });

    it('emits a warning when waitForCompletion exceeds its retry threshold', async () => {
      class StubbornTimerService extends TestTimerService {
        constructor() {
          super();
          this._calls = 0;
        }

        isProcessing() {
          if (this._calls < 55) {
            this._calls += 1;
            return true;
          }
          return super.isProcessing();
        }
      }

      const stubbornService = new StubbornTimerService();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await stubbornService.waitForCompletion();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'TestTimerService waitForCompletion: Max attempts reached'
          )
        );
      } finally {
        warnSpy.mockRestore();
        stubbornService.clearAll();
      }
    });
  });
});
