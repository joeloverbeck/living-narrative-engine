// src/services/entityScopeService.js

import {
  CONNECTIONS_COMPONENT_TYPE_ID,
  EQUIPMENT_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
  ITEM_COMPONENT_ID, PASSAGE_DETAILS_COMPONENT_TYPE_ID
} from '../types/components.js'; // Used by _handleLocation via SpatialIndex

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
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs in the player's inventory.
 * @private
 */
function _handleInventory(context) {
  const {playerEntity} = context;
  if (!playerEntity) {
    console.warn("entityScopeService._handleInventory: Scope 'inventory' requested but playerEntity is missing in context.");
    return new Set();
  }
  // Correct: Use string ID for check
  if (!playerEntity.hasComponent(INVENTORY_COMPONENT_ID)) {
    // Consider updating warning message to reflect check against ID, not class
    console.warn(`entityScopeService._handleInventory: Scope 'inventory' requested but player ${playerEntity.id} lacks component data for ID "${INVENTORY_COMPONENT_ID}".`);
    return new Set();
  }
  // Correct: Use getComponentData with string ID
  const inventoryData = playerEntity.getComponentData(INVENTORY_COMPONENT_ID);

  // Correct: Access data property directly and validate structure
  if (!inventoryData || !Array.isArray(inventoryData.items)) {
    console.warn(`entityScopeService._handleInventory: Inventory data for player ${playerEntity.id} (component "${INVENTORY_COMPONENT_ID}") is missing or malformed.`);
    return new Set();
  }
  // Correct: Use the items array from the data
  return new Set(inventoryData.items);
}

/**
 * Retrieves entity IDs from the current location, excluding the player instance if provided in context.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs in the current location (excluding the player if context allows).
 * @private
 */
function _handleLocation(context) {
  const {currentLocation, entityManager, playerEntity} = context;
  const results = new Set();

  if (!currentLocation) {
    console.warn("entityScopeService._handleLocation: Scope 'location' (or derived) requested but currentLocation is null.");
    return results;
  }
  if (!entityManager) {
    console.error('entityScopeService._handleLocation: entityManager is missing in context. Cannot perform location lookup.');
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
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of entity IDs equipped by the player.
 * @private
 */
function _handleEquipment(context) {
  const {playerEntity} = context;
  if (!playerEntity) {
    console.warn("entityScopeService._handleEquipment: Scope 'equipment' requested but playerEntity is missing in context.");
    return new Set();
  }
  // Use the correct imported constant EQUIPMENT_COMPONENT_ID
  if (!playerEntity.hasComponent(EQUIPMENT_COMPONENT_ID)) {
    // Update warning to use the constant ID string
    console.warn(`entityScopeService._handleEquipment: Scope 'equipment' requested but player ${playerEntity.id} lacks component data for ID "${EQUIPMENT_COMPONENT_ID}".`);
    return new Set();
  }
  // Get the raw data object
  const equipmentData = playerEntity.getComponentData(EQUIPMENT_COMPONENT_ID);
  const equippedIds = new Set();

  // *** CORRECTED LOGIC ***
  // Check if data and the 'slots' property exist and are an object
  if (equipmentData && typeof equipmentData.slots === 'object' && equipmentData.slots !== null) {
    // Iterate over the values (item IDs) in the slots object
    Object.values(equipmentData.slots).forEach(itemId => {
      // Add the ID if it's truthy (i.e., not null, undefined, empty string)
      if (itemId) {
        equippedIds.add(itemId);
      }
    });
  } else {
    // Add a warning if the data structure is unexpected
    console.warn(`entityScopeService._handleEquipment: Equipment data or slots missing/malformed for player ${playerEntity.id} (component "${EQUIPMENT_COMPONENT_ID}").`);
  }
  // *** END CORRECTED LOGIC ***

  return equippedIds;
}

/**
 * Retrieves entity IDs from the current location that have an ItemComponent.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of item entity IDs in the location.
 * @private
 */
function _handleLocationItems(context) {
  const {entityManager} = context;
  if (!entityManager) {
    console.error('entityScopeService._handleLocationItems: entityManager is missing in context.');
    return new Set();
  }

  // 1. Get IDs in location
  const locationIds = _handleLocation(context); // Assumes _handleLocation works
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
      // Handle dangling IDs (as your test checks)
      console.warn(`entityScopeService._handleLocationItems: Entity ID ${id} from location scope not found in entityManager when checking for component ${ITEM_COMPONENT_ID}.`);
    }
    // No 'else' needed here - if it's not an item, we just don't add it.
  }
  return itemIds;
}

