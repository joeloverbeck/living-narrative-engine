// src/persistence/persistenceTypes.js

/**
 * @file JSDoc typedefs used across persistence services.
 */

/**
 * Generic result returned by persistence operations.
 *
 * @template T
 * @typedef {object} PersistenceResult
 * @property {boolean} success - Indicates if the operation succeeded.
 * @property {T} [data] - Optional data returned on success.
 * @property {import('./persistenceErrors.js').PersistenceError} [error] - Error instance when the operation fails.
 * @property {string} [userFriendlyError] - Message safe to display to users.
 */
export {};
