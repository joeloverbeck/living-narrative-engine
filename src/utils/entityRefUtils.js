// src/utils/entityRefUtils.js
/**
 * Utility functions for resolving entity references to concrete entity IDs.
 *
 * @module entityRefUtils
 * @description Utilities for resolving entity references to concrete entity IDs.
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */
/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId - The entity identifier.
 */

/**
 * Resolves an entity reference into a concrete entity ID string. Supports the special keywords
 * 'actor' and 'target', plain ID strings, or objects of the form `{ entityId: string }`.
 *
 * @description Resolves an entity reference into a concrete entity ID string.
 * Supports the special keywords 'actor' and 'target', plain ID strings,
 * or objects of the form `{ entityId: string }`.
 * @param {'actor'|'target'|string|EntityRefObject} ref - Reference to resolve.
 * @param {ExecutionContext} executionContext - The current execution context providing actor/target.
 * @returns {string|null} The resolved entity ID, or `null` if it cannot be resolved.
 */
export function resolveEntityId(ref, executionContext) {
  const ec = executionContext?.evaluationContext ?? {};
  if (typeof ref === 'string') {
    const trimmed = ref.trim();
    if (!trimmed) return null;
    if (trimmed === 'actor') return ec.actor?.id ?? null;
    if (trimmed === 'target') return ec.target?.id ?? null;
    return trimmed;
  }

  if (
    ref &&
    typeof ref === 'object' &&
    typeof ref.entityId === 'string' &&
    ref.entityId.trim()
  ) {
    return ref.entityId.trim();
  }

  return null;
}
