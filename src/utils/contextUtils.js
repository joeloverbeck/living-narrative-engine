// src/utils/contextUtils.js
import { PlaceholderResolver } from './placeholderResolverUtils.js';
import { buildResolutionSources } from './placeholderSources.js';
import { getEntityDisplayName } from './entityUtils.js';
import { resolveEntityNameFallback } from './entityNameFallbackUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

// Re-export for backward compatibility
export { resolveEntityNameFallback };
// PLACEHOLDER_FIND_REGEX and FULL_STRING_PLACEHOLDER_REGEX are imported from
// placeholderResolverUtils.js to keep placeholder matching logic consistent.

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
  const { sources, fallback } = buildResolutionSources(executionContext);

  return resolver.resolveStructure(input, sources, fallback, skipKeys);
}
