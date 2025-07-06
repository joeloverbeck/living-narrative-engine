/**
 * @module entityPathResolver
 * @description Utility for resolving entity paths in JSON Logic contexts
 */

/**
 * Resolves an entity from a nested path in the context
 *
 * @param {object} context - The evaluation context
 * @param {string} pathString - Dot-separated path like "event.target.id" or special "." for current entity
 * @returns {{ entity: any, isValid: boolean }} The resolved entity and validation status
 */
export function resolveEntityPath(context, pathString) {
  // Handle invalid input
  if (!pathString || typeof pathString !== 'string') {
    return { entity: null, isValid: false };
  }

  // Special handling for "." which means the current entity in filter context
  if (pathString === '.') {
    const entity = context?.entity;
    return {
      entity,
      isValid: entity !== undefined && entity !== null,
    };
  }

  // Navigate the nested path
  const pathParts = pathString.split('.');
  let current = context;

  for (const part of pathParts) {
    // Check if we can continue navigating
    if (
      current === undefined ||
      current === null ||
      typeof current !== 'object'
    ) {
      return { entity: null, isValid: false };
    }
    current = current[part];
  }

  return {
    entity: current,
    isValid: current !== undefined && current !== null,
  };
}

/**
 * Validates that a resolved entity has an ID
 *
 * @param {any} entity - The resolved entity
 * @returns {boolean} True if entity has a valid ID
 */
export function hasValidEntityId(entity) {
  return (
    entity !== undefined &&
    entity !== null &&
    entity.id !== undefined &&
    entity.id !== null
  );
}
