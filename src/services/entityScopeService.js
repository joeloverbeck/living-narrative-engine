import {InventoryComponent} from '../components/inventoryComponent.js'; // Adjust path as needed
import {EquipmentComponent} from '../components/equipmentComponent.js'; // Adjust path as needed
import {ItemComponent} from '../components/itemComponent.js'; // Adjust path as needed

// --- JSDoc Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entity.js').EntityId} EntityId */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

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

    const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);

    if (idsInLoc) {
        for (const id of idsInLoc) {
            const entity = entityManager.getEntityInstance(id);
            if (!entity) {
                console.warn(`entityScopeService._handleLocation: Entity ID ${id} listed in location ${currentLocation.id} but instance not found (dangling ID). Skipping.`);
                continue; // Skip dangling IDs
            }

            // Exclude the player entity instance directly if playerEntity context is provided
            if (playerEntity && entity === playerEntity) {
                continue;
            }

            results.add(id);
        }
    }
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
 * Relies on _handleLocation for initial gathering, player exclusion, and dangling ID checks.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of item entity IDs in the location.
 * @private
 */
function _handleLocationItems(context) {
    const {entityManager} = context;
    // Get IDs from location, already excluding player (if context available) and handling dangling IDs
    const locationIds = _handleLocation(context);
    const itemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        // Check if the entity exists (should due to _handleLocation check) and has ItemComponent
        if (entity && entity.hasComponent(ItemComponent)) {
            itemIds.add(id);
        }
    }
    return itemIds;
}

/**
 * Retrieves entity IDs from the current location that DO NOT have an ItemComponent.
 * Relies on _handleLocation for initial gathering, player exclusion, and dangling ID checks.
 * @param {ActionContext} context - The action context.
 * @returns {Set<EntityId>} A set of non-item entity IDs in the location.
 * @private
 */
function _handleLocationNonItems(context) {
    const {entityManager} = context;
    // Get IDs from location, already excluding player (if context available) and handling dangling IDs
    const locationIds = _handleLocation(context);
    const nonItemIds = new Set();

    for (const id of locationIds) {
        const entity = entityManager.getEntityInstance(id);
        // Check if the entity exists (should due to _handleLocation check) and does NOT have ItemComponent
        if (entity && !entity.hasComponent(ItemComponent)) {
            nonItemIds.add(id);
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
    // _handleLocation already excludes player (if context provided) and checks for dangling IDs
    const locationIds = _handleLocation(context);
    // Combine sets using spread syntax into a new Set constructor - handles uniqueness automatically
    return new Set([...inventoryIds, ...locationIds]);
}


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
    // Add future scopes here, e.g., 'self', 'target'
};

// --- Public Aggregator Function ---

/**
 * Aggregates unique entity IDs from one or more specified scopes.
 * Handles unknown scopes and errors within individual scope handlers gracefully.
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
            // Set.add() handles uniqueness automatically.
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