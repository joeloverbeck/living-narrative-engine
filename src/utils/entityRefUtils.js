// src/utils/entityRefUtils.js
/**
 * @module entityRefUtils
 * @description Utilities for resolving entity references to concrete entity IDs.
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */
/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId
 */

/**
 * @description Resolves an entity reference into a concrete entity ID string.
 * Supports the special keywords 'actor' and 'target', plain ID strings,
 * or objects of the form `{ entityId: string }`.
 * @param {'actor'|'target'|string|EntityRefObject} ref - Reference to resolve.
 * @param {ExecutionContext} ctx - The current execution context providing actor/target.
 * @returns {string|null} The resolved entity ID, or `null` if it cannot be resolved.
 */
export function resolveEntityId(ref, ctx) {
  const ec = ctx?.evaluationContext ?? {};
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
