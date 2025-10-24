// src/utils/persistenceResultUtils.js

import { PersistenceError } from '../persistence/persistenceErrors.js';

/**
 * Creates a standardized failure result object for persistence operations.
 *
 * @description Convenience helper to wrap error creation.
 * @param {string} code - Error code from {@link PersistenceErrorCodes}.
 * @param {string} message - Human readable error message.
 * @returns {{success: false, error: PersistenceError}} Failure result.
 */
export function createPersistenceFailure(code, message) {
  return { success: false, error: new PersistenceError(code, message) };
}

/**
 * Creates a standardized success result object for persistence operations.
 *
 * @description Mirrors {@link createPersistenceFailure} for success cases.
 * @template T
 * @param {T} data - Data to return on success.
 * @returns {{success: true, data: T}} Success result.
 */
export function createPersistenceSuccess(data) {
  return { success: true, data };
}

/**
 * Normalizes the output of a persistence operation, ensuring failures always
 * return a {@link PersistenceError} instance.
 *
 * @template T
 * @param {{success: boolean, data?: T, error?: any}} result - Raw persistence
 *   result object.
 * @param {string} fallbackCode - Error code used when `result.error` is not a
 *   {@link PersistenceError}.
 * @param {string} defaultMsg - Message for the generated error when no
 *   {@link PersistenceError} is present.
 * @returns {{success: true, data: T} | {success: false, error: PersistenceError, data: null}}
 *   Normalized result object.
 */
export function normalizePersistenceFailure(result, fallbackCode, defaultMsg) {
  if (result.success) {
    return { success: true, data: result.data };
  }

  const { error: rawError } = result;
  if (rawError instanceof PersistenceError) {
    return { success: false, error: rawError, data: null };
  }

  /**
   * Attempts to extract a human readable message from unknown error shapes.
   *
   * @param {unknown} errorValue - Raw error value from the persistence layer.
   * @returns {string} Extracted message or empty string when unavailable.
   */
  function deriveMessage(errorValue) {
    if (!errorValue) {
      return '';
    }

    if (errorValue instanceof Error) {
      return typeof errorValue.message === 'string'
        ? errorValue.message.trim()
        : '';
    }

    if (typeof errorValue === 'string') {
      return errorValue.trim();
    }

    if (typeof errorValue === 'object') {
      const messageKeys = ['message', 'error', 'details', 'reason', 'description'];
      for (const key of messageKeys) {
        const value = /** @type {Record<string, unknown>} */ (errorValue)[key];
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }

      try {
        const serialized = JSON.stringify(errorValue);
        if (serialized && serialized !== '{}' && serialized !== '[]') {
          return serialized;
        }
      } catch {
        // ignore serialization errors
      }
    }

    return '';
  }

  const fallbackMessage =
    typeof defaultMsg === 'string' ? defaultMsg.trim() : 'Unknown error.';
  const derivedMessage = deriveMessage(rawError);

  let finalMessage = fallbackMessage || derivedMessage;
  if (fallbackMessage && derivedMessage && fallbackMessage !== derivedMessage) {
    finalMessage = `${fallbackMessage}: ${derivedMessage}`;
  }

  const normalizedError = new PersistenceError(fallbackCode, finalMessage);
  if (rawError !== undefined) {
    try {
      normalizedError.cause = rawError;
    } catch {
      normalizedError.originalError = rawError;
    }
  }

  return {
    success: false,
    error: normalizedError,
    data: null,
  };
}
