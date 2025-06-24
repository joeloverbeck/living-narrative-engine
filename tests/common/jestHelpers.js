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
 *
 * @returns {Promise<void>} Resolves once all timers have run.
 */
export async function flushPromisesAndTimers() {
  await jest.runAllTimersAsync();
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
