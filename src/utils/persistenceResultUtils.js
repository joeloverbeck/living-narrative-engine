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

  if (result.error instanceof PersistenceError) {
    return { success: false, error: result.error, data: null };
  }

  return {
    success: false,
    error: new PersistenceError(fallbackCode, defaultMsg),
    data: null,
  };
}
