// src/services/entityScopeService.js

import {InventoryComponent} from '../components/inventoryComponent.js'; // Adjust path as needed
import {EquipmentComponent} from '../components/equipmentComponent.js'; // Adjust path as needed
import {ItemComponent} from '../components/itemComponent.js'; // Adjust path as needed
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Required for nearby_including_blockers
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js'; // Required for nearby_including_blockers
import {PositionComponent} from '../components/positionComponent.js'; // Used by _handleLocation via SpatialIndex

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
        console.error("entityScopeService._handleLocation: entityManager is missing in context. Cannot perform location lookup.");
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
    if (!playerEntity.hasComponent(EquipmentComponent)) {
        console.warn(`entityScopeService._handleEquipment: Scope 'equipment' requested but player ${playerEntity.id} lacks EquipmentComponent.`);
        return new Set();
    }
    const equipment = playerEntity.getComponent(EquipmentComponent);
    const equippedIds = new Set();
    Object.values(equipment.getAllEquipped()).forEach(id => {
        if (id) {
            equippedIds.add(id);
        }
    });
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
        console.error("entityScopeService._handleLocationItems: entityManager is missing in context.");
        return new Set();
    }
    const locationIds = _handleLocation(context);
    const itemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        if (entity && entity.hasComponent(ItemComponent)) {
            itemIds.add(id);
        } else if (!entity) {
            console.warn(`entityScopeService._handleLocationItems: Entity ID ${id} from location scope not found in entityManager when checking for ItemComponent.`);
        }
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
        console.error("entityScopeService._handleLocationNonItems: entityManager is missing in context.");
        return new Set();
    }
    const locationIds = _handleLocation(context);
    const nonItemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        if (entity && !entity.hasComponent(ItemComponent)) {
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
    const aggregatedIds = new Set();
    const nearbyIds = _handleNearby(context);
    nearbyIds.forEach(id => aggregatedIds.add(id));

    const {entityManager, currentLocation} = context;
    if (!entityManager) {
        console.warn("entityScopeService._handleNearbyIncludingBlockers: entityManager missing in context. Cannot check for blockers.");
        return aggregatedIds;
    }
    if (!currentLocation) {
        console.warn("entityScopeService._handleNearbyIncludingBlockers: currentLocation missing in context. Cannot check for blockers.");
        return aggregatedIds;
    }
    if (!currentLocation.hasComponent(ConnectionsComponent)) {
        return aggregatedIds;
    }

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    const connections = connectionsComp.getAllConnections();

    for (const connection of connections) {
        const passageEntity = entityManager.getEntityInstance(connection.connectionEntityId);
        if (!passageEntity) {
            console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity instance not found for ID '${connection.connectionEntityId}'. Skipping blocker check.`);
            continue;
        }
        if (!passageEntity.hasComponent(PassageDetailsComponent)) {
            console.warn(`entityScopeService._handleNearbyIncludingBlockers: Passage entity '${passageEntity.id}' lacks PassageDetailsComponent. Cannot check for blocker.`);
            continue;
        }
        const passageDetailsComp = passageEntity.getComponent(PassageDetailsComponent);
        const blockerEntityId = passageDetailsComp.getBlockerId();

        if (typeof blockerEntityId === 'string' && blockerEntityId.trim() !== '') {
            aggregatedIds.add(blockerEntityId);
            if (!entityManager.getEntityInstance(blockerEntityId)) {
                console.warn(`entityScopeService._handleNearbyIncludingBlockers: Added blocker ID '${blockerEntityId}' but instance not found.`);
            }
        }
    }
    return aggregatedIds;
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
        console.error("getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.", {context});
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