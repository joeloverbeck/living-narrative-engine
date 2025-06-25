// src/logic/operationHandlers/logHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').BaseHandlerDeps} BaseHandlerDeps */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

/**
 * Parameters for the LOG operation.
 * Placeholders in `message` are assumed to be pre-resolved by OperationInterpreter.
 *
 * @typedef {object} LogOperationParams
 * @property {string|*} message - The message to log (required, potentially pre-resolved to non-string).
 * @property {'info'|'warn'|'error'|'debug'} [level='info'] - The logging level.
 */

const VALID_LOG_LEVELS = ['info', 'warn', 'error', 'debug'];
const DEFAULT_LOG_LEVEL = 'info';

/**
 * @implements {OperationHandler}
 */
class LogHandler extends BaseOperationHandler /* implements OperationHandler */ {
  /**
   * Creates an instance of LogHandler.
   *
   * @param {BaseHandlerDeps} deps - Dependencies object
   * @param {ILogger} deps.logger - The logger instance.
   * @throws {Error} If the logger is invalid or missing required methods.
   */
  constructor({ logger }) {
    super('LogHandler', {
      logger: {
        value: logger,
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      },
    });
  }

  /**
   * Executes the LOG operation: validates parameters and logs the pre-resolved message
   * using the injected logger at the specified or default level.
   *
   * @param {OperationParams | LogOperationParams | null | undefined} params - Parameters: { message: *, level?: string }. Message is pre-resolved.
   * @param {ExecutionContext} context - The execution context (used for logging services if needed, not resolution).
   * @returns {void}
   */
  execute(params, context) {
    const logger = this.getLogger(context);
    if (!assertParamsObject(params, logger, 'LOG')) return;

    // --- MODIFIED: Validate Parameters FIRST ---
    // Check if params exist and contain a non-null, non-undefined message.
    if (params.message === undefined || params.message === null) {
      logger.error(
        'LogHandler: Invalid or missing "message" parameter in LOG operation after resolution.',
        { paramsReceived: params }
      );
      return; // --- ADDED: Stop execution if validation fails ---
    }

    // --- Original Logic (slightly adjusted) ---

    // Convert the resolved message to string for logging
    // This handles cases where the message resolved to a number, boolean, object, etc.
    const messageToLog = String(params.message);

    // Check if the string conversion resulted in an empty string *after* initial validation
    if (messageToLog === '') {
      // Log a warning but allow logging empty strings as per previous logic.
      logger.warn(
        'LogHandler: "message" parameter resolved to an empty string.',
        { params }
      );
      // If you want to PREVENT logging empty strings, add 'return;' here.
    }

    // Determine Log Level & Warn on Invalid (check level *after* validating params itself)
    const requestedLevel =
      typeof params?.level === 'string'
        ? params.level.toLowerCase()
        : DEFAULT_LOG_LEVEL; // Safely access level
    const level = VALID_LOG_LEVELS.includes(requestedLevel)
      ? requestedLevel
      : DEFAULT_LOG_LEVEL;

    if (level !== requestedLevel && typeof params?.level === 'string') {
      // Use optional chaining for safety
      logger.warn(
        `LogHandler: Invalid log level "${params.level}" provided. Defaulting to "${DEFAULT_LOG_LEVEL}".`,
        { requestedLevel: params.level }
      );
    }

    // Call Logger Method
    try {
      // --- CORRECTED LINE ---
      // Directly call the method on the logger to preserve its 'this' context
      logger[level](messageToLog);
    } catch (logError) {
      const errorMsg = `LogHandler: Failed to write log message via ILogger instance (Level: ${level}). Check logger implementation.`;
      // Use console.error as the logger itself might be failing
      console.error(errorMsg, {
        message: messageToLog,
        originalError: logError,
      });
      // Attempt to log the original message to console as a last resort
      console.log(`[${level.toUpperCase()}] ${messageToLog}`);
    }
  }
}

export default LogHandler;
