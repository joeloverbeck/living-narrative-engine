/**
 * @module actorLocationUtils
 * @description Helper utilities to retrieve an actor's current location.
 */

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { isNonBlankString } from './textUtils.js';
import {
  getComponentFromManager,
  resolveEntityInstance,
} from './componentAccessUtils.js';

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
  const pos = getComponentFromManager(
    entityId,
    POSITION_COMPONENT_ID,
    entityManager
  );
  if (pos && isNonBlankString(pos.locationId)) {
    const locationEntity = resolveEntityInstance(pos.locationId, entityManager);
    return locationEntity ?? pos.locationId;
  }
  return null;
}

export default getActorLocation;
