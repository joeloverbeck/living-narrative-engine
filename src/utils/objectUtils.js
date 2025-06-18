// src/utils/objectUtils.js

import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../persistence/persistenceResultUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * @file Utility functions for working with plain JavaScript objects.
 */

/**
 * Resolves a dotted path inside a plain object or array without traversing the
 * prototype chain. Combines behaviour of the previous `resolvePath` and
 * `getObjectPropertyByPath` helpers.
 *
 * @param {Record<string, any> | any[] | null | undefined} obj - The root object
 *   or array to retrieve the property from.
 * @param {string} propertyPath - Dot-separated path (e.g. "a.b.c" or
 *   "list.0.name"). Whitespace is trimmed.
 * @returns {any | undefined} The value at the given path, or `undefined` if any
 *   segment is missing or not traversable.
 * @throws {TypeError} If `propertyPath` is not a non-empty string.
 */
export function resolvePath(obj, propertyPath) {
  if (typeof propertyPath !== 'string' || propertyPath.trim() === '') {
    throw new TypeError('resolvePath: propertyPath must be a non-empty string');
  }

  if (obj === null || typeof obj === 'undefined') {
    return undefined;
  }

  const pathParts = propertyPath.trim().split('.');
  if (pathParts.some((part) => part === '')) {
    return undefined;
  }

  let current = obj;
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];

    const isObject = current !== null && typeof current === 'object';
    if (!isObject) {
      return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
      if (current === undefined && i < pathParts.length - 1) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Freezes an object to make it immutable.
 *
 * @description
 * Immutability ensures that value objects cannot be modified after creation,
 * which helps prevent unintended side-effects and makes state management
 * more predictable.
 * @template T
 * @param {T} o - The object to freeze.
 * @returns {Readonly<T>} The frozen object.
 */
export function freeze(o) {
  return Object.freeze(o);
}

/**
 * Creates a deep clone of a plain object or array using JSON
 * serialization.
 *
 * @description
 * Suitable for cloning simple data structures that do not contain
 * functions or circular references. Non-serializable values will be
 * dropped during cloning.
 * @template T
 * @param {T} value - The value to clone.
 * @returns {T} The cloned value or the original primitive.
 * @throws {Error} If the value cannot be stringified (e.g. circular structure).
 */
export function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * Safely deep clones an object and logs errors on failure.
 *
 * @description Wraps {@link deepClone} and returns a
 * {@link import('../persistence/persistenceErrors.js').PersistenceError} when
 * cloning fails.
 * @template T
 * @param {T} value - Value to clone.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used
 *   for error reporting.
 * @returns {import('../persistence/persistenceTypes.js').PersistenceResult<T>}
 *   Clone result object.
 */
export function safeDeepClone(value, logger) {
  const log = ensureValidLogger(logger, 'ObjectUtils');
  try {
    /** @type {T} */
    const cloned = deepClone(value);
    return createPersistenceSuccess(cloned);
  } catch (error) {
    if (logger && typeof logger.error === 'function') {
      logger.error('DeepClone failed:', error);
    }
    return createPersistenceFailure(
      PersistenceErrorCodes.DEEP_CLONE_FAILED,
      'Failed to deep clone object.'
    );
  }
}

/**
 * Deeply freezes an object and all its nested properties that are objects.
 * This makes the object and its content immutable.
 *
 * @template T
 * @param {T} object - The object to deep freeze.
 * @returns {Readonly<T>} The deeply frozen object.
 */
export function deepFreeze(object) {
  if (object && typeof object === 'object') {
    // Freeze properties before freezing self
    Object.keys(object).forEach(key => {
      const value = object[key];
      // Recurse for nested objects
      if (value && typeof value === 'object') {
        deepFreeze(value);
      }
    });
    Object.freeze(object);
  }
  return object;
}

// Add other generic object utilities here in the future if needed.
