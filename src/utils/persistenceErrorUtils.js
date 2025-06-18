// src/utils/persistenceErrorUtils.js

import { createPersistenceFailure } from './persistenceResultUtils.js';
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

export default wrapPersistenceOperation;
