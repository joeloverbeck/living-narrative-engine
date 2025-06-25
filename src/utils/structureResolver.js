/**
 * @module structureResolver
 * @description Functions for resolving placeholders within complex structures.
 */

import {
  parsePlaceholderKey,
  PLACEHOLDER_FIND_REGEX,
  FULL_STRING_PLACEHOLDER_REGEX,
} from './placeholderPatterns.js';

/**
 * @class StructureResolver
 * @description Class responsible for resolving placeholders inside strings,
 * arrays and objects.
 */
export class StructureResolver {
  /**
   * @param {(obj: object, path: string) => any} resolvePath - Function used to resolve dotted paths.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   */
  constructor(resolvePath, logger) {
    this.resolvePath = resolvePath;
    this.logger = logger;
  }

  /**
   * Resolves placeholders in a string using provided data sources.
   *
   * @param {string} str - The string potentially containing placeholders.
   * @param {...object} dataSources - Source objects for resolution.
   * @returns {string} The string with placeholders replaced.
   */
  resolve(str, ...dataSources) {
    if (!str || typeof str !== 'string') {
      return '';
    }

    return str.replace(PLACEHOLDER_FIND_REGEX, (match, placeholderKey) => {
      const { key: trimmedKey, optional: isOptional } =
        parsePlaceholderKey(placeholderKey);
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
        this.logger.warn(
          `PlaceholderResolver: Placeholder "{${trimmedKey}}" not found in provided data sources. Replacing with empty string.`
        );
      }
      return '';
    });
  }

  _resolveFromSources(placeholderInfo, sources) {
    const { key } = placeholderInfo;
    for (const source of sources) {
      if (source && typeof source === 'object') {
        const value = this.resolvePath(source, key);
        if (value !== undefined) {
          return value;
        } else {
          const parts = key.split('.');
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
   * @description Match a string that consists solely of a placeholder.
   * @param {string} value
   * @returns {RegExpMatchArray|null}
   * @private
   */
  _getFullPlaceholderMatch(value) {
    return value.match(FULL_STRING_PLACEHOLDER_REGEX);
  }

  _handleFullString(value, sources) {
    const fullMatch = this._getFullPlaceholderMatch(value);
    if (!fullMatch) {
      return { changed: false, value };
    }

    // Trigger warning handling by attempting normal resolution first.
    this.resolve(value, ...sources);

    const placeholderInfo = parsePlaceholderKey(fullMatch[1]);
    const resolved = this._resolveFromSources(placeholderInfo, sources);
    const { key: placeholderPath, optional: isOptional } = placeholderInfo;
    if (resolved !== undefined) {
      this.logger.debug(
        `Resolved full string placeholder {${placeholderPath}${isOptional ? '?' : ''}} to: ${
          typeof resolved === 'object' ? JSON.stringify(resolved) : resolved
        }`
      );
      return { changed: true, value: resolved };
    }
    return { changed: true, value: undefined };
  }

  _replaceEmbedded(value, sources) {
    const replaced = this.resolve(value, ...sources);
    if (replaced === value) {
      return { changed: false, value };
    }

    this._logEmbeddedReplacements(value, sources);
    return { changed: true, value: replaced };
  }

  /**
   * @description Log debug info for each embedded placeholder replaced.
   * @param {string} value
   * @param {object[]} sources
   * @private
   */
  _logEmbeddedReplacements(value, sources) {
    let match;
    PLACEHOLDER_FIND_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_FIND_REGEX.exec(value))) {
      const placeholderSyntax = match[0];
      const placeholderInfo = parsePlaceholderKey(match[1]);
      const resolved = this._resolveFromSources(placeholderInfo, sources);
      if (resolved !== undefined) {
        const stringValue = resolved === null ? 'null' : String(resolved);
        this.logger.debug(
          `Replaced embedded placeholder ${placeholderSyntax} with string: "${stringValue}"`
        );
      }
    }
  }

  _resolveString(value, sources) {
    const fullResult = this._handleFullString(value, sources);
    if (fullResult.changed) {
      return fullResult;
    }

    return this._replaceEmbedded(value, sources);
  }

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
   * @description Resolve a single object property while honoring skip keys.
   * @param {object} obj
   * @param {string} key
   * @param {object[]} sources
   * @param {Set<string>} [skipKeys]
   * @returns {{value: *, changed: boolean}}
   * @private
   */
  _resolveObjectEntry(obj, key, sources, skipKeys) {
    if (skipKeys && skipKeys.has(key)) {
      return { value: obj[key], changed: false };
    }
    return this._resolveValue(obj[key], sources);
  }

  _resolveObject(obj, sources, skipKeys) {
    let changed = false;
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const { value: resolvedVal, changed: c } = this._resolveObjectEntry(
          obj,
          key,
          sources,
          skipKeys
        );
        if (c) {
          changed = true;
        }
        result[key] = resolvedVal;
      }
    }
    return { changed, value: changed ? result : obj };
  }

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
