// src/logic/contextUtils.js
import resolvePath from '../utils/resolvePath.js'; // Adjust path as needed
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// Regex to find placeholders like {path.to.value} within a string.
// Group 1: Captures the brace style path (excluding braces).
// The 'g' flag ensures it finds *all* occurrences.
const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}/g; // Only matches {...}

// Regex to check if the entire string is *only* a placeholder ({...})
// Group 1: Captures the path within braces.
const FULL_STRING_PLACEHOLDER_REGEX = /^{\s*([^}\s]+)\s*}$/; // Only matches {...}

/**
 * Recursively resolves placeholder strings (e.g., "{actor.id}", "{context.variableName}") within an input structure
 * using values from the provided executionContext. Handles nested objects and arrays.
 * Replaces placeholders found within strings. If a string consists *only* of a placeholder
 * that resolves to a non-string type (e.g., number, boolean, object), it returns the resolved type.
 * Otherwise, performs string replacement.
 *
 * Special handling for paths starting with "context.": These are resolved against
 * executionContext.evaluationContext.context, which is the standard variable store.
 * Other paths (e.g., "event.type", "actor.id") are resolved from the root of executionContext.
 *
 * @param {*} input - The data structure (object, array, string, primitive) containing potential placeholders.
 * @param {object} executionContext - The top-level context object (e.g., finalNestedExecutionContext) to resolve paths against.
 * @param {ILogger} [logger] - Optional logger for warnings.
 * @param {string} [currentPath] - Internal use for logging nested resolution issues.
 * @returns {*} A new structure with placeholders resolved, or the original input if no placeholders were found or resolution failed.
 */
