// src/services/entityScopeService.js
/* eslint-disable no-console */

import {
  EQUIPMENT_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
  ITEM_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../constants/componentIds.js'; // Used by _handleLocation via SpatialIndex

// --- JSDoc Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entity.js').EntityId} EntityId */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/connectionsComponent.js').ConnectionInfo} ConnectionInfo */
/** @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain */ // <-- Added TargetDomain type

// --- Internal Scope Handler Functions ---

/**
 * Retrieves entity IDs from the player's inventory.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs in the player's inventory.
 * @private
 */
function _handleInventory(context) {
  const { playerEntity } = context;
  if (!playerEntity) {
    console.warn(
      "entityScopeService._handleInventory: Scope 'inventory' requested but playerEntity is missing in context."
    );
    return new Set();
  }
  // Correct: Use string ID for check
  if (!playerEntity.hasComponent(INVENTORY_COMPONENT_ID)) {
    // Consider updating warning message to reflect check against ID, not class
    console.warn(
      `entityScopeService._handleInventory: Scope 'inventory' requested but player ${playerEntity.id} lacks component data for ID "${INVENTORY_COMPONENT_ID}".`
    );
    return new Set();
  }
  // Correct: Use getComponentData with string ID
  const inventoryData = playerEntity.getComponentData(INVENTORY_COMPONENT_ID);

  // Correct: Access data property directly and validate structure
  // Assumes the inventory component data has an 'items' array.
  if (!inventoryData || !Array.isArray(inventoryData.items)) {
    console.warn(
      `entityScopeService._handleInventory: Inventory data for player ${playerEntity.id} (component "${INVENTORY_COMPONENT_ID}") is missing, malformed, or does not contain an 'items' array.`
    );
    return new Set();
  }
  // Correct: Use the items array from the data
  return new Set(
    inventoryData.items.filter((id) => typeof id === 'string' && id)
  ); // Ensure only valid string IDs
}

/**
 * Retrieves entity IDs from the current location, excluding the player instance if provided in context.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs in the current location (excluding the player if context allows).
 * @private
 */
function _handleLocation(context) {
  const { currentLocation, entityManager, playerEntity } = context;
  const results = new Set();

  if (!currentLocation) {
    console.warn(
      "entityScopeService._handleLocation: Scope 'location' (or derived) requested but currentLocation is null."
    );
    return results;
  }
  if (!entityManager) {
    console.error(
      'entityScopeService._handleLocation: entityManager is missing in context. Cannot perform location lookup.'
    );
    return results;
  }

  const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id); // Uses spatial index

  if (idsInLoc) {
    for (const id of idsInLoc) {
      // Exclude the player entity ID directly
      if (playerEntity && id === playerEntity.id) {
        continue;
      }
      results.add(id);
    }
  }
  return results;
}

/**
 * Retrieves entity IDs from the player's equipped items.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs equipped by the player.
 * @private
 */
function _handleEquipment(context) {
  const { playerEntity } = context;
  if (!playerEntity) {
    console.warn(
      "entityScopeService._handleEquipment: Scope 'equipment' requested but playerEntity is missing in context."
    );
    return new Set();
  }
  // Use the correct imported constant EQUIPMENT_COMPONENT_ID
  if (!playerEntity.hasComponent(EQUIPMENT_COMPONENT_ID)) {
    // Update warning to use the constant ID string
    console.warn(
      `entityScopeService._handleEquipment: Scope 'equipment' requested but player ${playerEntity.id} lacks component data for ID "${EQUIPMENT_COMPONENT_ID}".`
    );
    return new Set();
  }
  // Get the raw data object
  const equipmentData = playerEntity.getComponentData(EQUIPMENT_COMPONENT_ID);
  const equippedIds = new Set();

  // *** CORRECTED LOGIC ***
  // Check if data and the 'slots' property exist and are an object
  if (
    equipmentData &&
    typeof equipmentData.slots === 'object' &&
    equipmentData.slots !== null
  ) {
    // Iterate over the values (item IDs) in the slots object
    Object.values(equipmentData.slots).forEach((itemId) => {
      // Add the ID if it's truthy (i.e., not null, undefined, empty string)
      if (itemId && typeof itemId === 'string') {
        // Ensure it's a string ID
        equippedIds.add(itemId);
      }
    });
  } else {
    // Add a warning if the data structure is unexpected
    console.warn(
      `entityScopeService._handleEquipment: Equipment data or slots missing/malformed for player ${playerEntity.id} (component "${EQUIPMENT_COMPONENT_ID}").`
    );
  }
  // *** END CORRECTED LOGIC ***

  return equippedIds;
}

