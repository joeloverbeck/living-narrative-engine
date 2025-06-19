// src/utils/contextUtils.js
import { safeResolvePath } from './objectUtils.js';
import { NAME_COMPONENT_ID } from '../constants/componentIds.js';
import { PlaceholderResolver } from './placeholderResolverUtils.js';
import { getEntityDisplayName } from './entityUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// PLACEHOLDER_FIND_REGEX and FULL_STRING_PLACEHOLDER_REGEX are imported from
// placeholderResolverUtils.js to keep placeholder matching logic consistent.

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

  let resolvedValue = safeResolvePath(
    effectiveRoot,
    pathForResolvePath,
    logger,
    `resolvePlaceholderPath for "${placeholderPath}" at ${logPath}`
  );

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
 * Resolves placeholders within a structure using a provided resolver.
 *
 * @private
 * @param {*} value - Value potentially containing placeholders.
 * @param {PlaceholderResolver} resolver - Resolver instance.
 * @param {object[]} sources - Primary data sources for resolution.
 * @param {object} fallback - Fallback source for resolution.
 * @param {Iterable<string>} [skipKeys] - Keys to skip when processing objects.
 * @returns {*} Resolved value or the original input when unchanged.
 */
function _resolveStructure(value, resolver, sources, fallback, skipKeys = []) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    let changed = false;
    const resolvedObj = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        if (
          (skipKeys instanceof Set && skipKeys.has(key)) ||
          (Array.isArray(skipKeys) && skipKeys.includes(key))
        ) {
          resolvedObj[key] = value[key];
        } else {
          const resolvedVal = resolver.resolveStructure(
            value[key],
            sources,
            fallback
          );
          if (resolvedVal !== value[key]) {
            changed = true;
          }
          resolvedObj[key] = resolvedVal;
        }
      }
    }
    return changed ? resolvedObj : value;
  }

  return resolver.resolveStructure(value, sources, fallback);
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
  const resolver = new PlaceholderResolver(logger);
  const { sources, fallback } =
    PlaceholderResolver.buildResolutionSources(executionContext);

  return _resolveStructure(input, resolver, sources, fallback, skipKeys);
}