/**
 * Retrieves entity IDs from the current location that DO NOT have an ItemComponent.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of non-item entity IDs in the location.
 * @private
 */
function _handleLocationNonItems(context) {
  const {entityManager} = context;
  if (!entityManager) {
    console.error('entityScopeService._handleLocationNonItems: entityManager is missing in context.');
    return new Set();
  }
  const locationIds = _handleLocation(context);
  const nonItemIds = new Set();

  for (const id of locationIds) {
    const entity = entityManager.getEntityInstance(id);
    if (entity && !entity.hasComponent(ITEM_COMPONENT_ID)) {
      nonItemIds.add(id);
    } else if (!entity) {
      console.warn(`entityScopeService._handleLocationNonItems: Entity ID ${id} from location scope not found in entityManager when checking for non-ItemComponent.`);
    }
  }
  return nonItemIds;
}

/**
 * Retrieves entity IDs from both the player's inventory and the current location (excluding player).
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A combined set of unique entity IDs from inventory and location.
 * @private
 */
function _handleNearby(context) {
  const inventoryIds = _handleInventory(context);
  const locationIds = _handleLocation(context);
  return new Set([...inventoryIds, ...locationIds]);
}

/**
 * Finds entities in the current location, player inventory, plus blocker entities
 * associated with passages connected to the current location.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of relevant entity IDs (location, inventory, blockers).
 * @private
 */
function _handleNearbyIncludingBlockers(context) {
  // Start by getting the nearby IDs (inventory + location)
  const aggregatedIds = _handleNearby(context); // Use _handleNearby directly

  const {entityManager, currentLocation} = context;
  if (!entityManager) {
    console.warn('entityScopeService._handleNearbyIncludingBlockers: entityManager missing in context. Cannot check for blockers.');
    return aggregatedIds; // Return nearby IDs if no EM
  }
  if (!currentLocation) {
    console.warn('entityScopeService._handleNearbyIncludingBlockers: currentLocation missing in context. Cannot check for blockers.');
    return aggregatedIds; // Return nearby IDs if no location
  }

  // Check if location HAS the connections component data
  if (!currentLocation.hasComponent(CONNECTIONS_COMPONENT_TYPE_ID)) {
    return aggregatedIds; // No connections component, just return nearby IDs
  }

  // Get the RAW DATA object for connections
  const connectionsCompData = currentLocation.getComponentData(CONNECTIONS_COMPONENT_TYPE_ID);

  // Validate the structure of the raw data BEFORE accessing properties
  if (!connectionsCompData || typeof connectionsCompData.connections !== 'object' || connectionsCompData.connections === null) {
    console.warn(`entityScopeService._handleNearbyIncludingBlockers: Connections component data missing or malformed for location ${currentLocation.id}. Cannot check for blockers.`);
    return aggregatedIds; // Data malformed, return nearby IDs
  }

  // Access the 'connections' property from the data object
  const connectionsMap = connectionsCompData.connections;

  // Iterate over the VALUES of the connections map
  // (assuming the values are objects like { connectionEntityId: '...', ... })
  for (const connectionInfo of Object.values(connectionsMap)) {
    // Add validation for connectionInfo structure if needed
    if (!connectionInfo || typeof connectionInfo.connectionEntityId !== 'string') {
      console.warn(`entityScopeService._handleNearbyIncludingBlockers: Malformed connection info found for location ${currentLocation.id}:`, connectionInfo);
      continue; // Skip this malformed connection
    }

    const passageEntity = entityManager.getEntityInstance(connectionInfo.connectionEntityId);
    if (!passageEntity) {
      console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity instance not found for ID '${connectionInfo.connectionEntityId}'. Skipping blocker check.`);
      continue; // Skip if passage entity doesn't exist
    }

    // Check if passage HAS the details component DATA
    if (!passageEntity.hasComponent(PASSAGE_DETAILS_COMPONENT_TYPE_ID)) {
      // Updated warning to be more specific about missing *data*
      console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity '${passageEntity.id}' lacks component data for ${PASSAGE_DETAILS_COMPONENT_TYPE_ID}. Cannot check for blocker.`);
      continue; // Skip if details component data is missing
    }

    // Get the RAW DATA for passage details
    const passageDetailsData = passageEntity.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);

    // Access the blocker ID directly from the data object, check if it's a non-empty string
    const blockerEntityId = passageDetailsData?.blockerEntityId; // Use optional chaining

    if (typeof blockerEntityId === 'string' && blockerEntityId.trim() !== '') {
      aggregatedIds.add(blockerEntityId); // Add the blocker ID

      // Optional: Keep the warning if the blocker *instance* itself is missing
      if (!entityManager.getEntityInstance(blockerEntityId)) {
        console.warn(`entityScopeService._handleNearbyIncludingBlockers: Added blocker ID '${blockerEntityId}' but instance not found.`);
      }
    }
  }
  return aggregatedIds; // Return the set containing nearby IDs + any valid blocker IDs
}

