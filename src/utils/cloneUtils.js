// src/utils/cloneUtils.js

import { PersistenceErrorCodes } from '../persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * @file Utility functions for cloning and freezing objects.
 * @description Re-exported from {@link src/utils/index.js}. Import from there
 * for convenience.
 */

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
 * functions or circular references. When `structuredClone` is not available
 * and JSON serialization is used, function values are omitted and
 * properties that cannot be stringified are silently dropped. Circular
 * references will cause an error to be thrown.
 * @template T
 * @param {T} value - The value to clone.
 * @returns {T} The cloned value or the original primitive.
 * @throws {Error} If the value cannot be stringified (e.g. circular structure).
 */
export function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
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
  const moduleLogger = ensureValidLogger(logger, 'CloneUtils');
  try {
    /** @type {T} */
    const cloned = deepClone(value);
    return createPersistenceSuccess(cloned);
  } catch (error) {
    moduleLogger.error('DeepClone failed:', error);
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
    Object.keys(object).forEach((key) => {
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

// Add other clone-related utilities here in the future if needed.
