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
 * @description Checks whether a value is a plain object (object literal or has a null prototype).
 * @param {any} value - Value to inspect.
 * @returns {boolean} True when the value is a plain object.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @description Performs a deep equality comparison between two values.
 * @param {any} a - First value to compare.
 * @param {any} b - Second value to compare.
 * @param {WeakMap<object, WeakSet<object>>} [seen] - Memoization structure to guard against circular references.
 * @returns {boolean} True when both values are deeply equal.
 */
function areDeeplyEqual(a, b, seen = new WeakMap()) {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i += 1) {
      if (!areDeeplyEqual(a[i], b[i], seen)) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    return false;
  }

  const seenForA = seen.get(a);
  if (seenForA && seenForA.has(b)) {
    return true;
  }

  const nextSeenForA = seenForA || new WeakSet();
  nextSeenForA.add(b);
  if (!seenForA) {
    seen.set(a, nextSeenForA);
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }

    if (!areDeeplyEqual(a[key], b[key], seen)) {
      return false;
    }
  }

  return true;
}

/**
 * Applies an array modification operation.
 *
 * @description Utility to mutate an array according to the given mode. It returns
 * a new array reflecting the modification and leaves the original untouched.
 * @param {'push'|'push_unique'|'pop'|'remove_by_value'} mode - Operation type.
 * @param {any[]} array - Array to operate on.
 * @param {any} value - Value used for push-like operations.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for errors.
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
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger for errors.
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
        exists = array.some((item) => areDeeplyEqual(item, value));
      }
      if (exists) {
        return { nextArray: array, result: array, modified: false };
      }
      const next = [...array, value];
      return { nextArray: next, result: next, modified: true };
    }
    case 'pop': {
      if (array.length === 0) {
        return { nextArray: array, result: undefined, modified: false };
      }
      const popped = array[array.length - 1];
      const next = array.slice(0, -1);
      return { nextArray: next, result: popped, modified: true };
    }
    case 'remove_by_value': {
      let index = -1;
      if (typeof value !== 'object' || value === null) {
        index = array.indexOf(value);
      } else {
        index = array.findIndex((item) => areDeeplyEqual(item, value));
      }

      if (index === -1) {
        return { nextArray: array, result: array, modified: false };
      }

      const next = [...array.slice(0, index), ...array.slice(index + 1)];
      return { nextArray: next, result: next, modified: true };
    }
    default:
      logger?.error(`Unknown mode: ${mode}`);
      return { nextArray: array, result: undefined, modified: false };
  }
}