/**
 * Retrieves entity IDs from the current location that have an ItemComponent.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of item entity IDs in the location.
 * @private
 */
function _handleLocationItems(context) {
  const { entityManager } = context;
  if (!entityManager) {
    console.error(
      'entityScopeService._handleLocationItems: entityManager is missing in context.'
    );
    return new Set();
  }

  // 1. Get IDs in location (this already excludes the player)
  const locationIds = _handleLocation(context);
  const itemIds = new Set();

  // 2. Iterate
  for (const id of locationIds) {
    // 3. Get instance
    const entity = entityManager.getEntityInstance(id);

    // 4. Check instance and component existence using the correct TYPE ID
    if (entity && entity.hasComponent(ITEM_COMPONENT_ID)) {
      // 5. Add ID if it's an item
      itemIds.add(id);
    } else if (!entity) {
      // Handle dangling IDs
      console.warn(
        `entityScopeService._handleLocationItems: Entity ID ${id} from location scope not found in entityManager when checking for component ${ITEM_COMPONENT_ID}.`
      );
    }
  }
  return itemIds;
}

/**
 * Retrieves entity IDs from the current location that DO NOT have an ItemComponent.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of non-item entity IDs in the location.
 * @private
 */
function _handleLocationNonItems(context) {
  const { entityManager } = context;
  if (!entityManager) {
    console.error(
      'entityScopeService._handleLocationNonItems: entityManager is missing in context.'
    );
    return new Set();
  }
  const locationIds = _handleLocation(context); // This already excludes the player
  const nonItemIds = new Set();

  for (const id of locationIds) {
    const entity = entityManager.getEntityInstance(id);
    if (entity && !entity.hasComponent(ITEM_COMPONENT_ID)) {
      nonItemIds.add(id);
    } else if (!entity) {
      console.warn(
        `entityScopeService._handleLocationNonItems: Entity ID ${id} from location scope not found in entityManager when checking for non-ItemComponent.`
      );
    }
  }
  return nonItemIds;
}

/**
 * Retrieves entity IDs from both the player's inventory and the current location (excluding player).
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A combined set of unique entity IDs from inventory and location.
 * @private
 */
function _handleNearby(context) {
  const inventoryIds = _handleInventory(context);
  const locationIds = _handleLocation(context); // Excludes player
  return new Set([...inventoryIds, ...locationIds]);
}

/**
 * Retrieves entity IDs from nearby scopes including blockers in exits.
 *
 * @param {ActionContext} context - Current action context.
 * @returns {Set<EntityId>} Aggregated entity IDs including blockers.
 * @private
 */
function _handleNearbyIncludingBlockers(context) {
  const aggregatedIds = _handleNearby(context); // inventory + location (player excluded from location part)
  const { currentLocation, entityManager } = context;
  if (!entityManager || !currentLocation) return aggregatedIds;

  const exits = currentLocation.getComponentData(EXITS_COMPONENT_ID);
  if (Array.isArray(exits)) {
    for (const ex of exits) {
      if (ex?.blocker && typeof ex.blocker === 'string') {
        aggregatedIds.add(ex.blocker);
        if (!entityManager.getEntityInstance(ex.blocker)) {
          console.warn(
            `_handleNearbyIncludingBlockers: blocker '${ex.blocker}' referenced by location '${currentLocation.id}' not found`
          );
        }
      }
    }
  } else {
    console.warn(
      `_handleNearbyIncludingBlockers: location '${currentLocation.id}' missing core:exits component data or it's not an array`
    );
  }

  return aggregatedIds;
}

/**
 * Retrieves the entity ID of the actor itself.
 *
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set containing only the player's entity ID, or an empty set if the player entity is not available.
 * @private
 */
