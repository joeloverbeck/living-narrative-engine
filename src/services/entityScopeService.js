// src/services/entityScopeService.js

import {InventoryComponent} from '../components/inventoryComponent.js'; // Adjust path as needed
import {EquipmentComponent} from '../components/equipmentComponent.js'; // Adjust path as needed
import {ItemComponent} from '../components/itemComponent.js'; // Adjust path as needed
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Required for new logic
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js'; // Required for new logic
import {PositionComponent} from '../components/positionComponent.js'; // Used by _handleLocation via SpatialIndex

// --- JSDoc Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entity.js').EntityId} EntityId */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/connectionsComponent.js').ConnectionInfo} ConnectionInfo */

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
    if (!playerEntity.hasComponent(InventoryComponent)) {
        console.warn(`entityScopeService._handleInventory: Scope 'inventory' requested but player ${playerEntity.id} lacks InventoryComponent.`);
        return new Set();
    }
    const inventory = playerEntity.getComponent(InventoryComponent);
    // Convert the array from getItems() to a Set
    return new Set(inventory.getItems());
}

/**
 * Retrieves entity IDs from the current location, excluding the player instance if provided in context.
 * Warns if entity instances for listed IDs cannot be found (dangling IDs).
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
    // Ensure entityManager is available for spatial index lookup
    if (!entityManager) {
        console.error("entityScopeService._handleLocation: entityManager is missing in context. Cannot perform location lookup.");
        return results;
    }

    const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id); // Uses spatial index

    if (idsInLoc) {
        for (const id of idsInLoc) {
            // No need to check instance here, spatial index should be reliable.
            // We only need to exclude the player.

            // Exclude the player entity ID directly
            if (playerEntity && id === playerEntity.id) {
                continue;
            }

            results.add(id);
        }
    }
    // Note: No longer need to check for dangling IDs here as spatial index should be more robust.
    // Optional: Log if no entities are found in the location map entry
    // else {
    //     console.log(`entityScopeService._handleLocation: No entities found registered for location ${currentLocation.id}.`);
    // }

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
    if (!playerEntity.hasComponent(EquipmentComponent)) {
        console.warn(`entityScopeService._handleEquipment: Scope 'equipment' requested but player ${playerEntity.id} lacks EquipmentComponent.`);
        return new Set();
    }
    const equipment = playerEntity.getComponent(EquipmentComponent);
    const equippedIds = new Set();
    // Iterate over values (entity IDs) in the equipped slots map
    Object.values(equipment.getAllEquipped()).forEach(id => {
        if (id) { // Filter out null/undefined values representing empty slots
            equippedIds.add(id);
        }
    });
    return equippedIds;
}

/**
 * Retrieves entity IDs from the current location that have an ItemComponent.
 * Relies on _handleLocation for initial gathering and player exclusion.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of item entity IDs in the location.
 * @private
 */
function _handleLocationItems(context) {
    const {entityManager} = context;
    if (!entityManager) {
        console.error("entityScopeService._handleLocationItems: entityManager is missing in context.");
        return new Set();
    }
    // Get IDs from location, already excluding player (if context available)
    const locationIds = _handleLocation(context);
    const itemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        // Check if the entity exists and has ItemComponent
        if (entity && entity.hasComponent(ItemComponent)) {
            itemIds.add(id);
        } else if (!entity) {
            // This case *shouldn't* happen often if _handleLocation uses spatial index correctly,
            // but good to have a fallback warning.
            console.warn(`entityScopeService._handleLocationItems: Entity ID ${id} from location scope not found in entityManager when checking for ItemComponent.`);
        }
    }
    return itemIds;
}

/**
 * Retrieves entity IDs from the current location that DO NOT have an ItemComponent.
 * Relies on _handleLocation for initial gathering and player exclusion.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of non-item entity IDs in the location.
 * @private
 */
