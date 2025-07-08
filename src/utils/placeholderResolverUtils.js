// src/utils/placeholderResolverUtils.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { ensureValidLogger } from './loggerUtils.js';
import { safeResolvePath } from './objectUtils.js';
import {
  PLACEHOLDER_FIND_REGEX,
  FULL_STRING_PLACEHOLDER_REGEX,
  parsePlaceholderKey,
} from './placeholderPatterns.js';
import {
  extractContextPath,
  resolvePlaceholderPath,
} from './placeholderPathResolver.js';
import { StructureResolver } from './structureResolver.js';

export {
  PLACEHOLDER_FIND_REGEX,
  FULL_STRING_PLACEHOLDER_REGEX,
  parsePlaceholderKey,
} from './placeholderPatterns.js';
export {
  extractContextPath,
  resolvePlaceholderPath,
} from './placeholderPathResolver.js';

/**
 * @class PlaceholderResolver
 * @description A utility class dedicated to resolving placeholders in strings and structures.
 */
export class PlaceholderResolver {
  /** @type {ILogger} */
  #logger;
  /** @type {StructureResolver} */
  #resolver;

  /**
   * Initializes a new instance of the PlaceholderResolver.
   *
   * @param {ILogger} [logger] - Optional logger instance. When omitted, a
   * console-based fallback is used.
   */
  constructor(logger) {
    this.#logger = ensureValidLogger(logger, 'PlaceholderResolver');
    /**
     * Resolve a dotted path on an object.
     *
     * @param {object} obj
     * @param {string} path
     * @returns {*}
     */
    const resolvePath = (obj, path) => {
      const { value } = safeResolvePath(
        obj,
        path,
        this.#logger,
        'PlaceholderResolver.resolvePath'
      );
      return value;
    };
    this.#resolver = new StructureResolver(resolvePath, this.#logger);
  }

  // Static helpers exposed for convenience
  static extractContextPath = extractContextPath;
  static resolvePlaceholderPath = resolvePlaceholderPath;

  /**
   * Resolves placeholders in a string using data from source objects.
   *
   * @param {string} str - String that may contain placeholders.
   * @param {...object} dataSources - Data sources to resolve against.
   * @returns {string} The resolved string.
   */
  resolve(str, ...dataSources) {
    return this.#resolver.resolve(str, ...dataSources);
  }

  /**
   * Recursively resolves placeholders within a complex structure.
   *
   * @param {*} input - The value that may contain placeholders.
   * @param {object|object[]} context - Primary data source or array of sources.
   * @param {object} [fallback] - Optional fallback data source.
   * @param {Iterable<string>} [skipKeys] - Keys to leave unresolved at the current object level.
   * @returns {*} The input with all placeholders resolved.
   */
  resolveStructure(input, context, fallback = {}, skipKeys = []) {
    const skipArray = Array.isArray(skipKeys) ? skipKeys : [...skipKeys];
    return this.#resolver.resolveStructure(input, context, fallback, skipArray);
  }

  // Proxy private helpers for existing unit tests
  /**
   * Expose StructureResolver's private method for tests.
   *
   * @param {string} value
   * @param {object[]} sources
   * @returns {{changed: boolean, value: any}}
   */
  _handleFullString(value, sources) {
    return /** @type {any} */ (this.#resolver)._handleFullString(
      value,
      sources
    );
  }

  /**
   * Expose StructureResolver's private method for tests.
   *
   * @param {string} value
   * @param {object[]} sources
   * @returns {{changed: boolean, value: string}}
   */
  _replaceEmbedded(value, sources) {
    return /** @type {any} */ (this.#resolver)._replaceEmbedded(value, sources);
  }
}

// --- FILE END ---
