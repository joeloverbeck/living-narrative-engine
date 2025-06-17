// src/utils/contextUtils.js
import { resolvePath } from './objectUtils.js';
import { NAME_COMPONENT_ID } from '../constants/componentIds.js';
import { PlaceholderResolver } from './placeholderResolverUtils.js';
import { getEntityDisplayName } from './entityUtils.js';

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

  if (!entity) return undefined;

  // If entity lacks getComponentData, provide a simple adapter so
  // getEntityDisplayName can still read from the components object.
  const adaptedEntity =
    typeof entity.getComponentData === 'function'
      ? entity
      : {
          ...entity,
          getComponentData: (type) => entity?.components?.[type],
        };

  const name = getEntityDisplayName(adaptedEntity, undefined, logger);

  if (typeof name === 'string') {
    logger?.debug(
      `Resolved placeholder "${placeholderPath}" to "${name}" via NAME_COMPONENT_ID component fallback.`
    );
    return name;
  }

  return undefined;
}

/**
 * Resolves a placeholder path against the provided execution context.
 *
 * @description Handles the `context.` prefix, uses {@link resolvePath}, and
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
function resolvePlaceholderPath(
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

  let pathForResolvePath = placeholderPath;
  let effectiveRoot = executionContext;

  if (placeholderPath.startsWith('context.')) {
    if (
      executionContext.evaluationContext &&
      typeof executionContext.evaluationContext.context === 'object' &&
      executionContext.evaluationContext.context !== null
    ) {
      effectiveRoot = executionContext.evaluationContext.context;
      pathForResolvePath = placeholderPath.substring('context.'.length);
    } else {
      logger?.warn(
        `Placeholder "${placeholderPath}" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${logPath}`
      );
    }
  }

  let resolvedValue;
  try {
    resolvedValue = resolvePath(effectiveRoot, pathForResolvePath);
  } catch (e) {
    logger?.error(
      `Error resolving path "${placeholderPath}" (interpreted as "${pathForResolvePath}") at ${logPath}`,
      e
    );
    resolvedValue = undefined;
  }

  if (resolvedValue === undefined) {
    resolvedValue = resolveEntityNameFallback(
      placeholderPath,
      executionContext,
      logger
    );
  }

  return resolvedValue;
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
 * @param {Iterable<string>} [skipKeys] - Keys to skip when resolving object properties at the current level.
 * @returns {*} A new structure with placeholders resolved, or the original input if no placeholders were found or resolution failed.
 */
export function resolvePlaceholders(
  input,
  executionContext,
  logger,
  currentPath = '',
  skipKeys = []
) {
  if (typeof input === 'string') {
    const fullMatch = input.match(FULL_STRING_PLACEHOLDER_REGEX);

    const resolver = new PlaceholderResolver(logger);
    const contextSource = {
      context:
        executionContext?.evaluationContext?.context &&
        typeof executionContext.evaluationContext.context === 'object'
          ? executionContext.evaluationContext.context
          : {},
    };
    const fallbackSource = {};
    const actorName = resolveEntityNameFallback('actor.name', executionContext);
    if (actorName !== undefined) {
      fallbackSource.actor = { name: actorName };
    }
    const targetName = resolveEntityNameFallback(
      'target.name',
      executionContext
    );
    if (targetName !== undefined) {
      if (!fallbackSource.target) fallbackSource.target = {};
      fallbackSource.target.name = targetName;
    }

    const replacedString = resolver.resolve(
      input,
      contextSource,
      executionContext ?? {},
      fallbackSource
    );

    if (fullMatch) {
      let placeholderPath = fullMatch[1];
      const isOptional = placeholderPath.endsWith('?');
      if (isOptional) {
        placeholderPath = placeholderPath.slice(0, -1);
      }
      const placeholderSyntax = `{${placeholderPath}${isOptional ? '?' : ''}}`;
      const fullLogPath = currentPath
        ? `${currentPath} -> ${placeholderSyntax}`
        : placeholderSyntax;

      const resolvedValue = resolvePlaceholderPath(
        placeholderPath,
        executionContext,
        logger,
        fullLogPath
      );

      if (resolvedValue === undefined) {
        return undefined;
      }

      logger?.debug(
        `Resolved full string placeholder ${placeholderSyntax} to: ${
          typeof resolvedValue === 'object'
            ? JSON.stringify(resolvedValue)
            : resolvedValue
        }`
      );
      return resolvedValue;
    }

    // Embedded placeholders debug logging
    let match;
    PLACEHOLDER_FIND_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_FIND_REGEX.exec(input))) {
      let placeholderPath = match[1];
      const placeholderSyntax = match[0];
      const isOptional = placeholderPath.endsWith('?');
      if (isOptional) {
        placeholderPath = placeholderPath.slice(0, -1);
      }
      const fullLogPath = currentPath
        ? `${currentPath} -> ${placeholderSyntax} (within string)`
        : `${placeholderSyntax} (within string)`;

      const resolvedValue = resolvePlaceholderPath(
        placeholderPath,
        executionContext,
        undefined,
        fullLogPath
      );
      if (resolvedValue !== undefined) {
        const stringValue =
          resolvedValue === null ? 'null' : String(resolvedValue);
        logger?.debug(
          `Replaced embedded placeholder ${placeholderSyntax} with string: "${stringValue}"`
        );
      }
    }

    return replacedString;
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
        if (
          (skipKeys instanceof Set && skipKeys.has(key)) ||
          (Array.isArray(skipKeys) && skipKeys.includes(key))
        ) {
          resolvedObj[key] = originalValue;
        } else {
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
    }
    return changed ? resolvedObj : input;
  } else {
    return input;
  }
}
