/**
 * @module bodyComponentUtils
 * @description Utilities for working with anatomy body components
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Retrieves the anatomy:body component for a given entity
 *
 * @param {IEntityManager} entityManager - The entity manager service
 * @param {string} entityId - The entity ID to get body component for
 * @returns {object | null} The body component or null if not found
 */
export function getBodyComponent(entityManager, entityId) {
  if (
    entityId === undefined ||
    entityId === null ||
    (typeof entityId === 'string' && entityId.trim() === '')
  ) {
    return null;
  }

  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (!bodyComponent) {
    return null;
  }

  // Validate that the component has a valid structure
  const hasDirectRoot =
    bodyComponent.root !== undefined && bodyComponent.root !== null;
  const hasNestedRoot =
    bodyComponent.body?.root !== undefined && bodyComponent.body?.root !== null;

  if (!hasDirectRoot && !hasNestedRoot) {
    return null;
  }

  return bodyComponent;
}

/**
 * Extracts the root entity ID from a body component
 * Handles both legacy format {body: {root}} and current format {root}
 *
 * @param {object} bodyComponent - The body component
 * @returns {string|null} The root entity ID or null if not found
 */
export function extractRootId(bodyComponent) {
  if (!bodyComponent) {
    return null;
  }

  // Support both formats for backward compatibility
  // Legacy format: { body: { root: 'entity123' } }
  // Current format: { root: 'entity123' }
  if (
    bodyComponent.body &&
    bodyComponent.body.root !== undefined &&
    bodyComponent.body.root !== null
  ) {
    return bodyComponent.body.root;
  }

  if (bodyComponent.root !== undefined && bodyComponent.root !== null) {
    return bodyComponent.root;
  }

  return null;
}

/**
 * Validates and gets the root ID from an entity's body component
 *
 * @param {IEntityManager} entityManager - The entity manager service
 * @param {string} entityId - The entity ID
 * @returns {{ rootId: string|null, hasBody: boolean }} The root ID and whether entity has body component
 */
export function getRootIdFromEntity(entityManager, entityId) {
  const bodyComponent = getBodyComponent(entityManager, entityId);

  if (!bodyComponent) {
    return { rootId: null, hasBody: false };
  }

  const rootId = extractRootId(bodyComponent);
  return { rootId, hasBody: true };
}
