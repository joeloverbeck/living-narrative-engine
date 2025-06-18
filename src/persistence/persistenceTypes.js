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

/**
 * Result returned when parsing a manual save file.
 *
 * @typedef {object} ParseSaveFileResult
 * @property {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} metadata
 *   - Parsed metadata extracted from the save file.
 * @property {boolean} isCorrupted - Indicates the save file was malformed or
 *   metadata could not be properly validated.
 */
