// src/actions/discoveryHandlers.js

/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../interfaces/IActionDiscoveryService.js').ActionContext} ActionContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../logging/consoleLogger.js').default} ILogger */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { getAvailableExits } from '../utils/locationUtils.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
  TARGET_DOMAIN_DIRECTION,
} from '../constants/targetDomains.js';

/**
 * @description Handles discovery for actions targeting 'self' or having no target.
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {object} formatterOptions - Options for command formatting.
 * @param {function(ActionDefinition, Entity, ActionTargetContext, object, object=): DiscoveredActionInfo|null} buildDiscoveredAction -
 *  Callback to build the DiscoveredActionInfo.
 * @returns {DiscoveredActionInfo[]}
 */
export function discoverSelfOrNone(
  actionDef,
  actorEntity,
  formatterOptions,
  buildDiscoveredAction
) {
  const targetCtx =
    actionDef.target_domain === TARGET_DOMAIN_SELF
      ? ActionTargetContext.forEntity(actorEntity.id)
      : ActionTargetContext.noTarget();

  const action = buildDiscoveredAction(
    actionDef,
    actorEntity,
    targetCtx,
    formatterOptions
  );

  return [action].filter(Boolean);
}

/**
 * @description Handles discovery for actions targeting a direction.
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {Entity|string|null} currentLocation - Current location entity or ID.
 * @param {string} locIdForLog - Location ID used for logging.
 * @param {object} formatterOptions - Formatter options.
 * @param {function(ActionDefinition, Entity, ActionTargetContext, object, object=): DiscoveredActionInfo|null} buildDiscoveredAction -
 *  Callback to build the DiscoveredActionInfo.
 * @param {EntityManager} entityManager - Entity manager for exit discovery.
 * @param {ISafeEventDispatcher} safeEventDispatcher - Dispatcher for safe events.
 * @param {ILogger} logger - Logger for diagnostics.
 * @param {function(Entity|string, EntityManager, ISafeEventDispatcher, ILogger): import('../utils/locationUtils.js').ExitData[]} [getAvailableExitsFn] -
 *  Function to fetch available exits.
 * @returns {DiscoveredActionInfo[]}
 */
export function discoverDirectionalActions(
  actionDef,
  actorEntity,
  currentLocation,
  locIdForLog,
  formatterOptions,
  buildDiscoveredAction,
  entityManager,
  safeEventDispatcher,
  logger,
  getAvailableExitsFn = getAvailableExits
) {
  if (!currentLocation) {
    logger.debug(
      `No location for actor ${actorEntity.id}; skipping direction-based actions.`
    );
    return [];
  }

  const exits = getAvailableExitsFn(
    currentLocation,
    entityManager,
    safeEventDispatcher,
    logger
  );
  logger.debug(
    `Found ${exits.length} available exits for location: ${locIdForLog} via getAvailableExits.`
  );

  /** @type {DiscoveredActionInfo[]} */
  const discoveredActions = [];

  for (const exit of exits) {
    const targetCtx = ActionTargetContext.forDirection(exit.direction);

    const action = buildDiscoveredAction(
      actionDef,
      actorEntity,
      targetCtx,
      formatterOptions,
      { targetId: exit.target }
    );

    if (action) {
      discoveredActions.push(action);
    }
  }

  return discoveredActions;
}

/**
 * @description Handles discovery for actions targeting entities via scope domains.
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {string} domain - The target domain.
 * @param {ActionContext} context - Current action context.
 * @param {object} formatterOptions - Formatter options.
 * @param {function(ActionDefinition, Entity, ActionTargetContext, object, object=): DiscoveredActionInfo|null} buildDiscoveredAction -
 *  Callback to build the DiscoveredActionInfo.
 * @param {(domains: string[], context: ActionContext, logger: ILogger) => Set<string>} getEntityIdsForScopesFn -
 *  Function to resolve entity IDs for scopes.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {DiscoveredActionInfo[]}
 */
export function discoverScopedEntityActions(
  actionDef,
  actorEntity,
  domain,
  context,
  formatterOptions,
  buildDiscoveredAction,
  getEntityIdsForScopesFn,
  logger
) {
  const targetIds =
    getEntityIdsForScopesFn([domain], context, logger) ?? new Set();
  /** @type {DiscoveredActionInfo[]} */
  const discoveredActions = [];

  for (const targetId of targetIds) {
    const targetCtx = ActionTargetContext.forEntity(targetId);

    const action = buildDiscoveredAction(
      actionDef,
      actorEntity,
      targetCtx,
      formatterOptions,
      { targetId }
    );

    if (action) {
      discoveredActions.push(action);
    }
  }

  return discoveredActions;
}