function _handleLocationNonItems(context) {
    const {entityManager} = context;
    if (!entityManager) {
        console.error("entityScopeService._handleLocationNonItems: entityManager is missing in context.");
        return new Set();
    }
    // Get IDs from location, already excluding player (if context available)
    const locationIds = _handleLocation(context);
    const nonItemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        // Check if the entity exists and does NOT have ItemComponent
        if (entity && !entity.hasComponent(ItemComponent)) {
            nonItemIds.add(id);
        } else if (!entity) {
            // Fallback warning similar to _handleLocationItems
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
    // _handleLocation excludes player and uses spatial index
    const locationIds = _handleLocation(context);
    // Combine sets using spread syntax into a new Set constructor - handles uniqueness automatically
    return new Set([...inventoryIds, ...locationIds]);
}

// ========================================================================
// == IMPLEMENTATION of _handleNearbyIncludingBlockers based on Ticket ==
// ========================================================================
/**
 * Finds entities in the current location, player inventory, plus blocker entities
 * associated with passages connected to the current location.
 * Implements ticket: feat(scope): Implement logic for _handleNearbyIncludingBlockers
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of relevant entity IDs (location, inventory, blockers).
 * @private
 */
function _handleNearbyIncludingBlockers(context) {
    // AC 1: Initialize an empty Set
    const aggregatedIds = new Set();

    // AC 2: Call _handleNearby and add results
    const nearbyIds = _handleNearby(context);
    nearbyIds.forEach(id => aggregatedIds.add(id));

    // AC 3: Safely check for context.currentLocation and context.entityManager
    const {entityManager, currentLocation} = context;
    if (!entityManager) {
        console.warn("entityScopeService._handleNearbyIncludingBlockers: entityManager missing in context. Cannot check for blockers.");
        return aggregatedIds; // Return IDs found by _handleNearby
    }
    if (!currentLocation) {
        console.warn("entityScopeService._handleNearbyIncludingBlockers: currentLocation missing in context. Cannot check for blockers.");
        return aggregatedIds; // Return IDs found by _handleNearby
    }

    // AC 4: Check if currentLocation has ConnectionsComponent
    if (!currentLocation.hasComponent(ConnectionsComponent)) {
        // This is a valid state, just means no connections to check for blockers
        return aggregatedIds;
    }

    // AC 5: Retrieve ConnectionsComponent instance
    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

    // AC 6: Get the list of connections
    const connections = connectionsComp.getAllConnections(); // Returns Array<{ direction: string, connectionEntityId: string }>

    // AC 7: Iterate through each connection
    for (const connection of connections) {
        // AC 7a: Retrieve the passage entity instance
        const passageEntity = entityManager.getEntityInstance(connection.connectionEntityId);

        // AC 7b: If passage instance not found, log warning and continue
        if (!passageEntity) {
            console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity instance not found for ID '${connection.connectionEntityId}' (connected to location '${currentLocation.id}'). Skipping blocker check for this connection.`);
            continue;
        }

        // AC 7c: Check if the passage entity has PassageDetailsComponent
        if (!passageEntity.hasComponent(PassageDetailsComponent)) {
            console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity '${passageEntity.id}' lacks PassageDetailsComponent. Cannot check for blocker. Entity:`, passageEntity);
            continue;
        }

        // AC 7d: Retrieve PassageDetailsComponent instance
        const passageDetailsComp = passageEntity.getComponent(PassageDetailsComponent);

        // AC 7e: Get the blocker entity ID
        const blockerEntityId = passageDetailsComp.getBlockerId(); // Returns string | null

        // AC 7f: If a non-empty blockerEntityId string is returned, add it
        if (typeof blockerEntityId === 'string' && blockerEntityId.trim() !== '') {
            aggregatedIds.add(blockerEntityId);

            // AC 7g: (Optional but Recommended) Check if blocker instance exists
            const blockerInstance = entityManager.getEntityInstance(blockerEntityId);
            if (!blockerInstance) {
                // Log warning if the instance itself is missing, even though we added the ID
                console.warn(`entityScopeService._handleNearbyIncludingBlockers: Added blocker ID '${blockerEntityId}' from passage '${passageEntity.id}', but the blocker entity instance was not found in entityManager.`);
            }
        }
        // If blockerEntityId is null, undefined, empty, or not a string, do nothing.
    }

    // AC 8: Return the final aggregatedIds set
    return aggregatedIds;
}

// ========================================================================
// == END IMPLEMENTATION                                               ==
// ========================================================================


// --- Strategy Map ---

/**
 * Maps scope names to their respective handler functions.
 * @type {Object.<string, (context: ActionContext) => Set<EntityId>>}
 * @private
 */
const scopeHandlers = {
    'inventory': _handleInventory,
    'location': _handleLocation,
    'equipment': _handleEquipment,
    'location_items': _handleLocationItems,
    'location_non_items': _handleLocationNonItems,
    'nearby': _handleNearby,
    'nearby_including_blockers': _handleNearbyIncludingBlockers,
    // =========================================
    // Add future scopes here, e.g., 'self', 'target'
};

// --- Public Aggregator Function ---

/**
 * Aggregates unique entity IDs from one or more specified scopes.
 * Handles unknown scopes and errors within individual scope handlers gracefully.
 * Known scopes include 'inventory', 'location', 'equipment', 'location_items',
 * 'location_non_items', 'nearby', and 'nearby_including_blockers'. // <-- UPDATED LINE
 *
 * @param {string | string[]} scopes - A single scope name or an array of scope names.
 * @param {ActionContext} context - The action context containing player, location, entityManager, etc.
 * @returns {Set<EntityId>} A single set containing unique entity IDs gathered from all valid requested scopes.
 */
function getEntityIdsForScopes(scopes, context) {
    // Ensure scopes is always an array
    const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
    const aggregatedIds = new Set();

    // Basic context validation - essential components must exist
    if (!context || !context.entityManager) {
        console.error("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context});
        return aggregatedIds; // Return empty set if core context is missing
    }
    // Also check playerEntity and currentLocation if they are generally expected?
    // Maybe not, as some scopes might not need them (e.g., a 'global_npcs' scope)
    // Individual handlers are responsible for checking the specific context parts they need.

    for (const scopeName of requestedScopes) {
        const handler = scopeHandlers[scopeName];

        if (!handler) {
            console.warn(`getEntityIdsForScopes: Unknown scope requested: '${scopeName}'. Skipping.`);
            continue; // Skip unknown scopes and proceed to the next
        }

        try {
            // Execute the handler for the current scope
            const scopeIds = handler(context);
            // Add all IDs returned by the handler to the main aggregated set.
            // Set iteration handles uniqueness automatically.
            scopeIds.forEach(id => aggregatedIds.add(id));
        } catch (error) {
            // Log the error including the specific scope that failed
            console.error(`getEntityIdsForScopes: Error executing handler for scope '${scopeName}':`, error);
            // Continue processing other scopes even if one fails, ensuring partial results can be returned
        }
    }

    return aggregatedIds;
}

// --- Exports ---
export {getEntityIdsForScopes};