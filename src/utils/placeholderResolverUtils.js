// src/utils/placeholderResolverUtils.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { resolvePath as objectResolvePath } from './objectUtils.js';

/**
 * Regex to find placeholders like {path.to.value} within a string.
 * Group 1 captures the path without braces.
 * The global flag ensures all occurrences are matched.
 *
 * @type {RegExp}
 */
export const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}/g;

/**
 * Regex to check if an entire string is only a placeholder.
 * Group 1 captures the path within the braces.
 *
 * @type {RegExp}
 */
export const FULL_STRING_PLACEHOLDER_REGEX = /^{\s*([^}\s]+)\s*}$/;

/**
 * @class PlaceholderResolver
 * @description A utility class dedicated to resolving placeholders in strings.
 * It replaces placeholders (e.g., `{key}`) with values from provided data objects.
 * This class is designed to be reusable and independently testable.
 */
export class PlaceholderResolver {
  /**
   * @private
   * @type {ILogger}
   * @description Logger instance. Defaults to console if no logger is provided.
   */
  #logger;

  /**
   * Initializes a new instance of the PlaceholderResolver.
   *
   * @param {ILogger} [logger] - An optional logger instance. If not provided, `console` will be used.
   */
  constructor(logger = console) {
    this.#logger = logger;
  }

  /**
   * Resolves a dotted path against a given object.
   *
   * @param {object} obj - Root object to resolve against.
   * @param {string} path - Dot separated path.
   * @returns {any|undefined} Resolved value or undefined if not found.
   */
  resolvePath(obj, path) {
    try {
      return objectResolvePath(obj, path);
    } catch (err) {
      this.#logger.error(
        `PlaceholderResolver: Error resolving path "${path}"`,
        err
      );
      return undefined;
    }
  }

  /**
   * Resolves placeholders in a string using data from one or more source objects.
   * Placeholders are expected in the format `{key}`.
   *
   * For each placeholder:
   * - The `key` (trimmed of whitespace) is searched in each `dataSource` object, in the order they are provided.
   * - If the `key` is found, the placeholder is replaced with its corresponding value.
   * - If the value is `null` or `undefined`, it's replaced with an empty string.
   * - Other values (numbers, booleans, etc.) are converted to strings.
   * - If the `key` is not found in any `dataSource`, the placeholder is replaced with an empty string,
   * and a warning is logged via the injected logger.
   *
   * If the input `str` is not a string or is empty, an empty string is returned.
   * Non-object items in `dataSources` are gracefully skipped during the key search.
   *
   * @param {string} str - The string potentially containing placeholders (e.g., "Hello {name}, welcome to {place}!").
   * @param {...object} dataSources - A variable number of data source objects to search for placeholder values.
   * Earlier objects in the list take precedence.
   * @returns {string} The string with all recognized placeholders processed, or an empty string if the input `str` was invalid.
   */
  resolve(str, ...dataSources) {
    if (!str || typeof str !== 'string') {
      return '';
    }

    return str.replace(PLACEHOLDER_FIND_REGEX, (match, placeholderKey) => {
      let trimmedKey = placeholderKey.trim();
      const isOptional = trimmedKey.endsWith('?');
      if (isOptional) {
        trimmedKey = trimmedKey.slice(0, -1);
      }
      for (const dataSource of dataSources) {
        if (dataSource && typeof dataSource === 'object') {
          const value = this.resolvePath(dataSource, trimmedKey);
          if (value !== undefined) {
            if (value === null) {
              return '';
            }
            return String(value);
          } else {
            const parts = trimmedKey.split('.');
            const last = parts.pop();
            const parentPath = parts.join('.');
            const parent =
              parentPath === ''
                ? dataSource
                : this.resolvePath(dataSource, parentPath);
            if (
              parent &&
              typeof parent === 'object' &&
              Object.prototype.hasOwnProperty.call(parent, last)
            ) {
              return '';
            }
          }
        }
      }
      if (!isOptional) {
        this.#logger.warn(
          `PlaceholderResolver: Placeholder "{${trimmedKey}}" not found in provided data sources. Replacing with empty string.`
        );
      }
      return '';
    });
  }
}

// --- FILE END ---
