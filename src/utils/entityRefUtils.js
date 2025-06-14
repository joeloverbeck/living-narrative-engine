/**
 * @file Utility functions for entity reference resolution.
 */

/**
 * Resolves an entity reference to a concrete entity ID.
 * Supports string references 'actor' and 'target', direct ID strings,
 * or objects shaped like `{ entityId: string }`.
 *
 * @param {'actor'|'target'|string|{entityId:string}|null|undefined} ref - The entity reference.
 * @param {object} ctx - The execution context containing evaluationContext.
 * @returns {string|null} The resolved entity ID, or null if it cannot be resolved.
 */
export function resolveEntityId(ref, ctx) {
  const ec = ctx?.evaluationContext ?? {};

  if (typeof ref === 'string') {
    const t = ref.trim();
    if (!t) return null;
    if (t === 'actor') return ec.actor?.id ?? null;
    if (t === 'target') return ec.target?.id ?? null;
    return t; // assume direct ID string
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

export default resolveEntityId;
