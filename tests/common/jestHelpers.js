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
