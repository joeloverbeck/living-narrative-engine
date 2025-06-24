// src/utils/placeholderResolverUtils.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { safeResolvePath } from './objectUtils.js';
import { resolveEntityNameFallback } from './entityNameFallbackUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

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
    this.#logger = ensureValidLogger(logger, 'PlaceholderResolver');
  }

  /**
   * Builds the data sources for placeholder resolution.
   *
   * @description Creates the base, root context, and fallback sources used by
   *   {@link PlaceholderResolver#resolveStructure}.
   * @param {object} executionContext - Execution context supplying actor, target,
   *   and evaluationContext data.
   * @returns {{sources: object[], fallback: object}} Sources array and fallback
   *   object for {@link PlaceholderResolver#resolveStructure}.
   */
  static buildResolutionSources(executionContext) {
    const contextSource = {
      context:
        executionContext?.evaluationContext?.context &&
        typeof executionContext.evaluationContext.context === 'object'
          ? executionContext.evaluationContext.context
          : {},
    };

    const fallback = {};
    const actorName = resolveEntityNameFallback('actor.name', executionContext);
    if (actorName !== undefined) {
      fallback.actor = { name: actorName };
    }
    const targetName = resolveEntityNameFallback(
      'target.name',
      executionContext
    );
    if (targetName !== undefined) {
      if (!fallback.target) fallback.target = {};
      fallback.target.name = targetName;
    }

    const baseSource = { ...(executionContext ?? {}) };
    delete baseSource.context;
    const rootContextSource =
      executionContext &&
      Object.prototype.hasOwnProperty.call(executionContext, 'context')
        ? { context: executionContext.context }
        : {};
    const sources = [rootContextSource, baseSource, contextSource];

    return { sources, fallback };
  }

  /**
   * Extracts the effective root and path when handling `context.` placeholders.
   *
   * @description Returns an object containing the trimmed path and the root
   * context object. When the prefix is used but `executionContext.evaluationContext.context`
   * is missing, `null` is returned.
   * @param {string} placeholderPath - Original placeholder path.
   * @param {object} executionContext - The current execution context.
   * @returns {{ path: string, root: object } | null} Extracted info or `null` on
   *   invalid context.
   */
  static extractContextPath(placeholderPath, executionContext) {
    if (!placeholderPath.startsWith('context.')) {
      return { path: placeholderPath, root: executionContext };
    }

    const ctx = executionContext?.evaluationContext?.context;
    if (ctx && typeof ctx === 'object') {
      return { path: placeholderPath.substring('context.'.length), root: ctx };
    }

    return null;
  }

  /**
   * Resolves a placeholder path against the provided execution context.
   *
   * @description Handles the `context.` prefix, uses {@link safeResolvePath}, and
   * falls back to {@link resolveEntityNameFallback} when direct resolution fails.
   * @param {string} placeholderPath - Path from the placeholder (e.g.,
   *   `context.varA`).
   * @param {object} executionContext - The execution context root object.
   * @param {ILogger} [logger] - Optional logger for warnings and errors.
   * @param {string} [logPath] - String used in log messages to indicate the
   *   source of the resolution attempt.
   * @returns {any|undefined} The resolved value, or `undefined` when resolution
   *   fails.
   */
  static resolvePlaceholderPath(
    placeholderPath,
    executionContext,
    logger,
    logPath = ''
  ) {
    if (!placeholderPath) {
      logger?.warn(`Failed to extract path from placeholder at ${logPath}`);
      return undefined;
    }

    if (!executionContext || typeof executionContext !== 'object') {
      logger?.warn(
        `Cannot resolve placeholder path "${placeholderPath}" at ${logPath}: executionContext is not a valid object.`
      );
      return undefined;
    }

    const contextInfo = this.extractContextPath(
      placeholderPath,
      executionContext
    );
    if (contextInfo === null) {
      logger?.warn(
        `Placeholder "${placeholderPath}" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${logPath}`
      );
      return undefined;
    }

    const resolvedValue =
      safeResolvePath(
        contextInfo.root,
        contextInfo.path,
        logger,
        `resolvePlaceholderPath for "${placeholderPath}" at ${logPath}`
      ) ?? resolveEntityNameFallback(placeholderPath, executionContext, logger);

    return resolvedValue;
  }

  /**
   * Resolves a dotted path against a given object.
   *
   * @param {object} obj - Root object to resolve against.
   * @param {string} path - Dot separated path.
   * @returns {any|undefined} Resolved value or undefined if not found.
   */
  resolvePath(obj, path) {
    return safeResolvePath(
      obj,
      path,
      this.#logger,
      'PlaceholderResolver.resolvePath'
    );
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

  /**
   * Resolves a value from an array of source objects using a dotted path.
   *
   * @private
   * @param {string} path - Dot separated lookup path.
   * @param {object[]} sources - Ordered list of source objects.
   * @returns {*} Resolved value or `undefined` if not found.
   */
  _resolveFromSources(path, sources) {
    for (const source of sources) {
      if (source && typeof source === 'object') {
        const value = this.resolvePath(source, path);
        if (value !== undefined) {
          return value;
        } else {
          const parts = path.split('.');
          const last = parts.pop();
          const parentPath = parts.join('.');
          const parent =
            parentPath === '' ? source : this.resolvePath(source, parentPath);
          if (
            parent &&
            typeof parent === 'object' &&
            Object.prototype.hasOwnProperty.call(parent, last)
          ) {
            return parent[last];
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Handles string placeholder resolution.
   *
   * @private
   * @param {string} value String potentially containing placeholders.
   * @param {object[]} sources Resolution sources.
   * @returns {{changed: boolean, value: *}} Resulting value and change flag.
   */
  _resolveString(value, sources) {
    const fullMatch = value.match(FULL_STRING_PLACEHOLDER_REGEX);
    const replaced = this.resolve(value, ...sources);
    if (fullMatch) {
      let placeholderPath = fullMatch[1];
      const isOptional = placeholderPath.endsWith('?');
      if (isOptional) {
        placeholderPath = placeholderPath.slice(0, -1);
      }
      const resolved = this._resolveFromSources(placeholderPath, sources);
      if (resolved !== undefined) {
        this.#logger.debug(
          `Resolved full string placeholder {${placeholderPath}${isOptional ? '?' : ''}} to: ${
            typeof resolved === 'object' ? JSON.stringify(resolved) : resolved
          }`
        );
        return { changed: true, value: resolved };
      }
      return { changed: true, value: undefined };
    }

    if (replaced !== value) {
      let match;
      PLACEHOLDER_FIND_REGEX.lastIndex = 0;
      while ((match = PLACEHOLDER_FIND_REGEX.exec(value))) {
        let placeholderPath = match[1];
        const placeholderSyntax = match[0];
        const isOptional = placeholderPath.endsWith('?');
        if (isOptional) {
          placeholderPath = placeholderPath.slice(0, -1);
        }
        const resolved = this._resolveFromSources(placeholderPath, sources);
        if (resolved !== undefined) {
          const stringValue = resolved === null ? 'null' : String(resolved);
          this.#logger.debug(
            `Replaced embedded placeholder ${placeholderSyntax} with string: "${stringValue}"`
          );
        }
      }
      return { changed: true, value: replaced };
    }

    return { changed: false, value };
  }

  /**
   * Handles array placeholder resolution.
   *
   * @private
   * @param {Array} arr Array potentially containing placeholders.
   * @param {object[]} sources Resolution sources.
   * @returns {{changed: boolean, value: *}} Resulting value and change flag.
   */
  _resolveArray(arr, sources) {
    let changed = false;
    const resolvedArr = arr.map((item) => {
      const { value: resolvedItem, changed: c } = this._resolveValue(
        item,
        sources
      );
      if (c) {
        changed = true;
      }
      return resolvedItem;
    });
    return { changed, value: changed ? resolvedArr : arr };
  }

  /**
   * Handles object placeholder resolution.
   *
   * @private
   * @param {object} obj Object potentially containing placeholders.
   * @param {object[]} sources Resolution sources.
   * @param {Set<string>} skipKeys Keys that should not be resolved at this level.
   * @returns {{changed: boolean, value: *}} Resulting value and change flag.
   */
  _resolveObject(obj, sources, skipKeys) {
    let changed = false;
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (skipKeys && skipKeys.has(key)) {
          result[key] = obj[key];
        } else {
          const { value: resolvedVal, changed: c } = this._resolveValue(
            obj[key],
            sources
          );
          if (c) {
            changed = true;
          }
          result[key] = resolvedVal;
        }
      }
    }
    return { changed, value: changed ? result : obj };
  }

  /**
   * Recursively resolves placeholders within a value using provided sources.
   *
   * @private
   * @param {*} value - Value that may contain placeholders.
   * @param {object[]} sources - Ordered list of source objects.
   * @param {Set<string>} skipKeys - Keys to skip when resolving objects.
   * @returns {*} Value with placeholders resolved.
   */
  _resolveValue(value, sources, skipKeys) {
    if (typeof value === 'string') {
      return this._resolveString(value, sources);
    }

    if (Array.isArray(value)) {
      return this._resolveArray(value, sources);
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return this._resolveObject(value, sources, skipKeys);
    }

    return { changed: false, value };
  }

  /**
   * Recursively resolves placeholders within a complex structure.
   *
   * @description Strings are processed with {@link PlaceholderResolver#resolve}.
   * If a string consists solely of a single placeholder, the resolved value is
   * returned with its original type. Arrays and objects are traversed
   * recursively.
   * @param {*} input - The value that may contain placeholders.
   * @param {object|object[]} context - Primary data source or array of sources
   *   used for resolution.
   * @param {object} [fallback] - Optional fallback data source.
   * @param {Iterable<string>} [skipKeys] - Keys to leave unresolved when
   *   encountered at the current object level. Defaults to `[]`.
   * @returns {*} The input with all placeholders resolved.
   */
  resolveStructure(input, context, fallback = {}, skipKeys = []) {
    const sources = Array.isArray(context) ? [...context] : [context];
    if (
      fallback &&
      typeof fallback === 'object' &&
      Object.keys(fallback).length
    ) {
      sources.push(fallback);
    }

    const skipSet =
      skipKeys instanceof Set
        ? skipKeys
        : Array.isArray(skipKeys)
          ? new Set(skipKeys)
          : new Set();

    return this._resolveValue(input, sources, skipSet).value;
  }
}

// --- FILE END ---
