/**
 * @module executionPlaceholderResolver
 * @description Utility class for resolving placeholders using an execution context.
 */

import { ensureValidLogger } from './loggerUtils.js';
import { buildResolutionSources } from './placeholderSources.js';
import { resolvePlaceholderPath } from './placeholderPathResolver.js';
import { PlaceholderResolver } from './placeholderResolverUtils.js';

/**
 * @class ExecutionPlaceholderResolver
 * @description Resolves placeholders relative to an execution context.
 */
export class ExecutionPlaceholderResolver {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {PlaceholderResolver} */
  #resolver;

  /**
   * Creates an instance of ExecutionPlaceholderResolver.
   *
   * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger.
   */
  constructor(logger) {
    const validatedLogger = ensureValidLogger(
      logger,
      'ExecutionPlaceholderResolver'
    );
    this.#logger = createContextAwareLogger(validatedLogger);
    this.#resolver = new PlaceholderResolver(this.#logger);
  }

  /**
   * Builds resolution sources from an execution context.
   *
   * @param {object} executionContext - The execution context.
   * @returns {{sources: object[], fallback: object}} Sources and fallback objects.
   */
  buildSources(executionContext) {
    return buildResolutionSources(executionContext);
  }

  /**
   * Resolves a single placeholder path against the execution context.
   *
   * @param {string} placeholderPath - Path from the placeholder.
   * @param {object} executionContext - The execution context.
   * @param {string} [logPath] - Identifier for logging purposes.
   * @returns {*} Resolved value or undefined.
   */
  resolvePathFromContext(placeholderPath, executionContext, logPath = '') {
    return resolvePlaceholderPath(
      placeholderPath,
      executionContext,
      this.#logger,
      logPath
    );
  }

  /**
   * Resolves placeholders within an input value using an execution context.
   *
   * @param {*} input - Value potentially containing placeholders.
   * @param {object} executionContext - Context to resolve against.
   * @param {{skipKeys?: Iterable<string>}} [options] - Additional options.
   * @returns {*} The resolved structure.
   */
  resolveFromContext(input, executionContext, { skipKeys } = {}) {
    const { sources, fallback } = this.buildSources(executionContext);
    return this.#resolver.resolveStructure(input, sources, fallback, skipKeys);
  }
}

export { extractContextPath } from './placeholderPathResolver.js';

/**
 * @description Creates a logger wrapper that suppresses warning messages about missing
 * `executionContext.evaluationContext.context` when resolving placeholders. Those
 * scenarios are treated as debug-level noise by higher level callers and should not
 * surface as warnings during placeholder resolution.
 * @param {import('../interfaces/coreServices.js').ILogger} baseLogger - Logger to wrap.
 * @returns {import('../interfaces/coreServices.js').ILogger} Logger with filtered warnings.
 */
function createContextAwareLogger(baseLogger) {
  const suppressedPatterns = [
    /executionContext\.evaluationContext\.context is missing or invalid/, // context store absent
    /Cannot resolve placeholder path "context\./, // context-prefixed path lookup
  ];

  const shouldSuppressWarn = (message) => {
    if (typeof message !== 'string') {
      return false;
    }

    return suppressedPatterns.some((pattern) => pattern.test(message));
  };

  return {
    debug: (message, ...args) => baseLogger.debug(message, ...args),
    info: (message, ...args) => baseLogger.info(message, ...args),
    warn: (message, ...args) => {
      if (shouldSuppressWarn(message)) {
        return;
      }

      baseLogger.warn(message, ...args);
    },
    error: (message, ...args) => baseLogger.error(message, ...args),
  };
}
