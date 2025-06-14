/**
 * @module actorLocationUtils
 * @description Helper utilities to retrieve an actor's current location.
 */

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Retrieves the current location for the given actor entity.
 *
 * It looks up the actor's `core:position` component and resolves the
 * referenced `locationId` to an entity instance if possible.
 *
 * @param {string} entityId - The instance ID of the actor.
 * @param {IEntityManager} entityManager - Manager used to access component data.
 * @returns {Entity | string | null} The location entity if found, otherwise the
 * locationId string, or `null` when unavailable.
 */
export function getActorLocation(entityId, entityManager) {
  if (!entityId || typeof entityId !== 'string') return null;
  if (!entityManager || typeof entityManager.getComponentData !== 'function') {
    return null;
  }

  try {
    const pos = entityManager.getComponentData(entityId, POSITION_COMPONENT_ID);
    if (pos && typeof pos.locationId === 'string' && pos.locationId) {
      const locationEntity =
        typeof entityManager.getEntityInstance === 'function'
          ? entityManager.getEntityInstance(pos.locationId)
          : null;
      return locationEntity ?? pos.locationId;
    }
  } catch {
    /* ignored */
  }
  return null;
}

export default getActorLocation;
