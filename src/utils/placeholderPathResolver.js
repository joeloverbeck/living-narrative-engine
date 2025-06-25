/**
 * @module placeholderPathResolver
 * @description Helper functions for resolving placeholder paths against an execution context.
 */

import { safeResolvePath } from './objectUtils.js';
import { resolveEntityNameFallback } from './entityNameFallbackUtils.js';

/**
 * Extracts the effective root and path when handling `context.` placeholders.
 *
 * @param {string} placeholderPath - Original placeholder path.
 * @param {object} executionContext - The current execution context.
 * @returns {{ path: string, root: object } | null} Extracted info or `null` on invalid context.
 */
export function extractContextPath(placeholderPath, executionContext) {
  if (!placeholderPath.startsWith('context.')) {
    return { path: placeholderPath, root: executionContext };
  }

  const ctx = executionContext?.evaluationContext?.context;
  if (ctx && typeof ctx === 'object') {
    return { path: placeholderPath.substring('context.'.length), root: ctx };
  }

  return null;
}

/**
 * Resolves a placeholder path against the provided execution context.
 *
 * @param {string} placeholderPath - Path from the placeholder (e.g., `context.varA`).
 * @param {object} executionContext - The execution context root object.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings and errors.
 * @param {string} [logPath] - String used in log messages to indicate the source of the resolution attempt.
 * @returns {any|undefined} The resolved value, or `undefined` when resolution fails.
 */
export function resolvePlaceholderPath(
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

  const contextInfo = extractContextPath(placeholderPath, executionContext);
  if (contextInfo === null) {
    logger?.warn(
      `Placeholder "${placeholderPath}" uses "context." prefix, but executionContext.evaluationContext.context is missing or invalid. Path: ${logPath}`
    );
    return undefined;
  }

  const { value, error } = safeResolvePath(
    contextInfo.root,
    contextInfo.path,
    logger,
    `resolvePlaceholderPath for "${placeholderPath}" at ${logPath}`
  );

  const resolvedValue =
    (error ? undefined : value) ??
    resolveEntityNameFallback(placeholderPath, executionContext, logger);

  return resolvedValue;
}
