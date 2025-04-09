// src/services/targetResolutionService.js

// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
import {TARGET_MESSAGES} from '../utils/messages.js';
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
// Import other components if needed for specific scopes (e.g., PositionComponent)

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/baseComponent.js').ComponentConstructor} ComponentConstructor */

/**
 * Configuration options for resolving a target entity.
 *
 * @typedef {object} TargetResolverConfig
 * @property {string | string[]} scope - Defines where to search.
 * Valid scopes: 'inventory', 'location', 'equipment', 'location_items',
 * 'location_non_items', 'nearby' (inventory + location). Can be a single string
 * or an array of strings.
 * @property {ComponentConstructor[]} requiredComponents - An array of Component classes
 * the target must possess (e.g., [ItemComponent, EquippableComponent]).
 * `NameComponent` is always implicitly required for matching.
 * @property {string} actionVerb - The verb used in feedback messages (e.g., 'attack', 'equip', 'take').
 * @property {string} targetName - The name string provided by the user to match against.
 * @property {(entity: Entity) => boolean} [customFilter] - An optional function for additional filtering logic.
 * @property {string} [notFoundMessageKey] - Optional override for the TARGET_MESSAGES key used on NOT_FOUND.
 * Defaults based on scope (e.g., 'NOT_FOUND_INVENTORY', 'NOT_FOUND_LOCATION').
 * @property {string} [emptyScopeMessage] - Optional override for the message dispatched when the initial scope yields no suitable entities.
 * Defaults to a generic message.
 */

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * It encapsulates the common logic of building a search scope, filtering entities,
 * calling `findTarget`, and handling the results (dispatching standard UI messages on failure).
 *
 * @param {ActionContext} context - The action context providing game state access.
 * @param {TargetResolverConfig} config - Configuration for the target resolution process.
 * @returns {Entity | null} The uniquely found Entity instance if successful, otherwise null.
 * Dispatches UI messages via `context.dispatch` on failure (NOT_FOUND, AMBIGUOUS, empty scope).
 */
