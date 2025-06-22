// src/entities/entityScopeService.js
 

import {
  EQUIPMENT_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
  ITEM_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../constants/componentIds.js';
import { isNonBlankString } from '../utils/textUtils.js';

// --- JSDoc Type Imports ---
/** @typedef {import('./entityManager.js').default} EntityManager */
/** @typedef {import('./entity.js').default} Entity */
/** @typedef {import('./entity.js').EntityId} EntityId */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

// --- REFACTOR START: Generic Scope Handler Factory ---

/**
 * @private
 * @description A factory function that creates a scope handler for scopes that are
 * derived from a component on the acting entity.
 * @param {string} componentId - The ID of the component to look for.
 * @param logger
 * @param {(componentData: object) => (string[] | null | undefined)} idExtractor -
 * A function that takes the component's data and returns an array of entity IDs.
 * @param {string} scopeNameForLogging - The name of the scope for logging purposes.
 * @returns {(context: ActionContext) => Set<EntityId>} A function that serves as a scope handler.
 */
function _createActorComponentScopeHandler(
  componentId,
  idExtractor,
  scopeNameForLogging,
  logger
) {
  /**
   * @param {ActionContext} context - The action context.
   * @returns {Set<EntityId>}
   */
  return (context) => {
    const { actingEntity } = context;
    if (!actingEntity) {
      logger.warn(
        `entityScopeService(#createActorComponentScopeHandler): Scope '${scopeNameForLogging}' requested but actingEntity is missing in context.`
      );
      return new Set();
    }

    if (!actingEntity.hasComponent(componentId)) {
      // This is not necessarily an error, just means the scope is empty for this actor.
      return new Set();
    }

    const componentData = actingEntity.getComponentData(componentId);
    if (!componentData) {
      logger.warn(
        `entityScopeService(#createActorComponentScopeHandler): Component data for '${componentId}' on actor ${actingEntity.id} is missing or malformed.`
      );
      return new Set();
    }

    const ids = idExtractor(componentData);
    if (!Array.isArray(ids)) {
      logger.warn(
        `entityScopeService(#createActorComponentScopeHandler): idExtractor for scope '${scopeNameForLogging}' did not return a valid array for actor ${actingEntity.id}.`
      );
      return new Set();
    }

    return new Set(ids.filter((id) => isNonBlankString(id)));
  };
}

// --- REFACTOR END ---

// --- Internal Scope Handler Functions ---

const _handleInventory = (logger) =>
  _createActorComponentScopeHandler(
    INVENTORY_COMPONENT_ID,
    (data) => data.items,
    'inventory',
    logger
  );

const _handleEquipment = (logger) =>
  _createActorComponentScopeHandler(
    EQUIPMENT_COMPONENT_ID,
    (data) => (data && data.slots ? Object.values(data.slots) : []),
    'equipment',
    logger
  );

const _handleFollowers = (logger) =>
  _createActorComponentScopeHandler(
    LEADING_COMPONENT_ID,
    (data) => data.followers,
    'followers',
    logger
  );

/**
 * Retrieves entity IDs from the current location, excluding the player.
 *
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleLocation(context, logger) {
  const { currentLocation, entityManager, actingEntity } = context;
  const results = new Set();

  if (!currentLocation) {
    logger.warn(
      "entityScopeService._handleLocation: Scope 'location' requested but currentLocation is null."
    );
    return results;
  }
  if (!entityManager) {
    logger.error(
      'entityScopeService._handleLocation: entityManager is missing in context. Cannot perform location lookup.'
    );
    return results;
  }

  const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);

  if (idsInLoc) {
    for (const id of idsInLoc) {
      if (actingEntity && id === actingEntity.id) {
        continue;
      }
      results.add(id);
    }
  }
  return results;
}

/**
 * Retrieves entity IDs from the current location that have an ItemComponent.
 *
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleLocationItems(context, logger) {
  const { entityManager } = context;
  if (!entityManager) {
    logger.error(
      'entityScopeService._handleLocationItems: entityManager is missing in context.'
    );
    return new Set();
  }
  const locationIds = _handleLocation(context, logger);
  const itemIds = new Set();
  for (const id of locationIds) {
    const entity = entityManager.getEntityInstance(id);
    if (entity?.hasComponent(ITEM_COMPONENT_ID)) {
      itemIds.add(id);
    }
  }
  return itemIds;
}

/**
 * Retrieves entity IDs from the current location that DO NOT have an ItemComponent.
 *
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleLocationNonItems(context, logger) {
  const { entityManager } = context;
  if (!entityManager) {
    logger.error(
      'entityScopeService._handleLocationNonItems: entityManager is missing in context.'
    );
    return new Set();
  }
  const locationIds = _handleLocation(context, logger);
  const nonItemIds = new Set();
  for (const id of locationIds) {
    const entity = entityManager.getEntityInstance(id);
    if (entity && !entity.hasComponent(ITEM_COMPONENT_ID)) {
      nonItemIds.add(id);
    }
  }
  return nonItemIds;
}

/**
 * Retrieves entity IDs from both inventory and location.
 *
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleNearby(context, logger) {
  const inventoryIds = _handleInventory(logger)(context);
  const locationIds = _handleLocation(context, logger);
  return new Set([...inventoryIds, ...locationIds]);
}

/**
 * Retrieves entity IDs from nearby scopes including blockers in exits.
 *
 * @param {ActionContext} context - Current action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleNearbyIncludingBlockers(context, logger) {
  const aggregatedIds = _handleNearby(context, logger);
  const { currentLocation, entityManager } = context;
  if (!entityManager || !currentLocation) return aggregatedIds;

  const exits = currentLocation.getComponentData(EXITS_COMPONENT_ID);
  if (Array.isArray(exits)) {
    for (const ex of exits) {
      if (ex?.blocker && typeof ex.blocker === 'string') {
        aggregatedIds.add(ex.blocker);
      }
    }
  }
  return aggregatedIds;
}

/**
 * Retrieves the entity ID of the actor itself.
 *
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>}
 * @private
 */
function _handleSelf(context, logger) {
  const { actingEntity } = context;
  if (!actingEntity || !actingEntity.id) {
    logger.warn(
      "entityScopeService._handleSelf: Scope 'self' requested but actingEntity or its ID is missing."
    );
    return new Set();
  }
  return new Set([actingEntity.id]);
}

// --- Strategy Map ---

/**
 * @type {{[key: string]: (context: ActionContext) => Set<EntityId>}}
 * @private
 */

// --- Public Aggregator Function ---

/**
 * Aggregates unique entity IDs from one or more specified scopes or target domains.
 *
 * @param {string | string[] | TargetDomain | TargetDomain[]} scopes - A single scope name or an array of them.
 * @param {ActionContext} context - The action context.
 * @param logger
 * @returns {Set<EntityId>} A single set of unique entity IDs.
 */
function getEntityIdsForScopes(scopes, context, logger = console) {
  const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
  const aggregatedIds = new Set();

  if (!context || !context.entityManager) {
    // FIX: Add the context object to the log call to provide more detail.
    logger.error(
      'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
      { context }
    );
    return aggregatedIds;
  }

  const scopeHandlers = {
    inventory: _handleInventory(logger),
    equipment: _handleEquipment(logger),
    followers: _handleFollowers(logger),
    location: (ctx) => _handleLocation(ctx, logger),
    location_items: (ctx) => _handleLocationItems(ctx, logger),
    location_non_items: (ctx) => _handleLocationNonItems(ctx, logger),
    nearby: (ctx) => _handleNearby(ctx, logger),
    nearby_including_blockers: (ctx) =>
      _handleNearbyIncludingBlockers(ctx, logger),
    self: (ctx) => _handleSelf(ctx, logger),
    environment: (ctx) => _handleLocation(ctx, logger),
  };

  for (const scopeName of requestedScopes) {
    const handler = scopeHandlers[scopeName];
    if (handler) {
      try {
        const scopeIds = handler(context);
        scopeIds.forEach((id) => aggregatedIds.add(id));
      } catch (error) {
        logger.error(
          `getEntityIdsForScopes: Error executing handler for scope '${scopeName}':`,
          error
        );
      }
    } else if (scopeName !== 'none' && scopeName !== 'direction') {
      logger.warn(
        `getEntityIdsForScopes: Unknown scope requested: '${scopeName}'. Skipping.`
      );
    }
  }
  return aggregatedIds;
}

// --- Exports ---
export { getEntityIdsForScopes };
