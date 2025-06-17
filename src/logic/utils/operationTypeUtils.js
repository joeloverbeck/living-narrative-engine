// src/logic/utils/operationTypeUtils.js

/**
 * Normalize and validate an operation type string.
 *
 * @description Trims the provided `type` and ensures it is a non-empty
 * string. Logs an error using the provided logger and label when validation
 * fails.
 * @param {*} type - The operation type to normalize.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for errors.
 * @param {string} label - Context label for error messages.
 * @returns {string|null} The trimmed type or `null` when invalid.
 */
export function getNormalizedOperationType(type, logger, label) {
  const msgPrefix = `${label}: operationType must be a non-empty string.`;

  if (typeof type !== 'string') {
    logger.error(msgPrefix);
    return null;
  }

  const trimmed = type.trim();
  if (!trimmed) {
    logger.error(msgPrefix);
    return null;
  }

  return trimmed;
}

export default getNormalizedOperationType;