export function resolveTargetEntity(context, config) {
    const {playerEntity, currentLocation, entityManager, dispatch} = context;

    // --- 1. Validate Inputs ---
    if (!context || !config || !config.scope || !config.requiredComponents || !config.actionVerb || !config.targetName) {
        console.error("resolveTargetEntity: Invalid context or configuration provided.", {context, config});
        // Dispatch generic internal error? Maybe too noisy. Log is important.
        return null;
    }
    if (typeof config.targetName !== 'string' || config.targetName.trim() === '') {
        // If targetName is empty, the caller should usually handle it (e.g., PROMPT_WHAT)
        // But we prevent findTarget from running with empty string.
        console.warn("resolveTargetEntity: Received empty targetName. Resolution cannot proceed.");
        // Optionally dispatch a generic "what?" message? Caller usually does this.
        // const promptMsg = TARGET_MESSAGES.PROMPT_WHAT(config.actionVerb);
        // dispatch('ui:message_display', { text: promptMsg, type: 'error' });
        return null;
    }

    // --- 2. Normalize Scope and Prepare Components ---
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    // Ensure NameComponent is always required for findTarget
    const requiredComponents = [NameComponent, ...config.requiredComponents.filter(c => c !== NameComponent)];

    // --- 3. Build Searchable Entities List ---
    const entityIdSet = new Set(); // Use Set to avoid duplicates across scopes

    for (const scope of scopes) {
        try {
            switch (scope) {
                case 'inventory': {
                    const inventory = playerEntity.getComponent(InventoryComponent);
                    if (inventory) {
                        inventory.getItems().forEach(id => entityIdSet.add(id));
                    } else {
                        console.warn(`resolveTargetEntity: Scope 'inventory' requested but player ${playerEntity.id} lacks InventoryComponent.`);
                    }
                    break;
                }
                case 'location':
                case 'location_items':
                case 'location_non_items': {
                    if (!currentLocation) {
                        console.warn(`resolveTargetEntity: Scope '${scope}' requested but currentLocation is null.`);
                        continue; // Skip this scope if location is invalid
                    }
                    const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                    if (idsInLoc) {
                        idsInLoc.forEach(id => {
                            if (id !== playerEntity.id) { // Always exclude player
                                const entity = entityManager.getEntityInstance(id);
                                if (!entity) {
                                    console.warn(`resolveTargetEntity: Entity ID ${id} listed in location ${currentLocation.id} but instance not found.`);
                                    return;
                                }
                                if (scope === 'location_items' && !entity.hasComponent(ItemComponent)) return;
                                if (scope === 'location_non_items' && entity.hasComponent(ItemComponent)) return;
                                entityIdSet.add(id);
                            }
                        });
                    }
                    break;
                }
                case 'equipment': {
                    const equipment = playerEntity.getComponent(EquipmentComponent);
                    if (equipment) {
                        Object.values(equipment.getAllEquipped()).forEach(id => {
                            if (id) entityIdSet.add(id);
                        });
                    } else {
                        console.warn(`resolveTargetEntity: Scope 'equipment' requested but player ${playerEntity.id} lacks EquipmentComponent.`);
                    }
                    break;
                }
                case 'nearby': // Convenience scope: combines inventory and location
                    // Add inventory
                    const inventory = playerEntity.getComponent(InventoryComponent);
                    if (inventory) inventory.getItems().forEach(id => entityIdSet.add(id));
                    // Add location (all non-player)
                    if (currentLocation) {
                        const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                        if (idsInLoc) idsInLoc.forEach(id => {
                            if (id !== playerEntity.id) entityIdSet.add(id);
                        });
                    }
                    break;
                default:
                    console.warn(`resolveTargetEntity: Unsupported scope specified: '${scope}'. Skipping.`);
            }
        } catch (error) {
            console.error(`resolveTargetEntity: Error processing scope '${scope}':`, error);
            // Continue to next scope if possible
        }
    }

    // --- 4. Filter Entities ---
    const initialEntities = Array.from(entityIdSet)
        .map(id => entityManager.getEntityInstance(id))
        .filter(entity => entity); // Filter out any instances that couldn't be retrieved

    const filteredEntities = initialEntities.filter(entity => {
        // Check required components
        const hasAllRequired = requiredComponents.every(ComponentClass => entity.hasComponent(ComponentClass));
        if (!hasAllRequired) return false;

        // Check custom filter if provided
        if (config.customFilter) {
            try {
                return config.customFilter(entity);
            } catch (filterError) {
                console.error(`resolveTargetEntity: Error executing customFilter for entity ${entity.id}:`, filterError);
                return false; // Exclude entity if filter throws error
            }
        }

        return true; // Passes all filters
    });

    // --- 5. Handle Empty Filtered Scope ---
    if (filteredEntities.length === 0) {
        const emptyMsg = config.emptyScopeMessage || `You don't see anything suitable to ${config.actionVerb} ${scopes.includes('inventory') || scopes.includes('equipment') ? 'on you' : 'here'}.`;
        // Refine message based on scope?
        // Example: If only 'inventory' scope, maybe "You don't have anything suitable..."
        // For now, keep it relatively simple.
        dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        return null;
    }

    // --- 6. Call findTarget ---
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 7. Handle findTarget Results ---
    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Determine appropriate message key
            let messageKey = config.notFoundMessageKey;
            if (!messageKey) {
                // --- MODIFICATION START ---
                // Prioritize action-specific keys first
                if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                // Then fall back to scope-based keys
                else if (scopes.includes('inventory')) messageKey = 'NOT_FOUND_INVENTORY';
                else if (scopes.includes('equipment')) messageKey = 'NOT_FOUND_EQUIPPED';
                // Final fallback
                else messageKey = 'NOT_FOUND_LOCATION';
                // --- MODIFICATION END ---
            }

            const messageGenerator = TARGET_MESSAGES[messageKey];
            const errorMsg = messageGenerator ? messageGenerator(config.targetName) : `Cannot find '${config.targetName}'.`; // Fallback message
            if (!messageGenerator) console.warn(`resolveTargetEntity: Invalid notFoundMessageKey: ${messageKey}`);

            dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            return null;
        }
        case 'FOUND_AMBIGUOUS': {
            // Use targetName as the "type name" for the prompt, as it's what the user typed.
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, findResult.matches);
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return null;
        }
        case 'FOUND_UNIQUE':
            return findResult.matches[0]; // Success! Return the entity.
        default: {
            // Should not happen with current findTarget implementation
            console.error("resolveTargetEntity: Unexpected status from findTarget:", findResult.status);
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected target resolution status)";
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return null;
        }
    }
}