/**
 * Applies an array modification operation.
 *
 * @description Utility to mutate an array according to the given mode. It returns
 * a new array reflecting the modification and leaves the original untouched.
 * @param {'push'|'push_unique'|'pop'|'remove_by_value'} mode - Operation type.
 * @param {any[]} array - Array to operate on.
 * @param {any} value - Value used for push-like operations.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for errors.
 * @returns {any[]} The modified array.
 */
export function applyArrayModification(mode, array, value, logger) {
  switch (mode) {
    case 'push':
      return [...array, value];
    case 'push_unique':
      return array.includes(value) ? array : [...array, value];
    case 'pop':
      return array.slice(0, -1);
    case 'remove_by_value':
      return array.filter((item) => item !== value);
    default:
      if (logger) {
        logger.error(`Unknown mode: ${mode}`);
      }
      return array;
  }
}
