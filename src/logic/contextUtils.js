// src/logic/contextUtils.js
import resolvePath from '../utils/resolvePath.js'; // Adjust path as needed
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */ // Added missing typedef

// Regex to find placeholders like {path.to.value} within a string.
// It captures the path itself (without braces or surrounding whitespace) in group 1.
// The 'g' flag ensures it finds *all* occurrences, not just the first.
const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}/g;

/**
 * Recursively resolves placeholder strings (e.g., "{actor.id}") within an input structure
 * using values from the provided context. Handles nested objects and arrays.
 * Replaces placeholders found within strings. If a string consists *only* of a placeholder
 * that resolves to a non-string type (e.g., number, boolean, object), it returns the resolved type.
 * Otherwise, performs string replacement.
 *
 * @param {*} input - The data structure (object, array, string, primitive) containing potential placeholders.
 * @param {object} context - The context object (e.g., ExecutionContext) to resolve paths against.
 * @param {ILogger} [logger] - Optional logger for warnings.
 * @param {string} [currentPath=''] - Internal use for logging nested resolution issues.
 * @returns {*} A new structure with placeholders resolved, or the original input if no placeholders were found or resolution failed.
 */
export function resolvePlaceholders(input, context, logger, currentPath = '') {
    if (typeof input === 'string') {
        // --- MODIFIED STRING HANDLING ---

        // Check if the *entire* string is a placeholder. This allows us to return non-string types.
        const fullMatch = input.match(/^\{\s*([^}\s]+)\s*}$/); // Original regex without global flag

        if (fullMatch) {
            const placeholderPath = fullMatch[1];
            const fullLogPath = currentPath ? `${currentPath} -> {${placeholderPath}}` : `{${placeholderPath}}`;
            if (context && typeof context === 'object') {
                const resolvedValue = resolvePath(context, placeholderPath);
                if (resolvedValue === undefined) {
                    logger?.warn(`Placeholder path "${placeholderPath}" could not be resolved in context. Path: ${fullLogPath}`);
                    return input; // Return original string if not found
                }
                // Return the resolved value directly (could be string, number, object, etc.)
                return resolvedValue;
            } else {
                logger?.warn(`Cannot resolve placeholder path "${placeholderPath}": Context is not a valid object. Path: ${fullLogPath}`);
                return input; // Return original string if context is invalid
            }
        } else {
            // The string is not solely a placeholder, so perform replacements within it.
            // Use .replace() with a replacer function for all occurrences.
            let replaced = false;
            const resultString = input.replace(PLACEHOLDER_FIND_REGEX, (match, placeholderPath) => {
                // match is the full placeholder e.g., "{ actor.name }"
                // placeholderPath is the captured group e.g., "actor.name"
                const fullLogPath = currentPath ? `${currentPath} -> {${placeholderPath}} (within string)` : `{${placeholderPath}} (within string)`;
                if (context && typeof context === 'object') {
                    const resolvedValue = resolvePath(context, placeholderPath);

                    if (resolvedValue === undefined) {
                        logger?.warn(`Placeholder path "${placeholderPath}" could not be resolved in context. Path: ${fullLogPath}`);
                        return match; // Return the original placeholder if not found
                    }
                    replaced = true;
                    // Convert resolved value to string for replacement within the larger string.
                    // Handle null explicitly, otherwise return String(value).
                    return resolvedValue === null ? 'null' : String(resolvedValue);
                } else {
                    logger?.warn(`Cannot resolve placeholder path "${placeholderPath}": Context is not a valid object. Path: ${fullLogPath}`);
                    return match; // Return original placeholder if context is invalid
                }
            });
            // Only return the potentially modified string if replacements occurred
            return replaced ? resultString : input;
        }
        // --- END MODIFIED STRING HANDLING ---

    } else if (Array.isArray(input)) {
        // Recursively resolve for each item in the array
        // Optimization: only create new array if an item actually changes
        let changed = false;
        const resolvedArray = input.map((item, index) => {
            const resolvedItem = resolvePlaceholders(item, context, logger, `${currentPath}[${index}]`);
            if (resolvedItem !== item) {
                changed = true;
            }
            return resolvedItem;
        });
        return changed ? resolvedArray : input;

    } else if (input && typeof input === 'object' && !(input instanceof Date)) { // Check it's a plain object, not Date etc.
        // Recursively resolve for each value in the object
        // Optimization: only create new object if a value actually changes
        let changed = false;
        const resolvedObj = {};
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                const originalValue = input[key];
                const resolvedValue = resolvePlaceholders(originalValue, context, logger, `${currentPath}.${key}`);
                if (resolvedValue !== originalValue) {
                    changed = true;
                }
                resolvedObj[key] = resolvedValue;
            }
        }
        return changed ? resolvedObj : input;
    } else {
        // Primitives (number, boolean, null, undefined, Date, etc.) - return as is
        return input;
    }
}