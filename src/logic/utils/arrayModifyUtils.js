/**
 * @description List of supported modification modes for array operations.
 * @type {Array<'push'|'push_unique'|'pop'|'remove_by_value'>}
 */
export const ARRAY_MODIFICATION_MODES = [
  'push',
  'push_unique',
  'pop',
  'remove_by_value',
];

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

/**
 * Advanced modification with deep comparison and result return.
 *
 * @param {'push'|'push_unique'|'pop'|'remove_by_value'} mode - Operation type.
 * @param {any[]} array - Array to operate on.
 * @param {any} value - Value used for push-like operations.
 * @param {import('../../interfaces/coreServices.js').ILogger} [logger] - Logger for errors.
 * @returns {{ nextArray: any[], result: any, modified: boolean }} The next array, result, and modification flag.
 */
export function advancedArrayModify(mode, array, value, logger) {
  if (!Array.isArray(array)) {
    logger?.error('advancedArrayModify: provided value is not an array');
    return { nextArray: array, result: undefined, modified: false };
  }

  switch (mode) {
    case 'push': {
      const next = [...array, value];
      return { nextArray: next, result: next, modified: true };
    }
    case 'push_unique': {
      let exists = false;
      if (typeof value !== 'object' || value === null) {
        exists = array.includes(value);
      } else {
        const valueJson = JSON.stringify(value);
        exists = array.some((item) => JSON.stringify(item) === valueJson);
      }
      const next = exists ? [...array] : [...array, value];
      return { nextArray: next, result: next, modified: !exists };
    }
    case 'pop': {
      const popped = array.length > 0 ? array[array.length - 1] : undefined;
      const next = array.slice(0, -1);
      return { nextArray: next, result: popped, modified: array.length > 0 };
    }
    case 'remove_by_value': {
      let next = [...array];
      let modified = false;
      if (typeof value !== 'object' || value === null) {
        const index = array.indexOf(value);
        if (index > -1) {
          next = [...array.slice(0, index), ...array.slice(index + 1)];
          modified = true;
        }
      } else {
        const valueJson = JSON.stringify(value);
        const index = array.findIndex(
          (item) => JSON.stringify(item) === valueJson
        );
        if (index > -1) {
          next = [...array.slice(0, index), ...array.slice(index + 1)];
          modified = true;
        }
      }
      return { nextArray: next, result: next, modified };
    }
    default:
      logger?.error(`Unknown mode: ${mode}`);
      return { nextArray: [...array], result: undefined, modified: false };
  }
}
