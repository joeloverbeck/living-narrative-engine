// src/utils/handlerUtils/serviceUtils.js

/**
 * @module HandlerUtils
 * @description Utility helpers for operation handlers.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import { validateServiceDeps } from '../serviceInitializerUtils.js';
import { setupPrefixedLogger } from '../loggerUtils.js';

/**
 * Initialize a handler-specific logger and validate its dependencies.
 *
 * @param {string} handlerName - Name used for log prefixing and validation.
 * @param {ILogger | undefined | null} logger - Logger instance to wrap.
 * @param {Record<string, import('../serviceInitializerUtils.js').DependencySpec>} [deps]
 *   - Optional dependency specification map.
 * @returns {ILogger} Prefixed logger instance.
 */
export function initHandlerLogger(handlerName, logger, deps) {
  const prefixed = setupPrefixedLogger(logger, `${handlerName}: `);
  validateServiceDeps(handlerName, prefixed, deps);
  return prefixed;
}

export { validateServiceDeps as validateDeps };

/**
 * @description Retrieve the logger to use during execution. If the
 * execution context provides a logger, it takes precedence over the
 * handler's default logger.
 * @param {ILogger} defaultLogger - Default logger from the handler.
 * @param {import('../../logic/defs.js').ExecutionContext} [executionContext] - Optional execution context.
 * @returns {ILogger} Logger instance for execution.
 */
export function resolveExecutionLogger(defaultLogger, executionContext) {
  return executionContext?.logger ?? defaultLogger;
}

// --- FILE END ---
