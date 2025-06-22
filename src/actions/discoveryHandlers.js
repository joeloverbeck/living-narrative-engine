// src/actions/discoveryHandlers.js
// -----------------------------------------------------------------------------
// Type imports
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../actions/actionDiscoveryService.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../actions/actionDiscoveryService.js').ActionContext} ActionContext */

import { ActionTargetContext } from '../models/actionTargetContext.js';
import { getAvailableExits } from '../utils/locationUtils.js';

/**
 * Handles discovery for actions targeting "self" or with no target.
 *
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {Entity|string|null} _currentLocation - Unused current location.
 * @param {string} _locIdForLog - Unused location id.
 * @param {string} _domain - Unused domain.
 * @param {ActionContext} _context - Unused context.
 * @param {object} formatterOptions - Options for command formatting.
 * @param {object} deps - Additional dependencies.
 * @param {Function} deps.buildDiscoveredAction - Builder for action info.
 * @returns {DiscoveredActionInfo[]} List of discovered actions.
 */
export function discoverSelfOrNone(
  actionDef,
  actorEntity,
  _currentLocation,
  _locIdForLog,
  _domain,
  _context,
  formatterOptions,
  { buildDiscoveredAction }
) {
  const targetCtx =
    actionDef.target_domain === 'self'
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
 * Handles discovery for actions targeting a direction.
 *
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {Entity|string|null} currentLocation - The actor's current location.
 * @param {string} locIdForLog - Location id used for logging.
 * @param {string} _domain - Unused domain.
 * @param {ActionContext} _context - Unused context.
 * @param {object} formatterOptions - Options for command formatting.
 * @param {object} deps - Additional dependencies.
 * @param {Function} deps.buildDiscoveredAction - Builder for action info.
 * @param {import('../entities/entityManager.js').default} deps.entityManager - Entity manager.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for events.
 * @param {import('../logging/consoleLogger.js').default} deps.logger - Logger instance.
 * @returns {DiscoveredActionInfo[]} List of discovered actions.
 */
export function discoverDirectionalActions(
  actionDef,
  actorEntity,
  currentLocation,
  locIdForLog,
  _domain,
  _context,
  formatterOptions,
  { buildDiscoveredAction, entityManager, safeEventDispatcher, logger }
) {
  if (!currentLocation) {
    logger.debug(
      `No location for actor ${actorEntity.id}; skipping direction-based actions.`
    );
    return [];
  }

  const exits = getAvailableExits(
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
      {
        targetId: exit.target,
      }
    );

    if (action) {
      discoveredActions.push(action);
    }
  }

  return discoveredActions;
}

/**
 * Handles discovery for actions targeting entities via scope domains.
 *
 * @param {ActionDefinition} actionDef - The action definition.
 * @param {Entity} actorEntity - The acting entity.
 * @param {Entity|string|null} _currentLocation - Unused current location.
 * @param {string} _locIdForLog - Unused location id.
 * @param {string} domain - Target domain for entity lookup.
 * @param {ActionContext} context - The action context.
 * @param {object} formatterOptions - Options for command formatting.
 * @param {object} deps - Additional dependencies.
 * @param {Function} deps.buildDiscoveredAction - Builder for action info.
 * @param {Function} deps.getEntityIdsForScopesFn - Scope resolution function.
 * @param {import('../logging/consoleLogger.js').default} deps.logger - Logger instance.
 * @returns {DiscoveredActionInfo[]} List of discovered actions.
 */
export function discoverScopedEntityActions(
  actionDef,
  actorEntity,
  _currentLocation,
  _locIdForLog,
  domain,
  context,
  formatterOptions,
  { buildDiscoveredAction, getEntityIdsForScopesFn, logger }
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
      {
        targetId,
      }
    );

    if (action) {
      discoveredActions.push(action);
    }
  }

  return discoveredActions;
}