/**
 * Retrieves the entity ID of the actor itself.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set containing only the player's entity ID, or an empty set if the player entity is not available.
 * @private
 */
function _handleSelf(context) {
  const {playerEntity} = context;
  if (!playerEntity || !playerEntity.id) {
    console.warn("entityScopeService._handleSelf: Scope 'self' requested but playerEntity or playerEntity.id is missing in context.");
    return new Set();
  }
  return new Set([playerEntity.id]);
}


// --- Strategy Map ---

/**
 * Maps scope names (including TargetDomain values where applicable) to their respective handler functions.
 * @type {Object.<string, (context: ActionContext) => Set<EntityId>>}
 * @private
 */
const scopeHandlers = {
  // Original Scope Keys
  'inventory': _handleInventory,
  'location': _handleLocation,
  'equipment': _handleEquipment,
  'location_items': _handleLocationItems,
  'location_non_items': _handleLocationNonItems,
  'nearby': _handleNearby,
  'nearby_including_blockers': _handleNearbyIncludingBlockers,

  // Mappings for TargetDomain values
  'self': _handleSelf,                     // Maps 'self' domain to the new handler
  'environment': _handleNearbyIncludingBlockers, // Maps 'environment' domain to nearby+blockers logic

  // Domains 'direction' and 'none' are not expected to resolve to entity IDs here.
  // The calling service (Action Discovery) should handle these cases before calling this function for entity resolution.
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
 * @returns {Set<EntityId>} A single set containing unique entity IDs gathered from all valid requested scopes/domains.
 */
function getEntityIdsForScopes(scopes, context) {
  const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
  const aggregatedIds = new Set();

  if (!context || !context.entityManager) {
    console.error('getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.', {context});
    return aggregatedIds;
  }

  for (const scopeName of requestedScopes) {
    const handler = scopeHandlers[scopeName];

    if (!handler) {
      // Explicitly ignore 'none' and 'direction' if passed, as they don't yield entity IDs
      if (scopeName === 'none' || scopeName === 'direction') {
        console.log(`getEntityIdsForScopes: Scope '${scopeName}' does not resolve to entity IDs. Skipping.`);
        continue;
      }
      // Warn for other unknown scopes
      console.warn(`getEntityIdsForScopes: Unknown or unhandled scope/domain requested: '${scopeName}'. Skipping.`);
      continue;
    }

    try {
      const scopeIds = handler(context);
      scopeIds.forEach(id => aggregatedIds.add(id));
    } catch (error) {
      console.error(`getEntityIdsForScopes: Error executing handler for scope/domain '${scopeName}':`, error);
    }
  }

  return aggregatedIds;
}

// --- Exports ---
export {getEntityIdsForScopes};