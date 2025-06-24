// src/actions/validation/contextBuilders.js

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

import { createEntityContext } from '../../logic/contextAssembler.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../constants/actionTargetTypes.js';

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

/**
 * @description Build the target portion of the validation context when targeting an entity.
 * @param {string} entityId - ID of the target entity.
 * @param {EntityManager} entityManager - Manager to access components.
 * @param {ILogger} logger - Logger instance.
 * @returns {{type: string, id: string, components: object}}
 * Target context for an entity.
 */
export function buildEntityTargetContext(entityId, entityManager, logger) {
  // Create the core entity context which is { id, components }
  const entityCtx = createEntityContext(entityId, entityManager, logger);

  // Add the 'type' property required for the validation context.
  return {
    type: TARGET_TYPE_ENTITY,
    id: entityCtx.id,
    components: entityCtx.components,
  };
}