export function resolvePlaceholders(
  input,
  executionContext,
  logger,
  currentPath = ''
) {
  if (typeof input === 'string') {
    const fullMatch = input.match(FULL_STRING_PLACEHOLDER_REGEX);

    if (fullMatch) {
      const placeholderPath = fullMatch[1]; // Path like "context.someVar" or "event.type"
      const placeholderSyntax = `{${placeholderPath}}`;
      const fullLogPath = currentPath
        ? `${currentPath} -> ${placeholderSyntax}`
        : placeholderSyntax;

      // Moved declaration of pathForResolvePath to a higher scope
      let pathForResolvePath = placeholderPath;
      let effectiveResolutionRoot = executionContext;

      if (!placeholderPath) {
        logger?.warn(
          `Failed to extract path from full string placeholder: "${input}"`
        );
        return input;
      }

      if (executionContext && typeof executionContext === 'object') {
        let resolvedValue;
        try {
          // --- START MODIFIED LOGIC FOR CONTEXT PATHS ---
          // effectiveResolutionRoot and pathForResolvePath are initialized before the try block

          if (placeholderPath.startsWith('context.')) {
            if (
              executionContext.evaluationContext &&
              typeof executionContext.evaluationContext.context === 'object' &&
              executionContext.evaluationContext.context !== null
            ) {
              effectiveResolutionRoot =
                executionContext.evaluationContext.context;
              pathForResolvePath = placeholderPath.substring('context.'.length);
            } else {
              logger?.warn(
                `Placeholder "${placeholderPath}" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${fullLogPath}`
              );
              // Fallthrough: attempt to resolve from root, pathForResolvePath remains placeholderPath
            }
          }
          // --- END MODIFIED LOGIC FOR CONTEXT PATHS ---
          resolvedValue = resolvePath(
            effectiveResolutionRoot,
            pathForResolvePath
          );
        } catch (e) {
          // pathForResolvePath is accessible here due to moved declaration
          logger?.error(
            `Error resolving path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax}. Path: ${fullLogPath}`,
            e
          );
          resolvedValue = undefined;
        }

        if (resolvedValue === undefined) {
          // pathForResolvePath is accessible here
          logger?.warn(
            `Placeholder path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax} could not be resolved. Path: ${fullLogPath}`
          );
          return input;
        }
        logger?.debug(
          `Resolved full string placeholder ${placeholderSyntax} to: ${typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue) : resolvedValue}`
        );
        return resolvedValue;
      } else {
        logger?.warn(
          `Cannot resolve placeholder path "${placeholderPath}" from ${placeholderSyntax}: executionContext is not a valid object. Path: ${fullLogPath}`
        );
        return input;
      }
    } else {
      let replaced = false;
      const resultString = input.replace(
        PLACEHOLDER_FIND_REGEX,
        (match, placeholderPath) => {
          const placeholderSyntax = match;
          const fullLogPath = currentPath
            ? `${currentPath} -> ${placeholderSyntax} (within string)`
            : `${placeholderSyntax} (within string)`;

          // Moved declaration of pathForResolvePath to a higher scope within the callback
          let pathForResolvePath = placeholderPath;
          let effectiveResolutionRoot = executionContext;

          if (!placeholderPath) {
            logger?.warn(
              `Failed to extract path from placeholder match: "${match}" in string "${input}"`
            );
            return match;
          }

          if (executionContext && typeof executionContext === 'object') {
            let resolvedValue;
            try {
              // --- START MODIFIED LOGIC FOR CONTEXT PATHS (embedded) ---
              // effectiveResolutionRoot and pathForResolvePath are initialized before this try block

              if (placeholderPath.startsWith('context.')) {
                if (
                  executionContext.evaluationContext &&
                  typeof executionContext.evaluationContext.context ===
                    'object' &&
                  executionContext.evaluationContext.context !== null
                ) {
                  effectiveResolutionRoot =
                    executionContext.evaluationContext.context;
                  pathForResolvePath = placeholderPath.substring(
                    'context.'.length
                  );
                } else {
                  logger?.warn(
                    `Embedded placeholder "${placeholderPath}" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${fullLogPath}`
                  );
                  // Fallthrough
                }
              }
              // --- END MODIFIED LOGIC FOR CONTEXT PATHS (embedded) ---
              resolvedValue = resolvePath(
                effectiveResolutionRoot,
                pathForResolvePath
              );
            } catch (e) {
              // pathForResolvePath is accessible here
              logger?.error(
                `Error resolving path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from embedded ${placeholderSyntax}. Path: ${fullLogPath}`,
                e
              );
              resolvedValue = undefined;
            }

            if (resolvedValue === undefined) {
              // pathForResolvePath is accessible here
              logger?.warn(
                `Embedded placeholder path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax} could not be resolved. Path: ${fullLogPath}`
              );
              return match;
            }
            replaced = true;
            const stringValue =
              resolvedValue === null ? 'null' : String(resolvedValue);
            logger?.debug(
              `Replaced embedded placeholder ${placeholderSyntax} with string: "${stringValue}"`
            );
            return stringValue;
          } else {
            logger?.warn(
              `Cannot resolve embedded placeholder path "${placeholderPath}" from ${placeholderSyntax}: executionContext is not a valid object. Path: ${fullLogPath}`
            );
            return match;
          }
        }
      );
      return replaced ? resultString : input;
    }
  } else if (Array.isArray(input)) {
    let changed = false;
    const resolvedArray = input.map((item, index) => {
      const resolvedItem = resolvePlaceholders(
        item,
        executionContext,
        logger,
        `${currentPath}[${index}]`
      );
      if (resolvedItem !== item) {
        changed = true;
      }
      return resolvedItem;
    });
    return changed ? resolvedArray : input;
  } else if (input && typeof input === 'object' && !(input instanceof Date)) {
    let changed = false;
    const resolvedObj = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const originalValue = input[key];
        const resolvedValue = resolvePlaceholders(
          originalValue,
          executionContext,
          logger,
          `${currentPath}.${key}`
        );
        if (resolvedValue !== originalValue) {
          changed = true;
        }
        resolvedObj[key] = resolvedValue;
      }
    }
    return changed ? resolvedObj : input;
  } else {
    return input;
  }
}
