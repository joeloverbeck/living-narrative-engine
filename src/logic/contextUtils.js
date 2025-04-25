// src/logic/contextUtils.js (or similar)
import resolvePath from '../utils/resolvePath.js'; // Adjust path as needed

const PLACEHOLDER_REGEX = /^{(\s*)([^}\s]+)(\s*)}$/; // Regex to match {path.to.value} including optional whitespace

/**
 * Recursively resolves placeholder strings (e.g., "{actor.id}") within an input structure
 * using values from the provided context.
 *
 * @param {*} input - The data structure (object, array, string, primitive) containing potential placeholders.
 * @param {object} context - The context object (e.g., JsonLogicEvaluationContext) to resolve paths against.
 * @param {ILogger} [logger] - Optional logger for warnings.
 * @param {string} [currentPath=''] - Internal use for logging nested resolution issues.
 * @returns {*} A new structure with placeholders resolved, or the original input if no placeholders were found or resolution failed.
 */
export function resolvePlaceholders(input, context, logger, currentPath = '') {
    if (typeof input === 'string') {
        const match = input.match(PLACEHOLDER_REGEX);
        if (match) {
            const placeholderPath = match[2]; // The actual path like 'actor.id'
            const fullLogPath = currentPath ? `${currentPath} \-\> \{${placeholderPath}}` : `{${placeholderPath}}`;
            // Ensure context is an object before trying to resolve
            if (context && typeof context === 'object') {
                const resolvedValue = resolvePath(context, placeholderPath);

                if (resolvedValue === undefined) {
                    logger?.warn(`Placeholder path "${placeholderPath}" could not be resolved in context. Path: ${fullLogPath}`);
                    return input; // Return original string if not found
                }
                // logger?.debug(`Resolved placeholder "${placeholderPath}" to value:`, resolvedValue); // Optional debug log
                return resolvedValue;
            } else {
                logger?.warn(`Cannot resolve placeholder path "${placeholderPath}": Context is not a valid object. Path: ${fullLogPath}`);
                return input; // Return original string if context is invalid
            }
        }
        return input; // Not a placeholder string
    } else if (Array.isArray(input)) {
        // Recursively resolve for each item in the array
        return input.map((item, index) => resolvePlaceholders(item, context, logger, `${currentPath}\[${index}]`));
    } else if (input && typeof input === 'object' && !(input instanceof Date)) { // Check it's a plain object, not Date etc.
        // Recursively resolve for each value in the object
        const resolvedObj = {};
        for (const key in input) {
            // Avoid iterating over prototype properties
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                resolvedObj[key] = resolvePlaceholders(input[key], context, logger, `${currentPath}\.${key}`);
            }
        }
        return resolvedObj;
    } else {
        // Primitives (number, boolean, null, undefined, Date, etc.) - return as is
        return input;
    }
}