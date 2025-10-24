// src/utils/persistenceErrorUtils.js

import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';
import { safeExecute } from './safeExecutionUtils.js';
import { PersistenceErrorCodes } from '../persistence/persistenceErrors.js';

/**
 * Parameters for {@link executePersistenceOp}.
 *
 * @typedef {object} ExecutePersistenceOpParams
 * @property {() => Promise<any>} [asyncOperation] - Async operation to run.
 * @property {() => any} [syncOperation] - Synchronous operation to run.
 * @property {import('../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
 * @property {string} [errorCode] - Error code on failure.
 * @property {string} [userMessage] - User-friendly error message.
 * @property {string} [context] - Context for logging.
 */

/**
 * Executes a synchronous or asynchronous persistence operation.
 *
 * @param {ExecutePersistenceOpParams} params - Operation details.
 * @returns {Promise<any> | any} Normalized result.
 */
export function executePersistenceOp({
  asyncOperation,
  syncOperation,
  logger,
  errorCode = PersistenceErrorCodes.UNEXPECTED_ERROR,
  userMessage,
  context = 'executePersistenceOp',
}) {
  const op = asyncOperation || syncOperation;
  if (!op) {
    throw new Error('executePersistenceOp: No operation provided.');
  }

  if (asyncOperation) {
    return /** @type {Promise<import('./safeExecutionUtils.js').ExecutionResult>} */ (
      safeExecute(op, logger, context)
    ).then(
      /**
       * @param {import('./safeExecutionUtils.js').ExecutionResult} res
       */
      (res) => {
        const { success, result, error } = res;
        if (success) {
          return result;
        }
        logger.error(context, error);
        const message =
          userMessage ||
          (error instanceof Error ? error.message : String(error));
        return {
          ...createPersistenceFailure(errorCode, message),
          userFriendlyError: userMessage,
        };
      }
    );
  }

  const { success, result, error } =
    /** @type {import('./safeExecutionUtils.js').ExecutionResult} */ (
      safeExecute(op, logger, context)
    );

  if (success) {
    return createPersistenceSuccess(result);
  }

  logger.error(context, error);
  const message =
    userMessage || (error instanceof Error ? error.message : String(error));
  return {
    ...createPersistenceFailure(errorCode, message),
    userFriendlyError: userMessage,
  };
}

/**
 * Executes a persistence operation and standardizes unexpected errors.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for error reporting.
 * @param {() => Promise<any>} operation - Async operation to execute.
 * @returns {Promise<any>} Result of the operation or standardized failure object.
 */
export async function wrapPersistenceOperation(logger, operation) {
  return executePersistenceOp({
    asyncOperation: operation,
    logger,
    context: 'wrapPersistenceOperation',
  });
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
  return executePersistenceOp({
    syncOperation: opFn,
    logger,
    errorCode,
    userMessage,
    context: logContext,
  });
}
