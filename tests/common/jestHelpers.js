import { jest } from '@jest/globals';

/**
 * Clears jest mock call histories on all functions within the supplied objects.
 *
 * @param {...object} targets - Objects containing jest.fn mocks.
 * @returns {void}
 */
export function clearMockFunctions(...targets) {
  for (const obj of targets) {
    for (const val of Object.values(obj)) {
      if (val && typeof val.mockClear === 'function') {
        val.mockClear();
      }
    }
  }
}

/**
 * Creates a spy that suppresses output from `console.error` during a test.
 *
 * @returns {import('@jest/globals').Mock} Jest spy on `console.error`.
 */
export function suppressConsoleError() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}

/**
 * Flushes pending promises and advances all Jest timers.
 * Uses a timeout to prevent infinite hanging when timers are misconfigured.
 *
 * @param {number} [maxIterations] - Maximum iterations to prevent infinite loops.
 * @returns {Promise<void>} Resolves once all timers have run.
 */
export async function flushPromisesAndTimers(maxIterations = 20) {
  let iterations = 0;
  let lastTimerCount = -1;
  let noProgressCount = 0;
  const maxNoProgress = 3; // Exit if no progress for 3 iterations

  while (iterations < maxIterations) {
    // First flush all pending promises using microtask queue
    // This is more reliable than mixing different async mechanisms
    await new Promise((resolve) => {
      // Use queueMicrotask if available (most modern environments)
      if (typeof queueMicrotask !== 'undefined') {
        queueMicrotask(resolve);
      } else if (typeof process !== 'undefined' && process.nextTick) {
        // Fallback to process.nextTick in Node.js
        process.nextTick(resolve);
      } else {
        // Last resort: use Promise.resolve().then()
        Promise.resolve().then(resolve);
      }
    });

    // Only run timers if we're using fake timers
    if (jest.isMockFunction(setTimeout)) {
      try {
        // Check if there are actually pending timers before running them
        const numPendingTimers = jest.getTimerCount();

        // Track if we're making progress
        if (numPendingTimers === lastTimerCount) {
          noProgressCount++;
          if (noProgressCount >= maxNoProgress && numPendingTimers === 0) {
            // No timers and no progress - we're done
            break;
          }
        } else {
          noProgressCount = 0; // Reset progress counter
        }

        lastTimerCount = numPendingTimers;

        if (numPendingTimers > 0) {
          // If there are many timers, run them all at once
          // Otherwise advance by smaller increments
          if (numPendingTimers > 5) {
            jest.runOnlyPendingTimers();
          } else {
            // For fewer timers, advance by 100ms at a time
            jest.advanceTimersByTime(100);
          }

          // After advancing timers, flush microtasks again
          await new Promise((resolve) => {
            if (typeof queueMicrotask !== 'undefined') {
              queueMicrotask(resolve);
            } else {
              Promise.resolve().then(resolve);
            }
          });
        } else if (iterations > 0) {
          // No pending timers after at least one iteration - we're likely done
          break;
        }
      } catch (error) {
        // If timer flushing fails, log and exit to prevent hangs
        console.warn('Timer flushing failed:', error.message);
        break;
      }
    } else {
      // Not using fake timers, just flush promises once more and exit
      await new Promise((resolve) => {
        if (typeof queueMicrotask !== 'undefined') {
          queueMicrotask(resolve);
        } else {
          Promise.resolve().then(resolve);
        }
      });
      break;
    }

    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn(
      `flushPromisesAndTimers: Maximum iterations (${maxIterations}) reached`
    );
  }
}

/**
 * Safely cleans up Jest timers and promises to prevent hanging tests.
 * Use this in afterEach hooks for comprehensive cleanup.
 *
 * @returns {Promise<void>} Resolves once cleanup is complete.
 */
export async function safeTestCleanup() {
  try {
    // Clear all timers first
    jest.clearAllTimers();

    // Flush any remaining promises and timers with a shorter iteration limit for cleanup
    await flushPromisesAndTimers(5);

    // Clear all mocks
    jest.clearAllMocks();

    // Restore real timers if we're using fake ones
    if (jest.isMockFunction(setTimeout)) {
      jest.useRealTimers();
    }

    // Reset modules if needed (be careful with this in performance tests)
    // jest.resetModules();
  } catch (error) {
    // Log warning but don't fail the test cleanup
    console.warn('Test cleanup warning:', error.message);
  }
}

/**
 * Waits for the provided asynchronous condition function to return true,
 * flushing timers between checks.
 *
 * @param {() => (boolean|Promise<boolean>)} asyncFn - Condition function.
 * @param {number} [maxTicks] - Maximum iterations to attempt.
 * @returns {Promise<boolean>} Resolves true if the condition is met.
 */
export async function waitForCondition(asyncFn, maxTicks = 50) {
  for (let i = 0; i < maxTicks; i++) {
    if (await asyncFn()) {
      return true;
    }

    await flushPromisesAndTimers();
  }
  return false;
}
