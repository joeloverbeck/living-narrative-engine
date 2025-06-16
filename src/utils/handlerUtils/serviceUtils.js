// src/utils/handlerUtils/serviceUtils.js

/**
 * @module HandlerUtils
 * @description Utility helpers for operation handlers.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import {
  setupService,
  validateServiceDeps,
} from '../serviceInitializerUtils.js';

/**
 * @description Initialize a handler logger using the standard service
 * initializer utilities. Logs will automatically be prefixed with the
 * handler name.
 * @param {string} name - Name of the handler.
 * @param {ILogger} logger - Base logger instance.
 * @returns {ILogger} Prefixed logger instance.
 */
export function initHandlerLogger(name, logger) {
  return setupService(name, logger);
}

/**
 * @description Validate handler dependencies using the common service
 * dependency validator.
 * @param {string} name - Name used for validation messages.
 * @param {ILogger} logger - Logger for validation output.
 * @param {Record<string, import('../serviceInitializerUtils.js').DependencySpec>} deps
 *   - Map of dependency specs.
 * @returns {void}
 */
export function validateDeps(name, logger, deps) {
  validateServiceDeps(name, logger, deps);
}

/**
 * @description Retrieve the logger to use during execution. If the
 * execution context provides a logger, it takes precedence over the
 * handler's default logger.
 * @param {ILogger} defaultLogger - Default logger from the handler.
 * @param {import('../../logic/defs.js').ExecutionContext} [execCtx] - Optional execution context.
 * @returns {ILogger} Logger instance for execution.
 */
export function getExecLogger(defaultLogger, execCtx) {
  return execCtx?.logger ?? defaultLogger;
}

// --- FILE END ---
