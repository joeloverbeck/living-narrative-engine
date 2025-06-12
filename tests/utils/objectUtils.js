/**
 * @module objectUtils
 */

/**
 * Freezes an object to make it immutable.
 *
 * @description
 * Immutability ensures that value objects cannot be modified after creation,
 * which helps prevent unintended side-effects and makes state management
 * more predictable.
 *
 * @template T
 * @param {T} o - The object to freeze.
 * @returns {Readonly<T>} The frozen object.
 */
export function freeze(o) {
  return Object.freeze(o);
}
