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
