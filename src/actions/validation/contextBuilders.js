/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// FIX: Removed obsolete imports
import { createComponentAccessor } from '../../logic/componentAccessor.js';
import { createEntityContext } from '../../logic/contextAssembler.js';

/**
 * @description Create a base target context with default null fields.
 * @param {'entity' | 'none'} type - Target context type.
 * @returns {{type: string, id: null, direction: null, components: null, blocker: null, exitDetails: null}}
 * Base target context object.
 */
export function createBaseTargetContext(type) {
  // FIX: The base context no longer needs to accommodate a 'direction' type.
  return {
    type,
    id: null,
    // These fields are now obsolete but kept as null for data structure consistency if anything still expects them.
    // They will not be populated.
    direction: null,
    components: null,
    blocker: null,
    exitDetails: null,
  };
}

/**
 * @description Build the actor portion of an action validation context.
 * @param {string} entityId - ID of the actor entity.
 * @param {EntityManager} entityManager - Manager to access components.
 * @param {ILogger} logger - Logger instance.
 * @returns {{id: string, components: object}} Actor context object.
 */
export function buildActorContext(entityId, entityManager, logger) {
  return createEntityContext(entityId, entityManager, logger);
}

/**
 * @description Build the target portion when targeting another entity.
 * @param {string} entityId - ID of the target entity.
 * @param {EntityManager} entityManager - Manager to access components.
 * @param {ILogger} logger - Logger instance.
 * @returns {{type: 'entity', id: string, direction: null, components: object, blocker: null, exitDetails: null}}
 * Target context for an entity.
 */
export function buildEntityTargetContext(entityId, entityManager, logger) {
  const ctx = createBaseTargetContext('entity');
  ctx.id = entityId;
  ctx.components = createComponentAccessor(entityId, entityManager, logger);
  return ctx;
}
