// src/utils/objectUtils.js

import { ensureValidLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * @file Utility functions for working with plain JavaScript objects.
 * @description Re-exported from {@link src/utils/index.js}. Import from there
 * for convenience.
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
      const anyCurrent = /** @type {any} */ (current);
      current = anyCurrent[part];
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
 * Safely resolves a path within an object and logs errors on failure.
 *
 * @description Wraps {@link resolvePath} in a try/catch block. When
 * resolution throws an error, the error is logged using
 * {@link ensureValidLogger} and `undefined` is returned.
 * @param {Record<string, any> | any[] | null | undefined} obj - Root object to
 *   resolve against.
 * @param {string} propertyPath - Dot separated path.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger for
 *   error reporting.
 * @param {string} [contextInfo] - Additional context included in log messages.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] - Dispatcher for system error events.
 * @returns {{ value: any | undefined, error: any | undefined }} Result object
 *   containing the resolved value or `undefined` when resolution fails, and the
 *   caught error if an exception occurred.
 */
export function safeResolvePath(
  obj,
  propertyPath,
  logger,
  contextInfo = '',
  dispatcher
) {
  const moduleLogger = ensureValidLogger(logger, 'ObjectUtils');
  try {
    const value = resolvePath(obj, propertyPath);
    return { value, error: undefined };
  } catch (error) {
    const info = contextInfo ? ` (${contextInfo})` : '';
    const message = `Error resolving path "${propertyPath}"${info}`;
    if (dispatcher) {
      const err = /** @type {any} */ (error);
      safeDispatchError(dispatcher, message, {
        raw: err?.message || err,
        stack: err?.stack,
      });
    } else {
      moduleLogger.error(message, error);
    }
    return { value: undefined, error };
  }
}

// Add other generic object utilities here in the future if needed.
