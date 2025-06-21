// src/utils/persistenceErrorUtils.js

import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';
import { PersistenceErrorCodes } from '../persistence/persistenceErrors.js';

/**
 * Executes a persistence operation and standardizes unexpected errors.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for error reporting.
 * @param {() => Promise<any>} operation - Async operation to execute.
 * @returns {Promise<any>} Result of the operation or standardized failure object.
 */
export async function wrapPersistenceOperation(logger, operation) {
  try {
    return await operation();
  } catch (error) {
    logger.error('Persistence operation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    return createPersistenceFailure(
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      message
    );
  }
}

/**
 * Executes a synchronous persistence operation and normalizes the result.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for
 *   error reporting.
 * @param {() => any} opFn - Operation function to execute.
 * @param {string} errorCode - Error code used on failure.
 * @param {string} userMessage - User-friendly error message.
 * @param {string} logContext - Context message used when logging errors.
 * @returns {import('../persistence/persistenceTypes.js').PersistenceResult<any>} Result of the operation.
 */
export function wrapSyncPersistenceOperation(
  logger,
  opFn,
  errorCode,
  userMessage,
  logContext
) {
  try {
    const result = opFn();
    return createPersistenceSuccess(result);
  } catch (error) {
    logger.error(logContext, error);
    return {
      ...createPersistenceFailure(errorCode, userMessage),
      userFriendlyError: userMessage,
    };
  }
}

export default wrapPersistenceOperation;