function _handleSelf(context) {
  const { playerEntity } = context;
  if (!playerEntity || !playerEntity.id) {
    console.warn(
      "entityScopeService._handleSelf: Scope 'self' requested but playerEntity or playerEntity.id is missing in context."
    );
    return new Set();
  }
  return new Set([playerEntity.id]);
}

// --- Strategy Map ---

/**
 * Maps scope names (including TargetDomain values where applicable) to their respective handler functions.
 *
 * @type {{[key: string]: (context: ActionContext) => Set<EntityId>}}
 * @private
 */
const scopeHandlers = {
  // Original Scope Keys
  inventory: _handleInventory,
  location: _handleLocation, // Entities in current location, excluding the player
  equipment: _handleEquipment,
  location_items: _handleLocationItems, // Items in current location, excluding player
  location_non_items: _handleLocationNonItems, // Non-items in current location, excluding player
  nearby: _handleNearby, // Inventory + Location (player excluded from location part)
  nearby_including_blockers: _handleNearbyIncludingBlockers, // Nearby + Exit Blockers

  // Mappings for TargetDomain values
  self: _handleSelf, // Maps 'self' domain to the new handler
  environment: _handleLocation, // CRITICAL CHANGE FOR TargetResolutionService:
  // 'environment' domain for target resolution will now use '_handleLocation',
  // which means entities in the current room, excluding the actor.
  // This is a more focused interpretation than 'nearby_including_blockers'.
  // If 'nearby_including_blockers' is truly desired for some use of 'environment'
  // scope, a new distinct scope name should be used or the caller must be specific.

  // Domains 'direction' and 'none' are not expected to resolve to entity IDs here.
};

// --- Public Aggregator Function ---

/**
 * Aggregates unique entity IDs from one or more specified scopes or target domains.
 * Handles unknown scopes gracefully. Accepts scope strings like 'inventory', 'location',
 * 'nearby', etc., as well as TargetDomain values like 'self', 'environment'.
 * TargetDomains 'direction' and 'none' should be handled by the calling service
 * and not passed here if entity resolution is desired.
 *
 * @param {string | string[] | TargetDomain | TargetDomain[]} scopes - A single scope/domain name or an array of scope/domain names.
 * @param {ActionContext} context - The action context containing player, location, entityManager, etc.
 * Note: `playerEntity` corresponds to `actingEntity`, `currentLocation` to the actor's location.
 * @returns {Set<EntityId>} A single set containing unique entity IDs gathered from all valid requested scopes/domains.
 */
function getEntityIdsForScopes(scopes, context) {
  const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
  const aggregatedIds = new Set();

  if (!context || !context.entityManager) {
    console.error(
      'getEntityIdsForScopes: Invalid or incomplete context provided (entityManager is crucial). Cannot proceed.',
      { context }
    );
    return aggregatedIds;
  }
  // Ensure playerEntity and currentLocation are available in the context if scopes require them.
  // Some scopes like 'self', 'inventory', 'equipment' require playerEntity.
  // Some scopes like 'location', 'environment' require currentLocation and playerEntity (for exclusion).
  // The handlers themselves check for these, but a general check might be useful.

  for (const scopeName of requestedScopes) {
    const handler = scopeHandlers[scopeName];

    if (!handler) {
      // Explicitly ignore 'none' and 'direction' if passed, as they don't yield entity IDs
      if (scopeName === 'none' || scopeName === 'direction') {
        console.log(
          `getEntityIdsForScopes: Scope '${scopeName}' does not resolve to entity IDs. Skipping.`
        );
        continue;
      }
      // Warn for other unknown scopes
      console.warn(
        `getEntityIdsForScopes: Unknown or unhandled scope/domain requested: '${scopeName}'. Skipping.`
      );
      continue;
    }

    try {
      const scopeIds = handler(context);
      scopeIds.forEach((id) => aggregatedIds.add(id));
    } catch (error) {
      console.error(
        `getEntityIdsForScopes: Error executing handler for scope/domain '${scopeName}':`,
        error
      );
    }
  }

  return aggregatedIds;
}

// --- Exports ---
export { getEntityIdsForScopes };
