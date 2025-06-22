// src/utils/handlerUtils/serviceUtils.js

/**
 * @module HandlerUtils
 * @description Utility helpers for operation handlers.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

export {
  setupService as initHandlerLogger,
  validateServiceDeps as validateDeps,
} from '../serviceInitializerUtils.js';

/**
 * @description Retrieve the logger to use during execution. If the
 * execution context provides a logger, it takes precedence over the
 * handler's default logger.
 * @param {ILogger} defaultLogger - Default logger from the handler.
 * @param {import('../../logic/defs.js').ExecutionContext} [executionContext] - Optional execution context.
 * @returns {ILogger} Logger instance for execution.
 */
export function getExecLogger(defaultLogger, executionContext) {
  return executionContext?.logger ?? defaultLogger;
}

// --- FILE END ---
