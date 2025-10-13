/**
 * @module executionPlaceholderResolver
 * @description Utility class for resolving placeholders using an execution context.
 */

import { ensureValidLogger } from './loggerUtils.js';
import { buildResolutionSources } from './placeholderSources.js';
import { resolvePlaceholderPath } from './placeholderPathResolver.js';
import {
  PlaceholderResolver,
  PLACEHOLDER_FIND_REGEX,
  parsePlaceholderKey,
} from './placeholderResolverUtils.js';

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
    this.#logger = ensureValidLogger(logger, 'ExecutionPlaceholderResolver');
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
    warnForMissingContextPlaceholders(
      input,
      executionContext,
      this.#logger
    );
    const { sources, fallback } = this.buildSources(executionContext);
    return this.#resolver.resolveStructure(input, sources, fallback, skipKeys);
  }
}

export { extractContextPath } from './placeholderPathResolver.js';

/**
 * Recursively walks the provided input value to trigger warnings for placeholders that
 * rely on `executionContext.evaluationContext.context` when that object is missing.
 * This mirrors the expectations of higher-level integration tests that depend on
 * warning emissions for unresolved `context.` placeholders.
 *
 * @param {*} input - Arbitrary structure that may contain placeholders.
 * @param {object} executionContext - Execution context passed to the resolver.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used for warnings.
 * @param {string} [path='root'] - Human-readable path for logging context.
 * @returns {void}
 */
function warnForMissingContextPlaceholders(
  input,
  executionContext,
  logger,
  path = 'root'
) {
  if (typeof input === 'string') {
    PLACEHOLDER_FIND_REGEX.lastIndex = 0;
    let match;
    while ((match = PLACEHOLDER_FIND_REGEX.exec(input))) {
      const { key } = parsePlaceholderKey(match[1]);
      if (key.startsWith('context.')) {
        const hasContext =
          executionContext?.evaluationContext?.context &&
          typeof executionContext.evaluationContext.context === 'object';
        if (!hasContext) {
          logger.warn(
            `Placeholder "{${key}}" not found: executionContext.evaluationContext.context is missing or invalid. Path: ${path}`
          );
        }
        resolvePlaceholderPath(key, executionContext, logger, path);
      }
    }
    PLACEHOLDER_FIND_REGEX.lastIndex = 0;
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      const nextPath = `${path}[${index}]`;
      warnForMissingContextPlaceholders(
        item,
        executionContext,
        logger,
        nextPath
      );
    });
    return;
  }

  if (input && typeof input === 'object') {
    for (const key of Object.keys(input)) {
      const nextPath = path === 'root' ? key : `${path}.${key}`;
      warnForMissingContextPlaceholders(
        input[key],
        executionContext,
        logger,
        nextPath
      );
    }
  }
}
