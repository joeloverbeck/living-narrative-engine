export const PersistenceErrorCodes = {
  INVALID_SAVE_NAME: 'INVALID_SAVE_NAME',
  INVALID_SAVE_IDENTIFIER: 'INVALID_SAVE_IDENTIFIER',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  EMPTY_FILE: 'EMPTY_FILE',
  DECOMPRESSION_ERROR: 'DECOMPRESSION_ERROR',
  DESERIALIZATION_ERROR: 'DESERIALIZATION_ERROR',
  INVALID_GAME_STATE: 'INVALID_GAME_STATE',
  CHECKSUM_GENERATION_FAILED: 'CHECKSUM_GENERATION_FAILED',
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
  CHECKSUM_CALCULATION_ERROR: 'CHECKSUM_CALCULATION_ERROR',
  DIRECTORY_CREATION_FAILED: 'DIRECTORY_CREATION_FAILED',
  WRITE_ERROR: 'WRITE_ERROR',
  DELETE_FILE_NOT_FOUND: 'DELETE_FILE_NOT_FOUND',
  DELETE_FAILED: 'DELETE_FAILED',
  DEEP_CLONE_FAILED: 'DEEP_CLONE_FAILED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
};

// Freeze to prevent accidental modification of error codes
Object.freeze(PersistenceErrorCodes);

export default PersistenceErrorCodes;

/**
 * Custom error class for persistence-related operations.
 *
 * @class PersistenceError
 * @augments Error
 * @param {string} code - Machine readable code from PersistenceErrorCodes.
 * @param {string} message - Human readable message.
 */
export class PersistenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PersistenceError);
    }
  }
}
