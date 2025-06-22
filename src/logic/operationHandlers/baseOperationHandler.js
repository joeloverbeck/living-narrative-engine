// src/logic/operationHandlers/baseOperationHandler.js

/**
 * @file Base class providing common dependency validation and logging helpers
 *       for operation handlers.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import {
  initHandlerLogger,
  validateDeps,
  getExecLogger,
} from '../../utils/handlerUtils/serviceUtils.js';

/**
 * @class BaseOperationHandler
 * @description Utility superclass that standardizes dependency validation and
 * logging setup for operation handlers.
 */
class BaseOperationHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {Record<string, *>} */
  #deps;

  /**
   * Create a new BaseOperationHandler instance.
   *
   * @param {string} name - Unique handler name for log prefixing.
   * @param {Record<string, {value: *, requiredMethods?: string[], isFunction?: boolean}>} deps
   *   - Dependency specification map. Must include a `logger` entry with the raw
   *     logger instance.
   */
  constructor(name, deps) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('BaseOperationHandler requires a non-empty name.');
    }
    const logger = deps?.logger?.value ?? deps?.logger;
    this.#logger = initHandlerLogger(name, logger);
    validateDeps(name, this.#logger, deps);
    this.#deps = {};
    for (const [key, spec] of Object.entries(deps || {})) {
      this.#deps[key] = spec?.value ?? spec;
    }
  }

  /**
   * Access the validated dependencies by name.
   *
   * @returns {Record<string, *>} Dependency instances keyed by name.
   */
  get deps() {
    return this.#deps;
  }

  /**
   * Access the base logger used by this handler.
   *
   * @returns {ILogger} Logger instance.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Retrieve the logger appropriate for a specific execution context.
   *
   * @param {ExecutionContext} [executionContext] - Optional execution context which may
   *   provide a contextual logger.
   * @returns {ILogger} Logger instance for the current execution.
   */
  getLogger(executionContext) {
    return getExecLogger(this.#logger, executionContext);
  }
}

export default BaseOperationHandler;
