// src/utils/placeholderResolver.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

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
     * @param {ILogger} [logger=console] - An optional logger instance. If not provided, `console` will be used.
     */
    constructor(logger = console) {
        this.#logger = logger;
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

        return str.replace(/{([^{}]+)}/g, (match, placeholderKey) => {
            const trimmedKey = placeholderKey.trim();
            for (const dataSource of dataSources) {
                if (dataSource && typeof dataSource === 'object' && Object.prototype.hasOwnProperty.call(dataSource, trimmedKey)) {
                    const value = dataSource[trimmedKey];
                    return value !== null && value !== undefined ? String(value) : '';
                }
            }
            this.#logger.warn(`PlaceholderResolver: Placeholder "{${trimmedKey}}" not found in provided data sources. Replacing with empty string.`);
            return '';
        });
    }
}

// --- FILE END ---