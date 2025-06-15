// src/logic/contextUtils.js
import { resolvePath } from '../utils/objectUtils.js';
import { NAME_COMPONENT_ID } from '../constants/componentIds'; // Adjust path as needed
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// Regex to find placeholders like {path.to.value} within a string.
// Group 1: Captures the brace style path (excluding braces).
// The 'g' flag ensures it finds *all* occurrences.
const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}/g; // Only matches {...}

// Regex to check if the entire string is *only* a placeholder ({...})
// Group 1: Captures the path within braces.
const FULL_STRING_PLACEHOLDER_REGEX = /^{\s*([^}\s]+)\s*}$/; // Only matches {...}

/**
 * Provides a fallback to resolve common placeholders such as `actor.name` or
 * `target.name`.
 *
 * @description Looks for the `NAME_COMPONENT_ID` component on the relevant
 * entity and returns its text value when present.
 * @param {string} placeholderPath - The original path, e.g., 'target.name'.
 * @param {object} resolutionRoot - The root context object to resolve from
 *   (e.g., nestedExecutionContext).
 * @param {ILogger} [logger] - Optional logger for debug messages.
 * @returns {string|undefined} The resolved name, or undefined if not found.
 */
export function resolveEntityNameFallback(
  placeholderPath,
  resolutionRoot,
  logger
) {
  if (!resolutionRoot) return undefined;

  let entity;
  // Determine if the placeholder is one of the recognized shorthands.
  if (placeholderPath === 'actor.name') {
    entity = resolutionRoot.actor;
  } else if (placeholderPath === 'target.name') {
    entity = resolutionRoot.target;
  } else {
    return undefined; // Not a recognized shorthand, so no fallback applies.
  }

  // Safely access the name component's text property using optional chaining.
  const name = entity?.components?.[NAME_COMPONENT_ID]?.text;

  if (typeof name === 'string') {
    logger?.debug(
      `Resolved placeholder "${placeholderPath}" to "${name}" via NAME_COMPONENT_ID component fallback.`
    );
    return name;
  }

  return undefined;
}

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
      let placeholderPath = fullMatch[1]; // Path like "context.someVar" or "event.type"
      const isOptional = placeholderPath.endsWith('?');
      if (isOptional) {
        placeholderPath = placeholderPath.slice(0, -1);
      }
      const placeholderSyntax = `{${placeholderPath}${isOptional ? '?' : ''}}`;
      const fullLogPath = currentPath
        ? `${currentPath} -> ${placeholderSyntax}`
        : placeholderSyntax;

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
            }
          }
          resolvedValue = resolvePath(
            effectiveResolutionRoot,
            pathForResolvePath
          );
        } catch (e) {
          logger?.error(
            `Error resolving path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax}. Path: ${fullLogPath}`,
            e
          );
          resolvedValue = undefined;
        }

        // --- START FIX ---
        // If the primary resolution failed, attempt our smart fallback for common cases.
        if (resolvedValue === undefined) {
          resolvedValue = resolveEntityNameFallback(
            placeholderPath,
            executionContext, // Pass the original, top-level context for the fallback
            logger
          );
        }
        // --- END FIX ---

        if (resolvedValue === undefined) {
          if (!isOptional) {
            logger?.warn(
              `Placeholder path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax} could not be resolved. Path: ${fullLogPath}`
            );
          }
          return undefined; // callers now see “no value”
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
          const isOptional = placeholderPath.endsWith('?');
          if (isOptional) {
            placeholderPath = placeholderPath.slice(0, -1);
          }
          const fullLogPath = currentPath
            ? `${currentPath} -> ${placeholderSyntax} (within string)`
            : `${placeholderSyntax} (within string)`;

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
                }
              }
              resolvedValue = resolvePath(
                effectiveResolutionRoot,
                pathForResolvePath
              );
            } catch (e) {
              logger?.error(
                `Error resolving path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from embedded ${placeholderSyntax}. Path: ${fullLogPath}`,
                e
              );
              resolvedValue = undefined;
            }

            // --- START FIX ---
            // If the primary resolution failed, attempt our smart fallback for common cases.
            if (resolvedValue === undefined) {
              resolvedValue = resolveEntityNameFallback(
                placeholderPath,
                executionContext, // Pass the original, top-level context for the fallback
                logger
              );
            }
            // --- END FIX ---

            if (resolvedValue === undefined) {
              if (!isOptional) {
                logger?.warn(
                  `Embedded placeholder path "${placeholderPath}" (interpreted as "${pathForResolvePath}") from ${placeholderSyntax} could not be resolved. Path: ${fullLogPath}`
                );
              }
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
