// src/actions/validation/contextBuilders.js

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

import { createEntityContext } from '../../logic/contextAssembler.js';

/**
 * @description Build the actor portion of an action validation context.
 * @param {string} entityId - ID of the actor entity.
 * @param {EntityManager} entityManager - Manager to access components.
 * @param {ILogger} logger - Logger instance.
 * @returns {{id: string, components: object}} Actor context object.
 */
export function buildActorContext(entityId, entityManager, logger) {
  // This function already delegates correctly and needs no changes.
  return createEntityContext(entityId, entityManager, logger);
}
