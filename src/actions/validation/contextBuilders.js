// src/actions/validation/contextBuilders.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { getExitByDirection } from '../../utils/locationUtils.js';
import { createComponentAccessor } from '../../logic/componentAccessor.js';
import { createEntityContext } from '../../logic/contextAssembler.js';

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
 * @returns {{type: 'entity', id: string, direction: null, components: object, blocker: undefined, exitDetails: null}}
 *   Target context for an entity.
 */
export function buildEntityTargetContext(entityId, entityManager, logger) {
  return {
    type: 'entity',
    id: entityId,
    direction: null,
    components: createComponentAccessor(entityId, entityManager, logger),
    blocker: undefined,
    exitDetails: null,
  };
}

/**
 * @description Build the target portion when targeting a direction.
 * @param {string} actorId - ID of the actor performing the action.
 * @param {string} direction - Direction keyword.
 * @param {EntityManager} entityManager - Manager to access components.
 * @param {ILogger} logger - Logger instance.
 * @returns {{type: 'direction', id: null, direction: string, components: null, blocker: any, exitDetails: any}}
 *   Target context for a direction.
 */
export function buildDirectionContext(
  actorId,
  direction,
  entityManager,
  logger
) {
  const actorPositionData = entityManager.getComponentData(
    actorId,
    POSITION_COMPONENT_ID
  );
  const actorLocationId = actorPositionData?.locationId;
  let targetBlockerValue = undefined;
  let targetExitDetailsValue = null;

  if (actorLocationId) {
    const matchedExit = getExitByDirection(
      actorLocationId,
      direction,
      entityManager,
      logger
    );
    if (matchedExit) {
      targetExitDetailsValue = matchedExit;
      targetBlockerValue = matchedExit.blocker ?? null;
    }
  }

  return {
    type: 'direction',
    id: null,
    direction,
    components: null,
    blocker: targetBlockerValue,
    exitDetails: targetExitDetailsValue,
  };
}
