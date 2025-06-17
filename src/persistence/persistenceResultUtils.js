// src/persistence/persistenceResultUtils.js

import { PersistenceError } from './persistenceErrors.js';

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

export default createPersistenceFailure;
