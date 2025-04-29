// src/logic/contextUtils.js
import resolvePath from '../utils/resolvePath.js'; // Adjust path as needed
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */

// Regex to find placeholders like {path.to.value} OR $path.to.value within a string.
// Group 1: Captures the brace style path (excluding braces).
// Group 2: Captures the dollar style path (excluding '$').
// It prioritizes finding {..} first if nested like {$var} (though weird).
// The 'g' flag ensures it finds *all* occurrences.
const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}|\$([a-zA-Z_][\w.]*)/g;

// Regex to check if the entire string is *only* a placeholder ({...} or $...)
// Group 1: Captures the path within braces.
// Group 2: Captures the path after $.
const FULL_STRING_PLACEHOLDER_REGEX = /^(?:{\s*([^}\s]+)\s*}|\$([a-zA-Z_][\w.]*))$/;


/**
 * Recursively resolves placeholder strings (e.g., "{actor.id}" or "$actor.id") within an input structure
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
        // --- MODIFIED STRING HANDLING FOR BOTH SYNTAXES ---

        // Check if the *entire* string is a placeholder ({...} or $...).
        const fullMatch = input.match(FULL_STRING_PLACEHOLDER_REGEX);

        if (fullMatch) {
            // Determine the path based on which capture group matched.
            // fullMatch[1] is for {...}, fullMatch[2] is for $...
            const placeholderPath = fullMatch[1] ?? fullMatch[2];
            const placeholderSyntax = fullMatch[1] ? `{${placeholderPath}}` : `$${placeholderPath}`; // For logging
            const fullLogPath = currentPath ? `${currentPath} -> ${placeholderSyntax}` : placeholderSyntax;

            if (!placeholderPath) {
                // Should not happen with the regex, but defensively check.
                logger?.warn(`Failed to extract path from full string placeholder: "${input}"`);
                return input;
            }

            if (context && typeof context === 'object') {
                let resolvedValue;
                try {
                    resolvedValue = resolvePath(context, placeholderPath);
                } catch (e) {
                    // Catch errors from resolvePath (e.g., invalid path format)
                    logger?.error(`Error resolving path "${placeholderPath}" from ${placeholderSyntax}. Path: ${fullLogPath}`, e);
                    resolvedValue = undefined; // Treat resolution errors as 'not found'
                }

                if (resolvedValue === undefined) {
                    logger?.warn(`Placeholder path "${placeholderPath}" from ${placeholderSyntax} could not be resolved in context. Path: ${fullLogPath}`);
                    return input; // Return original string if not found or error occurred
                }
                // Return the resolved value directly (could be string, number, object, etc.)
                logger?.debug(`Resolved full string placeholder ${placeholderSyntax} to: ${typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue) : resolvedValue}`);
                return resolvedValue;
            } else {
                logger?.warn(`Cannot resolve placeholder path "${placeholderPath}" from ${placeholderSyntax}: Context is not a valid object. Path: ${fullLogPath}`);
                return input; // Return original string if context is invalid
            }
        } else {
            // The string is not solely a placeholder, so perform replacements within it.
            // Use .replace() with a replacer function for all occurrences.
            let replaced = false;
            const resultString = input.replace(PLACEHOLDER_FIND_REGEX, (match, bracePath, dollarPath) => {
                // match is the full placeholder e.g., "{ actor.name }" or "$actor.name"
                // bracePath is the captured path for {...} syntax (group 1)
                // dollarPath is the captured path for $... syntax (group 2)
                const placeholderPath = bracePath ?? dollarPath;
                const placeholderSyntax = match; // Use the full match for logging syntax
                const fullLogPath = currentPath ? `${currentPath} -> ${placeholderSyntax} (within string)` : `${placeholderSyntax} (within string)`;

                if (!placeholderPath) {
                    // Should not happen, but defensively check.
                    logger?.warn(`Failed to extract path from placeholder match: "${match}" in string "${input}"`);
                    return match; // Return original match if path extraction fails
                }

                if (context && typeof context === 'object') {
                    let resolvedValue;
                    try {
                        resolvedValue = resolvePath(context, placeholderPath);
                    } catch (e) {
                        logger?.error(`Error resolving path "${placeholderPath}" from ${placeholderSyntax} (within string). Path: ${fullLogPath}`, e);
                        resolvedValue = undefined;
                    }

                    if (resolvedValue === undefined) {
                        logger?.warn(`Placeholder path "${placeholderPath}" from ${placeholderSyntax} could not be resolved in context. Path: ${fullLogPath}`);
                        return match; // Return the original placeholder if not found or error occurred
                    }
                    replaced = true;
                    // Convert resolved value to string for replacement within the larger string.
                    // Handle null explicitly, otherwise return String(value).
                    const stringValue = resolvedValue === null ? 'null' : String(resolvedValue);
                    logger?.debug(`Replaced placeholder ${placeholderSyntax} with string: "${stringValue}"`);
                    return stringValue;
                } else {
                    logger?.warn(`Cannot resolve placeholder path "${placeholderPath}" from ${placeholderSyntax}: Context is not a valid object. Path: ${fullLogPath}`);
                    return match; // Return original placeholder if context is invalid
                }
            });
            // Only return the potentially modified string if replacements occurred
            return replaced ? resultString : input;
        }
        // --- END MODIFIED STRING HANDLING ---

    } else if (Array.isArray(input)) {
        // Recursively resolve for each item in the array
        let changed = false;
        const resolvedArray = input.map((item, index) => {
            const resolvedItem = resolvePlaceholders(item, context, logger, `${currentPath}[${index}]`);
            if (resolvedItem !== item) {
                changed = true;
            }
            return resolvedItem;
        });
        return changed ? resolvedArray : input;

    } else if (input && typeof input === 'object' && !(input instanceof Date)) { // Check it's a plain object
        // Recursively resolve for each value in the object
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