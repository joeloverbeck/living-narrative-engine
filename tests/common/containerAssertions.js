/**
 * @file Assertion helpers for DI container-related tests.
 */

/**
 * Asserts that resolving `token` from the container yields a singleton instance
 * of the provided class.
 *
 * @param {{ resolve: Function }} container - DI container instance.
 * @param {any} token - Token used to resolve the instance.
 * @param {Function} Class - Expected constructor.
 * @returns {void}
 */
export function expectSingleton(container, token, Class) {
  expect(() => container.resolve(token)).not.toThrow();
  const first = container.resolve(token);
  expect(first).toBeInstanceOf(Class);
  expect(container.resolve(token)).toBe(first);
}
